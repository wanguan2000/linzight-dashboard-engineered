# RWD EDC v1 数据库表结构

## 运行配置

- 开发默认：macOS 本地 PostgreSQL，`DATABASE_URL=postgresql+psycopg2:///linzight_dashboard_engineered`
- SQLite 仅用于隔离 smoke、备份恢复和迁移导出脚本，可显式设置 `DATABASE_URL=sqlite:///./backend/linzight_demo.db`
- 本地文件目录：`LINZIGHT_UPLOADS_DIR=./uploads`

当前后端运行时默认使用 PostgreSQL；SQLite 版本支持 `jsonb()` 时，CRF payload 会以 JSONB（二进制 JSON）BLOB 保存，不支持时自动回退到 TEXT JSON。PostgreSQL runtime 当前以兼容 JSON 文本保存。API 层统一解码为 JSON object，因此前端不需要直接处理底层存储格式。

## 核心实体

| 表 | 用途 | 主链路位置 |
| --- | --- | --- |
| `studies` | RWD EDC Study 主表 | 多研究隔离 |
| `users` | 系统账号与角色 | 登录、权限、审计 |
| `study_members` | Study 成员与研究级角色 | 研究内权限 |
| `global_role_study_scope` | 平台级角色授权 Study 范围 | 跨研究权限 |
| `role_permissions` | 角色资源动作矩阵 | 权限体系 |
| `patients` | 70 个模拟患者主档 | 患者列表、患者详情 |
| `study_visit_plans` | 每个 Study 的访视计划配置 | 研究配置、自动生成访视 |
| `study_configurations` | Study 配置总表 | 病种语义、当前 CRF、访视计划、知情同意模板、检测 profile |
| `consents` | 知情同意状态 | 患者详情、Journey |
| `visits` | 基线与随访访视 | Patient Journey、CRF |
| `follow_up_records` | 出院后或门诊间隔随访事实记录 | Patient Journey、疗效和长期管理 |
| `crf_entries` | CRF 模块化录入 payload | CRF 录入 |
| `samples` | 样本登记台账 | 样本登记 |
| `omics_records` | 多组学检测登记 | 多组学检测 |
| `uploaded_files` | 本地上传文件元数据 | 文件上传、结果文件 |
| `export_jobs` | 导出任务与文件关联 | 数据分析、导出 |
| `data_quality_issues` | 数据完整性与校验问题 | 质控 |
| `audit_logs` | 操作审计 | 审计日志 |
| `crf_templates` | CRF 模板库 | CRF 配置 |
| `study_crf_versions` | Study 独立 CRF 版本 | CRF 发布与版本 |

## 角色范围

`users.role_code` 是当前权限判断使用的角色编码。`users.role` 仅保留旧 Demo 登录兼容值。

平台级角色：

- `LZ_ADMIN`
- `LZ_CRC`
- `LZ_CRF_ADMIN`
- `LZ_DATA_MANAGER`
- `LZ_AUDITOR`

研究级角色：

- `STUDY_PI`
- `STUDY_CRC`
- `STUDY_CONFIG_ADMIN`
- `STUDY_DATA_MANAGER`

`study_members.study_role` 只保存研究级角色。平台级角色的授权 Study 范围保存在 `global_role_study_scope`。

## 关键关系

