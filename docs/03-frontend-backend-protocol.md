# 前后端联调数据协议

OpenAPI schema 快照由 `npm run export:openapi` 生成到 `docs/openapi.json`。后端 endpoint、schema 或权限语义变化时，应同步更新该快照、`docs/02-api-contract.md`、`src/services/contracts.ts` 和对应 smoke tests。

## 字段命名

- 后端 API 固定使用 `snake_case`。
- 前端 React 组件继续使用既有 `camelCase`/业务中文字段结构。
- `src/services/contracts.ts` 是后端响应的 TypeScript source of truth。
- `src/services/api.ts` 负责将后端结构转换为前端组件结构。

## 当前映射

CRF 字段字典按 Study 绑定。`LGL-1111` 与 `RWD-NMO-2026` 使用 `resource/sle-crf-v0.1.schema.json`；`LZXK-01` 使用 `backend/seed.py` 中定义的独立 15 字段肺癌耐药 CRF V1.0。前端 `src/data/crfTemplate.ts` 保留 SLE schema 基础分组，临床录入页按患者 `studyId` 切换肺癌 CRF 分组。正式 PostgreSQL runtime 使用原生 `JSONB` 保存 CRF schema、患者 CRF payload、随访 payload、配置和导出 scope；显式 SQLite 测试库可将同一 payload 写入 JSONB BLOB。API 层解码后仍按 JSON object 返回给前端。

所有 RWD EDC 主链路数据使用 `study_id` 做隔离。前端会在登录后保存 `study_scope` 与当前 `activeStudyId`；API 请求自动携带 HMAC 签名 Bearer token，并在进入业务模块时走 `/studies/{study_id}/...` 路径。登录态启动时会调用 `/auth/me` 校验，token 缺失、过期或无效时回到登录页。

Study Workspace 是唯一业务租户边界。Study 入口先认证账号，账号只授权一个 Study 时直接进入该 Study Workspace，授权多个 Study 时认证后再选择工作区。`LZ_ADMIN`、`LZ_CRC`、`LZ_DATA_MANAGER` 登录后默认进入 LZ 全局态，不自动切换到单个 Study。LZ 平台角色可在 LZ 全局态进入首页工作台、患者队列管理、样本及检测、临床数据采集、患者旅程、导出/报表和 Study 系统管理，并查看或管理授权范围内所有 Study 的患者、样本、检测、CRF、访视、随访和导出信息。全局首页工作台调用 `/analytics/summary`，后端按当前用户 Study scope 聚合；跨 Study 业务列表读取必须按 Study 列表逐个调用 `/studies/{study_id}/...` 后汇总，不能调用无 Study 上下文的业务 list 接口；业务写入仍必须带明确 `study_id`。GA 版本先使用应用层过滤，PostgreSQL RLS 作为 GA 后强化项推进。

Study 配置总表由 `/study-configurations` 和 `/studies/{study_id}/configuration` 读取，字段为 `study_id`、`disease_area`、`active_crf_version_id`、`visit_plan`、`consent_template`、`testing_profile` 和 `follow_up_schema`。`PUT /studies/{study_id}/configuration` 按路径中的单个 Study 更新配置；系统管理页当前只发送 `consent_template`，后端按 Study scope 和 `studies:write` 校验，Study Workspace 内不能配置其他 Study 的知情同意。知情同意页必须按当前患者或当前 Study 的 `study_configurations` 解析知情内容、模板编号和纸质预览：优先使用 `consent_template`，并结合 `disease_area`、患者 `disease_type` 和配置行缺失时的 Study 主数据 `indication/name` 判断肺癌、免疫神经等模板，不允许只按固定 Study ID 或固定 PDF 展示。后端 seed 会把 `LZXK-01` 绑定到肺癌 CRF、肺癌知情同意模板和 `TP-LUNG-RESIST-OMICS`；免疫病 Study 绑定免疫病 CRF、免疫病知情同意模板和 `TP-SLE-OMICS`。新建患者时如当前 Study 没有 published CRF，API 直接失败，前端应提示配置未发布。

