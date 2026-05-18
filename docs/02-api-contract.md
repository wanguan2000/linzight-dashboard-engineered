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
- 当前 Demo Study：`LGL-1111`、`RWD-NMO-2026`、`LZXK-01`；`LZXK-01` 为真实世界肺癌耐药研究，默认 20 名患者，使用独立 15 字段肺癌耐药 CRF。
- Study Workspace 是唯一业务租户边界。患者、CRF、样本、组学、随访、文件、Query、质控、导出、审批和审计等业务 list 接口必须以 `/studies/{study_id}/...` 或显式 `study_id` 进入；未带 Study 上下文的旧式业务 list 请求返回 `400`。
- LZ 全局态不能直接调用业务 list 接口读取多 Study 业务表；全局患者列表只调用 `/global/patient-index`，返回患者索引、脱敏编号、Study 信息、状态与最近更新时间。LZ 管理页不是业务租户，前端全局态只保留全局患者索引与 Study 系统管理；Study 系统管理只管理 Study、用户和授权范围，不直接编辑 CRF、样本、随访、导出等业务数据。生产 PostgreSQL 版本应在同一边界上补 RLS，当前 Demo 阶段先用后端应用层过滤。
- OpenAPI schema 快照：运行 `npm run export:openapi` 生成 `docs/openapi.json`；API 变更时应同步 `src/services/contracts.ts`、本文档和 smoke tests。

## 主链路接口

| 链路 | 方法 | 路径 | 用途 |
| --- | --- | --- | --- |
| 登录 | `POST` | `/auth/login` | 用户登录，返回 token 与用户角色 |
| 登录 | `GET` | `/auth/me` | 当前用户信息 |
| 登录 | `POST` | `/auth/logout` | 记录登出审计并返回登出状态 |
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
| Study | `DELETE` | `/studies/{study_id}` | `LZ_ADMIN` 将 Study 软删除为 `deleted`，保留审计和历史关联 |
| Study 配置 | `GET` | `/study-configurations` | 当前用户可访问 Study 的配置总表，返回 disease area、当前 CRF、访视计划、知情同意模板和检测 profile |
| Study 配置 | `GET` | `/studies/{study_id}/configuration` | 查询单个 Study 配置总表行 |
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
| Study CRF 字段 | `POST` | `/studies/{study_id}/crf-fields` | 新增 Study CRF 字段并写入审计 |
| Study CRF 字段 | `PUT` | `/studies/{study_id}/crf-fields/{field_id}` | 更新字段名称、类型、模块、状态、选项、必填和校验规则 |
| 全局患者索引 | `GET` | `/global/patient-index` | LZ 全局页只读索引；返回 `patient_id`、`masked_subject_code`、`study_id`、`study_name`、`status`、`last_updated` |
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
| 访视 | `PUT` | `/visits/{visit_id}` | 更新实际访视日期、访视类型、临床指标、完整度和状态，并写入 before/after 审计 |
| 样本登记 | `GET` | `/studies/{study_id}/samples` | 查询单个 Study 样本台账 |
| 样本登记 | `POST` | `/studies/{study_id}/samples` | 新增样本 |
| 多组学检测 | `GET` | `/studies/{study_id}/omics` | 查询单个 Study 检测记录 |
| 多组学检测 | `POST` | `/studies/{study_id}/omics` | 新增检测记录 |
| 文件上传 | `POST` | `/files` | 上传知情、临床、样本、组学结果或导出文件 |
| 文件上传 | `GET` | `/studies/{study_id}/files?patient_id=...` | 查询患者文件 |
| 文件上传 | `GET` | `/files/{file_id}/download` | 校验 Study/角色权限、扫描状态和归档状态后下载文件 |
| 文件上传 | `POST` | `/files/{file_id}/archive` | 将文件标记为长期归档，后续下载需先恢复 |
| Patient Journey | `GET` | `/patients/{patient_id}/journey` | Journey 页面聚合接口 |
| 数据分析 | `GET` | `/studies/{study_id}/analytics/summary` | 单个 Study 队列统计、样本和组学概览 |
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
| 审计 | `GET` | `/studies/{study_id}/audit-logs` | 查询单个 Study 实体操作审计 |

