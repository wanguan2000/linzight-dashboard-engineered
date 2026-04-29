# 前后端联调数据协议

## 字段命名

- 后端 API 固定使用 `snake_case`。
- 前端 React 组件继续使用既有 `camelCase`/业务中文字段结构。
- `src/services/contracts.ts` 是后端响应的 TypeScript source of truth。
- `src/services/api.ts` 负责将后端结构转换为前端组件结构。

## 当前映射

| 后端字段 | 前端字段 | 说明 |
| --- | --- | --- |
| `study_id` | `studyId` | 固定默认 `LGL-1111` |
| `hospital_no` | `hospitalNo` | 患者住院号 |
| `disease_type` | `diseaseType` | `NPSLE`、`Non-NPSLE`、`MS`、`NMOSD`、`HC` |
| `clinical_data` | `clinicalData` | CRF 宽表字段，保留中文字段名 |
| `sample_type` | `sampleType` | 样本类型 |
| `collected_at` | `collectedAt` | 样本采集日期 |
| `linked_omics` | `linkedOmics` | 样本关联检测项目 |
| `sample_id` | `sampleId` | 组学检测关联样本 |
| `run_id` | `runId` | 检测批次号 |
| `sent_at` | `sentAt` | 送检日期 |
| `completed_at` | `completedAt` | 完成日期 |

## 前端 fallback 规则

前端依次请求：

1. `VITE_API_BASE_URL`
2. `http://127.0.0.1:8000`
3. `http://127.0.0.1:8001`

如果 API 不可用，页面继续使用 `src/data/*.ts` 中的 Demo 数据。后端阶段完成后，接口返回结构必须与 `src/services/contracts.ts` 一致，避免破坏现有 fallback 行为。

## 主链路聚合

Patient Journey 页面以患者为中心汇总：

```json
{
  "patient": {},
  "consents": [],
  "visits": [],
  "crf_entries": [],
  "samples": [],
  "omics_records": [],
  "files": [],
  "quality_issues": []
}
```

现有 `/patients/{patient_id}/panorama` 已返回 `patient`、`samples`、`omics_records`、`consents`、`visits`。阶段 5 后端开发会补齐 `/patients/{patient_id}/journey`，并保持 `panorama` 兼容。

## 错误格式

后端错误统一使用 FastAPI 默认结构：

```json
{
  "detail": "record not found"
}
```

字段校验错误保持 Pydantic/FastAPI 默认 `detail[]`，前端表单阶段只展示首条错误。
