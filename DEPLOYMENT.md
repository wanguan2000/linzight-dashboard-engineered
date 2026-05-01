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

当前仓库尚未提供 Dockerfile。后续建议：

- `Dockerfile.frontend`：Node build + Nginx serve `dist/`。
- `Dockerfile.backend`：Python slim + FastAPI + uvicorn。
- `docker-compose.yml`：frontend、backend、postgres 或 sqlite volume。

最小方向：

```text
frontend: npm run build -> serve dist
backend: pip install -r backend/requirements.txt -> uvicorn backend.main:app
```

## 环境变量

前端：

- `VITE_API_BASE_URL`

后端：

- `LINZIGHT_DATABASE_URL`
- `LINZIGHT_POSTGRES_URL`
- `LINZIGHT_UPLOADS_DIR`

真实生产密钥应放入部署平台 secret，不要写入仓库。

## 生产部署注意事项

- 不要部署 demo token 认证作为生产认证。
- 不要使用本地 SQLite 作为生产主库。
- 上传目录应使用持久化存储或对象存储。
- 患者数据和医疗敏感数据必须有脱敏、权限和审计。
- CORS 只允许可信前端域名。
- 建议启用依赖漏洞扫描和最小权限 GitHub secrets。