患者、样本、组学、访视、随访和知情同意等响应中的直接标识符会按 `field_permissions` 应用字段级权限。`LZ_DATA_MANAGER`、`STUDY_DATA_MANAGER` 和 `LZ_AUDITOR` 默认只能看到姓名、住院号等字段的脱敏值；导出时这些字段按 `can_export=false` 输出为空，确保前端表格、详情页和 CSV 下载使用同一套权限/脱敏逻辑。
审批状态机统一使用 `draft / submitted / approved / rejected / cancelled / completed`。每次提交、批准、拒绝、取消和完成都会写入 `approval_actions` 与 `audit_logs`；System Management 的 Approval Center 在 Study Workspace 内读取 `/studies/{study_id}/approvals` 并调用 approve/reject 操作。`econsent_withdrawal` 与 `econsent_resign` 复用同一审批中心，后端禁止提交人自批，请求创建后 consent 进入 `撤回审批中` 或 `重签审批中`，完成审批后再更新为 `已撤回` 或 `已重签`。
Query 创建会校验 `study_id / patient_id / visit_id` 一致性，且 `field_name` 必须属于该 Study 当前 CRF 字段字典；例如 `LZXK-01` 肺癌 CRF 不允许创建 `SLEDAI评分` 字段 Query。
Study 配置总表使用 `study_configurations` 作为发布收口源，绑定 `study_id -> disease_area -> active_crf_version_id -> visit_plan -> consent_template -> testing_profile`。新建患者和自动 CRF 草稿必须使用当前 Study 的 published CRF；如果目标 Study 没有 published CRF，后端返回错误，不允许静默回退到 LGL。
文件上传通过存储适配层写入 `uploaded_files`，记录 `study_id`、owner、MIME type、size、SHA-256、`storage_backend`、扫描状态和归档状态。默认本地存储；`LINZIGHT_STORAGE_BACKEND=object` 时返回 `object://bucket/prefix/...` 风格 URI。病毒扫描器同样可替换，mock/external adapter 均阻止 EICAR 测试签名；下载和归档动作均写入审计日志。
审计响应包含 `before`、`after` 和结构化 `diff`，用于展示字段级路径、修改前值和修改后值。CRF 字段配置、访视修改、审批完成、文件下载/归档等关键动作都应保留 `study_id`。

## 角色权限矩阵

平台级角色：

| 角色 | Study 范围 | 患者/CRF 数据 | CRF 配置 | 质控/Query | 导出/分析 | 审计 |
| --- | --- | --- | --- | --- | --- | --- |
| `LZ_ADMIN` | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 |
| `LZ_CRC` | 授权 Study | 录入/修改未锁定数据 | 默认不管理结构 | 核查/回复 | 默认无导出 | 无 |
| `LZ_CRF_ADMIN` | 授权 Study | 默认只读 | 配置/发布版本 | 无 | 无 | 无 |
| `LZ_DATA_MANAGER` | 授权 Study | 只读/核查 | 默认无 | 发起/关闭/冻结 | 可导出 | 可读 |
| `LZ_AUDITOR` | 授权 Study | 只读 | 只读 | 只读 | 只读 | 可读 |

研究级角色：

| 角色 | Study 范围 | 患者/CRF 数据 | CRF 配置 | 质控/Query | 导出/分析 | 成员管理 |
| --- | --- | --- | --- | --- | --- | --- |
| `STUDY_PI` | 所属 Study | 查看/医学审核 | 无 | 查看 | 按配置可读 | 无 |
| `STUDY_CRC` | 所属 Study | 新建/录入/回复 Query | 无 | 回复 | 无 | 无 |
| `STUDY_CONFIG_ADMIN` | 所属 Study | 默认只读 | 配置/发布 | 无 | 无 | 可管理本 Study |
| `STUDY_DATA_MANAGER` | 所属 Study | 只读/核查 | 无 | 发起/关闭/冻结 | 可导出 | 无 |

## 核心请求示例

