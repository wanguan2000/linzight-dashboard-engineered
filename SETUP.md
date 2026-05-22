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

如果只看前端外壳，可以不创建环境变量文件。内部试点应连接 PostgreSQL 后端；API 不可用时只能作为静态/开发预览。

远程安装或升级时，除了数据库和上传目录，还必须配置首个管理员、公开访问地址和 SMTP。缺少 SMTP 时，登录页的“发送重置邮件”不会真正发出邮件。

```bash
LINZIGHT_INITIAL_ADMIN_EMAIL=guan.wang@linzight.com
LINZIGHT_INITIAL_ADMIN_PASSWORD=<secret>
LINZIGHT_PUBLIC_APP_URL=https://rws.createcured.com
LINZIGHT_SMTP_HOST=smtp.feishu.cn
LINZIGHT_SMTP_PORT=465
LINZIGHT_SMTP_SECURITY=ssl
LINZIGHT_SMTP_USERNAME=rws@linzight.com
LINZIGHT_SMTP_PASSWORD=<secret>
LINZIGHT_SMTP_FROM=rws@linzight.com
```

## 第一次启动步骤

1. 安装前端依赖：`npm install`
2. 构建确认：`npm run build`
3. 启动前端：`npm run dev`
4. 如需后端，确认本机 PostgreSQL 已启动，并创建本地库：`createdb linzight_dashboard_engineered 2>/dev/null || true`
5. 进入 `backend/` 创建虚拟环境并安装依赖。
6. 初始化后端数据：`python bootstrap.py`
7. 启动后端：`uvicorn main:app --reload --port 8000`

## Docker Compose 启动

如果本机已安装 Docker，可以直接启动前后端功能测试环境。Compose 后端默认连接宿主机 Homebrew PostgreSQL 17.10 数据库 `linzight_dashboard_engineered`，不再默认拉起内置 PostgreSQL 16 容器：

```bash
docker compose up --build
```

首次启动会在宿主机 PostgreSQL 17.10 库中初始化 schema，并在用户表为空时只创建首个 LZ 系统管理员，不会自动 seed Study、患者、样本、检测或测试用户。前端地址为 `http://127.0.0.1:5173/`，后端健康检查为 `http://127.0.0.1:8000/health`。

## 常见启动失败原因

- Node.js 版本过旧：升级到 Node.js 20 LTS 或更新 LTS。
- 依赖未安装：重新运行 `npm install`。
- 端口占用：Vite 会自动切换端口；后端可改用 `--port 8001`。
- 后端数据库不存在：先运行 `createdb linzight_dashboard_engineered 2>/dev/null || true`，再在 `backend/` 下运行 `python bootstrap.py`。
- API 请求失败：检查 `VITE_API_BASE_URL`，或确认本地后端已启动。
- Python 虚拟环境未启用：确认 `source backend/.venv/bin/activate` 已执行。

## 如何确认项目运行正常

执行：

```bash
npm run lint
npm run build
npm run export:openapi
npm test
docker compose config
```

前端运行后确认：

- 登录页正常显示，可选择 `Study 研究入口`、研究编号 `study_id` 或 `LZ 系统管理` 后再登录。
- 中 / EN 语言切换可用。
- 登录后能进入首页工作台。
- 侧边栏可切换八个模块。
- 正式数据状态以 PostgreSQL 后端返回为准；后端未启动时只验证前端外壳，不作为正式数据状态判断。

后端运行后确认：

```bash
curl http://127.0.0.1:8000/health
```

患者、CRF、样本、导出和审计接口都需要 Bearer token，并会按当前用户的 `study_id` 授权范围过滤。正式空库只有首个 LZ 系统管理员；如需测试账号和三 Study fixture，显式运行 `python backend/seed.py`。

## 旧 SQLite 测试库备份恢复

```bash
npm run backup:postgres
npm run backup:sqlite
npm run restore:sqlite -- backups/linzight-<timestamp>
```

PostgreSQL 备份演练会生成 `pg_dump` custom-format dump 和 `reports/postgres-backup-drill.json`；SQLite 备份仅用于旧测试库。备份路径默认是 `./backups`，已被 Git ignore。更多部署与运维说明见 `docs/deployment-ops.md`。
