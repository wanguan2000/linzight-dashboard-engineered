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

仓库提供最小 Docker Compose Demo 环境：

```bash
docker compose up --build
```

- `Dockerfile.frontend`：Node 22 Alpine 构建 Vite 应用，并用 `vite preview` 暴露 `5173`。
- `Dockerfile.backend`：Python 3.11 slim，安装 FastAPI 依赖，复制 `backend/` 与 CRF schema，并运行 uvicorn。
- `docker-compose.yml`：启动 frontend + backend，后端使用 SQLite volume `/data/linzight_demo.db` 和上传 volume `/uploads`。
- 后端首次启动时如果 `/data/linzight_demo.db` 不存在，会执行 `python -m backend.seed` 生成三 Study Demo 数据。

默认访问地址：

```text
frontend: http://127.0.0.1:5173/
backend:  http://127.0.0.1:8000/
health:   http://127.0.0.1:8000/health
```

本 Compose 文件用于本地 Demo / private beta 验证，不是生产编排。生产环境应替换为正式认证、独立数据库、对象存储、受控 CORS、TLS、日志采集和备份策略。

## 环境变量

前端：

- `VITE_API_BASE_URL`

后端：

- `LINZIGHT_DATABASE_URL`
- `LINZIGHT_POSTGRES_URL`
- `LINZIGHT_UPLOADS_DIR`
- `LINZIGHT_BACKUP_DIR`

真实生产密钥应放入部署平台 secret，不要写入仓库。

更完整的环境变量、Nginx 反向代理示例和 Demo SQLite 备份恢复说明见 `docs/deployment-ops.md`。

## Demo 备份恢复

本地 private beta 验证可备份 SQLite Demo 数据库和上传目录：

```bash
npm run backup:sqlite
npm run restore:sqlite -- backups/linzight-<timestamp>
```

恢复脚本会先在 `backups/pre-restore-<timestamp>` 保留覆盖前副本。生产环境必须使用正式数据库备份、对象存储版本管理、访问控制和恢复演练，不能依赖该 Demo 脚本。

## 生产部署注意事项

- 不要部署 demo token 认证作为生产认证。
- 不要使用本地 SQLite 作为生产主库。
- 上传目录应使用持久化存储或对象存储。
- 患者数据和医疗敏感数据必须有脱敏、权限和审计。
- CORS 只允许可信前端域名。
- 建议启用依赖漏洞扫描和最小权限 GitHub secrets。
