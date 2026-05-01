# LinZight Demo Release Notes

## v0.0.1-beta.0

发布日期：2026-05-01

### 范围

- 整理为可上传 GitHub private 仓库的 beta 版本。
- 补齐未来开发者和 AI 接手所需文档。
- 统一版本号为 `0.0.1-beta.0`。
- 保留 Vite + React + TypeScript 前端、FastAPI + SQLite Demo 后端和八模块静态 HTML 导出能力。

### 文档

- 新增 `AGENTS.md`、`AI_HANDOFF.md`、`ARCHITECTURE.md`、`DEVELOPMENT.md`、`SETUP.md`、`ROADMAP.md`、`CHANGELOG.md`、`API.md`、`DEPLOYMENT.md`、`SECURITY.md`。
- 新增根目录 `.env.example` 和 `LICENSE`。
- 更新 `README.md` 作为 GitHub 入口。

### 已知限制

- 尚未配置 `test` 脚本。
- 后端仍是 Demo API，不是生产认证和生产数据库。
- CI/CD、Docker 和自动化浏览器测试待补充。

## 历史基线：0.01beta

发布日期：2026-04-27

## 范围

- 建立以患者为中心的真实世界研究数据采集与管理系统 Demo 基线。
- 默认研究编号：`LGL-1111`。
- 前端覆盖首页、患者队列、临床数据采集、知情同意、样本管理、多组学检测、患者旅程和数据分析/报表。
- 后端提供 FastAPI + SQLite CRUD 与单患者全景接口。

## 已完成

- 中文化导航与核心页面。
- LinZight 品牌 Logo 接入。
- 玻璃拟态侧边栏、卡片和业务表格样式。
- 默认入口调整为首页工作台，并支持通过 URL 参数、hash 或导出文件名定位指定模块。
- 患者队列管理页面与患者搜索/筛选/列表。
- 临床数据采集页面，包含 CRF 模块、随访、样本联动和样本库编码。
- 样本编号显示规则：`患者编号-Txx`，例如 `CJY-308-T01`。
- 样本库编码字典：`T01` 至 `T15`。
- 知情同意管理页面。
- 样本管理、多组学检测、患者旅程和报表页面。
- 样本及检测、系统管理页面纳入静态 HTML 导出范围。
- 新增 `npm run export:html`，生成首页工作台、患者队列管理、知情同意、临床数据采集、样本及检测、患者旅程、数据分析、系统管理 8 个可交互 HTML 页面。
- 新增中英双语显示层，支持登录页、全局导航、顶部栏和核心模块常见文案切换，默认中文并保存浏览器语言偏好。
- FastAPI 后端：患者、样本、组学检测 CRUD，患者全景接口。
- Seed 数据：6 个患者、10 个样本、10 条组学检测记录。

## 验收命令

```bash
npm run check
npm run export:html
backend/.venv/bin/python -m compileall -q backend
backend/.venv/bin/python -m backend.seed
```

## 后续开发建议

- 将样本库编码下沉到后端数据模型，增加样本类型字典表。
- 增加用户角色、权限和审计日志。
- 为 CRUD 表单补充真实提交、校验和错误提示。
- 增加 API 自动化测试和前端交互测试。
