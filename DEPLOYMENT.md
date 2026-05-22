# DEPLOYMENT.md

## 本地构建

```bash
npm install
npm run build
```

构建输出位于 `dist/`，该目录不提交 Git。

## 静态 HTML 部署

如需离线或静态站点交付：

```bash
npm run export:html
```

将 `exports/html/` 作为静态站点根目录部署即可。页面已内联主要 CSS 和 JS；Logo、PDF 等二进制静态资源保留在相邻目录。

## Vite 静态部署

适用于 Nginx、GitHub Pages、S3/CloudFront、Vercel Static、Netlify 等：

```bash
npm run build
```

部署 `dist/` 目录。生产 API 地址通过 `VITE_API_BASE_URL` 注入。

## Vercel 部署建议

当前主应用是 Vite，不是 Next.js。Vercel 配置建议：

- Build Command：`npm run build`
- Output Directory：`dist`
- Install Command：`npm install`
- Environment Variables：`VITE_API_BASE_URL`

如果只部署静态导出页面，可将 `exports/html/` 作为输出目录，但需要在 CI 中先运行 `npm run export:html`。

## Docker 部署建议

仓库提供最小 Docker Compose PostgreSQL 功能测试环境：

```bash
docker compose up --build
```

- `Dockerfile.frontend`：Node 22 Alpine 构建 Vite 应用，并用 `vite preview` 暴露 `5173`。
- `Dockerfile.backend`：Python 3.11 slim，安装 FastAPI 依赖，复制 `backend/` 与 CRF schema，并运行 uvicorn。
- `docker-compose.yml`：启动 PostgreSQL + backend + frontend，默认后端使用 PostgreSQL volume 和上传 volume `/uploads`。
- 后端首次启动时会执行 `python -m backend.bootstrap`，初始化 PostgreSQL schema，并在用户表为空时只创建首个 LZ 系统管理员；不会自动生成 Study、患者、样本、检测或测试用户。

默认访问地址：

```text
frontend: http://127.0.0.1:5173/
backend:  http://127.0.0.1:8000/
health:   http://127.0.0.1:8000/health
```

本 Compose 文件用于本地内部试点验证，不是生产编排。生产环境应替换为集中身份源、独立托管 PostgreSQL、对象存储、受控 CORS、TLS、日志采集和备份策略。

## 环境变量

前端：

- `VITE_API_BASE_URL`

远程 Nginx 同域反代部署时，前端构建必须使用 `VITE_API_BASE_URL=/api`，或保留代码里的同源 `/api` 默认值。不要让远程浏览器优先访问 `http://127.0.0.1:8000`，否则用户本机如果运行过旧后端，会登录到本地旧数据，看起来像远程页面回退到旧版本。

后端：

- `DATABASE_URL`
- `LINZIGHT_DATABASE_URL`
- `LINZIGHT_POSTGRES_URL`
- `LINZIGHT_UPLOADS_DIR`
- `LINZIGHT_BACKUP_DIR`
- `LINZIGHT_INITIAL_ADMIN_EMAIL`
- `LINZIGHT_INITIAL_ADMIN_PASSWORD`
- `LINZIGHT_PUBLIC_APP_URL`
- `LINZIGHT_SMTP_HOST`
- `LINZIGHT_SMTP_PORT`
- `LINZIGHT_SMTP_SECURITY`
- `LINZIGHT_SMTP_USERNAME`
- `LINZIGHT_SMTP_PASSWORD`
- `LINZIGHT_SMTP_FROM`

安装或升级远程系统时必须同时配置 `LINZIGHT_PUBLIC_APP_URL` 和 `LINZIGHT_SMTP_*`，否则“忘记密码 / 修改密码”只能生成后端 token 记录，不能发送重置邮件。真实生产密钥应放入部署平台 secret 或 systemd env file，不要写入仓库。

更完整的环境变量、Nginx 反向代理示例和旧 SQLite 测试库备份恢复说明见 `docs/deployment-ops.md`。

## 旧 SQLite 测试库备份恢复

本地旧 SQLite 测试库可备份 SQLite 数据库和上传目录：

```bash
npm run backup:sqlite
npm run restore:sqlite -- backups/linzight-<timestamp>
```

恢复脚本会先在 `backups/pre-restore-<timestamp>` 保留覆盖前副本。生产环境必须使用正式数据库备份、对象存储版本管理、访问控制和恢复演练，不能依赖该 Demo 脚本。

## 生产部署注意事项

- 不要把本地签名 Bearer token 当作真实患者生产认证。
- 不要使用本地 SQLite 作为正式运行数据库；正式版本数据库为 PostgreSQL，数据库 URL 必须放入受控环境变量或 systemd env file，不要写入仓库。
- 上传目录应使用持久化存储或对象存储。
- 患者数据和医疗敏感数据必须有脱敏、权限和审计。
- CORS 只允许可信前端域名。
- 建议启用依赖漏洞扫描和最小权限 GitHub secrets。