字段级权限由后端 `field_permissions` 统一执行。前端不自行判断姓名、住院号、身份证号、手机号、地址等直接标识符是否需要脱敏，而是展示 API 返回值；导出文件也由后端按同一规则生成。当前默认规则让 `LZ_DATA_MANAGER`、`STUDY_DATA_MANAGER` 和 `LZ_AUDITOR` 在页面看到脱敏值，在 CSV 导出中移除直接标识符。

文件上传由 `/files` 写入存储适配层，响应包含 `storage_backend`、`storage_path`、`scan_status`、`scan_message`、`archive_status`、`archived_at` 和 `retention_until`。本地开发默认 `local`；生产式 smoke 可用 `LINZIGHT_STORAGE_BACKEND=object` 返回 `object://bucket/prefix/...` URI。文件下载统一走 `/files/{file_id}/download`，后端会校验 Study 权限、角色权限、病毒扫描状态和归档状态。

访视计划由 `study_visit_plans` 配置，不写入 CRF 字段表。`visits` 是患者实际访视记录，通过 `visit_plan_id` 关联配置；新建患者时后端只创建患者主档和待签署知情同意，不自动生成访视、初始 CRF 草稿或 Patient Journey 事件。

随访记录由 `follow_up_records` 保存，不写入 CRF 版本配置表。它隶属于患者信息，绑定 `study_id + patient_id`，并可选通过 `visit_id` 关联某次随访访视，用于记录随访方式、随访人、生存/疾病状态、疗效、转移、不良事件、生活质量和失访原因。

正式 GA 数据字段以 PostgreSQL 为准：患者基本信息使用 `patient_number / patient_name / study_id / hospital_no / sex / age / disease_type / note`，其中 `patient_number` 由后端自动生成唯一编号，从 `H00010` 到 `H99999`，前端创建和编辑时均不得手工修改；患者 CRF 使用每个 Study 的 `study_crf_versions.schema_json` 与 `crf_entries.payload`，默认 section 覆盖病程记录、住院、治疗方案、检查，JSON 格式按 Study CRF 方案配置；患者随访使用 `study_configurations.follow_up_schema` 与 `follow_up_records.payload`，默认覆盖访视、日期、类型、疗效评估和记录，JSON 格式按 Study 随访方案配置；样本信息使用 `patient_id / id / sample_type / collected_at / storage / initial_quantity / remaining_quantity / quantity_unit / note / linked_omics`，其中 `id` 由后端自动生成且不可修改，规则为 `S` + 两位 `Study Code` + 患者编号后三位数字 + 该患者样本序号 `01`-`99`，例如 Study Code `05`、患者编号 `H00080` 的第一个样本为 `S0508001`；`remaining_quantity` 由检测送样量和返还量自动计算；多组学检测使用 `sample_id / sample_ids / sample_usage / testing_project_id / assay / vendor / platform / status / sent_at / completed_at / qc / result_file_id`。疾病类型、样本类型、检测类型和单位类型下拉框由 LZ 全局配置维护，前端通过 `/global-configuration` 从 `global_configurations` 表读取；API 按字符串接收这些字段；一个患者可有多个样本，一个检测可人工选择一个或多个样本。

患者姓名隐私展示由后端字段权限控制。API 返回 `patient_name_initials` 供默认显示；完整 `patient_name` 只对 `LZ_ADMIN`、`STUDY_CONFIG_ADMIN`、`STUDY_CRC` 和 `LZ_CRC` 返回。前端“授权查看”只能切换后端已授权返回的完整姓名，不能在前端拼接、还原或绕过后端权限。

临床数据采集页的“多次随访”表格读取计划/实际 `visits`，同时将 `follow_up_records` 映射为可回显的随访行。新增或编辑随访行时，前端通过 `saveVisitFollowUpRecord()` 写入 `/studies/{study_id}/follow-up-records`；计划访视配置仍由 `study_visit_plans` 管理。