- `study_id` 是 RWD EDC 核心隔离字段。`patients`、`samples`、`omics_records`、`consents`、`visits`、`follow_up_records`、`crf_entries`、`uploaded_files`、`export_jobs`、`data_quality_issues`、`audit_logs` 均包含该字段。
- `patients` 是患者中心主表，`samples`、`omics_records`、`consents`、`visits`、`follow_up_records`、`crf_entries`、`uploaded_files`、`data_quality_issues` 均可按 `patient_id` 汇总成 Patient Journey。
- `study_visit_plans.study_id` 关联 `studies.id`，保存该 Study 的访视编码、名称、访视类型、相对基线天数、访视窗口、必填 CRF 表单和样本要求。
- `study_configurations.study_id` 是 Study 配置总表主键；`active_crf_version_id` 指向当前 published CRF，`visit_plan_json` 保存 active plan profile/codes，`consent_template` 绑定 Study 知情同意模板，`testing_profile_json` 保存样本/检测 profile。
- `visits.visit_plan_id` 关联 `study_visit_plans.id`。`visits` 是患者实际访视记录；`study_visit_plans` 是配置模板。新建患者时后端按当前 Study 的 active 访视计划生成初始访视和 CRF 草稿。
- 访视计划不放在 CRF 字段表内。CRF 版本定义表单结构，访视计划定义时间点和该时间点需要录入哪些表单。
- `follow_up_records.patient_id` 关联 `patients.id`，可选 `visit_id` 关联 `visits.id`。它记录随访时间、方式、随访人、生存状态、疾病状态、疗效评估、转移、不良事件、生活质量和失访原因，不属于 CRF 版本配置表。
- `omics_records.testing_project_id` 是样本检测项目编号，不作为 RWD EDC 数据隔离字段。
- `omics_records.sample_id` 关联 `samples.id`，用于样本送检到组学结果的链路追踪。
- `uploaded_files` 可关联患者、样本、组学记录或知情同意记录，文件实体统一落本地 `uploads` 目录。
- `export_jobs.file_id` 指向导出文件元数据，便于数据分析页展示导出状态。
- `audit_logs` 记录所有关键实体变更，保留 `before_json` 与 `after_json` 便于后续审计追溯。
- 当前 seed 包含 `LZXK-01` 真实世界肺癌耐药研究，默认 20 名患者，并生成独立 Study 成员、CRF V1.0、组织/胸水样本和 `TP-LUNG-RESIST-OMICS` 检测项目记录。

## CRF JSONB 存储

CRF 宽表数据采用双轨存储，兼顾 PostgreSQL runtime、SQLite JSONB 查询性能和迁移可读性：

| 表 | JSONB BLOB 字段 | TEXT JSON 兼容字段 | 版本字段 | 格式字段 |
| --- | --- | --- | --- | --- |
| `patients` | `clinical_data_jsonb` | `clinical_data_json` | `clinical_data_version` | `clinical_data_format` |
| `crf_entries` | `payload_jsonb` | `payload_json` | `payload_version` | `payload_format` |

- `*_jsonb`：PostgreSQL runtime 当前写入 JSON 文本；SQLite 支持 `jsonb()` 时写入 BLOB，并支持 `json_extract()`、`json()` 等 SQLite JSON 函数读取。
- `*_json`：保留 TEXT JSON 作为可读兼容副本，也用于不支持 `jsonb()` 的环境。
- `*_version`：来自 payload 内的 `CRF版本`，当前 SLE CRF schema 为 `V0.1`。
- `*_format`：记录实际写入格式，当前支持 `jsonb`、`json` 和历史迁移值 `legacy`。

## 索引策略

v1 先覆盖主链路查询：

- `patients(disease_type)`：队列筛选。
- `samples(patient_id)`：患者详情和 Journey 样本汇总。
- `omics_records(patient_id)`：患者详情和 Journey 检测汇总。
- `study_visit_plans(study_id)`：Study 配置页和新建患者时加载访视计划。
- `study_configurations(active_crf_version_id)`：从 Study 配置反查当前 CRF 版本。
- `visits(visit_plan_id)`：从患者访视反查配置。
- `follow_up_records(patient_id)`、`follow_up_records(study_id)`：患者 Journey 与 Study 随访列表过滤。
- `follow_up_records(study_id, patient_id, follow_up_date, follow_up_method)`：避免同一患者同一日期同一方式重复录入。
- `crf_entries(patient_id)`：CRF 模块查询。
- `uploaded_files(patient_id)`：患者文件汇总。
- `audit_logs(entity_type, entity_id)`：实体审计追溯。
- `data_quality_issues(patient_id, status)`：患者质控问题过滤。
