# RWD EDC v1 API 接口协议

## 约定

- Base URL：开发默认 `http://127.0.0.1:8000`
- 格式：JSON，字段使用 `snake_case`
- 认证：`POST /auth/login` 返回 HMAC 签名 Bearer token；后续可替换为托管 JWT/session 服务
- 文件上传：`multipart/form-data`，文件落本地 `uploads/`
- 患者中心主键：`patient_id`
- RWD EDC 研究隔离字段：`study_id`
- 样本检测项目字段：`testing_project_id`
- RWD EDC 不使用 `project_id`
- 显式测试 seed Study：`LGL-1111`、`RWD-NMO-2026`、`LZXK-01`；`LZXK-01` 为真实世界肺癌耐药研究，默认 20 名患者，使用独立 15 字段肺癌耐药 CRF。正式空库不会自动创建这些 Study。
- Study Workspace 是唯一业务租户边界。患者、CRF、样本、组学、随访、文件、Query、质控、导出和审批等业务 list 接口必须以 `/studies/{study_id}/...` 或显式 `study_id` 进入；未带 Study 上下文的旧式业务 list 请求返回 `400`。
- LZ 平台角色（`LZ_ADMIN`、`LZ_CRC`、`LZ_DATA_MANAGER`）可在 LZ 系统管理态查看和管理授权范围内所有 Study 的患者、样本、检测、CRF、访视、随访和导出信息。跨 Study 读取必须按 Study 列表逐个调用 `/studies/{study_id}/...` 后汇总，不能调用无 Study 上下文的业务 list 接口。GA 版本先用后端应用层过滤；PostgreSQL RLS 作为 GA 后强化项推进。
- OpenAPI schema 快照：运行 `npm run export:openapi` 生成 `docs/openapi.json`；API 变更时应同步 `src/services/contracts.ts`、本文档和 smoke tests。

## 主链路接口

