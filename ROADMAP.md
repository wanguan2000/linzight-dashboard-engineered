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
- 继续梳理 Demo 数据和 mock fallback 边界；当前已完成 SLE CRF V0.1 schema、LZXK-01 肺癌耐药字段、Study 访视计划配置、随访记录与 70 名测试患者 seed 的前后端联动。
- 为导出 HTML 增加自动校验脚本；当前 `npm run smoke:ui` 已覆盖 8 个导出页面、关键英文文案、CRF migration approval、execution logs 和多 Study selector 文案。
- 补充 OpenAPI 或 API schema 导出；当前已加入 `npm run export:openapi` 并生成 `docs/openapi.json`，CI/release gate 会检查契约快照。
- 继续扩展当前 `study_id` 权限 Demo 的后端 API smoke tests；CI artifact 与 release gate 已建立，后续可增加分支保护状态检查。

## v0.1.0 建议计划

- 引入生产化 API 适配层。
- 将已落地的 Study 角色权限、审计、CRF 版本和数据质量规则扩展为生产级认证与审批流。
- 将 CRF schema 和样本字典进一步配置化；当前 SLE CRF V0.1 已以 JSON schema 接入前端与 seed，但还不是生产级 schema 编辑器。
- 增加文件上传安全策略、对象存储适配和脱敏下载。
- 建立完整前后端契约测试。

## v1.0.0 建议计划

- 完成真实 Study 配置能力。
- 支持生产部署、备份、恢复和监控。
- 支持合规审计、隐私保护和数据导出审批流程。
- 支持多中心、多研究、多角色协作。
- 建立正式运维文档和安全响应流程。

## 技术债

- 当前已有 `npm run smoke:api`，但还没有前端组件/浏览器自动化测试。
- 后端认证是 Demo token，不适合生产。
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
- 脱敏导出审批。
- 多语言文案覆盖率检查。
