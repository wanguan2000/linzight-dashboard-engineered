# 权限矩阵

本矩阵是 release candidate 的正式权限口径。后端安全边界由 `backend/permissions.py` 的 `role_can()` 和 `/permissions/matrix` 输出执行；前端菜单、按钮和 tooltip 只能作为体验层说明，不能作为安全边界。

## 角色

| 角色 | 类型 | 默认范围 |
| --- | --- | --- |
| `LZ_ADMIN` | 平台级 | 全部 Study |
| `LZ_CRC` | 平台级 | 授权 Study |
| `LZ_CRF_ADMIN` | 平台级 | 授权 Study |
| `LZ_DATA_MANAGER` | 平台级 | 授权 Study |
| `LZ_AUDITOR` | 平台级 | 授权 Study |
| `STUDY_PI` | 研究级 | 所属 Study |
| `STUDY_CRC` | 研究级 | 所属 Study |
| `STUDY_CONFIG_ADMIN` | 研究级 | 所属 Study |
| `STUDY_DATA_MANAGER` | 研究级 | 所属 Study |

## 操作矩阵

| 模块 | 操作 | API endpoint | 允许角色 |
| --- | --- | --- | --- |
| Study Configuration | 读取 Study 配置 | `GET /studies`, `GET /study-configurations`, `GET /studies/{study_id}/configuration` | 全部角色按 Study scope 读取 |
| Account and Study Members | 创建/更新账号与 Study 成员 | `POST /users`, `GET/POST /studies/{study_id}/members` | `LZ_ADMIN`, `STUDY_CONFIG_ADMIN` |
| Patient Cohort | 读取患者 | `GET /patients`, `GET /patients/{patient_id}`, `GET /patients/{patient_id}/panorama` | 全部角色按 Study scope 读取 |
| Patient Cohort | 新增/修改/删除患者 | `POST /patients`, `PUT /patients/{patient_id}`, `DELETE /patients/{patient_id}` | `LZ_ADMIN`, `LZ_CRC`, `STUDY_CRC` |
| Clinical Data Capture | 读取 CRF/访视 | `GET /crf`, `GET /visits`, `GET /patients/{patient_id}/journey` | 全部角色按 Study scope 读取 |
| Clinical Data Capture | 写入 CRF | `POST /crf`, `PUT /crf/{entry_id}` | `LZ_ADMIN`, `LZ_CRC`, `STUDY_CRC` |
| Clinical Data Capture | 写入随访记录 | `POST /follow-up-records`, `PUT /follow-up-records/{record_id}` | `LZ_ADMIN`, `LZ_CRC`, `STUDY_CRC` |
| System Management | 配置 CRF/访视计划/site | `POST/PUT /studies/{study_id}/crf-*`, `POST/PUT /studies/{study_id}/visit-plans`, `POST /studies/{study_id}/sites*` | `LZ_ADMIN`, `LZ_CRF_ADMIN`, `STUDY_CONFIG_ADMIN` |
| Informed Consent | 读取知情同意 | `GET /consents` | 全部角色按 Study scope 读取 |
| Informed Consent | 更新知情同意/发起撤回重签 | `PUT /consents/{consent_id}`, `POST /consents/{consent_id}/withdrawal-request`, `POST /consents/{consent_id}/resign-request` | `LZ_ADMIN`, `LZ_CRC`, `STUDY_CRC` |
| Samples and Testing | 写入样本 | `POST /samples`, `PUT /samples/{sample_id}` | `LZ_ADMIN`, `LZ_CRC`, `STUDY_CRC` |
| Samples and Testing | 写入组学检测 | `POST /omics`, `PUT /omics/{omics_id}` | `LZ_ADMIN`, `LZ_CRC`, `STUDY_CRC` |
| Files | 上传/下载/归档文件 | `POST /files`, `GET /files/{file_id}/download`, `POST /files/{file_id}/archive` | 写入：`LZ_ADMIN`, `LZ_CRC`, `STUDY_CRC`; 下载按文件 Study scope 和扫描状态校验 |
| Data Management | 运行质控和创建 Query | `POST /quality/run`, `POST /queries` | `LZ_ADMIN`, `LZ_CRC`, `LZ_DATA_MANAGER`, `STUDY_DATA_MANAGER` |
| Data Management | 导出和下载数据 | `POST /exports`, `GET /exports/{export_id}/download` | `LZ_ADMIN`, `LZ_DATA_MANAGER`, `STUDY_DATA_MANAGER` |
| Approval Center | 审批提交/批准/拒绝/取消/完成 | `POST /approvals*` | `LZ_ADMIN`, `LZ_DATA_MANAGER`, `STUDY_DATA_MANAGER`; 提交人不能自批 |
| Audit | 读取审计日志 | `GET /audit-logs` | `LZ_ADMIN`, `LZ_DATA_MANAGER`, `LZ_AUDITOR`, `STUDY_CONFIG_ADMIN`, `STUDY_DATA_MANAGER` |

## UI 规则

- 有权限：按钮可点击，成功/失败必须给出状态反馈。
- 无权限：按钮保持可见时必须 `disabled`，并用 `title`/tooltip 说明需要的角色或审批状态。
- 隐藏菜单只是减少噪音；所有写操作必须继续由后端独立校验并返回 403。
- 跨 Study 请求必须返回 403，不能只返回空列表或前端静默失败。

## 自动化检查

- `npm run smoke:api` 读取 `/permissions/matrix` 并校验关键角色。
- `npm run browser:matrix` 覆盖桌面和 390px 角色/路由矩阵。
- `npm run smoke:static-runtime` 覆盖静态导出中的 LZXK 肺癌 CRF 语义。
