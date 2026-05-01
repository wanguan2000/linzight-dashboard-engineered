# SETUP.md

## 从 GitHub clone 后如何运行

```bash
git clone <repo-url>
cd linzight-dashboard-engineered
npm install
npm run build
npm run dev
```

打开 Vite 输出的本地地址，通常是 `http://localhost:5173/`。

## 环境变量配置

前端：

```bash
cp .env.example .env.local
```

后端：

```bash
cp backend/.env.example backend/.env
```

如果只看前端 Demo，可以不创建环境变量文件。前端会自动尝试本地 API，并在不可用时回退到 mock 数据。

## 第一次启动步骤

1. 安装前端依赖：`npm install`
2. 构建确认：`npm run build`
3. 启动前端：`npm run dev`
4. 如需后端，进入 `backend/` 创建虚拟环境并安装依赖。
5. 初始化后端数据：`python seed.py`
6. 启动后端：`uvicorn main:app --reload --port 8000`

## 常见启动失败原因

- Node.js 版本过旧：升级到 Node.js 20 LTS 或更新 LTS。
- 依赖未安装：重新运行 `npm install`。
- 端口占用：Vite 会自动切换端口；后端可改用 `--port 8001`。
- 后端数据库不存在：运行 `python backend/seed.py` 或在 `backend/` 下运行 `python seed.py`。
- API 请求失败：检查 `VITE_API_BASE_URL`，或确认本地后端已启动。
- Python 虚拟环境未启用：确认 `source backend/.venv/bin/activate` 已执行。

## 如何确认项目运行正常

执行：

```bash
npm run lint
npm run build
```

前端运行后确认：

- 登录页正常显示。
- 中 / EN 语言切换可用。
- 登录后能进入首页工作台。
- 侧边栏可切换八个模块。
- 后端未启动时页面仍能展示 Demo 数据。

后端运行后确认：

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/patients
```