| 链路 | 方法 | 路径 | 用途 |
| --- | --- | --- | --- |
| 登录 | `POST` | `/auth/login` | 用户登录，返回 token 与用户角色 |
| 登录 | `GET` | `/auth/me` | 当前用户信息 |
| 登录 | `POST` | `/auth/logout` | 返回登出状态 |
| 用户 | `GET` | `/users` | 查询当前授权范围内用户；`LZ_ADMIN` 可查全部，`study_id` 可限定单 Study |
| 用户 | `POST` | `/users` | 创建平台或研究级用户；研究级用户可同步加入指定 Study |
| 用户 | `PATCH` | `/users/{user_id}` | 修改用户显示名、密码；`LZ_ADMIN` 可修改角色和全局登录状态，Study 管理员仅限本 Study 成员基础资料 |
| 用户 | `PATCH` | `/users/{user_id}/status` | `LZ_ADMIN` 启用或禁用账号；禁用账号不能登录 |
| 用户 | `PATCH` | `/users/{user_id}/study-scope` | `LZ_ADMIN` 管理非 `LZ_ADMIN` 平台角色的授权 Study 范围 |
| 字段权限 | `GET` | `/field-permissions` | 当前角色或管理员可见的字段级可见、可导出和脱敏规则 |
| 权限矩阵 | `GET` | `/permissions/matrix` | 导出平台角色、Study 角色、模块、操作、资源动作和 endpoint 的正式权限矩阵 |
| Study | `GET` | `/studies` | 当前用户可访问 Study |
| Study | `POST` | `/studies` | `LZ_ADMIN` 新建 Study，默认先进入 draft 或 active 生命周期状态 |
| Study | `PATCH` | `/studies/{study_id}` | `LZ_ADMIN` 更新 Study 基本信息、终止或重新激活 Study |
| Study | `DELETE` | `/studies/{study_id}` | `LZ_ADMIN` 将 Study 软删除为 `deleted`，保留历史关联 |
| Study 配置 | `GET` | `/study-configurations` | 当前用户可访问 Study 的配置总表，返回 disease area、当前 CRF、访视计划、知情同意模板和检测 profile |
| Study 配置 | `GET` | `/studies/{study_id}/configuration` | 查询单个 Study 配置总表行 |
| Study 配置 | `PUT` | `/studies/{study_id}/configuration` | 更新单个 Study 配置总表行；当前系统管理 UI 用于保存本 Study 的知情同意模板 |
| Study 成员 | `GET` | `/studies/{study_id}/members` | 查询 Study 成员 |
| Study 成员 | `POST` | `/studies/{study_id}/members` | 分配或更新研究级角色，返回与列表一致的成员展示字段 |
| Study 中心 | `GET` | `/studies/{study_id}/sites` | 查询 Study 下的 site/中心 |
| Study 中心 | `POST` | `/studies/{study_id}/sites` | 新增或更新 Study site |
| Study 中心 | `POST` | `/studies/{study_id}/sites/{site_id}/users` | 分配 site 用户 |
| Study 访视计划 | `GET` | `/studies/{study_id}/visit-plans` | 查询 Study 访视计划配置 |
| Study 访视计划 | `POST` | `/studies/{study_id}/visit-plans` | 新增或按 code 更新 Study 访视计划 |
| Study 访视计划 | `PUT` | `/studies/{study_id}/visit-plans/{plan_id}` | 更新指定访视计划 |
| Study CRF | `GET` | `/studies/{study_id}/crf-versions` | 查询 Study CRF 版本 |
| Study CRF | `POST` | `/studies/{study_id}/crf-versions` | 创建 Study CRF 版本 |
| Study CRF | `POST` | `/studies/{study_id}/crf-versions/migration-preview` | 预览当前发布版本与目标 schema 的字段差异 |
| Study CRF | `PUT` | `/studies/{study_id}/crf-versions/{version_id}` | 更新版本状态、schema 或变更摘要；发布时退休旧 published 版本 |
| Study CRF | `GET` | `/studies/{study_id}/crf-migrations` | 查询 Study CRF 迁移审批记录 |
| Study CRF | `POST` | `/studies/{study_id}/crf-migrations` | 为 draft 目标版本提交迁移审批 |
| Study CRF | `POST` | `/studies/{study_id}/crf-migrations/{migration_id}/approve` | 批准 pending CRF 迁移 |
| Study CRF | `POST` | `/studies/{study_id}/crf-migrations/{migration_id}/apply` | 应用 approved CRF 迁移并发布目标版本 |
| Study CRF 字段 | `GET` | `/studies/{study_id}/crf-fields` | 查询当前 Study CRF 字段配置 |
| Study CRF 字段 | `POST` | `/studies/{study_id}/crf-fields` | 新增 Study CRF 字段 |
| Study CRF 字段 | `PUT` | `/studies/{study_id}/crf-fields/{field_id}` | 更新字段名称、类型、模块、状态、选项、必填和校验规则 |
| 患者列表 | `GET` | `/studies/{study_id}/patients` | 搜索、筛选单个 Study 患者 |
| 患者创建 | `POST` | `/studies/{study_id}/patients` | 在单个 Study Workspace 内创建患者 |
| 患者详情 | `GET` | `/patients/{patient_id}` | 患者主档 |
| 患者详情 | `GET` | `/patients/{patient_id}/panorama` | 患者全景数据 |
| 随访记录 | `GET` | `/studies/{study_id}/follow-up-records` | 查询单个 Study 的患者随访记录 |
| 随访记录 | `POST` | `/studies/{study_id}/follow-up-records` | 新增随访记录 |
| 随访记录 | `PUT` | `/follow-up-records/{record_id}` | 更新随访记录 |
| CRF 录入 | `GET` | `/studies/{study_id}/crf?patient_id=...` | 查询患者 CRF |
| CRF 录入 | `POST` | `/studies/{study_id}/crf` | 新增 CRF 模块记录 |
| CRF 录入 | `PUT` | `/crf/{entry_id}` | 更新 CRF 草稿、提交或锁定 |
| 访视 | `PUT` | `/visits/{visit_id}` | 更新实际访视日期、访视类型、临床指标、完整度和状态 |
| 样本登记 | `GET` | `/studies/{study_id}/samples` | 查询单个 Study 样本台账 |
| 样本登记 | `POST` | `/studies/{study_id}/samples` | 新增样本 |
| 多组学检测 | `GET` | `/studies/{study_id}/omics` | 查询单个 Study 检测记录 |
| 多组学检测 | `POST` | `/studies/{study_id}/omics` | 新增检测记录 |
| 文件上传 | `POST` | `/files` | 上传知情、临床、样本、组学结果或导出文件 |
| 文件上传 | `GET` | `/studies/{study_id}/files?patient_id=...` | 查询患者文件 |
| 文件上传 | `GET` | `/files/{file_id}/download` | 校验 Study/角色权限、扫描状态和归档状态后下载文件 |
| 文件上传 | `POST` | `/files/{file_id}/archive` | 将文件标记为长期归档，后续下载需先恢复 |
| Patient Journey | `GET` | `/patients/{patient_id}/journey` | Journey 页面聚合接口 |
| 数据分析 | `GET` | `/analytics/summary` | LZ 全局态按当前用户 Study scope 聚合患者、样本、组学、访视、CRF 和导出归档概览 |
| 数据分析 | `GET` | `/studies/{study_id}/analytics/summary` | 单个 Study 队列统计、样本、组学和导出归档概览 |
| 导出 | `POST` | `/exports` | 创建导出任务 |
| 导出 | `GET` | `/studies/{study_id}/exports` | 查询单个 Study 导出任务 |
| 审批 | `GET` | `/studies/{study_id}/approvals` | 查询当前 Study 的审批请求和动作记录 |
| 审批 | `POST` | `/approvals` | 提交导出或 CRF 发布审批；脱敏审批作为内部治理能力保留，不作为当前客户演示范围 |
| 审批 | `POST` | `/approvals/{approval_id}/approve` | 批准 submitted 审批，禁止提交人自批 |
| 审批 | `POST` | `/approvals/{approval_id}/reject` | 拒绝 submitted 审批 |
| 审批 | `POST` | `/approvals/{approval_id}/cancel` | 由提交人或管理员取消 draft/submitted 审批 |
| 审批 | `POST` | `/approvals/{approval_id}/complete` | 将 approved 审批标记为 completed |
| eConsent | `POST` | `/consents/{consent_id}/withdrawal-request` | 发起知情同意撤回审批，批准并 complete 后将 consent 标记为已撤回 |
| eConsent | `POST` | `/consents/{consent_id}/resign-request` | 发起知情同意重签审批，批准并 complete 后将 consent 标记为待签署 |
| Query | `GET` | `/studies/{study_id}/queries` | 按患者、状态、字段、责任人查询单个 Study 数据 Query |
| Query | `POST` | `/queries` | 创建并指派 Query |
| Query | `PUT` | `/queries/{query_id}` | 回复、关闭或取消 Query |
| Operation Logs | `GET` | `/operation-logs`, `/studies/{study_id}/operation-logs` | 查询后端操作日志 |
| Operation Logs Export | `GET` | `/operation-logs/export`, `/studies/{study_id}/operation-logs/export` | 导出操作日志 CSV |
患者、样本、组学、访视、随访和知情同意等响应中的直接标识符会按 `field_permissions` 应用字段级权限。`LZ_DATA_MANAGER`、`STUDY_DATA_MANAGER` 和 `LZ_AUDITOR` 默认只能看到姓名、住院号等字段的脱敏值；导出时这些字段按 `can_export=false` 输出为空，确保前端表格、详情页和 CSV 下载使用同一套权限/脱敏逻辑。
审批状态机统一使用 `draft / submitted / approved / rejected / cancelled / completed`。每次提交、批准、拒绝、取消和完成都会写入 `approval_actions`；System Management 的 Approval Center 在 Study Workspace 内读取 `/studies/{study_id}/approvals` 并调用 approve/reject 操作。`econsent_withdrawal` 与 `econsent_resign` 复用同一审批中心，后端禁止提交人自批，请求创建后 consent 进入 `撤回审批中` 或 `重签审批中`，完成审批后再更新为 `已撤回` 或 `已重签`。
Query 创建会校验 `study_id / patient_id / visit_id` 一致性，且 `field_name` 必须属于该 Study 当前 CRF 字段字典；例如 `LZXK-01` 肺癌 CRF 不允许创建 `SLEDAI评分` 字段 Query。
Study 配置总表使用 `study_configurations` 作为发布收口源，绑定 `study_id -> disease_area -> active_crf_version_id -> visit_plan -> consent_template -> testing_profile -> follow_up_schema`。新建患者和自动 CRF 草稿必须使用当前 Study 的 published CRF；如果目标 Study 没有 published CRF，后端返回错误，不允许静默回退到 LGL。
`PUT /studies/{study_id}/configuration` 只更新路径中的单个 Study 配置，并由后端按当前用户 Study scope 与 `studies:write` 权限校验；Study Workspace 内不能通过请求体切换到其他 Study。当前前端先开放 `consent_template` 写入，用于 Study 知情同意配置。
`Study 系统管理` 的 `Global Configuration | 全局配置` 通过 `/global-configuration` 读取和保存疾病类型、样本类型、检测类型和单位类型字典，后端持久化到 `global_configurations` 表。患者、样本和检测 API 现在按字符串接收 `disease_type`、`sample_type`、`quantity_unit` 和 `omics_records.assay`，以便承载 LZ 全局字典扩展；正式落库仍由 `study_id`、角色权限和 Study 生命周期校验控制。

