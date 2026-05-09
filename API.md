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

登录响应会返回新角色码、`study_scope` 和 `study_memberships`。后续请求需要携带 Bearer token，后端按 `study_id` 自动过滤授权数据。

### Studies 和权限

- `GET /studies`
- `GET /studies/{study_id}/members`
- `POST /studies/{study_id}/members`
- `GET /studies/{study_id}/visit-plans`
- `POST /studies/{study_id}/visit-plans`
- `PUT /studies/{study_id}/visit-plans/{plan_id}`
- `GET /studies/{study_id}/crf-versions`
- `POST /studies/{study_id}/crf-versions`

RWD EDC 主链路统一使用 `study_id`，不使用 `project_id`。样本检测项目编号使用 `testing_project_id`。
当前 seed 包含 `LGL-1111`、`RWD-NMO-2026` 和 `LZXK-01`；`LZXK-01` 是真实世界肺癌耐药研究，默认 20 名患者，并有独立 Study 角色和 CRF V1.0。

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

`study_visit_plans` 保存每个 Study 的访视配置，`visits.visit_plan_id` 关联该配置。新建患者时后端会按当前 Study 的 active 访视计划生成初始访视，并为每个计划指定的 `required_forms` 创建 CRF 草稿。

### Follow-up Records

- `GET /follow-up-records`
- `POST /follow-up-records`
- `PUT /follow-up-records/{record_id}`

随访记录隶属于患者信息，使用 `study_id + patient_id` 隔离，可选通过 `visit_id` 关联某次随访访视。字段覆盖随访时间、方式、随访人、生存状态、疾病状态、症状体征、影像/检验结论、疗效评估、转移情况、不良事件、生活质量、失访原因和记录时间。

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

当前 Demo CRF 使用 `resource/sle-crf-v0.1.schema.json`，由 `resource/SLE临床数据记录表.csv` 生成。API 仍返回解码后的 `patients.clinical_data` 与 `crf_entries.payload` JSON object，二者均包含 `CRF版本: "V0.1"`。

SQLite 存储层优先使用 JSONB（二进制 JSON）BLOB：

- `patients.clinical_data_jsonb` 保存患者宽表 CRF payload，`clinical_data_version` 当前为 `V0.1`，`clinical_data_format` 为 `jsonb` 或 `json`。
- `crf_entries.payload_jsonb` 保存 CRF 模块 payload，`payload_version` 当前为 `V0.1`，`payload_format` 为 `jsonb` 或 `json`。
- `clinical_data_json` 与 `payload_json` 保留为 TEXT JSON 兼容字段，用于迁移、调试和不支持 SQLite `jsonb()` 的运行环境。

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

- `/studies`：Study、中心、版本和配置。
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
