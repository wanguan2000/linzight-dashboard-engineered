# linzight-dashboard-engineered

当前版本：`v0.0.1-beta.0`

`linzight-dashboard-engineered` 是 LinZight 真实世界研究数据采集与管理系统的工程化 Demo。项目以患者为中心，覆盖研究工作台、患者队列、知情同意、临床数据采集、样本及检测、患者旅程、数据分析和系统管理，并提供可选 FastAPI + SQLite Demo 后端。前端在后端不可用时会自动回退到本地 mock/seed 数据，适合产品演示、静态 HTML 交付和后续增量开发。

未来 AI 接手本项目时，请先阅读：

1. `AGENTS.md`
2. `AI_HANDOFF.md`
3. `ARCHITECTURE.md`
4. `ROADMAP.md`
5. 本文件

## 技术栈

- 前端：Vite + React + TypeScript
- 样式：分层 CSS，医疗/科研运营型 dashboard 风格，玻璃拟态侧边栏、卡片、业务表格和状态标签
- 国际化：项目内轻量 i18n，支持中文和英文，默认中文
- 后端：FastAPI + Pydantic + SQLite Demo API
- 数据：本地 mock data + `backend/seed.py` 初始化数据
- 静态导出：`npm run export:html` 生成可直接打开的交互式 HTML 页面

## 目录结构

```text
.
├── backend/                       # FastAPI + SQLite Demo 后端
├── docs/                          # 既有工程文档和协议说明
├── exports/html/                  # npm run export:html 生成的可交互 HTML 页面
├── public/                        # Vite 静态资源
├── resource/                      # 产品参考资料、截图、模板和历史原型
├── scripts/export-html-pages.mjs  # 静态 HTML 导出脚本
├── src/                           # React 前端源码
├── uploads/.gitkeep               # 本地上传目录占位；真实上传内容不提交
├── AGENTS.md                      # Codex/AI 长期项目规则
├── AI_HANDOFF.md                  # 当前状态和接手说明
├── ARCHITECTURE.md                # 架构说明
├── DEVELOPMENT.md                 # 开发流程
├── SETUP.md                       # clone 后启动说明
├── ROADMAP.md                     # 版本路线图
├── CHANGELOG.md                   # Keep a Changelog 风格变更记录
├── API.md                         # Demo API 与未来 API 规划
├── DEPLOYMENT.md                  # 部署说明
├── SECURITY.md                    # 安全与敏感信息规则
└── package.json
```

## 本地安装

建议使用 Node.js 20 LTS 或更新的 LTS 版本。

```bash
npm install
```

后端可选。如需运行 Demo API：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python seed.py
uvicorn main:app --reload --port 8000
```

## 本地启动

前端开发服务器：

```bash
npm run dev
```

浏览器打开 Vite 输出地址，通常是 `http://localhost:5173/`。如果端口被占用，Vite 会自动切换到下一个可用端口。

默认 Demo 登录账号可在 `src/data/auth.ts` 和 `backend/seed.py` 中查看；前端登录会优先调用后端认证，后端不可用时回退到本地 Demo 账号。

## 构建方式

```bash
npm run build
```

静态 HTML 导出：

```bash
npm run export:html
```

导出文件位于 `exports/html/`，包括：

- `index.html`
- `home-workbench.html`
- `patient-cohort-management.html`
- `informed-consent.html`
- `clinical-data-capture.html`
- `sample-testing.html`
- `patient-journey.html`
- `data-analysis.html`
- `system-management.html`

这些页面已内联主要前端 CSS 和 JS，可直接本地打开，也可部署到静态服务器。

## 环境变量

复制示例文件后按需修改：

```bash
cp .env.example .env.local
cp backend/.env.example backend/.env
```

常用变量：

| 变量 | 作用 |
| --- | --- |
| `VITE_API_BASE_URL` | 前端优先访问的 API 地址；为空时依次尝试本地 8000/8001 |
| `LINZIGHT_DATABASE_URL` | 后端 SQLite 数据库 URL |
| `LINZIGHT_POSTGRES_URL` | 预留 PostgreSQL 配置 |
| `LINZIGHT_UPLOADS_DIR` | 后端本地上传目录 |

不要提交 `.env`、`.env.local`、真实 token、真实患者数据或真实医疗敏感数据。

## 常见问题

### `npm run lint` 扫到生成目录怎么办？

当前 lint 脚本已限定为 `eslint src scripts`。不要把 `dist/`、`.next/`、`node_modules/`、上传目录或缓存目录加入 lint 范围。

### 前端没有后端是否能运行？

可以。`src/services/api.ts` 会优先访问 `VITE_API_BASE_URL`、`http://127.0.0.1:8000`、`http://127.0.0.1:8001`，失败后页面会使用本地 Demo 数据。

### 静态 HTML 为什么还会有 `assets/`？

导出脚本会内联构建后的 CSS/JS，但 Logo、PDF 等二进制静态资源仍保留在相邻目录，方便本地和静态部署浏览。

### 后端数据库文件是否提交？

不提交。`backend/linzight_demo.db` 是本地生成文件，已被 `.gitignore` 排除。需要数据时运行 `python backend/seed.py`。

## 后续开发入口

未来 AI 或开发者重新 clone 后，建议顺序：

```bash
git clone <repo-url>
cd linzight-dashboard-engineered
npm install
npm run build
npm run dev
```

然后阅读 `AGENTS.md` 和 `AI_HANDOFF.md`，按 `ROADMAP.md` 做增量开发。不要重写整个项目，不要大规模改变现有 UI 风格。