## 全局配置

- `GET /global-configuration`：读取全局疾病类型、样本类型、检测类型和单位类型。需要登录用户具备 `studies:read`。
- `PUT /global-configuration`：写入全局疾病类型、样本类型、检测类型和单位类型。仅 `LZ_ADMIN` 可写。
- 默认样本类型：`肿瘤FFPE`、`肿瘤组织`、`CSF`、`血液`、`胸水`。
- 默认检测类型：`RNA-seq`、`WES`、`scRNA-seq`、`类器官构建`、`Olink`。
- 默认单位类型：`mL`、`块`、`片`、`管`。

正式 GA 核心数据模型：

| 数据域 | PostgreSQL/API 字段 | 关系与说明 |
| --- | --- | --- |
| 患者基本信息 | `patients.patient_number`, `patient_name`, `study_id`, `hospital_no`, `sex`, `age`, `disease_type`, `note` | `patient_number` 是业务患者编号；`patient_name` 是患者姓名，默认显示拼音首字母；`id` 是系统主键；`name` 暂兼容既有页面展示，默认与 `patient_number` 同步。 |
| 患者 CRF 信息 | `crf_entries.payload` + `study_crf_versions.schema_json` | 每个 Study 独立配置 CRF；默认包含病程记录、住院、治疗方案、检查等 section，payload 以 JSON 保存。 |
| 患者随访 | `follow_up_records.payload` + `study_configurations.follow_up_schema` | 每个 Study 独立配置随访 JSON；默认覆盖访视、日期、类型、疗效评估、记录，同时保留日期、类型、疗效、记录等固定列用于筛选和列表。 |
| 样本信息 | `samples.patient_id`, `id`, `sample_type`, `collected_at`, `storage`, `initial_quantity`, `remaining_quantity`, `quantity_unit`, `note`, `linked_omics` | 一个患者可有多个样本；`storage` 保存存储位置；初始量、剩余量和单位按字符串保存，单位由全局单位类型单选；`remaining_quantity` 由人工维护，不由检测记录自动扣减；`linked_omics` 记录该样本已做或计划做的检测。 |
| 多组学检测 | `omics_records.sample_id`, `sample_ids`, `sample_usage`, `testing_project_id`, `assay`, `vendor`, `platform`, `status`, `sent_at`, `completed_at`, `qc`, `result_file_id` | `sample_id` 是兼容旧逻辑的主样本；`sample_ids` 支持人工选择一个或多个样本；`sample_usage` 记录每个样本的人工填写使用量、单位和用途；`vendor` 保存检测供应商；`result_file_id` 指向 `uploaded_files.id` 的结果文件记录。 |

