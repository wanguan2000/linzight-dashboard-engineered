# ARCHITECTURE.md

## 项目整体架构

`linzight-dashboard-engineered` 是一个前端优先的真实世界研究 dashboard，配套 FastAPI 后端。正式运行数据库固定为 PostgreSQL；本地 GA 运行目标为 Homebrew PostgreSQL 17.10 的 `linzight_dashboard_engineered`，Docker Compose 后端默认连接宿主机同一库。本地临时 smoke、旧 SQLite 备份和迁移导出工具只有在显式设置 `LINZIGHT_ALLOW_SQLITE_RUNTIME=1` 时才可使用 `sqlite:///...` 数据库 URL。正式首次启动为空库，仅创建首个 LZ 系统管理员，Study 和业务数据由用户创建或导入。

```text
React/Vite UI
  -> src/services/api.ts
    -> VITE_API_BASE_URL or localhost API
    -> formal connected views return backend data or empty state
  -> npm run export:html
    -> dist/
    -> exports/html/*.html

FastAPI API
  -> backend/database.py
  -> PostgreSQL formal runtime, SQLite only with LINZIGHT_ALLOW_SQLITE_RUNTIME=1 for isolated tools
  -> uploads/ local files
```

RWD EDC 主链路以 `study_id` 作为隔离边界。后端在统一权限函数中先判断平台级角色，再判断 Study 成员角色；前端只做菜单、按钮和 fallback 数据过滤，真正权限以后端为准。

## 前端结构

- `src/main.tsx`：React 入口，挂载 i18n provider 和 App。
- `src/App.tsx`：登录状态、导航状态、模块路由和静态导出初始模块解析。
- `src/components/`：页面级模块和复用 UI 组件。
- `src/data/`：静态导出、开发预览和测试 fixture 数据。
- `src/services/api.ts`：前端 API 请求、fallback、后端数据到前端类型的映射。
- `src/services/contracts.ts`：后端 API 响应类型。
- `src/i18n/`：轻量双语运行时和文案包。
- `src/styles/`：设计 token、基础样式、布局样式和组件样式。

## 后端结构

后端为内部试点 API，正式运行使用 PostgreSQL；当前版本先使用应用层 Study 过滤和权限校验，PostgreSQL RLS 移入后续生产强化项。真实患者生产上线前仍需集中身份源、托管密钥、生产对象存储和备份恢复演练。

- `backend/main.py`：FastAPI 路由、本地签名 Bearer token、CRUD、导出、导入、质量规则和患者全景接口。
- `backend/database.py`：PostgreSQL/SQLite 连接、schema 初始化、Study/权限/CRF 版本表、JSON/JSONB 兼容迁移、row mapper、上传目录配置；SQLite 入口受 `LINZIGHT_ALLOW_SQLITE_RUNTIME=1` 限制。
- `backend/permissions.py`：平台级角色、研究级角色、Study scope 和权限判断函数。
- `backend/schemas.py`：Pydantic schema。
- `backend/seed.py`：显式测试数据 fixture 初始化；正式 Docker bootstrap 不自动执行。
- `backend/requirements.txt`：后端依赖。

## 数据流

1. 页面组件触发数据读取。
2. `src/services/api.ts` 依次尝试：
   - `VITE_API_BASE_URL`
   - `http://127.0.0.1:8000`
   - `http://127.0.0.1:8001`
3. 内部试点以 PostgreSQL 后端返回为准；API 为空时显示空状态，API 不可用时只能作为静态/开发预览。LZ 全局首页工作台调用 `/analytics/summary`，后端按当前平台角色的 Study scope 聚合统计；单 Study 工作台调用 `/studies/{study_id}/analytics/summary`。
4. 登录 token 和语言偏好保存在 localStorage。
5. 文件上传和导出仅在后端可用时走 API；后端保存到本地 `uploads/`。

## 页面结构

主应用由 `Sidebar`、`Topbar` 和活动模块组成。当前模块包括：

- 首页工作台：`Dashboard`
- 患者队列管理：`PatientCohortPage`
- 知情同意：`ConsentManagementPage`
- 临床数据采集：`ClinicalDataCapturePage`
- 样本及检测：`SampleTestingPage`
- 患者旅程：`PatientJourneyPage`
- 数据分析：`ReportsPage`
- 系统管理：`SystemManagementPage`

## 组件结构

- 页面级组件负责业务布局、筛选和模块交互。
- 卡片、指标、趋势、流程、快捷操作、状态标签等 UI 复用组件位于 `src/components/`。
- 图标由 `src/components/Icon.tsx` 管理。
- 业务数据结构集中在 `src/types.ts` 和 `src/data/*`。

## 状态管理方式

当前不使用 Redux/Zustand 等外部状态管理。状态主要由 React `useState`、`useEffect` 和组件 props 传递完成：