患者队列新建或编辑患者成功后，前端必须把保存后的患者设置为当前患者上下文，并同步给知情同意、临床数据采集和患者旅程等页面。后端 `POST /studies/{study_id}/patients` 创建患者主档，并创建一条 `status=待签署` 的 consent 记录；知情同意页面优先选择当前患者对应的 consent，不允许默认回退到列表第一名患者。新患者没有真实 CRF、访视、随访、样本或检测记录前，Patient Journey 必须显示空事件状态。
患者编辑保存时，前端必须把当前表单中的 `study_id` 一并发送到 `PUT /patients/{patient_id}`。只有 `LZ_ADMIN` 可以跨 Study 更正患者所属 Study；后端会级联更新该患者的知情同意、访视、CRF、随访、样本、检测、文件、Query 和质控记录的 `study_id`，防止列表按 Study 过滤后主档与业务记录断裂。
样本编辑保存时，前端也必须把表单中的 `study_id` 一并发送到 `PUT /samples/{sample_id}`。后端以目标患者的 Study 为准重算样本 `study_id`，但样本编号 `id` 不允许修改；若该样本已经被任何检测记录引用，则禁止直接更换患者，要求先处理关联检测记录，避免多样本检测中的 `sample_ids` 与患者/Study 不一致。

系统管理页的账号创建通过 `POST /users` 执行。前端传入 `username`、`display_name`、`role`、`password`、`study_id` 和 `member_status`；后端创建用户前会执行基础密码策略，密码使用 PBKDF2-HMAC-SHA256 加盐哈希保存。如果是研究级角色，会同步创建当前 Study 的 `study_members` 记录并返回 `study_memberships`。LZ 全局态由 `LZ_ADMIN` 创建 `LZ_ADMIN`、`LZ_CRC`、`LZ_DATA_MANAGER` 平台账户时，非 Admin 平台角色随后调用 `PATCH /users/{user_id}/study-scope` 写入授权 Study 范围。Create Account 按钮必须使用这些接口，不应只在前端插入本地账号。

系统管理页的 Study 成员列表通过 `/studies/{study_id}/members` 读取，Study PI、Study CRC、Study Admin 和 Study DM 都默认可只读查看本 Study 成员和角色列表；已有成员启用/停用研究级角色通过同一路径 `POST` upsert，仍只允许 Study Admin 或 LZ Admin 写入。平台级 `LZ_ADMIN` 启用/禁用账号时调用 `PATCH /users/{user_id}/status`，该接口会影响登录生命周期。账号删除使用 `DELETE /users/{user_id}` 软删除/归档：前端显示 `Deleted`，后端保留 `users` 行和历史审计链，仅将账号状态置为 `deleted` 并禁用 Study membership。后端禁止当前用户自删，也禁止删除最后一个 active `LZ_ADMIN`。这些响应必须包含 `username`、`display_name` 和 `last_login_at`，与列表接口一致，前端才能在保存后直接更新账号行。

LZ 全局态的 Study Registry 通过 `GET /studies` 读取 Study 主数据和生命周期状态。Registry 正式列为 `Study ID`、`Study Code`、`Study 名称`、`leading_pi_info`、`status` 和 `system_admin`；`Study ID` 继续用于路由和权限隔离，`Study Code` 是后端规范化的 `01`-`99` 两位展示码。`LZ_ADMIN` 的 New Study、Terminate 和 Delete 操作分别调用 `POST /studies`、`PATCH /studies/{study_id}` 和 `DELETE /studies/{study_id}`；删除为软删除，返回状态为 `deleted` 的 Study 行。前端必须展示 `draft / active / terminated / deleted` 状态，并在 terminated/deleted 时把业务写入预期解释为后端拒绝。患者列表在跨 Study 视图中通过 `GET /studies` 关联展示对应 Study Code。