Patient Journey 页面的多轨临床事件轴、事件明细流和关键指标趋势只能从当前患者的 `patients`、`crf_entries`、`visits`、`follow_up_records`、`samples`、`omics_records` 和 `uploaded_files` 聚合生成，不允许使用前端静态旅程数据或合成日期、合成诊断/住院/治疗事件冒充正式状态。关键指标没有真实访视或 CRF 值时必须为空或显示 0，不允许按序号生成趋势。
`/studies/{study_id}/analytics/summary` 返回 `export_count` 和 `ready_export_count`，Dashboard 的“导出归档”必须使用 `export_jobs` 统计，不允许复用组学归档数。
患者姓名授权：`patient_name` 默认按拼音首字母展示。完整姓名默认只授权给 `LZ_ADMIN`、`STUDY_CONFIG_ADMIN`、`STUDY_CRC` 和 `LZ_CRC`；其他角色由后端字段权限返回拼音首字母，前端不能自行还原完整姓名。
文件上传通过存储适配层写入 `uploaded_files`，记录 `study_id`、owner、MIME type、size、SHA-256、`storage_backend`、扫描状态和归档状态。默认本地存储；`LINZIGHT_STORAGE_BACKEND=object` 时返回 `object://bucket/prefix/...` 风格 URI。病毒扫描器同样可替换，mock/external adapter 均阻止 EICAR 测试签名；下载和归档动作均由后端校验 Study 权限、角色权限、扫描状态和归档状态。
GA 版本已移除 standalone audit log 模块，不再提供 `/audit-logs` 或 `/studies/{study_id}/audit-logs` API，也不再创建 `audit_logs` 表。正式审计底座改为后台 `operation_logs` 表：所有核心后端写操作必须记录操作者、Study、实体、动作、before/after/diff JSONB 和时间戳；前端不展示 Audit Diff 页面。

