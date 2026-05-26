# API.md

## 当前 API 状态

当前项目包含可选 FastAPI Demo 后端，入口为 `backend/main.py`。前端也可以在没有后端时运行，此时会使用 `src/data/` 中的 mock 数据。

默认 API base：

1. `VITE_API_BASE_URL`
2. `http://127.0.0.1:8000`
3. `http://127.0.0.1:8001`

## 已有接口分组

### Health 和 Seed

- `GET /health`
- `POST /seed`

### Auth

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /users`
- `PATCH /users/{user_id}/status`
- `DELETE /users/{user_id}`
- `GET /field-permissions`
- `GET /permissions/matrix`

当前认证使用 HMAC 签名 Bearer token，密码使用 PBKDF2-HMAC-SHA256 加盐哈希。`POST /users` 会执行基础密码策略校验，账号禁用后登录会被拒绝。
字段级权限集中在 `field_permissions`：患者姓名、住院号、身份证号、手机号、地址等直接标识符会按角色返回原文、脱敏值或导出空值。
正式权限矩阵由 `/permissions/matrix` 输出，文档版本见 `docs/08-permission-matrix.md`。前端按钮状态必须与该矩阵和后端 403 保持一致。

登录响应会返回新角色码、`study_scope` 和 `study_memberships`。后续请求需要携带 Bearer token，后端按 `study_id` 自动过滤授权数据。
`POST /users` 用于系统管理页创建账号；`STUDY_CONFIG_ADMIN` 可在本 Study 内创建研究级账号并同步写入 `study_members`，平台级账号创建仅限 `LZ_ADMIN`。`DELETE /users/{user_id}` 用于 `LZ_ADMIN` 软删除/归档账号：账号状态置为 `deleted`、关联 Study membership 置为 `disabled`、历史审计链保留；后端拒绝当前用户自删和删除最后一个 active `LZ_ADMIN`。

### Studies 和权限

- `GET /studies`
- `GET /global-configuration`
- `PUT /global-configuration`
- `GET /study-configurations`
- `GET /studies/{study_id}/configuration`
- `PUT /studies/{study_id}/configuration`
- `GET /studies/{study_id}/members`
- `POST /studies/{study_id}/members`
- `GET /studies/{study_id}/visit-plans`
- `POST /studies/{study_id}/visit-plans`
- `PUT /studies/{study_id}/visit-plans/{plan_id}`
- `GET /studies/{study_id}/crf-versions`
- `POST /studies/{study_id}/crf-versions`
- `POST /studies/{study_id}/crf-versions/migration-preview`
- `PUT /studies/{study_id}/crf-versions/{version_id}`
- `GET /studies/{study_id}/crf-migrations`
- `POST /studies/{study_id}/crf-migrations`
- `POST /studies/{study_id}/crf-migrations/{migration_id}/approve`
- `POST /studies/{study_id}/crf-migrations/{migration_id}/apply`
- `GET /studies/{study_id}/crf-fields`
- `POST /studies/{study_id}/crf-fields`
- `PUT /studies/{study_id}/crf-fields/{field_id}`

RWD EDC 主链路统一使用 `study_id`，不使用 `project_id`。样本检测项目编号使用 `testing_project_id`。
当前 seed 包含 `LGL-1111`、`RWD-NMO-2026` 和 `LZXK-01`；`LZXK-01` 是真实世界肺癌耐药研究，默认 20 名患者，并有独立 Study 角色和 CRF V1.0。
`/global-configuration` 保存 `Study 系统管理` 的疾病类型、样本类型、检测类型和单位类型全局字典，持久化在 `global_configurations`。读取需要登录，写入仅限 `LZ_ADMIN`；患者队列汇总和样本/检测表单共享该配置。
`study_configurations` 是发布收口的 Study 配置总表，接口返回 `study_id`、`disease_area`、`active_crf_version_id`、`visit_plan`、`consent_template` 和 `testing_profile`。`PUT /studies/{study_id}/configuration` 用于按当前路径 Study 更新配置；系统管理页当前开放 `consent_template` 写入，后端按当前用户 Study scope 和 `studies:write` 校验，不允许 Study Workspace 配置其他 Study。新建患者会绑定当前 Study 的 published CRF；没有 published CRF 时后端拒绝创建，不回退默认 LGL。
`POST /studies/{study_id}/members` 与成员列表返回同一展示结构，包含 `username` 和 `display_name`，用于系统管理页 upsert 后直接刷新成员行。
`/studies/{study_id}/crf-fields` 从当前 Study CRF version 的 `schema_json.sections[].fields[]` 读取和写入字段配置，新增或更新字段会写入 `audit_logs`。字段配置支持 `options`、`required`、`validation_rule` 和 `conditional_logic`，供系统管理页维护下拉选项、必填状态、基础校验规则和条件逻辑。
`PUT /studies/{study_id}/crf-versions/{version_id}` 支持草稿发布；发布时后端会写入 `published_at`，并将同 Study 的旧 published 版本置为 `retired`。
`POST /studies/{study_id}/crf-versions/migration-preview` 比较当前 published 版本与目标 schema，返回 added/removed/changed/unchanged 摘要，不写入数据库。
`/studies/{study_id}/crf-migrations` 保存 CRF 迁移审批流：针对 draft 目标版本创建 pending request，approve 后变为 approved，apply 后发布目标版本并退休旧 published 版本；提交人不能批准或应用自己的 request。响应包含 `execution_logs`，记录 request/approve/apply/blocked 步骤；每一步同时写入 `audit_logs`。

### Patients

- `GET /patients`
- `POST /patients`
- `GET /patients/{patient_id}`
- `PUT /patients/{patient_id}`
- `DELETE /patients/{patient_id}`
- `GET /patients/{patient_id}/panorama`
- `GET /patients/{patient_id}/journey`

`PUT /patients/{patient_id}` 可更新患者主档字段。`LZ_ADMIN` 可通过 payload 中的 `study_id` 更正患者所属 Study；后端会同时迁移该患者关联的 consent、visit、CRF、follow-up、sample、omics、file、Query 和 quality issue 的 `study_id`，避免患者主表与业务子表 Study 不一致。非 `LZ_ADMIN` 不能跨 Study 移动患者。
患者 `patient_name` 和 `hospital_no` 可不填；空住院号以数据库 `NULL` 保存，填写住院号时仍按同一 Study 内唯一校验。患者 `birth_date` 是年龄展示、筛选和排序的权威来源；新增患者输入年龄时前端按“当前年 - 年龄，1 月 1 日”自动推断出生日期，之后可手工修改。患者 `age` 允许为空并以数据库 `NULL` 保存，仅保留兼容旧数据；新建患者不再默认填入 45。患者 `sex` 增加 `unknown` 选项，数据库默认值为 `unknown`。

### Samples

- `GET /samples`
- `POST /samples`
- `GET /samples/{sample_id}`
- `PUT /samples/{sample_id}`
- `DELETE /samples/{sample_id}`

样本 payload 必须包含人工填写的 `id` 作为条码/样本编号；后端不再自动生成样本编号。payload 还包含 `storage`、`initial_quantity`、`remaining_quantity`、`quantity_unit` 和 `linked_omics`。样本量字段按字符串保存，单位从全局单位类型字典单选；剩余量由人工维护，不自动计算，也不默认等于初始量。
`PUT /samples/{sample_id}` 中的 `study_id` 必须与样本所属患者一致；样本更换患者时后端会按目标患者重算样本 `study_id`。已有检测记录引用的样本不能直接更换患者，避免多样本检测记录跨患者或跨 Study 断裂。

### Visits

- `GET /visits`
- `PUT /visits/{visit_id}`

`study_visit_plans` 保存每个 Study 的访视配置，`visits.visit_plan_id` 关联该配置。新建患者时后端会按当前 Study 的 active 访视计划生成初始访视，并为每个计划指定的 `required_forms` 创建 CRF 草稿。`PUT /visits/{visit_id}` 可更新实际访视日期、访视类型、临床指标、完整度和状态，并写入 before/after diff 审计；`POST /quality/run` 会基于访视计划窗口生成超窗问题。

### Follow-up Records

- `GET /follow-up-records`
- `POST /follow-up-records`
- `PUT /follow-up-records/{record_id}`

随访记录隶属于患者信息，使用 `study_id + patient_id` 隔离，可选通过 `visit_id` 关联某次随访访视。字段覆盖随访时间、方式、随访人、生存状态、疾病状态、症状体征、影像/检验结论、疗效评估、转移情况、不良事件、生活质量、失访原因和记录时间。
临床数据采集页新增/编辑随访行时写入该接口；计划访视仍由 `study_visit_plans` 管理。

### Omics

- `GET /omics`
- `POST /omics`
- `GET /omics/{record_id}`
- `PUT /omics/{record_id}`
- `DELETE /omics/{record_id}`

检测 payload 保留 `sample_id` 作为主样本，同时支持 `sample_ids` 多样本选择和 `sample_usage` 每样本使用量/单位/用途记录。

### Consents

- `GET /consents`
- `PUT /consents/{consent_id}`
- `POST /consents/{consent_id}/withdrawal-request`
- `POST /consents/{consent_id}/resign-request`

知情同意撤回和重签通过 Approval Center 处理。请求接口只创建审批；批准并 complete 后，后端才会将 consent 状态更新为 `已撤回` 或 `待签署`。

### CRF

- `GET /crf`
- `POST /crf`
- `PUT /crf/{entry_id}`

当前 Demo CRF 使用 `resource/sle-crf-v0.1.schema.json`，由 `resource/SLE临床数据记录表.csv` 生成。API 仍返回解码后的 `patients.clinical_data` 与 `crf_entries.payload` JSON object，二者均包含 `CRF版本: "V0.1"`。

SQLite 存储层优先使用 JSONB（二进制 JSON）BLOB：

- `patients.clinical_data_jsonb` 保存患者宽表 CRF payload，`clinical_data_version` 当前为 `V0.1`，`clinical_data_format` 为 `jsonb` 或 `json`。
- `crf_entries.payload_jsonb` 保存 CRF 模块 payload，`payload_version` 当前为 `V0.1`，`payload_format` 为 `jsonb` 或 `json`。
- `clinical_data_json` 与 `payload_json` 保留为 TEXT JSON 兼容字段，用于迁移、调试和不支持 SQLite `jsonb()` 的运行环境。

### Files

- `GET /files`
- `POST /files`

上传分类包括 `consent`、`clinical`、`sample`、`omics_result`、`analysis_export`、`other`。临床、组学结果和分析导出类文件必须标记脱敏。
文件 API 记录 `study_id`、上传者、MIME type、size、SHA-256、存储后端、病毒扫描状态和归档状态；`GET /files/{file_id}/download` 会校验权限、扫描状态和归档状态，并写入审计日志。默认使用本地存储；`LINZIGHT_STORAGE_BACKEND=object` 时返回 `object://bucket/prefix/...` URI，便于生产式对象存储 smoke。