系统管理页的用户列表通过 `GET /users` 或 `GET /users?study_id=...` 补齐后端用户 ID、Study membership、`study_scope` 和 `last_login_at`。账号表正式列为姓名、账号邮箱、对应 StudyID、角色、Status、Last Login 和 Actions；Last Login 只显示后端返回值。同一个用户可以绑定多个 Study；单 Study 视角下 Study PI、Study CRC、Study Admin 和 Study DM 都应看到本 Study 成员列表与账户概览，写操作按钮再按角色禁用。平台态账号编辑面板按 Study 逐行调用 `/studies/{study_id}/members` upsert，每行独立选择 `STUDY_CONFIG_ADMIN`（Study Admin）、`STUDY_PI`、`STUDY_CRC` 或 `STUDY_DATA_MANAGER`（Study DM），并用 `/permissions/matrix` 的正式权限矩阵展示该 Study 角色对应权限。Study Workspace 内只能调整当前 Study 的 membership。Study 系统管理员用 `PATCH /users/{user_id}?study_id=...` 修改本 Study 成员基础资料；`Set Admin` 使用 `/studies/{study_id}/members` 将成员角色 upsert 为 `STUDY_CONFIG_ADMIN`，LZ 管理员会同步写入 Study 主数据 `system_admin`。平台级授权范围由 `LZ_ADMIN` 通过 `PATCH /users/{user_id}/study-scope` 写入 `global_role_study_scope`，前端的 Scope 操作只在 LZ 平台系统管理态对非 `LZ_ADMIN` 的 `LZ_*` 角色开放。`Deleted` 账号仍可在列表中留痕展示，但前端禁用编辑、密码、启停、Set Admin 和 Scope 操作。

多中心配置由 `/studies/{study_id}/sites` 和 `/studies/{study_id}/sites/{site_id}/users` 管理，所有 site 与 site-user assignment 都带 `study_id`，后端按当前用户 Study scope 校验。Query 管理的 list 读取走 `/studies/{study_id}/queries`；创建、指派、回复和关闭仍绑定 `study_id / patient_id / visit_id / form_id / field_name`。

进入单个 Study Workspace 后，系统管理页的 CRF 字段配置通过 `/studies/{study_id}/crf-fields` 读取当前 Study CRF version 的字段列表。新增字段调用 `POST /studies/{study_id}/crf-fields`，编辑字段调用 `PUT /studies/{study_id}/crf-fields/{field_id}`。前端可编辑字段名称、类型、模块、状态、下拉选项、必填状态、校验规则和条件逻辑；后端将字段写回 `study_crf_versions.schema_json.sections[].fields[]`。

进入单个 Study Workspace 后，系统管理页的 CRF 版本面板通过 `/studies/{study_id}/crf-versions` 读取版本列表。`New Draft` 会从当前字段表生成 schema 并调用 `POST /studies/{study_id}/crf-versions` 创建草稿。正式发布优先走审批流：`Request Approval` 调用 `POST /studies/{study_id}/crf-migrations`，`Approve` 调用 `/approve`，`Apply` 或 `Apply Approved` 调用 `/apply`，由后端发布目标 draft 并退休该 Study 的旧 published 版本。
`Preview Migration` 调用 `POST /studies/{study_id}/crf-versions/migration-preview`，用当前字段表生成目标 schema，并显示新增、变更、移除和未变化字段数量，同时列出字段级新增、变更项和移除明细。该接口只读，不改变版本状态。
系统管理页同时读取 `/studies/{study_id}/crf-migrations` 展示最近的 migration approval request 和 execution log 数量；所有提交、批准和应用操作均以 `study_id` 为路径参数。后端禁止 request 发起人批准或应用自己的 CRF migration，前端用通用状态消息提示权限或后端拒绝。
系统管理页的 Approval Center 在 Study Workspace 内读取 `/studies/{study_id}/approvals`，展示导出、CRF 发布和 eConsent 撤回/重签审批的 `draft / submitted / approved / rejected / cancelled / completed` 状态、动作记录数量和评论，并在全局视角保留 `Study ID`。Approve/Reject 按钮分别调用 `/approvals/{id}/approve` 与 `/approvals/{id}/reject`；后端禁止提交人自批，并将动作写入 `approval_actions`。知情同意页的撤回/重签按钮分别调用 `/consents/{consent_id}/withdrawal-request` 和 `/consents/{consent_id}/resign-request`；请求创建后 consent 进入 `撤回审批中` 或 `重签审批中`，审批 complete 后才进入 `已撤回` 或 `已重签`。脱敏审批作为内部治理能力保留，不作为当前客户演示发布范围。