`POST /seed` 只用于隔离 smoke/test fixture。正式 PostgreSQL runtime 默认返回 404；如需人工重置测试环境，必须显式设置 `LINZIGHT_ENABLE_SEED_ENDPOINT=1` 并使用 LZ Admin Bearer token 调用。SQLite smoke 仍可通过 `LINZIGHT_ALLOW_SQLITE_RUNTIME=1` 自动 seed 临时库。

### Operation Logs

- `GET /operation-logs?limit=100&action=CREATE&entity_type=patients`：LZ Admin 可查询全局操作日志；非 Admin 平台角色按其 Study scope 自动过滤。
- `GET /studies/{study_id}/operation-logs`：Study-scoped 操作日志查询；医生研究者、CRC、Data Manager 和 Study Admin 只能访问自己所属 Study。
- `GET /operation-logs/export` 和 `GET /studies/{study_id}/operation-logs/export`：导出 CSV，列包括 `id, study_id, actor_id, actor_role, action, entity_type, entity_id, diff_count, created_at`。
- 日志 API 只读取 `operation_logs`，不恢复前端 Audit Diff 模块；前端 System Management 仅展示筛选后的日志列表和 CSV 导出入口。

## 角色权限矩阵

平台级角色：

| 角色 | Study 范围 | 患者/CRF 数据 | CRF 配置 | 质控/Query | 导出/分析 |
| --- | --- | --- | --- | --- | --- |
| `LZ_ADMIN` | 全部 | 全部 | 全部 | 全部 | 全部 |
| `LZ_CRC` | 授权 Study | 录入/修改未锁定数据 | 默认不管理结构 | 核查/回复 | 默认无导出 |
| `LZ_CRF_ADMIN` | 授权 Study | 默认只读 | 配置/发布版本 | 无 | 无 |
| `LZ_DATA_MANAGER` | 授权 Study | 只读/核查 | 默认无 | 发起/关闭/冻结 | 可导出 |
| `LZ_AUDITOR` | 授权 Study | 只读 | 只读 | 只读 | 只读 |

研究级角色：

| 角色 | Study 范围 | 患者/CRF 数据 | CRF 配置 | 质控/Query | 导出/分析 | 成员管理 |
| --- | --- | --- | --- | --- | --- | --- |
| `STUDY_PI` | 所属 Study | 查看/医学审核 | 无 | 查看 | 按配置可读 | 无 |
| `STUDY_CRC` | 所属 Study | 新建/录入/回复 Query | 无 | 回复 | 无 | 无 |
| `STUDY_CONFIG_ADMIN` | 所属 Study | 本 Study 全部读写 | 配置/发布 | 全部 | 可导出 | 可管理本 Study |
| `STUDY_DATA_MANAGER` | 所属 Study | 只读/核查 | 无 | 发起/关闭/冻结 | 可导出 | 无 |

