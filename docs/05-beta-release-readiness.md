# Beta 发布准备与验证记录

记录日期：2026-05-10

更新：2026-05-12 增加 `npm run release:check`、`docs/release-checklist.md`、`npm run export:openapi`、`Dockerfile.frontend`、`Dockerfile.backend`、`docker-compose.yml`、`docs/deployment-ops.md` 和 Demo SQLite 备份恢复脚本，CI 会在 lint/build/API smoke/OpenAPI export/HTML export/UI smoke 后执行 release gate，并上传 `exports/html/` 静态 HTML artifact。`npm run smoke:api`、`npm run smoke:ui` 和 `.github/workflows/ci.yml` 可自动启动临时 FastAPI + SQLite 实例并验证 Study 隔离、权限矩阵、用户创建、CRF 字段写入、CRF 版本迁移审批/发布、知情同意文件上传、样本/组学创建、导出权限和审计日志；静态 UI smoke 会检查 8 个 HTML 导出页面、关键按钮文案和 CRF migration approval 文案。

本文记录 `v0.0.1-beta.0` 进入 GitHub private beta 前的工程验证结果。当前结论是：项目适合发布为 Demo / private beta 仓库，不适合作为生产级临床系统直接部署。

## 已完成检查

- 代码审查：检查前后端 Study 权限、`study_id` 隔离、CRF 版本、访视计划、随访记录、患者旅程聚合与静态导出链路。
- 后端 CRUD smoke：使用临时 SQLite 数据库验证登录、患者创建/更新/删除、样本创建/更新/删除、组学创建/更新/删除、CRF 创建/更新、随访创建/更新、访视计划 upsert/update、Patient Journey 聚合、跨 Study 403 权限拒绝。
- 自动化 API smoke：`npm run smoke:api` 通过临时数据库验证 LZXK-01 Study 用户登录、患者查询隔离、跨 Study 403、用户创建权限、CRF 字段更新、CRF 版本草稿/迁移审批/发布、提交人自审拒绝、execution logs 及审计、知情同意文件上传、样本/组学创建、PI 导出拒绝和数据管理员导出成功。
- OpenAPI 契约快照：`npm run export:openapi` 生成 `docs/openapi.json`，CI 与 release gate 会验证导出脚本和快照文件存在。
- 自动化 UI smoke：`npm run smoke:ui` 检查 `exports/html` manifest、8 个模块 HTML、初始模块 boot script、内联 CSS/JS、登录页英文文案、知情同意英文关键文案、关键英文按钮文案、CRF migration approval、execution logs、separate reviewer 和多 Study selector 文案，以及静态资源引用。
- Release gate：`npm run release:check` 检查必备脚本、交接文档、API/协议文档、发布检查文档、CI gate、8 个静态导出页、禁止跟踪的环境/数据库/上传/依赖/缓存文件和大文件。
- Docker Compose：已提供前端/后端镜像和本地 Demo 编排，后端首次启动会在 SQLite volume 中 seed 三 Study Demo 数据；`docker compose config` 用于校验编排文件语法。
- Docker 实测：Docker Desktop 启动后，`docker compose build` 和 `docker compose up -d` 已通过；后端容器首次启动成功 seed 70 名患者，`GET /health` 与 `POST /auth/login` 正常，前端容器通过 `http://localhost:5173/` 可访问。前端 Dockerfile 已复制 `resource/sle-crf-v0.1.schema.json`，避免容器内 TypeScript build 缺 CRF schema。
- 部署运维：已补 `docs/deployment-ops.md`，包括环境变量清单、Nginx 反向代理示例、Docker Compose 说明和 Demo SQLite/上传目录备份恢复脚本。
- 浏览器交互补充：System Management 的平台角色 Study selector 已验证可切换到 `LZXK-01` 并重新加载该 Study 的成员、CRF 字段、CRF migration 和访视计划；同一 requester 的 CRF migration Approve/Apply 在前端禁用并显示 separate reviewer 状态。
- 浏览器英文文案补充：`sample-testing`、`system-management`、`data-analysis`、`home-workbench` 在 `locale=en-US` 下复查无可见中文残留，语言切换控件除外。
- CI：`.github/workflows/ci.yml` 会在 push/PR 上运行 npm install、lint、build、Python backend compile、`npm run smoke:api`、`npm run export:openapi`、`npm run export:html`、`npm run smoke:ui`、`npm run release:check`、`npm run smoke:docker`，并上传 `exports/html/` artifact。
- 前端浏览器 smoke：验证 Study 登录、LZXK-01 后端实时数据展示、患者列表筛选数据、患者“查看”进入 Journey、“编辑”进入临床数据采集、模块切换与控制台错误。
- 配置检查：确认 `LINZIGHT_DATABASE_URL` 已被后端连接函数实际读取，可使用临时或自定义 SQLite 路径运行验证。
- 敏感信息检查：扫描常见 token、API key、私钥、明文 secret 模式，未发现命中。
- 大文件检查：历史原型目录 `resource/clinical-patient-journey-nextjs/` 下存在未跟踪依赖和构建缓存，但未被 Git 跟踪；`.gitignore` 已覆盖这些目录。
- 依赖安全检查：`npm audit --audit-level=high --omit=dev` 未发现高危生产依赖漏洞。
- 构建检查：`npm run lint`、`npm run build`、`npm run export:html`、`npm run smoke:ui`、`python -m compileall -q backend` 通过。

