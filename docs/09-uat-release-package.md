# UAT 和发布包

## 发布包内容

- `RELEASE_NOTES.md` / `docs/release-notes-v0.2.0-production-demo-rc1.md`
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
| LZ Admin | `admin@demo.linzight` | 全部 Study、患者 Study ID、系统管理、审批、审计 |
| Lung Study CRC | `lung-crc@demo.linzight` | `LZXK-01` 患者、CRF、eConsent、样本、Journey、数据分析质控转 Query |
| Lung Study Data Manager | `lung-dm@demo.linzight` | `LZXK-01` 质控、Query、导出、Approval Center、Audit Diff |

## UAT Checklist

- 登录入口按 Study / LZ 系统管理分流。
- `LZXK-01` 不显示 SLEDAI、C3、C4、IgG、免疫抑制剂或 NPSLE 知情同意。
- `LGL-1111` 保留免疫病 CRF。
- Admin 全局患者列表每行显示 Study ID。
- Study 角色跨 Study API 返回 403。
- Data Analysis 运行质控后，可从访视窗口问题创建 Query。
- Query 可回复、关闭、重开，并在 Audit Diff 里留痕。
- eConsent 撤回/重签先进入审批中，Approval complete 后才变为已撤回/已重签。
- 文件上传记录 storage backend、bucket/key 或 local path、hash、size、MIME、scan status、Study ID、patient ID。
- 导出任务记录 Study、操作者、生成时间和下载行为。
- 390px 视口可跑患者、CRF、样本、Query、审批、审计主链路。
- 中英文切换无明显硬编码阻断。
- Release notes 明确：Demo/private beta，不可直接承载真实患者生产数据。

## 回滚步骤

1. 前端回滚到上一版 `dist/` 或 `exports/html/` artifact。
2. 后端回滚到上一 Git tag 或镜像。
3. 数据库恢复到部署前 staging backup。
4. 对象存储回滚到部署前 prefix/version marker。
5. 重新运行 `npm run smoke:api`、`npm run smoke:crf-semantics`、`npm run browser:matrix`。

## 发布限制声明

当前 release candidate 仅用于客户演示和内部试点。真实患者生产上线前，必须完成生产 PostgreSQL runtime、集中身份源、真实对象存储、真实病毒扫描、安全审计、备份恢复演练、UAT 签字和合规评估。