字段级 Query 由 `/queries` 创建，前端必须传入 `study_id`、`patient_id`、`form_id` 和 CRF 字段名；如果关联访视，则 `visit_id` 必须属于同一患者和 Study。后端按当前发布 CRF 校验字段名，确保肺癌 Study 不再出现 SLE 字段 Query。`GET /studies/{study_id}/queries` 支持按 `patient_id`、`status`、`field_name` 和 `assigned_to` 筛选；`PUT /queries/{query_id}` 支持 `open / answered / closed / cancelled`，关闭后重开为 `open` 会清空 `closed_at`。

访视窗口预警由 `/studies/{study_id}/quality/run` 生成。后端以患者最早实际访视作为 baseline，根据 `study_visit_plans.day_offset` 与 `window_before_days/window_after_days` 比对 `visits.visit_date`；超窗问题写入 `data_quality_issues`，`source_table=visits`、`field_name=visit_date`。

GA 版本已移除 standalone audit log 模块；前端不再调用 `/audit-logs` 或展示 Audit Diff 面板。后端仍必须写 `operation_logs` 作为正式审计底座，覆盖患者、样本、检测、CRF、随访、知情、文件、导出、Query、质控、Study/用户/成员和审批相关写操作。

测试 seed 是后端受控 fixture，不属于正式 UI/API 工作流。正式 PostgreSQL runtime 默认关闭 `/seed`，防止 GA 数据库被未授权清空或重建；只有隔离 SQLite smoke 或显式开启并经 LZ Admin 授权时可执行。

