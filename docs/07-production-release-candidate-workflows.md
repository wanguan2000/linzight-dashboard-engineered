# Production Release Candidate 收口工作流

## 发布目标

本轮目标是把当前工程化 Demo 收口到 release candidate：可客户演示、可内部试点、不可直接承载真实患者生产数据。真实患者生产上线仍必须另行完成生产数据库、集中身份源、生产文件存储、安全审计、备份恢复和 UAT。锁库和脱敏审批先排除在本轮客户演示正式发布范围外，仅保留为内部治理能力。

## 并行工作流

| 工作流 | 范围 | RC gate |
| --- | --- | --- |
| 1. Study / CRF / 数据隔离冻结 | Study 配置总表、当前 Study published CRF、访视计划、知情同意模板、检测 profile、fallback 数据语义 | `npm run smoke:crf-semantics` 与 `npm run smoke:static-runtime` 必须证明 `LZXK-01` 不漏 SLE/免疫病字段，`LGL-1111` 保留免疫病 CRF |
| 2. 权限矩阵产品化 | 平台角色、Study 角色、菜单、按钮、tooltip、后端 403 和 API smoke 一致 | `npm run smoke:api` 覆盖 patients、crf、samples、omics、consents、files、queries、quality、exports、approvals 和 operation logs 的正向和越权 |
| 3. Query / 质控 / 访视窗口闭环 | Query 创建、回复、关闭、重开、质控一键生成 Query、访视窗口和漏访原因 | API smoke 必须覆盖 Query 状态流转、访视窗口问题生成和 Study 字段校验 |
| 4. eConsent 正式化 | 签署、撤回、重签、审批、归档、扫描件和模板按 Study 绑定 | 撤回/重签必须走 Approval Center，Approval complete 后 consent 状态刷新并写入 `operation_logs` |
| 5. 生产基础设施适配 | PostgreSQL 迁移、DATABASE_URL、对象存储、病毒扫描、文件 metadata、备份恢复 | `backend/migrations/postgres/` 提供 schema/index/constraint/seed；生产文件路径不得依赖本地 uploads 作为最终存储 |
| 6. 权限与归档底座 | Study-scoped 写入校验、审批动作记录、文件扫描和归档状态 | 任一关键操作必须带 Study 上下文并通过后端权限校验 |
| 7. 前端发布质量 | 系统管理降密度、Data Manager 工作台、移动端卡片化、通知入口、AI canned responses、中英文一致性 | `npm run browser:matrix` 和 `npm run smoke:ui` 覆盖 390px 主链路、主按钮反馈和明显硬编码 |
| 8. 发布工程与 UAT | CI、staging 部署脚本、发布包、UAT checklist、安全检查、性能 smoke | `npm run release:check`、`npm run smoke:performance`、`npm run deploy:staging`、CI、固定三角色 demo E2E 和 release notes 全绿 |

## 当前前置决策

- 所有 Study 业务语义从 `study_configurations` 读取或派生，核心字段为 `study_id -> disease_area -> active_crf_version_id -> visit_plan -> consent_template -> testing_profile`。
- 新增患者必须绑定当前 Study 的 published CRF；如果当前 Study 没有 published CRF，后端直接拒绝，不再回退到默认 LGL。
- 前端隐藏只用于体验，安全边界以后端 `backend/permissions.py` 与 API 403 为准。
- 静态 HTML 可继续作为演示交付，但 release candidate gate 必须同时覆盖 API smoke、CRF 语义 smoke、静态导出 runtime smoke、UI smoke、browser matrix、demo E2E、performance smoke 和 staging deploy dry-run。

## 不进入本轮正式发布范围

- 真实患者生产数据承载。
- 生产锁库和脱敏审批正式流程。
- 集中身份源、密钥托管、长期归档、生产监控告警和完整灾备切换。
- 多浏览器截图基线和真实供应商病毒扫描 SLA。
