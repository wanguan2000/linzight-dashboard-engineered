# ROADMAP.md

## v0.0.1-beta.0 当前范围

- 整理 private GitHub beta 仓库。
- 补齐 README、AGENTS、AI handoff、架构、开发、部署、安全和 API 文档。
- 保留当前 Vite + React dashboard 和可选 FastAPI Demo 后端。
- 保留八个模块的静态 HTML 导出能力。
- 明确 `.gitignore`、`.env.example`、敏感信息和生成目录规则。

## v0.0.2-beta.0 建议计划

- 增加 GitHub Actions：install、lint、build、backend compile；当前已加入 CI 工作流并覆盖 API smoke、OpenAPI 导出、静态导出、UI smoke、release gate 与静态 HTML artifact 上传。
- 增加基础测试脚本和 smoke tests；当前已加入 `npm test`、`npm run smoke:api`、`npm run export:openapi`、`npm run smoke:ui` 和 `npm run release:check`，覆盖临时后端、Study 隔离、权限、CRF、样本、组学、导出、审计、OpenAPI 契约和发布文件卫生。
- 增加本地 Docker Compose Demo；当前已加入 `Dockerfile.frontend`、`Dockerfile.backend` 和 `docker-compose.yml`，可一键启动前端、后端、SQLite volume 与上传 volume。
- 补齐部署运维基础；当前已加入 `docs/deployment-ops.md`、Nginx 反向代理示例、环境变量清单和 Demo SQLite/上传目录备份恢复脚本。
- 继续梳理 Demo 数据和 mock fallback 边界；当前已完成 SLE CRF V0.1 schema、LZXK-01 独立 15 字段肺癌耐药 CRF、Study 访视计划配置、随访记录与 70 名测试患者 seed 的前后端联动。
- 为导出 HTML 增加自动校验脚本；当前 `npm run smoke:ui` 已覆盖 8 个导出页面、关键英文文案、CRF migration approval、execution logs 和多 Study selector 文案。
- 补充 OpenAPI 或 API schema 导出；当前已加入 `npm run export:openapi` 并生成 `docs/openapi.json`，CI/release gate 会检查契约快照。
- 继续扩展当前 `study_id` 权限 Demo 的后端 API smoke tests；CI artifact 与 release gate 已建立，后续可增加分支保护状态检查。
- 补齐跨 Study 管理视角的 `Study ID` 可见性；患者队列、CRF 摘要、知情同意、样本/检测、患者旅程和导出已进入第一轮收口，页面数据与 CRF 一致性审计见 `docs/page-data-crf-consistency-audit.md`。
- 进入 production release candidate 收口后按 8 条并行工作流推进：Study/CRF 冻结、权限矩阵、Query/质控/访视窗口、eConsent、生产基础设施、审计合规、前端发布质量、发布工程与 UAT。正式清单见 `docs/07-production-release-candidate-workflows.md`。
- 正式权限矩阵已沉淀到 `docs/08-permission-matrix.md`，后端通过 `/permissions/matrix` 导出，`npm run smoke:api` 会校验关键角色和操作不漂移。
- UAT 发布包已沉淀到 `docs/09-uat-release-package.md`，覆盖三角色固定链路、已知限制、回滚步骤和 Demo/private beta 声明。

## v0.1.0 建议计划

- 引入生产化 API 适配层。
- 将已落地的 Study 角色权限、审计、CRF 版本和数据质量规则扩展为生产级认证与审批流。
- 将 CRF schema 和样本字典进一步配置化；当前 SLE CRF V0.1 已以 JSON schema 接入前端与 seed，但还不是生产级 schema 编辑器。
- 增加文件上传安全策略、对象存储适配和文件下载审计。
- 建立完整前后端契约测试。

## v1.0.0 建议计划

- 完成真实 Study 配置能力。
- 支持生产部署、备份、恢复和监控。
- 支持合规审计、隐私保护和数据导出审批流程。
- 支持多中心、多研究、多角色协作。
- 建立正式运维文档和安全响应流程。

## 正式产品发布前必须完成

- 权限隔离：为全部核心接口和前端路由建立角色 x Study x 资源矩阵测试，覆盖 `LZ_ADMIN` 全局视角、授权平台角色、研究级角色本 Study 访问和跨 Study 403。
- Study 配置冻结：所有 Study 必须在 `study_configurations` 中绑定 disease area、published CRF、visit plan、consent template 和 testing profile；新增患者不得在缺失 published CRF 时回退默认 LGL。
- 数据口径：所有全局管理列表、详情、导出、审计、文件和 Query 都必须显示 `Study ID`，并提供 Study selector 或明确的 `ALL_STUDIES` 范围。
- 数据质量：字段级 Query、访视窗口超窗预警和 CRF 字段名校验已有 Demo first pass；正式发布前继续补字段字典单位、范围、逻辑校验、漏访原因、样本温控/转运/冻存位置和组学结果结构化解析。
- 合规流程：审计 before/after diff、导出任务审计、eConsent 撤回/重签审批已有 Demo first pass；正式发布前继续补 reviewer UX、审批报表、扫描件归档和真实审计留痕策略。
- 生产基础：PostgreSQL schema/index/constraint/seed 分层迁移、对象存储/病毒扫描适配点、staging deploy dry-run 和 performance smoke 已有 RC first pass；正式发布前仍需托管 PostgreSQL runtime adapter、真实 OSS/S3/ClamAV 或供应商网关、集中身份源、密钥管理、TLS、监控告警、备份恢复演练和隐私数据发布检查。
- 自动化验证：API contract、权限越权、导出下载、移动端卡片视图、静态 HTML 导出、静态 runtime smoke、性能 smoke 和 `browser:matrix` 已纳入本地或 CI gate；正式发布前继续扩展到多浏览器截图基线。

## 技术债

- 当前已有 `npm run smoke:api`、`npm run smoke:ui`、`npm run regression:browser` 和 `npm run browser:matrix`，但还没有正式组件测试与多浏览器截图基线。
- 后端已具备本地签名 Bearer token、PBKDF2 密码哈希和账号禁用控制；生产部署仍需托管 secret、TLS、速率限制和集中身份源。
- mock data 与 API data 仍有重复映射维护成本。
- `resource/` 下包含历史原型，需要长期保留但避免误当主应用。
- 静态导出是生成产物，需要明确何时提交和刷新。

## 产品功能待办

- 研究配置中心。
- CRF 表单 schema 编辑器。
- 访视计划编辑器。
- 患者筛选和入排标准管理。
- 样本生命周期追踪。
- 多组学结果结构化解析。
- 数据质量 query 管理。
- 审计日志检索和导出。
- 导出任务审计和下载闭环。
- 多语言文案覆盖率检查。
