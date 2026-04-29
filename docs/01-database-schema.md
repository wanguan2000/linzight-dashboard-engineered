# RWS EDC v1 数据库表结构

## 运行配置

- 开发默认：SQLite，`LINZIGHT_DATABASE_URL=sqlite:///./backend/linzight_demo.db`
- PostgreSQL 保留配置：`LINZIGHT_POSTGRES_URL=postgresql://linzight:linzight@localhost:5432/linzight`
- 本地文件目录：`LINZIGHT_UPLOADS_DIR=./uploads`

当前后端运行时仍使用 SQLite；PostgreSQL URL 作为部署迁移配置保留，不在 v1 开发阶段强制启用。

## 核心实体

| 表 | 用途 | 主链路位置 |
| --- | --- | --- |
| `users` | 系统账号与角色 | 登录、权限、审计 |
| `role_permissions` | 角色资源动作矩阵 | 权限体系 |
| `patients` | 50 个模拟患者主档 | 患者列表、患者详情 |
| `consents` | 知情同意状态 | 患者详情、Journey |
| `visits` | 基线与随访访视 | Patient Journey、CRF |
| `crf_entries` | CRF 模块化录入 payload | CRF 录入 |
| `samples` | 样本登记台账 | 样本登记 |
| `omics_records` | 多组学检测登记 | 多组学检测 |
| `uploaded_files` | 本地上传文件元数据 | 文件上传、结果文件 |
| `export_jobs` | 导出任务与文件关联 | 数据分析、导出 |
| `data_quality_issues` | 数据完整性与校验问题 | 质控 |
| `audit_logs` | 操作审计 | 审计日志 |

## 角色范围

`users.role` 固定为：

- `sys_admin`
- `project_admin`
- `investigator`
- `crc`
- `data_manager`
- `viewer`

## 关键关系

- `patients` 是患者中心主表，`samples`、`omics_records`、`consents`、`visits`、`crf_entries`、`uploaded_files`、`data_quality_issues` 均可按 `patient_id` 汇总成 Patient Journey。
- `omics_records.sample_id` 关联 `samples.id`，用于样本送检到组学结果的链路追踪。
- `uploaded_files` 可关联患者、样本、组学记录或知情同意记录，文件实体统一落本地 `uploads` 目录。
- `export_jobs.file_id` 指向导出文件元数据，便于数据分析页展示导出状态。
- `audit_logs` 记录所有关键实体变更，保留 `before_json` 与 `after_json` 便于后续审计追溯。

## 索引策略

v1 先覆盖主链路查询：

- `patients(disease_type)`：队列筛选。
- `samples(patient_id)`：患者详情和 Journey 样本汇总。
- `omics_records(patient_id)`：患者详情和 Journey 检测汇总。
- `crf_entries(patient_id)`：CRF 模块查询。
- `uploaded_files(patient_id)`：患者文件汇总。
- `audit_logs(entity_type, entity_id)`：实体审计追溯。
- `data_quality_issues(patient_id, status)`：患者质控问题过滤。
