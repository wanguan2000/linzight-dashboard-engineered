# UAT 和发布包

## 发布包内容

- `RELEASE_NOTES.md` / `docs/release-notes-v1.0.4.md`
- `docs/demo-readiness-checklist.md`
- `docs/07-production-release-candidate-workflows.md`
- `docs/08-permission-matrix.md`
- `docs/09-uat-release-package.md`
- `docs/openapi.json`
- `exports/html/`
- `backend/migrations/postgres/`
- `reports/browser-matrix.json`
- `reports/static-export-runtime-smoke.json`
- `reports/performance-smoke.json`

## 固定 UAT 角色

| 角色 | 账号 | UAT 链路 |
| --- | --- | --- |
| LZ Admin | configured initial admin | Study 创建/终止/删除、用户与 Study 授权范围、全局系统管理 |
| Study System Admin | user-created `STUDY_CONFIG_ADMIN` | 本 Study 患者、知情同意、CRF、访视、随访、样本、检测、文件、Query、质控、导出、审批、用户、成员和配置全权限；后端记录 operation logs |
| Study Data Manager | user-created `STUDY_DATA_MANAGER` | 本 Study 质控、Query、导出、Approval Center |

## UAT Checklist

- 登录入口按 Study / LZ 系统管理分流。
- `LZXK-01` 不显示 SLEDAI、C3、C4、IgG、免疫抑制剂或 NPSLE 知情同意。
- `LGL-1111` 保留免疫病 CRF。
- Admin 全局患者列表每行显示 Study ID。
- Study 角色跨 Study API 返回 403。
- Data Analysis 运行质控后，可从访视窗口问题创建 Query。
- Query 可回复、关闭、重开，并在 Query 状态中保留处理结果。
- eConsent 撤回/重签先进入审批中，Approval complete 后才变为已撤回/已重签。
- 文件上传记录 storage backend、bucket/key 或 local path、hash、size、MIME、scan status、Study ID、patient ID。
- 导出任务记录 Study、操作者、生成时间和下载行为。
- 390px 视口可跑患者、CRF、样本、Query、审批主链路；operation logs 由 API smoke 和数据库检查验证。
- 中英文切换无明显硬编码阻断。
- Release notes 明确：`v1.0.4` 是内部试点与真实业务场景验证版本，不可直接承载未经合规审批的真实患者生产数据。

## 回滚步骤

1. 前端回滚到上一版 `dist/` 或 `exports/html/` artifact。
2. 后端回滚到上一 Git tag 或镜像。
3. 数据库恢复到部署前 staging backup。
4. 对象存储回滚到部署前 prefix/version marker。
5. 重新运行 `npm run smoke:api`、`npm run smoke:crf-semantics`、`npm run browser:matrix`。

## 发布限制声明

当前 `v1.0.4` 内部试点包用于客户在受控环境中验证真实业务流程、角色权限、Study 配置和数据闭环；正式 Docker 启动为空库，仅保留首个 LZ 系统管理员。正式运行数据库固定为 PostgreSQL，SQLite 只允许隔离 smoke/旧迁移工具显式开启。真实患者生产上线前，必须完成生产 PostgreSQL runtime、集中身份源、真实对象存储、真实病毒扫描、安全审计、备份恢复演练、UAT 签字和合规评估。
