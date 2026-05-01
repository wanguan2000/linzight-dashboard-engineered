# API.md

## 当前 API 状态

当前项目包含可选 FastAPI Demo 后端，入口为 `backend/main.py`。前端也可以在没有后端时运行，此时会使用 `src/data/` 中的 mock 数据。

默认 API base：

1. `VITE_API_BASE_URL`
2. `http://127.0.0.1:8000`
3. `http://127.0.0.1:8001`

## 已有接口分组

### Health 和 Seed

- `GET /health`
- `POST /seed`

### Auth

- `POST /auth/login`
- `GET /auth/me`

当前认证使用 demo token，不是生产级认证。

### Patients

- `GET /patients`
- `POST /patients`
- `GET /patients/{patient_id}`
- `PUT /patients/{patient_id}`
- `DELETE /patients/{patient_id}`
- `GET /patients/{patient_id}/panorama`
- `GET /patients/{patient_id}/journey`

### Samples

- `GET /samples`
- `POST /samples`
- `GET /samples/{sample_id}`
- `PUT /samples/{sample_id}`
- `DELETE /samples/{sample_id}`

### Visits

- `GET /visits`

### Omics

- `GET /omics`
- `POST /omics`
- `GET /omics/{record_id}`
- `PUT /omics/{record_id}`
- `DELETE /omics/{record_id}`

### Consents

- `GET /consents`
- `PUT /consents/{consent_id}`

### CRF

- `GET /crf`
- `POST /crf`
- `PUT /crf/{entry_id}`

### Files

- `GET /files`
- `POST /files`

上传分类包括 `consent`、`clinical`、`sample`、`omics_result`、`analysis_export`、`other`。临床、组学结果和分析导出类文件必须标记脱敏。

### Analytics 和 Quality

- `GET /analytics/summary`
- `GET /quality/issues`
- `POST /quality/run`

### Exports 和 Imports

- `POST /exports`
- `GET /exports`
- `GET /exports/{export_id}/download`
- `POST /imports/patients`

### Audit Logs

- `GET /audit-logs`

## 前端契约

- 后端响应类型在 `src/services/contracts.ts`。
- 数据转换逻辑在 `src/services/api.ts`。
- 更详细契约参考 `docs/02-api-contract.md` 和 `docs/03-frontend-backend-protocol.md`。

## 未来 API 规划

- `/studies`：研究项目、中心、版本和配置。
- `/dictionaries`：字段字典、样本类型、访视窗口、CRF schema。
- `/queries`：数据质量 query 创建、关闭、审计。
- `/permissions`：角色、权限矩阵、字段级权限。
- `/exports/requests`：脱敏导出审批。
- `/files/presign`：对象存储上传和下载。
- `/integrations`：EMR/LIS/组学平台接入状态。

## 生产化注意事项

- 替换 demo token 为正式认证。
- 加入 HTTPS、CSRF/CORS 策略、审计和速率限制。
- 所有患者相关数据必须脱敏或加权限控制。
- API schema 变更必须同步 `contracts.ts`、文档和测试。