## 核心请求示例

用户创建使用 `POST /users`。请求字段包括 `username`、`display_name`、`role`、`password`、`status`、可选 `study_id` 和 `member_status`。当 `study_id` 存在且 `role` 为 `STUDY_*` 时，后端会同时创建 `study_members` 行。`STUDY_CONFIG_ADMIN` 只能在自己可管理的 Study 内创建研究级账号；平台级 `LZ_*` 账号仅允许 `LZ_ADMIN` 创建。用户基础资料修改使用 `PATCH /users/{user_id}`；Study 管理员只能在 `study_id` 范围内修改本 Study 成员的显示名或密码，平台角色、登录状态和跨 Study 授权范围仍由 `LZ_ADMIN` 管理。用户响应包含 `last_login_at`，成功登录时由后端更新，不由前端伪造。

Study 生命周期使用 `POST /studies`、`PATCH /studies/{study_id}` 和 `DELETE /studies/{study_id}`。Study 主数据字段包括 `id`、`code`、`name`、`indication`、`phase`、`status`、`owner_org`、`leading_pi_info` 和 `system_admin`。`DELETE` 为软删除，将状态改为 `deleted` 并保留历史数据。`terminated` 或 `deleted` Study 会拒绝患者、CRF、访视、随访、样本、组学、文件、质控、导出等业务写入。

平台级授权范围使用 `PATCH /users/{user_id}/study-scope` 写入 `global_role_study_scope`。该接口只允许 `LZ_ADMIN` 调用，适用于 `LZ_CRC`、`LZ_CRF_ADMIN`、`LZ_DATA_MANAGER` 和 `LZ_AUDITOR`；`LZ_ADMIN` 永远是 `all_studies`，不通过该接口配置。

Study 成员写入响应与列表响应保持一致，包含 `username`、`display_name`、`last_login_at`、`study_role`、`status`、`created_at` 和 `updated_at`，便于系统管理页在 upsert 后直接刷新行状态。

Study CRF 字段响应包含 `options`、`required`、`validation_rule` 和 `conditional_logic`。前端系统管理页的字段编辑器会把下拉选项、必填状态、校验规则和条件逻辑保存回 `study_crf_versions.schema_json.sections[].fields[]`。

Study CRF 版本发布使用 `PUT /studies/{study_id}/crf-versions/{version_id}`，将 `status` 设为 `published`。后端会给当前版本写入 `published_at`，并将同一 Study 下其他 `published` 版本置为 `retired`，避免一个 Study 同时存在多个当前发布版本。
迁移预览使用 `POST /studies/{study_id}/crf-versions/migration-preview`，请求体传入目标 `schema`，后端与当前 published 版本比较并返回 `added`、`removed`、`changed` 和 `unchanged` 摘要，不写入数据库。
正式版本切换可走 `/studies/{study_id}/crf-migrations`：提交审批时后端持久化 source/target version、preview 摘要和 note；批准后状态变为 `approved`；应用后目标 draft 版本变为 `published`，同一 Study 的旧 published 版本变为 `retired`。响应的 `execution_logs` 会记录 request/approve/apply/blocked 步骤。提交人不能批准或应用自己的 CRF migration request。

登录：

```json
{
  "username": "crc@demo.linzight",
  "password": "Demo1234!"
}
```

CRF 创建：

```json
{
  "study_id": "LGL-1111",
  "patient_id": "PAT-001",
  "visit_id": "VIS-001",
  "crf_version_id": "CRFV-LGL-1111-V0.1",
  "form_id": "baseline",
  "module": "baseline",
  "payload": {
    "CRF版本": "V0.1",
    "SLEDAI评分": 12,
    "PGA评分": 2,
    "WBC": 10.73
  },
  "status": "draft"
}
```

Study 访视计划创建：

```json
{
  "code": "V4",
  "name": "V4 6月随访",
  "visit_type": "随访访视",
  "day_offset": 180,
  "window_before_days": 14,
  "window_after_days": 14,
  "required_forms": ["follow_up"],
  "required_samples": ["血液"],
  "status": "active",
  "sort_order": 4
}
```

