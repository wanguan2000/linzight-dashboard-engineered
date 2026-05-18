# DEVELOPMENT.md

## 开发环境要求

- Node.js：建议 20 LTS 或更新 LTS。
- npm：随 Node.js 安装即可。
- Python：建议 3.11+，仅在运行 FastAPI Demo 后端时需要。
- Git：用于分支、提交和发布。
- GitHub CLI：可选，用于创建 private repo、tag release 和 prerelease。
- Docker：可选，用于 `docker compose up --build` 一键启动 Demo。

## 安装依赖

```bash
npm install
```

后端依赖：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 启动开发服务器

前端：

```bash
npm run dev
```

后端：

```bash
createdb linzight_dashboard_engineered 2>/dev/null || true
cd backend
source .venv/bin/activate
python bootstrap.py
uvicorn main:app --reload --port 8000
```

默认后端连接 macOS 本地 PostgreSQL 数据库 `linzight_dashboard_engineered`。`python bootstrap.py` 会初始化 schema，并在数据库为空时生成三个 Demo Study（`LGL-1111`、`RWD-NMO-2026`、`LZXK-01`）、平台级/研究级角色、Study 成员、CRF 版本和按 `study_id` 隔离的患者、CRF、样本、组学、导出、质控、审计数据。`LZXK-01` 是真实世界肺癌耐药研究，默认 20 名患者。

## 构建

```bash
npm run build
```

静态 HTML 导出：

```bash
npm run export:html
```

## Lint

```bash
npm run lint
```

当前 lint 范围限定为 `src scripts`，避免扫描 `dist/`、`exports/`、`.next/` 等生成目录。

## 测试

当前 `npm test` 会依次运行 API smoke、OpenAPI 导出、静态 HTML 导出、UI smoke 和 release gate。发布前至少执行：

```bash
npm run lint
npm run build
npm run export:openapi
npm test
docker compose config
python3 -m compileall -q backend
```

如需保留或回滚本地 Demo 数据：

```bash
npm run backup:sqlite
npm run restore:sqlite -- backups/linzight-<timestamp>
```

未来建议增加：

- React component smoke tests。
- API contract tests。
- Playwright 核心路径测试。
- 更完整的权限矩阵和真实浏览器交互回归测试。

## 推荐 Git 工作流

- 默认分支：`main`。
- 功能分支：`codex/<short-task>`、`feature/<short-task>`。
- 修复分支：`fix/<short-bug>`。
- 发布分支：`release/<version>`。

## Commit Message 规范

建议使用简洁 conventional 风格：

- `feat: add cohort filter`
- `fix: handle API fallback timeout`
- `docs: update AI handoff`
- `chore: refresh static exports`
- `release: prepare v0.0.1-beta.0`

## 如何让 AI 继续开发

给 AI 的第一条指令应包含目标模块、验收命令和不允许重写项目的要求。AI 开工前必须读：

```text
AGENTS.md
AI_HANDOFF.md
README.md
ARCHITECTURE.md
ROADMAP.md
```

AI 修改功能后必须同步文档，并在最终报告中说明运行过的验证命令。