| 后端字段 | 前端字段 | 说明 |
| --- | --- | --- |
| `study_id` | `studyId` | RWD EDC Study 隔离字段 |
| `patient_number` | `patientNumber` | 后端自动生成的业务患者编号，范围 `H00010`-`H99999`；后端 `id` 仍为系统主键 |
| `patient_name` | `patientName` | 患者姓名；未授权角色返回拼音首字母 |
| `patient_name_initials` | `patientNameInitials` | 患者姓名拼音首字母，用于默认显示 |
| `visit_plan_id` | `visitPlanId` | 患者访视关联的 Study 访视计划 |
| `visit_plan_code` | `visitPlanCode` | `V1`、`V2`、`V3` 等访视计划编码 |
| `day_offset` / `plan_day_offset` | `dayOffset` / `planDayOffset` | 相对基线天数 |
| `window_before_days` / `window_after_days` | `windowBeforeDays` / `windowAfterDays` | 访视窗口 |
| `follow_up_date` | `followUpDate` | 随访日期 |
| `follow_up_method` | `followUpMethod` | 门诊、电话、线上、家访或其他 |
| `followed_by` | `followedBy` | 随访人 |
| `survival_status` | `survivalStatus` | 生存状态 |
| `disease_status` | `diseaseStatus` | 无病、复发、转移、稳定、进展等疾病状态 |
| `symptoms_signs` | `symptomsSigns` | 症状与体征 |
| `imaging_lab_summary` | `imagingLabSummary` | 影像/检验关键结论 |
| `efficacy_assessment` | `efficacyAssessment` | 缓解、稳定、进展或未评估 |
| `record_note` | `recordNote` | 随访记录正文或补充说明 |
| `payload` | `payload` | 患者 CRF 或随访 JSON payload，按 Study schema 配置 |
| `metastasis_status` | `metastasisStatus` | 转移情况 |
| `adverse_events` | `adverseEvents` | 不良事件 |
| `quality_of_life` | `qualityOfLife` | 生活质量评估 |
| `lost_to_follow_up_reason` | `lostToFollowUpReason` | 失访原因 |
| `recorded_at` | `recordedAt` | 记录时间 |
| `hospital_no` | `hospitalNo` | 患者住院号 |
| `disease_type` | `diseaseType` | `NPSLE`、`Non-NPSLE`、`MS`、`NMOSD`、`HC`、`NSCLC`、`LUAD`、`LUSC`、`EGFR-TKI耐药`、`ALK耐药` |
| `clinical_data` | `clinicalData` | 当前 Study CRF 宽表字段，保留中文字段名；LZXK-01 不混入 SLE 字段 |
| `clinical_data_version` | `clinicalDataVersion` | CRF payload 版本，SLE 为 `V0.1`，LZXK-01 为 `V1.0` |
| `clinical_data_format` | `clinicalDataFormat` | 后端存储格式，优先为 `jsonb` |
| `created_at` | `createdAt` | 患者主档创建时间；患者队列默认按该字段倒序展示最新建立患者 |
| `updated_at` | `lastUpdated` | 患者主档更新时间；用于展示或兼容回退，不作为默认队列排序 |
| `sample_type` | `sampleType` | 样本类型 |
| `collected_at` | `collectedAt` | 样本采集日期 |
| `storage` | `storage` | 样本保存地址 |
| `initial_quantity` | `initialQuantity` | 样本初始量，字符串保存以支持混合单位 |
| `remaining_quantity` | `remainingQuantity` | 样本剩余量，由后端自动计算：初始量减所有检测送样量，再加检测返还量；前端只读展示 |
| `quantity_unit` | `quantityUnit` | 样本数量单位；由 `Study 系统管理` 的全局单位类型字典单选，可为空 |
| `note` | `note` | 患者或样本注释，按数据域区分 |
| `linked_omics` | `linkedOmics` | 样本关联检测项目 |
| `testing_project_id` | `testingProjectId` | 样本检测项目编号，不等同于 RWD EDC Study |
| `sample_id` | `sampleId` | 组学检测关联样本 |
| `sample_ids` | `sampleIds` | 组学检测人工选择的一个或多个样本；`sample_id` 保留为主样本 |
| `sample_usage` | `sampleUsage` | 每个样本在检测中的送样量 `usedQuantity`、返还量 `returnedQuantity`、单位和用途 |
| `run_id` | `runId` | 检测批次号 |
| `vendor` | `vendor` | 多组学检测供应商 |
| `qc` | `qc` | 检测 QC 状态 |
| `result_file_id` | `resultFileId` | 组学结果文件，对应 `uploaded_files.id` |
| `sent_at` | `sentAt` | 送检日期 |
| `completed_at` | `completedAt` | 完成日期 |
| CRF field `id` | `id` | 系统管理字段表中的 Field ID |
| CRF field `type` | `type` | `Text`、`Number`、`Dropdown` 或 `Boolean` |
| CRF field `module` | `module` | CRF section title |
| CRF field `status` | `status` | `启用`、`草稿` 或 `停用` |
| CRF field `options` | `options` | 下拉字段选项列表，非下拉字段可为空数组 |
| CRF field `required` | `required` | 是否必填 |
| CRF field `validationRule` | `validation_rule` | 文本化校验规则，例如 `integer >= 1` |
| CRF field `conditionalLogic` | `conditional_logic` | 文本化条件逻辑，例如 `驱动基因突变 is not empty` |

CRF 模块响应中的 `payload_version` 与 `payload_format` 不直接渲染为录入字段，但用于校验 `payload` 与当前 CRF schema 的版本一致性。正式 PostgreSQL 中 `clinical_data_json`、`clinical_data_jsonb`、`payload_json` 和 `payload_jsonb` 均为原生 `JSONB`；前端不直接依赖这些底层列。