### Analytics 和 Quality

- `GET /analytics/summary`
- `GET /quality/issues`
- `POST /quality/run`

质量检查包含基础完整性、样本缺失、知情状态和访视窗口规则。访视窗口问题写入 `data_quality_issues`，`source_table=visits`、`field_name=visit_date`。

### Exports 和 Imports

- `POST /exports`
- `GET /exports`
- `GET /exports/{export_id}/download`
- `POST /imports/patients`

### Audit Logs

- `GET /audit-logs`

审计日志返回 `before`、`after` 和结构化 `diff` 数组，便于前端展示字段级变更路径、修改前值和修改后值。

## 前端契约

- 后端响应类型在 `src/services/contracts.ts`。
- 数据转换逻辑在 `src/services/api.ts`。
- 更详细契约参考 `docs/02-api-contract.md` 和 `docs/03-frontend-backend-protocol.md`。

## 未来 API 规划

- `/studies`：Study、中心、版本和配置。
- `/dictionaries`：字段字典、样本类型、访视窗口、CRF schema。
- `/queries`：数据质量 query 创建、回复、关闭、审计；当前已校验 Study、患者、访视和 CRF 字段一致性。
- `/permissions`：角色、权限矩阵、字段级权限。
- `/approvals`：导出、CRF 发布和 eConsent 撤回/重签审批状态机。脱敏审批作为内部治理能力保留，不作为当前客户演示范围。
- `/files/presign`：真实对象存储直传和下载签名。
- `/integrations`：EMR/LIS/组学平台接入状态。

## 生产化注意事项

- 将本地签名密钥接入生产级 secret 管理，并加入 HTTPS、CSRF/CORS 策略、审计和速率限制。
- 所有患者相关数据必须脱敏或加权限控制。
- API schema 变更必须同步 `contracts.ts`、文档和测试。
- OpenAPI schema 快照通过 `npm run export:openapi` 生成到 `docs/openapi.json`。
