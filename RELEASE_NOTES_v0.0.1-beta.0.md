# v0.0.1-beta.0

## 当前状态

这是 `linzight-dashboard-engineered` 的首个 GitHub beta 预发布版本，面向 private 仓库协作、AI 接手开发和后续产品化迭代。

## 已包含功能

- Vite + React + TypeScript dashboard。
- 八个核心业务模块：首页工作台、患者队列管理、知情同意、临床数据采集、样本及检测、患者旅程、数据分析、系统管理。
- 中英文切换。
- 可选 FastAPI + SQLite Demo 后端。
- 本地 mock fallback。
- 八个可交互静态 HTML 页面导出。

## 文档清单

- `README.md`
- `AGENTS.md`
- `AI_HANDOFF.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT.md`
- `SETUP.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `API.md`
- `DEPLOYMENT.md`
- `SECURITY.md`

## 已知限制

- 尚未配置 `test` 脚本。
- 后端为 Demo 级实现，不适合作为生产认证或生产数据库。
- CI/CD、Docker、生产 API 接入和自动化浏览器测试仍待补充。

## 下一步计划

- 增加 GitHub Actions。
- 增加前端和后端 smoke tests。
- 完善 API 契约和生产部署路径。
- 引入权限、审计、脱敏和数据质量工作流。

## AI 继续开发说明

未来 AI 接手前必须先阅读 `AGENTS.md` 和 `AI_HANDOFF.md`。后续开发应以增量修改为主，不要重写项目，不要大规模改变现有 UI 风格。