CRF 录入响应还包含 `crf_version_id` 和 `form_id`。已录入数据必须保留原 `crf_version_id`；已发布 CRF 修改应生成新的 `study_crf_versions` 记录。

## 前端 API 规则

前端依次请求：

1. `VITE_API_BASE_URL`
2. `http://127.0.0.1:8000`
3. `http://127.0.0.1:8001`

内部试点以 PostgreSQL 后端返回为准；后端为空时页面应展示空状态。API 不可用时，页面只能作为静态/开发预览，不应作为正式数据状态判断。接口返回结构必须与 `src/services/contracts.ts` 一致。

测试 fixture 中的 `LZXK-01` 数据包含 20 名真实世界肺癌耐药研究患者、独立肺癌 CRF 字段、血液/组织/胸水样本，以及 `NGS panel`、`ctDNA`、`病理复核` 检测项目；正式空库不会自动加载这些数据。

正式页面不再使用前端 `studyVisitPlans` fallback 冒充后端访视计划；访视计划、CRF 字段、权限矩阵和 Study 配置必须来自 PostgreSQL API。测试 fixture 仍可显式生成 `LGL-1111`、`RWD-NMO-2026` 和 `LZXK-01` 的独立 V1/V2/V3 配置。

System Management 的 `Operation Logs` 区块只消费 `/operation-logs` 或 `/studies/{study_id}/operation-logs`，用于筛选和导出后端留痕。进入单个 Study Workspace 或在系统管理中选中具体 Study 时，列表、统计和 CSV 都必须走对应 `/studies/{study_id}/operation-logs` 路由，并且前端二次过滤只能保留 `study_id === 当前 Study` 的记录，不能把 `study_id` 为空或其他 Study 的日志混入单 Study 视图。它不是已移除的 Audit Diff 模块，不允许前端本地生成或伪造日志；日志必须来自后端 `operation_logs` 表。

## 主链路聚合

Patient Journey 页面以患者为中心汇总；正式连接态必须从当前 Study 的 `patients`、`crf_entries`、`visits`、`follow_up_records`、`samples`、`omics_records` 和 `uploaded_files` 数据库记录生成。多轨临床事件轴、事件明细流和关键指标趋势都从这些表聚合；当前 Study 没有患者时必须显示空状态，不能回退到前端静态患者或样例旅程，也不能生成固定日期、诊断、住院、治疗或按序号递增/递减的假趋势。

```json
{
  "patient": {},
  "consents": [],
  "visits": [],
  "follow_up_records": [],
  "crf_entries": [],
  "samples": [],
  "omics_records": [],
  "files": [],
  "quality_issues": []
}
```

现有 `/patients/{patient_id}/panorama` 已返回 `patient`、`samples`、`omics_records`、`consents`、`visits`、`follow_up_records`。`/patients/{patient_id}/journey` 与 `panorama` 保持兼容。
Dashboard 的 `/analytics/summary` 和 `/studies/{study_id}/analytics/summary` 以 `patients`、`visits`、`crf_entries`、`consents`、`samples`、`omics_records`、`export_jobs` 聚合。前端“导出归档”读取 `export_count` / `ready_export_count`，不再复用组学归档数量。
样本及检测页面读取 `/studies/{study_id}/files` 后用 `omics_records.result_file_id -> uploaded_files.id` 关联展示结果文件。生产 UI 不得把 `result_file_id` 当作文件名；结果文件列至少显示 `original_filename`、`scan_status` 和 `archive_status`。上传组学结果时必须关联当前选中的检测记录 `omics_id`，不能默认挂到列表第一条样本或检测。

## 错误格式

后端错误统一使用 FastAPI 默认结构：

```json
{
  "detail": "record not found"
}
```

字段校验错误保持 Pydantic/FastAPI 默认 `detail[]`，前端表单阶段只展示首条错误。