- 登录用户：`App.tsx` + localStorage。
- 当前模块：`App.tsx`，并同步到 URL query/hash。
- 选中患者：`App.tsx` 传入患者旅程和临床数据采集。
- 语言：`src/i18n/I18nProvider.tsx` + localStorage。

## Mock Data 和 API 数据来源

- Mock data：`src/data/`。
- API：`backend/main.py`。
- 测试 seed 数据：`backend/seed.py`。
- CRF V0.1 schema：`resource/sle-crf-v0.1.schema.json`，由 `resource/SLE临床数据记录表.csv` 派生；前端通过 `src/data/crfTemplate.ts` 读取，后端 seed 直接读取同一份 JSON。
- `LZXK-01` Study：测试 seed 中的真实世界肺癌耐药研究，默认生成 20 名患者，并在 Study CRF V1.0 中追加肺癌耐药字段；正式空库不会自动创建该 Study。
- CRF JSON 存储：正式 PostgreSQL runtime 使用原生 `JSONB` 保存 CRF schema、患者 CRF payload、随访 payload、Study 配置和导出 scope。SQLite 隔离测试库支持 `jsonb()` 时，`patients.clinical_data_jsonb` 与 `crf_entries.payload_jsonb` 保存二进制 JSONB BLOB。API mapper 解码后仍返回 JSON object，并暴露 `*_version` 与 `*_format`。
- Study 配置总表：`study_configurations` 绑定 `study_id`、`disease_area`、当前 published `active_crf_version_id`、active visit-plan codes、知情同意模板、检测 profile 和 `follow_up_schema`。后端新建患者时必须找到当前 Study 的 published CRF，否则拒绝创建，避免空 CRF 或默认 LGL 回退。
- LZ 全局配置：`Study 系统管理` 提供疾病类型、样本类型、检测类型和单位类型字典维护，前端通过 `/global-configuration` 读取和保存，后端持久化到 `global_configurations`；前端患者队列和样本及检测表单共享该字典；写入患者、样本和检测时仍以 PostgreSQL API 接受的字段值为准。
- Study 隔离：`patients`、`consents`、`visits`、`follow_up_records`、`crf_entries`、`samples`、`omics_records`、`uploaded_files`、`export_jobs` 和 `data_quality_issues` 均包含 `study_id`；`omics_records.testing_project_id` 表示样本检测项目编号。
- GA 核心数据模型：`patients.patient_number` 保存业务患者编号，`patients.patient_name` 保存患者姓名并按角色脱敏为拼音首字母；`samples.storage` 保存存储位置，`samples.initial_quantity / remaining_quantity / quantity_unit` 保存人工维护的混合单位样本量，`samples.linked_omics_json` 保存该样本已做或计划做的检测；`omics_records.vendor` 保存检测供应商，`omics_records.sample_id` 保留主样本，`omics_records.sample_ids_json / sample_usage_json` 支持一次检测人工选择多个样本和记录各样本使用量，`omics_records.result_file_id` 指向组学结果文件；`follow_up_records.record_note` 保存随访记录正文；Patient Journey 只从这些 PostgreSQL 表和文件表聚合。
- Study Registry 主数据：`studies.leading_pi_info` 保存 leading PI 信息，`studies.system_admin` 保存该 Study 系统管理员展示值；用户表 `users.last_login_at` 由登录接口写入，用于用户账户与角色列表的 Last Login 列。
- 患者 CRF 与随访 JSON：患者 CRF 由 `study_crf_versions.schema_json` 配置，`crf_entries.payload` 保存 JSON；患者随访由 `study_configurations.follow_up_schema` 配置，`follow_up_records.payload` 保存 JSON。默认 CRF section 为病程记录、住院、治疗方案、检查；默认随访字段为访视、日期、类型、疗效评估、记录。
- 访视计划：`study_visit_plans` 按 Study 保存 V1/V2/V3 等时间点配置、访视窗口、必填 CRF 表单和样本要求；`visits.visit_plan_id` 指向该配置，患者实际访视不再由前端或 seed 硬编码。
- 随访记录：`follow_up_records` 隶属于患者信息，可选关联 `visits.id`，用于患者旅程展示出院后或门诊间隔随访事实，不放入 CRF 版本配置表。
- API 契约参考：`API.md`、`docs/02-api-contract.md`、`docs/03-frontend-backend-protocol.md`。

## 静态 HTML 导出

`scripts/export-html-pages.mjs` 先读取 `dist/index.html`，再为八个模块注入 `window.__LINZIGHT_INITIAL_MODULE__` 并生成独立 HTML。导出页面会根据注入值、URL 参数、hash 或文件名定位初始模块。

## 后续可扩展方向

- 将内部试点 API 扩展为生产 API，并将 mock/test fixture 严格限制在开发模式。
- 将字段字典、CRF schema、权限策略和质量规则后端化。
- 增加 OpenAPI schema 生成、API client 生成和契约测试。
- 增加 CI、测试、Docker 和部署流水线。
- 将静态导出纳入 release artifact 或 GitHub Pages/private preview 流程。