Study CRF 字段创建：

```json
{
  "name": "新增字段",
  "type": "Text",
  "module": "基本信息",
  "status": "草稿"
}
```

随访记录创建：

```json
{
  "study_id": "LZXK-01",
  "patient_id": "PAT-051",
  "visit_id": "VIS-051-2",
  "follow_up_date": "2024-10-30",
  "follow_up_method": "门诊",
  "followed_by": "肺癌 CRC",
  "survival_status": "存活",
  "disease_status": "稳定",
  "symptoms_signs": "咳嗽/胸痛较前稳定，ECOG 1。",
  "imaging_lab_summary": "胸部CT提示靶病灶稳定；ctDNA 动态监测已复核。",
  "efficacy_assessment": "稳定",
  "record_note": "门诊复查，继续当前治疗方案。",
  "metastasis_status": "未见新增转移",
  "adverse_events": "无明显不良事件",
  "quality_of_life": "日常活动基本可维持。",
  "lost_to_follow_up_reason": "-"
}
```

CRF 查询响应会继续返回解码后的 JSON object，同时暴露底层存储格式和 CRF payload 版本：

```json
{
  "id": "CRF-001",
  "study_id": "LGL-1111",
  "patient_id": "PAT-001",
  "visit_id": "VIS-001",
  "crf_version_id": "CRFV-LGL-1111-V0.1",
  "form_id": "baseline",
  "module": "baseline",
  "payload": {
    "CRF版本": "V0.1",
    "SLEDAI评分": 12
  },
  "payload_version": "V0.1",
  "payload_format": "jsonb",
  "status": "draft"
}
```

导出任务：

```json
{
  "export_type": "cohort_csv",
  "scope": {
    "study_id": "LGL-1111",
    "disease_type": ["NPSLE", "Non-NPSLE", "MS", "NMOSD", "HC"]
  },
  "requested_by": "USR-003"
}
```

## API 与前端数据映射

- `patients.patient_number` 映射到 `PatientRecord.patientNumber`；`patients.name` 仅保留既有页面兼容展示
- `patients.patient_name` 映射到 `PatientRecord.patientName`；`patients.patient_name_initials` 映射到 `PatientRecord.patientNameInitials`
- `patients` 映射到 `PatientRecord`
- `study_visit_plans` 映射到 `StudyVisitPlanRecord`
- `follow_up_records` 映射到 `FollowUpRecord`
- `samples.note` 映射到 `SampleRecord.note`
- `omics_records.result_file_id` 映射到 `OmicsRecord.resultFileId`
- `follow_up_records.record_note` 映射到 `FollowUpRecord.recordNote`
- `follow_up_records.payload` 映射到 `FollowUpRecord.payload`；`study_configurations.follow_up_schema` 是随访 JSON 字段配置
- `samples` 映射到 `SampleRecord`
- `omics_records` 映射到 `OmicsRecord`
- `patients.clinical_data` 与 `crf_entries.payload` 保持当前 Study CRF 字段字典的宽表 JSON；`LGL-1111` 和 `RWD-NMO-2026` 使用 SLE CRF V0.1，`LZXK-01` 使用肺癌耐药 CRF V1.0，避免跨病种字段混入。
- 正式 PostgreSQL runtime 将所有 JSON payload/schema/scope 列写入原生 `JSONB`；显式 SQLite 测试库优先写入 `patients.clinical_data_jsonb` 与 `crf_entries.payload_jsonb` BLOB。API mapper 解码后返回 JSON object，并通过 `clinical_data_version`、`clinical_data_format`、`payload_version`、`payload_format` 暴露版本和存储格式。
- `patients/{patient_id}/journey` 与现有 `panorama` 保持兼容，返回 `patient`、`consents`、`visits`、`follow_up_records`、`crf_entries`、`samples`、`omics_records`、`files`、`quality_issues`
- `visits.visit_plan_id` 指向 `study_visit_plans.id`；`visits` 返回 `visit_plan_code`、`plan_day_offset` 和访视窗口字段，供前端展示计划来源。
- `follow_up_records.visit_id` 可选指向 `visits.id`；同一患者同一日期同一随访方式通过数据库唯一索引防重复。
