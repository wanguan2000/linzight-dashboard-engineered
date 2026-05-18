# ARCHITECTURE.md

## 项目整体架构

`linzight-dashboard-engineered` 是一个前端优先的真实世界研究 dashboard Demo，配套一个可选 FastAPI 后端。后端默认使用 PostgreSQL，本地临时 smoke 可显式设置 `sqlite:///...` 数据库 URL。前端既可以连接本地 Demo API，也可以在 API 不可用时使用内置 mock 数据，保证演示和静态导出可用。

```text
React/Vite UI
  -> src/services/api.ts
    -> VITE_API_BASE_URL or localhost API
    -> fallback to src/data mock data
  -> npm run export:html
    -> dist/
    -> exports/html/*.html

FastAPI Demo API
  -> backend/database.py
  -> PostgreSQL by default, SQLite for isolated smoke runs
  -> uploads/ local files
```

RWD EDC 主链路以 `study_id` 作为隔离边界。后端在统一权限函数中先判断平台级角色，再判断 Study 成员角色；前端只做菜单、按钮和 fallback 数据过滤，真正权限以后端为准。

## 前端结构

- `src/main.tsx`：React 入口，挂载 i18n provider 和 App。
- `src/App.tsx`：登录状态、导航状态、模块路由和静态导出初始模块解析。
- `src/components/`：页面级模块和复用 UI 组件。
- `src/data/`：Dashboard、认证、患者、样本、组学、患者旅程等 Demo 数据。
- `src/services/api.ts`：前端 API 请求、fallback、后端数据到前端类型的映射。
- `src/services/contracts.ts`：后端 API 响应类型。
- `src/i18n/`：轻量双语运行时和文案包。
- `src/styles/`：设计 token、基础样式、布局样式和组件样式。

## 后端结构

后端存在，但当前定位是 Demo API，不是生产后端。

- `backend/main.py`：FastAPI 路由、认证 demo token、CRUD、导出、导入、质量规则和患者全景接口。
- `backend/database.py`：SQLite/PostgreSQL 连接、schema 初始化、Study/权限/CRF 版本表、JSONB/JSON 兼容迁移、row mapper、上传目录配置。
- `backend/permissions.py`：平台级角色、研究级角色、Study scope 和权限判断函数。
- `backend/schemas.py`：Pydantic schema。
- `backend/seed.py`：Demo 数据初始化。
- `backend/requirements.txt`：后端依赖。

## 数据流

1. 页面组件触发数据读取。
2. `src/services/api.ts` 依次尝试：
   - `VITE_API_BASE_URL`
   - `http://127.0.0.1:8000`
   - `http://127.0.0.1:8001`
3. API 请求超时或失败时，页面使用 `src/data/` 中的本地 Demo 数据。
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
- Demo API：`backend/main.py`。
- Seed 数据：`backend/seed.py`。
- CRF V0.1 schema：`resource/sle-crf-v0.1.schema.json`，由 `resource/SLE临床数据记录表.csv` 派生；前端通过 `src/data/crfTemplate.ts` 读取，后端 seed 直接读取同一份 JSON。
- `LZXK-01` Study：真实世界肺癌耐药研究，seed 默认生成 20 名患者，并在 Study CRF V1.0 中追加肺癌耐药字段；前端 fallback 数据与后端 seed 保持同一患者/访视/随访/样本/组学结构。
- CRF JSON 存储：SQLite 支持 `jsonb()` 时，`patients.clinical_data_jsonb` 与 `crf_entries.payload_jsonb` 保存二进制 JSONB BLOB；PostgreSQL runtime 当前使用兼容文本 JSON 存储。API mapper 解码后仍返回 JSON object，并暴露 `*_version` 与 `*_format`。
- Study 配置总表：`study_configurations` 绑定 `study_id`、`disease_area`、当前 published `active_crf_version_id`、active visit-plan codes、知情同意模板和检测 profile。后端新建患者时必须找到当前 Study 的 published CRF，否则拒绝创建，避免空 CRF 或默认 LGL 回退。
- Study 隔离：`patients`、`consents`、`visits`、`follow_up_records`、`crf_entries`、`samples`、`omics_records`、`uploaded_files`、`export_jobs`、`data_quality_issues`、`audit_logs` 均包含 `study_id`；`omics_records.testing_project_id` 表示样本检测项目编号。
- 访视计划：`study_visit_plans` 按 Study 保存 V1/V2/V3 等时间点配置、访视窗口、必填 CRF 表单和样本要求；`visits.visit_plan_id` 指向该配置，患者实际访视不再由前端或 seed 硬编码。
- 随访记录：`follow_up_records` 隶属于患者信息，可选关联 `visits.id`，用于患者旅程展示出院后或门诊间隔随访事实，不放入 CRF 版本配置表。
- API 契约参考：`API.md`、`docs/02-api-contract.md`、`docs/03-frontend-backend-protocol.md`。

## 静态 HTML 导出

`scripts/export-html-pages.mjs` 先读取 `dist/index.html`，再为八个模块注入 `window.__LINZIGHT_INITIAL_MODULE__` 并生成独立 HTML。导出页面会根据注入值、URL 参数、hash 或文件名定位初始模块。

## 后续可扩展方向

- 将 Demo API 替换为生产 API，并保留 mock fallback 作为开发模式。
- 将字段字典、CRF schema、权限策略和质量规则后端化。
- 增加 OpenAPI schema 生成、API client 生成和契约测试。
- 增加 CI、测试、Docker 和部署流水线。
- 将静态导出纳入 release artifact 或 GitHub Pages/private preview 流程。
