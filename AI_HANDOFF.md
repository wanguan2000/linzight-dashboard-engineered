# AI_HANDOFF.md

## 当前版本

`v0.0.1-beta.0`

## 当前状态

项目处于可上传 GitHub private 仓库的 beta 整理阶段。前端为 Vite + React + TypeScript dashboard，后端为可选 FastAPI + SQLite Demo API。前端在 API 不可用时会回退到本地 Demo 数据；`npm run export:html` 可生成八个可直接打开的交互式 HTML 页面。

## 已实现功能

- 登录页与 Demo 账号认证回退；登录页支持先选择 `Study 研究入口` + `study_id` 或 `LZ 系统管理`，再选择对应账号登录。
- 首页工作台、患者队列管理、知情同意、临床数据采集、样本及检测、患者旅程、数据分析、系统管理。
- 患者队列搜索、筛选、列表和进入患者旅程/临床数据采集的联动。
- 临床数据采集 CRF、随访、样本联动和样本库编码展示。
- 知情同意列表、状态管理、版本信息和同意书预览。
- 样本台账、多组学检测记录、QC 状态和结果文件状态展示。
- 患者旅程单患者全景视图。
- 中英双语切换，偏好保存在浏览器 localStorage。
- SLE CRF V0.1：由 `resource/SLE临床数据记录表.csv` 派生，当前 schema 文件为 `resource/sle-crf-v0.1.schema.json`，共 10 个分组、89 个字段。
- Demo seed：`backend/seed.py` 读取 CRF V0.1 schema，生成 70 名测试患者、210 条访视、140 条随访记录、210 条 CRF 记录及关联样本/组学/知情同意数据；CRF payload 以 SQLite JSONB BLOB 优先保存，并带版本信息。
- 多 Study 权限 Demo：后端 seed 包含 `LGL-1111`、`RWD-NMO-2026` 与 `LZXK-01`，所有 RWD EDC 核心表通过 `study_id` 隔离，样本检测项目使用 `testing_project_id`。
- 跨 Study 管理视角：`LZ_ADMIN` 可以管理全部 Study 患者；患者队列、CRF 患者摘要、知情同意、样本/检测和导出任务均应明确展示或选择 `Study ID`，避免管理员全局视角下把不同 Study 数据混读。
- `LZXK-01`：真实世界肺癌耐药研究，默认 20 名患者、60 条访视、40 条随访记录、60 条 CRF、44 个样本、84 条组学记录；CRF 为独立 15 字段肺癌耐药 schema，不再继承或追加 SLE 字段。账号 `lung-pi@demo.linzight`、`lung-crc@demo.linzight`、`lung-config@demo.linzight`、`lung-dm@demo.linzight` 分别覆盖 Study PI/CRC/配置管理员/数据管理员。
- 平台级/研究级角色：`LZ_ADMIN`、`LZ_CRC`、`LZ_CRF_ADMIN`、`LZ_DATA_MANAGER`、`LZ_AUDITOR` 与 `STUDY_PI`、`STUDY_CRC`、`STUDY_CONFIG_ADMIN`、`STUDY_DATA_MANAGER`。
- Study CRF 版本：`crf_templates` 到 `study_crf_versions` 再到 `crf_entries.crf_version_id`，已发布版本保留历史引用。
- Study 配置总表：`study_configurations` 绑定 `study_id -> disease_area -> active_crf_version_id -> visit_plan -> consent_template -> testing_profile`；`LZXK-01` 绑定肺癌 CRF、肺癌知情同意模板和 `TP-LUNG-RESIST-OMICS` 检测 profile。
- Study 访视计划：`study_visit_plans` 独立于 CRF 结构，按 Study 定义 V1/V2/V3、时间窗、必填表单和样本要求；`visits.visit_plan_id` 关联计划，新建患者会自动生成计划访视和 CRF 草稿。
- 随访记录：`follow_up_records` 独立于 CRF 版本配置，隶属于患者信息，绑定 `study_id + patient_id`，可选关联 `visit_id`，Patient Journey 已接入展示。
- FastAPI Demo 后端：患者、样本、组学、知情同意、CRF、文件、质量、导出、审计和患者全景接口。
- 静态 HTML 导出：八个业务模块各一个入口页面。
- 本地 Docker Compose Demo：`Dockerfile.frontend`、`Dockerfile.backend` 和 `docker-compose.yml` 可一键启动前端、后端、SQLite volume 与上传 volume。
- Demo 运维脚本：`npm run backup:sqlite` 与 `npm run restore:sqlite -- backups/<dir>` 支持本地 SQLite/上传目录备份恢复，说明见 `docs/deployment-ops.md`。
- OpenAPI schema 导出：`npm run export:openapi` 生成 `docs/openapi.json`，CI 和 release gate 会检查该契约快照。
- Beta 发布准备验证记录：`docs/05-beta-release-readiness.md`，包含本轮 CRUD smoke、API/UI smoke、release gate、浏览器 smoke、安全扫描、敏感信息检查、配置检查和剩余正式化工作。页面、数据与 CRF 一致性审计记录见 `docs/page-data-crf-consistency-audit.md`；客户演示口径见 `docs/demo-readiness-checklist.md`。
- 生产化第一版补强：字段级 Query 创建会校验 Study/患者/访视/CRF 字段一致性，支持创建、回复、关闭、重开和筛选；质量检查会生成访视窗口超窗问题；审计日志返回结构化 before/after `diff`；eConsent 撤回/重签先进入 Approval Center 审批中状态，审批完成后同步为已撤回或已重签；文件上传具备 object-storage 与 external virus scanner 适配点；`backend/migrations/postgres/` 提供 schema/index/constraint/seed 分层 PostgreSQL 迁移，`npm run export:postgres-migration` 仍可生成 staging 数据导出包；`npm run smoke:performance` 覆盖 70 demo patients 与导出响应；`npm run deploy:staging` 输出 staging 部署计划；`npm run browser:matrix` 覆盖桌面/移动端角色矩阵；患者/模块表格在 390px 移动端卡片化展示。

