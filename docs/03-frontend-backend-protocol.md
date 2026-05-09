# 前后端联调数据协议

## 字段命名

- 后端 API 固定使用 `snake_case`。
- 前端 React 组件继续使用既有 `camelCase`/业务中文字段结构。
- `src/services/contracts.ts` 是后端响应的 TypeScript source of truth。
- `src/services/api.ts` 负责将后端结构转换为前端组件结构。

## 当前映射

CRF 字段字典当前来自 `resource/sle-crf-v0.1.schema.json`。前端通过 `src/data/crfTemplate.ts` 读取分组和字段，后端 `backend/seed.py` 使用同一份 schema 生成患者 `clinical_data` 和 `crf_entries.payload`。SQLite 存储层优先将同一 payload 写入 JSONB BLOB，API 层解码后仍按 JSON object 返回给前端。

所有 RWD EDC 主链路数据使用 `study_id` 做隔离。前端会在登录后保存 `study_scope`，API 请求自动携带 Bearer token；后端不可用时，本地 fallback 数据也按当前用户 Study scope 过滤。

访视计划由 `study_visit_plans` 配置，不写入 CRF 字段表。`visits` 是患者实际访视记录，通过 `visit_plan_id` 关联配置；新建患者时后端按当前 Study active 访视计划自动生成访视和初始 CRF 草稿。

随访记录由 `follow_up_records` 保存，不写入 CRF 版本配置表。它隶属于患者信息，绑定 `study_id + patient_id`，并可选通过 `visit_id` 关联某次随访访视，用于记录随访方式、随访人、生存/疾病状态、疗效、转移、不良事件、生活质量和失访原因。

| 后端字段 | 前端字段 | 说明 |
| --- | --- | --- |
| `study_id` | `studyId` | RWD EDC Study 隔离字段 |
| `visit_plan_id` | `visitPlanId` | 患者访视关联的 Study 访视计划 |
| `visit_plan_code` | `visitPlanCode` | `V1`、`V2`、`V3` 等访视计划编码 |
| `day_offset` / `plan_day_offset` | `dayOffset` / `planDayOffset` | 相对基线天数 |
| `window_before_days` / `window_after_days` | `windowBeforeDays` / `windowAfterDays` | 访视窗口 |
| `follow_up_date` | `followUpDate` | 随访日期 |
| `follow_up_method` | `followUpMethod` | 门诊、电话、线上、家访或其他 |
| `followed_by` | `followedBy` | 随访人 |
| `survival_status` | `survivalStatus` | 生存状态 |
| `disease_status` | `diseaseStatus` | 无病、复发、转移、稳定、进展等疾病状态 |
| `symptoms_signs` | `symptomsSigns` | 症状与体征 |
| `imaging_lab_summary` | `imagingLabSummary` | 影像/检验关键结论 |
| `efficacy_assessment` | `efficacyAssessment` | 缓解、稳定、进展或未评估 |
| `metastasis_status` | `metastasisStatus` | 转移情况 |
| `adverse_events` | `adverseEvents` | 不良事件 |
| `quality_of_life` | `qualityOfLife` | 生活质量评估 |
| `lost_to_follow_up_reason` | `lostToFollowUpReason` | 失访原因 |
| `recorded_at` | `recordedAt` | 记录时间 |
| `hospital_no` | `hospitalNo` | 患者住院号 |
| `disease_type` | `diseaseType` | `NPSLE`、`Non-NPSLE`、`MS`、`NMOSD`、`HC`、`NSCLC`、`LUAD`、`LUSC`、`EGFR-TKI耐药`、`ALK耐药` |
| `clinical_data` | `clinicalData` | SLE CRF V0.1 宽表字段，保留中文字段名 |
| `clinical_data_version` | `clinicalDataVersion` | CRF payload 版本，当前为 `V0.1` |
| `clinical_data_format` | `clinicalDataFormat` | 后端存储格式，优先为 `jsonb` |
| `sample_type` | `sampleType` | 样本类型 |
| `collected_at` | `collectedAt` | 样本采集日期 |
| `linked_omics` | `linkedOmics` | 样本关联检测项目 |
| `testing_project_id` | `testingProjectId` | 样本检测项目编号，不等同于 RWD EDC Study |
| `sample_id` | `sampleId` | 组学检测关联样本 |
| `run_id` | `runId` | 检测批次号 |
| `sent_at` | `sentAt` | 送检日期 |
| `completed_at` | `completedAt` | 完成日期 |

CRF 模块响应中的 `payload_version` 与 `payload_format` 不直接渲染为录入字段，但用于校验 `payload` 与当前 CRF schema 的版本一致性。后端数据库保留 `clinical_data_json` / `payload_json` TEXT JSON 兼容字段；前端不直接依赖这些底层列。

CRF 录入响应还包含 `crf_version_id` 和 `form_id`。已录入数据必须保留原 `crf_version_id`；已发布 CRF 修改应生成新的 `study_crf_versions` 记录。

## 前端 fallback 规则

前端依次请求：

1. `VITE_API_BASE_URL`
2. `http://127.0.0.1:8000`
3. `http://127.0.0.1:8001`

如果 API 不可用，页面继续使用 `src/data/*.ts` 中的 Demo 数据。后端阶段完成后，接口返回结构必须与 `src/services/contracts.ts` 一致，避免破坏现有 fallback 行为。

当前 `fetchDemoDataset()` 在后端不可用时会回退到前端同批 70 名测试患者、样本、组学、访视和随访记录 mock 数据，保证临床数据采集、患者列表和患者旅程仍可展示。`LZXK-01` fallback 数据包含 20 名真实世界肺癌耐药研究患者和肺癌耐药字段。

前端 fallback 访视同样来自 `studyVisitPlans`：`LGL-1111`、`RWD-NMO-2026` 和 `LZXK-01` 各有独立 V1/V2/V3 配置，LZXK-01 的 V2/V3 展示为耐药评估和疗效评估。

## 主链路聚合

Patient Journey 页面以患者为中心汇总：

```json
{
  "patient": {},
  "consents": [],
  "visits": [],
  "follow_up_records": [],
  "crf_entries": [],
  "samples": [],
  "omics_records": [],
  "files": [],
  "quality_issues": []
}
```

现有 `/patients/{patient_id}/panorama` 已返回 `patient`、`samples`、`omics_records`、`consents`、`visits`、`follow_up_records`。`/patients/{patient_id}/journey` 与 `panorama` 保持兼容。

## 错误格式

后端错误统一使用 FastAPI 默认结构：

```json
{
  "detail": "record not found"
}
```

字段校验错误保持 Pydantic/FastAPI 默认 `detail[]`，前端表单阶段只展示首条错误。
