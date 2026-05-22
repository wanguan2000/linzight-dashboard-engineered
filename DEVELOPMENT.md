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

默认后端连接 macOS Homebrew PostgreSQL 17.10 本地数据库 `linzight_dashboard_engineered`。Docker Compose 后端也默认连接宿主机 `host.docker.internal:5432` 的同一个库，不再默认使用 Compose 内置 PG16。正式运行数据库必须是 PostgreSQL；如果将 `DATABASE_URL` 或 `LINZIGHT_DATABASE_URL` 配置为 `sqlite:///...`，必须显式设置 `LINZIGHT_ALLOW_SQLITE_RUNTIME=1`，且只能用于隔离 smoke、旧 SQLite 备份或迁移导出工具。`python bootstrap.py` 会初始化 schema，并在用户表为空时只创建首个 LZ 系统管理员，不会自动生成 Study、患者、样本或测试用户。需要测试 fixture 时，单独运行 `python seed.py`。

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

如需保留或回滚旧 SQLite 测试库数据：

```bash
npm run backup:sqlite
npm run restore:sqlite -- backups/linzight-<timestamp>
```

未来建议增加：

- React component smoke tests。
- API contract tests。
- Playwright 核心路径测试。
- 更完整的权限矩阵和真实浏览器交互回归测试。

## 业务编号规则

- Study Code：`studies.code` 由后端规范为 `01`-`99` 两位数字，`study_id` 仍是路由、权限和数据隔离键。
- 患者编号：`patients.patient_number` 由后端自动生成，全局唯一，从 `H00010` 到 `H99999`；前端创建和编辑时只读，后端忽略请求里的 `patient_number` 与兼容字段 `name`。
- 样本编号：`samples.id` 由后端自动生成且不可修改，格式为 `S` + 两位 Study Code + 患者编号后三位 + 该患者样本序号 `01`-`99`，例如 Study Code `05`、患者编号 `H00080` 的第一个样本为 `S0508001`。
- 样本余量：后端按 `initial_quantity - sum(sample_usage.usedQuantity) + sum(sample_usage.returnedQuantity)` 自动计算 `remaining_quantity`，前端只读展示，不再提供手工校正量。

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