## 发布前已修复

- 后端 `connect()` 原先声明支持 `LINZIGHT_DATABASE_URL`，但实际总是连接默认 `backend/linzight_demo.db`；已修复为读取 `sqlite:///...` 配置路径。
- 首页欢迎语原先写死为默认 PI 名称；已改为按当前登录用户展示，避免多 Study / 多角色演示时产生误导。

## Beta 发布范围

- 前端：Vite + React + TypeScript dashboard，支持登录、Study scope、模块路由、患者队列、知情同意、临床数据采集、样本及检测、患者旅程、数据分析和系统管理。
- 后端：FastAPI + SQLite Demo API，包含签名 Bearer token、Study 权限、CRUD、导出、导入、质量规则、审计和患者全景接口。
- 数据：三 Study demo seed，SLE CRF V0.1 schema，LZXK-01 肺癌耐药字段和患者/访视/随访/样本/组学数据。
- 交付：源码、工程文档、环境示例、静态 HTML 导出产物。

## 仍需完成的正式化工作

- GitHub Actions：artifact 上传和 release checklist gate 已完成；后续可增加缓存细化、分支保护状态检查和 release approval gate。
- 自动化测试：补前端组件/交互测试、扩展后端 API 测试、权限矩阵回归测试和真实浏览器 smoke 脚本；当前已有 API smoke、OpenAPI 导出、静态 UI smoke、`npm test` 综合 smoke 和 release gate。
- 安全：本地签名 token、密码策略、PBKDF2 密码哈希和账号禁用已完成；后续增加字段级权限、脱敏规则、导出审批、文件病毒扫描和对象存储安全策略。
- 合规：完善真实患者数据进入系统前的脱敏流程、审计检索、下载审批、数据留存和删除策略。
- 配置与安装：Docker Compose Demo、环境变量清单、Nginx 反向代理示例和 Demo 备份恢复说明已完成；后续补生产数据库迁移、对象存储、正式备份策略和恢复演练。
- 数据层：将 SQLite Demo 明确升级为生产数据库适配层，并补迁移工具和 schema 版本管理。
- 发布管理：release checklist 与 CHANGELOG 发布段落已建立；后续创建实际版本 tag、GitHub release notes，并在发布前确认回滚 artifact。

## 当前限制

- 当前删除、新增等完整编辑动作主要通过后端 API 验证；前端患者队列已提供 Demo 级新建/编辑表单，但还不是生产级患者主数据向导。
- 后端仍是 Demo API，使用 SQLite 和本地签名 token，不应承载真实患者隐私数据。
- `exports/html/` 是生成产物，源码变化后必须重新运行 `npm run export:html`。