## 尚未实现功能

- 完整生产级认证、集中身份源、权限审批流和用户管理。
- 真实 EDC/EMR/LIS/组学平台 API 接入。
- 前端组件/真实浏览器自动化测试需要继续扩展；当前已提供并纳入 CI/release gate 的检查包括 `npm run smoke:api`、`npm run smoke:crf-semantics`、`npm run export:openapi`、`npm run smoke:ui`、`npm run smoke:static-runtime`、`npm run browser:matrix`、`npm run demo:e2e`、`npm run smoke:performance`、`npm run release:check` 和 `npm test` 综合 smoke，后续仍需扩展到更多浏览器和截图基线。
- 静态导出 runtime smoke 已加入 `npm run smoke:static-runtime`：启动 `exports/html` 静态服务器，登录 `LZXK-01` 肺癌 CRC，验证 390px 临床数据采集页可见内容包含肺癌字段且不漏 SLE/免疫病字段。
- CI/CD 自动发布流程；GitHub Actions 已覆盖基础验证、CRF 语义 smoke、角色浏览器矩阵、demo E2E、release gate 和静态 HTML artifact 上传。
- 生产级部署模板；当前已提供本地 Demo 用 `Dockerfile.frontend`、`Dockerfile.backend`、`docker-compose.yml` 和 staging dry-run 计划脚本。
- 真实文件对象存储、病毒扫描、长期归档策略和 PostgreSQL runtime adapter 仍需接入生产基础设施并完成演练。
- Query 管理、字段级审计 before/after diff、eConsent 撤回/重签审批、访视窗口超窗预警和数据字典规则已有 RC first pass，仍需更完整的 reviewer UX、报表和供应商级验证。锁库和脱敏审批属于内部治理流程，当前客户演示发布前不作为外显范围。

## 已知问题

- `npm test` 已配置为 API smoke、OpenAPI 导出、静态导出、UI smoke 和 release gate 的组合检查。
- Docker daemon 未运行时只能执行 `docker compose config`；实际镜像构建需要先启动本机 Docker。
- 后端已替换为本地签名 Bearer token、PBKDF2 密码哈希和账号启用/禁用控制；SQLite 仍是 Demo 数据层，不能直接承载真实患者隐私数据。
- `resource/clinical-patient-journey-nextjs/` 是历史 Next.js 原型参考，不是当前主应用。
- `exports/html/` 是生成产物；修改源码后必须重新运行 `npm run export:html` 才能同步。
- 项目包含 Demo 医疗研究样例数据和模板资料；发布前必须持续检查不要混入真实患者隐私数据。
- CSV 源模板中有重复字段 `免疫制剂2`；CRF V0.1 schema 已将第二个字段规范为 `免疫制剂2（第2项）`，后续真实字段字典确认前不要再改回重复 key。
- 当前隔离模型已按 Demo API smoke 覆盖管理员全局患者口径、Study CRC 跨 Study 403、样本/检测/知情同意/文件/Query/质量/导出/审批/审计列表不串 Study；浏览器矩阵覆盖桌面和 390px 移动端主路由。正式发布前仍需纳入 CI 并扩展到真实身份源和更多浏览器。
- 新建患者已禁止在当前 Study 没有 published CRF 时回退默认 LGL；若后续新增 Study，必须先发布该 Study 的 CRF 并同步 `study_configurations`。

## 下一步开发优先级

1. 继续扩展正式 CI 权限矩阵：patients、samples、omics、visits、follow-ups、consents、CRF、files、queries、quality、exports、approvals、audit logs 已有正向/越权 smoke，下一步补字段级权限、中心级权限和真实身份源映射。
2. 把浏览器矩阵扩展到更多浏览器和截图基线，覆盖管理员 Study selector、Study ID 列、Study CRC 只看本 Study、移动端卡片视图和导出下载闭环。
3. 抽离 mock data，形成可替换的 demo dataset 层，确保 API 失败 fallback 不泄露未授权 Study。
4. 细化 API 契约和错误处理，继续产品化字段级 Query、审计 diff 展示、文件归档和 eConsent 重签流程。
5. 将当前 Docker Compose Demo 扩展为生产部署模板、备份恢复、真实对象存储、病毒扫描和集中身份源方案。
6. 将当前 Demo Study 权限模型扩展为生产级认证、字段级权限和审计策略。
7. 接入真实后端前完成字段字典、单位、范围、必填、逻辑校验和访视窗口规则。

## 未来 AI 接手第一步

先阅读：

1. `AGENTS.md`
2. `README.md`
3. `ARCHITECTURE.md`
4. `API.md`
5. `ROADMAP.md`
6. `docs/frontend-html-export.md`

然后运行：

```bash
npm install
npm run lint
npm run build
```

如需同步静态页面：

```bash
npm run export:html
npm run smoke:ui
```

如需检查后端：

```bash
python3 -m compileall -q backend
```

## 重要提醒

不要重写项目，不要大规模改变现有 UI。后续开发应以增量方式进行：先定位相关模块，复用现有组件、样式 token、API 映射和文档结构，再做小范围变更并补充验证。