用户创建使用 `POST /users`。请求字段包括 `username`、`display_name`、`role`、`password`、`status`、可选 `study_id` 和 `member_status`。当 `study_id` 存在且 `role` 为 `STUDY_*` 时，后端会同时创建 `study_members` 行并写入 `audit_logs`。`STUDY_CONFIG_ADMIN` 只能在自己可管理的 Study 内创建研究级账号；平台级 `LZ_*` 账号仅允许 `LZ_ADMIN` 创建。用户基础资料修改使用 `PATCH /users/{user_id}`；Study 管理员只能在 `study_id` 范围内修改本 Study 成员的显示名或密码，平台角色、登录状态和跨 Study 授权范围仍由 `LZ_ADMIN` 管理。

Study 生命周期使用 `POST /studies`、`PATCH /studies/{study_id}` 和 `DELETE /studies/{study_id}`。`DELETE` 为软删除，将状态改为 `deleted` 并保留历史数据和审计。`terminated` 或 `deleted` Study 会拒绝患者、CRF、访视、随访、样本、组学、文件、质控、导出等业务写入，系统管理和审计仍可读取或维护。

平台级授权范围使用 `PATCH /users/{user_id}/study-scope` 写入 `global_role_study_scope`。该接口只允许 `LZ_ADMIN` 调用，适用于 `LZ_CRC`、`LZ_CRF_ADMIN`、`LZ_DATA_MANAGER` 和 `LZ_AUDITOR`；`LZ_ADMIN` 永远是 `all_studies`，不通过该接口配置。

Study 成员写入响应与列表响应保持一致，包含 `username`、`display_name`、`study_role`、`status`、`created_at` 和 `updated_at`，便于系统管理页在 upsert 后直接刷新行状态。

Study CRF 字段响应包含 `options`、`required`、`validation_rule` 和 `conditional_logic`。前端系统管理页的字段编辑器会把下拉选项、必填状态、校验规则和条件逻辑保存回 `study_crf_versions.schema_json.sections[].fields[]`；后端写入 `audit_logs`，用于追踪 schema 配置变化。

Study CRF 版本发布使用 `PUT /studies/{study_id}/crf-versions/{version_id}`，将 `status` 设为 `published`。后端会给当前版本写入 `published_at`，并将同一 Study 下其他 `published` 版本置为 `retired`，避免一个 Study 同时存在多个当前发布版本。
迁移预览使用 `POST /studies/{study_id}/crf-versions/migration-preview`，请求体传入目标 `schema`，后端与当前 published 版本比较并返回 `added`、`removed`、`changed` 和 `unchanged` 摘要，不写入数据库。
正式版本切换可走 `/studies/{study_id}/crf-migrations`：提交审批时后端持久化 source/target version、preview 摘要和 note；批准后状态变为 `approved`；应用后目标 draft 版本变为 `published`，同一 Study 的旧 published 版本变为 `retired`。提交、批准、应用均写入 `audit_logs`，并在响应的 `execution_logs` 中记录 request/approve/apply/blocked 步骤。提交人不能批准或应用自己的 CRF migration request。

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

- `patients` 映射到 `PatientRecord`
- `study_visit_plans` 映射到 `StudyVisitPlanRecord`
- `follow_up_records` 映射到 `FollowUpRecord`
- `samples` 映射到 `SampleRecord`
- `omics_records` 映射到 `OmicsRecord`
- `patients.clinical_data` 与 `crf_entries.payload` 保持当前 Study CRF 字段字典的宽表 JSON；`LGL-1111` 和 `RWD-NMO-2026` 使用 SLE CRF V0.1，`LZXK-01` 使用肺癌耐药 CRF V1.0，避免跨病种字段混入。
- SQLite 存储层优先写入 `patients.clinical_data_jsonb` 与 `crf_entries.payload_jsonb` BLOB；PostgreSQL runtime 当前写入兼容 JSON 文本；API mapper 解码后返回 JSON object，并通过 `clinical_data_version`、`clinical_data_format`、`payload_version`、`payload_format` 暴露版本和存储格式
- `patients/{patient_id}/journey` 与现有 `panorama` 保持兼容，返回 `patient`、`consents`、`visits`、`follow_up_records`、`crf_entries`、`samples`、`omics_records`、`files`、`quality_issues`
- `visits.visit_plan_id` 指向 `study_visit_plans.id`；`visits` 返回 `visit_plan_code`、`plan_day_offset` 和访视窗口字段，供前端展示计划来源。
- `follow_up_records.visit_id` 可选指向 `visits.id`；同一患者同一日期同一随访方式通过数据库唯一索引防重复。
