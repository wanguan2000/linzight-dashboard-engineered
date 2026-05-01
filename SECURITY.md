# SECURITY.md

## 基本规则

- 不提交 `.env`、`.env.local` 或任何真实环境变量文件。
- 不提交真实 token、API key、GitHub token、OpenAI key、数据库密码或私钥。
- 不提交真实患者隐私数据。
- 不提交真实医疗敏感数据。
- 不提交本地数据库、上传文件、缓存、构建产物或 IDE/system 文件。

## 环境变量

只提交示例文件：

- `.env.example`
- `backend/.env.example`

本地开发请复制到未跟踪文件：

```bash
cp .env.example .env.local
cp backend/.env.example backend/.env
```

## GitHub Secrets 建议

生产或 CI 中需要的敏感配置应放在 GitHub Actions secrets 或部署平台 secrets：

- `VITE_API_BASE_URL`
- 数据库连接串
- 对象存储 key
- 第三方 API token
- Release/deploy token

不要把 secret 写入源码、文档、issue、PR 或 release notes。

## 医疗和患者数据

- Demo 数据必须使用匿名、脱敏或虚构数据。
- 上传文件默认视为敏感，不提交 Git。
- `clinical`、`omics_result`、`analysis_export` 类文件必须标记脱敏后再进入后端上传接口。
- 导出数据应走审批、审计和脱敏流程。

## 依赖安全检查建议

本地可运行：

```bash
npm audit
```

后续建议在 CI 中增加：

- `npm audit --audit-level=high`
- Dependabot alerts
- GitHub secret scanning
- CodeQL 或等价静态扫描

## 发现敏感信息怎么办

1. 立即停止提交和 push。
2. 从工作区和暂存区移除敏感文件或内容。
3. 更新 `.gitignore`。
4. 如果 secret 已经进入 Git 历史，立即轮换 secret，并按需清理历史。
5. 在 handoff 或发布报告中记录风险和处理状态。
