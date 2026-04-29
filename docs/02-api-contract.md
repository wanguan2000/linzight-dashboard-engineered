# RWS EDC v1 API 接口协议

## 约定

- Base URL：开发默认 `http://127.0.0.1:8000`
- 格式：JSON，字段使用 `snake_case`
- 认证：`POST /auth/login` 返回 Bearer token；开发阶段可使用 Demo token，后续可替换 JWT
- 文件上传：`multipart/form-data`，文件落本地 `uploads/`
- 患者中心主键：`patient_id`

## 主链路接口

| 链路 | 方法 | 路径 | 用途 |
| --- | --- | --- | --- |
| 登录 | `POST` | `/auth/login` | 用户登录，返回 token 与用户角色 |
| 登录 | `GET` | `/auth/me` | 当前用户信息 |
| 患者列表 | `GET` | `/patients` | 搜索、筛选患者 |
| 患者详情 | `GET` | `/patients/{patient_id}` | 患者主档 |
| 患者详情 | `GET` | `/patients/{patient_id}/panorama` | 患者全景数据 |
| CRF 录入 | `GET` | `/crf?patient_id=...` | 查询患者 CRF |
| CRF 录入 | `POST` | `/crf` | 新增 CRF 模块记录 |
| CRF 录入 | `PUT` | `/crf/{entry_id}` | 更新 CRF 草稿、提交或锁定 |
| 样本登记 | `GET` | `/samples` | 查询样本台账 |
| 样本登记 | `POST` | `/samples` | 新增样本 |
| 多组学检测 | `GET` | `/omics` | 查询检测记录 |
| 多组学检测 | `POST` | `/omics` | 新增检测记录 |
| 文件上传 | `POST` | `/files` | 上传知情、临床、样本、组学结果或导出文件 |
| 文件上传 | `GET` | `/files?patient_id=...` | 查询患者文件 |
| Patient Journey | `GET` | `/patients/{patient_id}/journey` | Journey 页面聚合接口 |
| 数据分析 | `GET` | `/analytics/summary` | 队列统计、样本和组学概览 |
| 导出 | `POST` | `/exports` | 创建导出任务 |
| 导出 | `GET` | `/exports` | 查询导出任务 |
| 审计 | `GET` | `/audit-logs` | 查询实体操作审计 |

## 角色权限矩阵

| 角色 | 患者 | CRF | 样本 | 组学 | 文件 | 导出 | 系统 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `sys_admin` | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 |
| `project_admin` | 全部 | 审核 | 全部 | 全部 | 全部 | 全部 | 项目配置 |
| `investigator` | 读取/审核 | 提交/审核 | 读取 | 读取 | 上传/读取 | 读取 | 无 |
| `crc` | 新增/更新 | 草稿/提交 | 新增/更新 | 登记 | 上传/读取 | 读取 | 无 |
| `data_manager` | 读取 | 锁定/质控 | 读取 | 读取/质控 | 读取 | 全部 | 字典配置 |
| `viewer` | 读取 | 读取 | 读取 | 读取 | 读取 | 读取 | 无 |

## 核心请求示例

登录：

```json
{
  "username": "crc@demo.linzight",
  "password": "demo123"
}
```

CRF 创建：

```json
{
  "patient_id": "PAT-001",
  "visit_id": "VIS-001",
  "module": "baseline",
  "payload": {
    "SLEDAI评分": 12,
    "PGA评分": 2,
    "WBC": 10.73
  },
  "status": "draft"
}
```

导出任务：

```json
{
  "export_type": "cohort_csv",
  "scope": {
    "study_id": "LGL-1111",
    "disease_type": ["NPSLE", "Non-NPSLE", "MS", "NMOSD", "HC"]
  },
  "requested_by": "USR-003"
}
```

## API 与前端数据映射

- `patients` 映射到 `PatientRecord`
- `samples` 映射到 `SampleRecord`
- `omics_records` 映射到 `OmicsRecord`
- `crf_entries.payload` 保持 CRF 字段字典的宽表 JSON，便于阶段 4 与现有前端 `clinicalData` 对齐
- `patients/{patient_id}/journey` 与现有 `panorama` 保持兼容，后续可返回 `patient`、`consents`、`visits`、`crf_entries`、`samples`、`omics_records`、`files`、`quality_issues`
