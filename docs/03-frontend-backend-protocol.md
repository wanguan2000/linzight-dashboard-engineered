# 前后端联调数据协议

OpenAPI schema 快照由 `npm run export:openapi` 生成到 `docs/openapi.json`。后端 endpoint、schema 或权限语义变化时，应同步更新该快照、`docs/02-api-contract.md`、`src/services/contracts.ts` 和对应 smoke tests。

## 字段命名

- 后端 API 固定使用 `snake_case`。
- 前端 React 组件继续使用既有 `camelCase`/业务中文字段结构。
- `src/services/contracts.ts` 是后端响应的 TypeScript source of truth。
- `src/services/api.ts` 负责将后端结构转换为前端组件结构。

## 当前映射

CRF 字段字典当前来自 `resource/sle-crf-v0.1.schema.json`。前端通过 `src/data/crfTemplate.ts` 读取分组和字段，后端 `backend/seed.py` 使用同一份 schema 生成患者 `clinical_data` 和 `crf_entries.payload`。SQLite 存储层优先将同一 payload 写入 JSONB BLOB，API 层解码后仍按 JSON object 返回给前端。

所有 RWD EDC 主链路数据使用 `study_id` 做隔离。前端会在登录后保存 `study_scope`，API 请求自动携带 HMAC 签名 Bearer token；登录态启动时会调用 `/auth/me` 校验，token 缺失、过期或无效时回到登录页。

字段级权限由后端 `field_permissions` 统一执行。前端不自行判断姓名、住院号、身份证号、手机号、地址等直接标识符是否需要脱敏，而是展示 API 返回值；导出文件也由后端按同一规则生成。当前默认规则让 `LZ_DATA_MANAGER`、`STUDY_DATA_MANAGER` 和 `LZ_AUDITOR` 在页面看到脱敏值，在 CSV 导出中移除直接标识符。

访视计划由 `study_visit_plans` 配置，不写入 CRF 字段表。`visits` 是患者实际访视记录，通过 `visit_plan_id` 关联配置；新建患者时后端按当前 Study active 访视计划自动生成访视和初始 CRF 草稿。

随访记录由 `follow_up_records` 保存，不写入 CRF 版本配置表。它隶属于患者信息，绑定 `study_id + patient_id`，并可选通过 `visit_id` 关联某次随访访视，用于记录随访方式、随访人、生存/疾病状态、疗效、转移、不良事件、生活质量和失访原因。

临床数据采集页的“多次随访”表格读取计划/实际 `visits`，同时将 `follow_up_records` 映射为可回显的随访行。新增或编辑随访行时，前端通过 `saveVisitFollowUpRecord()` 写入 `/follow-up-records`；计划访视配置仍由 `study_visit_plans` 管理。

系统管理页的账号创建通过 `POST /users` 执行。前端传入 `username`、`display_name`、`role`、`password`、`study_id` 和 `member_status`；后端创建用户前会执行基础密码策略，密码使用 PBKDF2-HMAC-SHA256 加盐哈希保存。如果是研究级角色，会同步创建当前 Study 的 `study_members` 记录并返回 `study_memberships`。Create Account 按钮必须使用该接口，不应只在前端插入本地账号。

系统管理页的 Study 成员列表通过 `/studies/{study_id}/members` 读取，已有成员启用/停用研究级角色通过同一路径 `POST` upsert。平台级 `LZ_ADMIN` 启用/禁用账号时调用 `PATCH /users/{user_id}/status`，该接口会影响登录生命周期。该响应必须包含 `username` 和 `display_name`，与列表接口一致，前端才能在保存后直接更新账号行。

系统管理页的 CRF 字段配置通过 `/studies/{study_id}/crf-fields` 读取当前 Study CRF version 的字段列表。新增字段调用 `POST /studies/{study_id}/crf-fields`，编辑字段调用 `PUT /studies/{study_id}/crf-fields/{field_id}`。前端可编辑字段名称、类型、模块、状态、下拉选项、必填状态、校验规则和条件逻辑；后端将字段写回 `study_crf_versions.schema_json.sections[].fields[]`，并为新增或更新操作写入 `audit_logs`。

系统管理页的 CRF 版本面板通过 `/studies/{study_id}/crf-versions` 读取版本列表。`New Draft` 会从当前字段表生成 schema 并调用 `POST /studies/{study_id}/crf-versions` 创建草稿。正式发布优先走审批流：`Request Approval` 调用 `POST /studies/{study_id}/crf-migrations`，`Approve` 调用 `/approve`，`Apply` 或 `Apply Approved` 调用 `/apply`，由后端发布目标 draft 并退休该 Study 的旧 published 版本。
`Preview Migration` 调用 `POST /studies/{study_id}/crf-versions/migration-preview`，用当前字段表生成目标 schema，并显示新增、变更、移除和未变化字段数量，同时列出字段级新增、变更项和移除明细。该接口只读，不改变版本状态。
系统管理页同时读取 `/studies/{study_id}/crf-migrations` 展示最近的 migration approval request 和 execution log 数量；所有提交、批准和应用操作均以 `study_id` 为路径参数，并写入后端 `audit_logs`。后端禁止 request 发起人批准或应用自己的 CRF migration，前端用通用状态消息提示权限或后端拒绝。
系统管理页的 Approval Center 读取 `/approvals?study_id=...`，展示导出、脱敏导出和 CRF 发布审批的 `draft / submitted / approved / rejected / cancelled / completed` 状态、动作记录数量和评论。Approve/Reject 按钮分别调用 `/approvals/{id}/approve` 与 `/approvals/{id}/reject`；后端禁止提交人自批，并将动作写入 `approval_actions` 和 `audit_logs`。

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
| CRF field `id` | `id` | 系统管理字段表中的 Field ID |
| CRF field `type` | `type` | `Text`、`Number`、`Dropdown` 或 `Boolean` |
| CRF field `module` | `module` | CRF section title |
| CRF field `status` | `status` | `启用`、`草稿` 或 `停用` |
| CRF field `options` | `options` | 下拉字段选项列表，非下拉字段可为空数组 |
| CRF field `required` | `required` | 是否必填 |
| CRF field `validationRule` | `validation_rule` | 文本化校验规则，例如 `integer >= 1` |
| CRF field `conditionalLogic` | `conditional_logic` | 文本化条件逻辑，例如 `驱动基因突变 is not empty` |

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
