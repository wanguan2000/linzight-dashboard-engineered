# AGENTS.md

本文件是 Codex、ChatGPT 或其他 AI 继续开发 `linzight-dashboard-engineered` 时必须遵守的长期项目规则。

## 项目背景

本项目是 LinZight 真实世界研究数据采集与管理系统的工程化 Demo，目标是展示以患者为中心的研究运营、临床数据采集、知情同意、样本及多组学检测、患者旅程和数据分析工作流。当前版本为 `v0.2.0-production-demo`，适合作为 Demo 发布版本继续迭代；不可直接承载真实患者生产数据。

## 技术栈

- Vite + React + TypeScript
- 分层 CSS：`src/styles/tokens.css`、`base.css`、`layout.css`、`components.css`
- 轻量项目内 i18n：`src/i18n/`
- 可选 FastAPI + SQLite Demo 后端：`backend/`
- 静态 HTML 导出脚本：`scripts/export-html-pages.mjs`

## 必须先阅读的文件

1. `README.md`
2. `AI_HANDOFF.md`
3. `ARCHITECTURE.md`
4. `ROADMAP.md`
5. `docs/frontend-html-export.md`
6. `docs/02-api-contract.md`
7. `docs/03-frontend-backend-protocol.md`

## 目录约定

- `src/components/`：React 页面和业务组件。
- `src/data/`：前端 mock/demo 数据。
- `src/services/`：API 客户端、接口契约映射。
- `src/i18n/`：中英双语运行时和文案。
- `backend/`：FastAPI Demo 后端、schema、seed 数据。
- `exports/html/`：静态 HTML 导出产物；通过 `npm run export:html` 生成。
- `resource/`：产品参考资料、截图、历史原型和模板。不要把这里当运行时源码随意重构。
- `uploads/`：本地上传目录。只提交 `.gitkeep`，不要提交上传文件。

## 运行命令

```bash
npm install
npm run dev
```

后端可选：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python seed.py
uvicorn main:app --reload --port 8000
```

## 构建命令

```bash
npm run build
npm run export:html
```

## 测试命令

当前项目没有配置专门的 `test` 脚本。每次提交前至少运行：

```bash
npm run lint
npm run build
```

如果修改后端，还要运行：

```bash
python3 -m compileall -q backend
```

## UI 风格约定

- 保持医疗科研运营 dashboard 风格：信息密度适中、可扫描、克制、专业。
- 不要把项目改成营销落地页，不要增加大型 hero 区。
- 保留当前侧边栏、顶部栏、卡片、表格、状态标签、AI 命令栏的视觉语言。
- 新增模块优先复用现有 CSS token 和组件结构，不要引入完全不同的设计系统。
- 中英文切换要继续可用；新增可见文案时同步更新 `src/i18n/messages.zh-CN.ts` 和 `src/i18n/messages.en-US.ts`。

## 代码风格约定

- 优先使用现有 React 函数组件和 TypeScript 类型。
- 保持 API 映射集中在 `src/services/api.ts` 和 `src/services/contracts.ts`。
- mock 数据放在 `src/data/`，不要散落到组件内部。
- 不要随意升级依赖或引入大型依赖。
- 不要把生成目录加入 lint、build 或 git 提交范围。
- 不要提交真实 `.env`、token、患者隐私数据、医疗敏感数据、数据库文件或上传文件。

## 不允许做的事情

- 不要重写整个项目。
- 不要大规模重构业务代码。
- 不要改变现有 UI 风格作为默认行为。
- 不要删除已有核心功能或导出页面。
- 不要提交 `node_modules/`、`.next/`、`dist/`、`build/`、`.env`、本地数据库、上传文件和缓存。
- 不要伪造 GitHub push、tag、release 成功状态。

## 完成一次任务前必须检查

1. `git status --short --branch`
2. `npm run lint`
3. `npm run build`
4. 如修改导出逻辑，运行 `npm run export:html`
5. 如修改后端，运行 `python3 -m compileall -q backend`
6. 检查是否新增敏感信息或大文件
7. 确认 `.gitignore` 仍覆盖生成目录和私有数据

## 修改功能后必须同步更新

- 用户入口或运行方式变化：更新 `README.md`、`SETUP.md`、`DEVELOPMENT.md`。
- 架构、数据流或模块结构变化：更新 `ARCHITECTURE.md`。
- API 或后端契约变化：更新 `API.md`、`docs/02-api-contract.md`、`docs/03-frontend-backend-protocol.md`。
- 发布范围或已知问题变化：更新 `AI_HANDOFF.md`、`CHANGELOG.md`、`ROADMAP.md`。
- 静态 HTML 导出变化：更新 `docs/frontend-html-export.md` 和 `exports/html/README.md`。
