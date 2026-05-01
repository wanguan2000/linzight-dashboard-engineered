# DEVELOPMENT.md

## 开发环境要求

- Node.js：建议 20 LTS 或更新 LTS。
- npm：随 Node.js 安装即可。
- Python：建议 3.11+，仅在运行 FastAPI Demo 后端时需要。
- Git：用于分支、提交和发布。
- GitHub CLI：可选，用于创建 private repo、tag release 和 prerelease。

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
cd backend
source .venv/bin/activate
python seed.py
uvicorn main:app --reload --port 8000
```

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

当前项目没有配置 `test` 脚本。发布前至少执行：

```bash
npm run lint
npm run build
python3 -m compileall -q backend
```

未来建议增加：

- React component smoke tests。
- API contract tests。
- Playwright 核心路径测试。
- GitHub Actions 自动执行 lint/build/test。

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
