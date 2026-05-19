# RWD EDC 开发进度

## 当前阶段
已完成 v1 主链路开发

## 已完成
- [x] 1. 前端工程化改造
  - 新增 Demo 登录入口，覆盖 `LZ_ADMIN`、`LZ_CRC`、`LZ_CRF_ADMIN`、`LZ_DATA_MANAGER`、`LZ_AUDITOR`、`STUDY_PI`、`STUDY_CRC`、`STUDY_CONFIG_ADMIN`、`STUDY_DATA_MANAGER` 角色。
  - 登录后保持现有前端 UI 风格进入主应用，并在 Topbar/Sidebar 展示当前用户与角色。
  - 保留现有模块导航，主链路入口为：登录 → 患者列表 → 患者详情/Patient Journey → CRF 录入 → 样本及检测 → 数据分析。
- [x] 2. 设计数据库表结构
  - 扩展 SQLite schema：用户、角色权限、CRF、上传文件、导出任务、数据质控和操作日志。
  - 新增 `docs/01-database-schema.md`，记录核心实体、关系、角色范围、索引策略与 PostgreSQL 配置保留方式。
  - 新增 `backend/.env.example`，保留 SQLite、PostgreSQL、本地 uploads 配置入口。
- [x] 3. 定义 API 接口
  - 新增 `docs/02-api-contract.md`，定义登录、患者、CRF、样本、多组学、文件上传、Journey、分析、导出和后台操作日志口径。
  - 扩展 `backend/schemas.py`，补齐认证、CRF、文件、导出、数据质控、后台操作日志和分析摘要的 Pydantic 模型。
- [x] 4. 建立前后端联调的数据协议
  - 新增 `src/services/contracts.ts`，集中定义后端 snake_case 响应类型。
  - 调整 `src/services/api.ts`，保持现有 fallback 行为，只负责后端响应到前端组件数据的转换。
  - 新增 `docs/03-frontend-backend-protocol.md`，记录字段映射、fallback 规则、Journey 聚合结构与错误格式。
- [x] 5. 后端开发
  - 重写 `backend/seed.py`，生成 70 个模拟患者，覆盖 NPSLE、Non-NPSLE、MS、NMOSD、HC 与 LZXK-01 肺癌耐药队列，并生成关联访视、CRF、样本、多组学和知情同意数据。
  - 补齐 FastAPI 主链路接口：登录、CRF、文件上传、Patient Journey、分析摘要、导出和后台操作日志。
  - 文件上传使用本地 `uploads/` 目录，导出任务可生成队列 CSV。
  - 更新 README 后端接口和数据说明。
- [x] 6. 权限与账户体系
  - 后端新增 Demo Bearer token 解析和角色权限校验，写接口缺 token 返回 401，无权限返回 403。
  - 写接口已接入权限校验：患者、CRF、样本、组学、文件、导出。
  - 前端登录优先调用后端 `/auth/login`，后端不可用时回退本地 Demo 认证。
  - 2026-05-07：新增多 Study 权限体系，RWD EDC 主链路统一按 `study_id` 隔离，Study CRC 只看所属 Study，平台角色按授权 Study scope 访问。
  - 2026-05-07：新增 `LZXK-01` 真实世界肺癌耐药研究，默认生成 20 名患者及 Study PI/CRC/配置管理员/数据管理员角色，平台 LZ_CRC 与 LZ_CRF_ADMIN 授权覆盖该 Study。
- [x] 7. 文件上传与隐私处理
  - 后端文件上传增加分类白名单和去标识化校验，`clinical`、`omics_result`、`analysis_export` 必须标记 `is_deidentified=true`。
  - 上传成功后自动写入后台操作日志。
  - 前端“样本及检测”页面新增结果文件上传入口，默认按组学结果文件标记去标识化。
- [x] 8. 数据导入导出
  - 后端新增 `GET /exports/{export_id}/download`，支持下载导出任务生成的 CSV 文件。
  - 后端新增 `POST /imports/patients`，支持最小患者 CSV 导入并写入后台操作日志。
  - 前端数据分析页的导出按钮已接入 `/exports`，默认登录角色调整为研究配置管理员以便主链路可直接试跑导出。
- [x] 9. 数据完整性与校验
  - 后端新增 `/quality/run` 和 `/quality/issues`，可扫描临床完整度、样本缺失和知情同意状态并生成 `data_quality_issues`。
  - 质控运行写入后台操作日志。
  - 前端数据分析页新增“运行校验”入口和结果状态展示。
- [x] 10. 审计日志
  - GA 版本移除 standalone Audit Diff 模块和 `/audit-logs` API。
  - 患者、样本、组学、CRF、文件上传、导入、导出、质控运行等写操作由后台 `operation_logs` 覆盖。
  - 操作轨迹作为数据库审计底座保留，不作为前端生产页面展示。
- [x] 11. 测试
  - 完成主链路 API smoke：登录 → 患者列表 → CRF 录入 → 文件上传 → Patient Journey → 数据分析 → 导出下载。
  - 完成后端 Python 编译、前端 `npm run check`、静态 HTML 导出。
  - Smoke 后已清理上传/导出测试文件，并 reseed 回 70 名模拟患者状态。
  - 2026-04-30：患者旅程新增患者查找/切换入口；患者队列列表默认分页调整为 5 条，并完成浏览器回归。
  - 2026-04-30：优化正文可读性，调深正文辅助色并放大表格、筛选区、知情同意正文和分页文字；完成浏览器回归。
  - 2026-04-30：样本及检测页独有统计卡、筛选区和患者选择控件同步正文排版标准；完成浏览器回归。
  - 2026-04-30：患者队列关键指标、队列概览、样本采集汇总、数据完整性趋势改为从数据库患者/样本数据实时派生；完成浏览器回归。
  - 2026-04-30：患者旅程顶部患者查找器优化为 50 名患者全量搜索；移除常驻患者卡片/疾病快捷模块，改为输入时浮层匹配结果；完成浏览器回归。
  - 2026-04-30：患者旅程事件分类、事件搜索和重置视图移动到多轨临床事件轴卡片内，并移除时间轴标题数量徽标；完成浏览器回归。

## 待完成
- [x] 1. 前端工程化改造
- [ ] 2. 设计数据库表结构
- [ ] 3. 定义 API 接口
- [ ] 4. 建立前后端联调的数据协议
- [ ] 5. 后端开发
- [ ] 6. 权限与账户体系
- [ ] 7. 文件上传与隐私处理
- [ ] 8. 数据导入导出
- [ ] 9. 数据完整性与校验
- [ ] 10. 审计日志
- [x] 11. 测试

## 最近一次运行命令
- `npm run lint`
- `npm run build`
- in-app browser smoke：刷新患者旅程页，确认页顶不再含事件分类/事件搜索/重置控件，时间轴卡片内包含分类筛选、事件搜索和重置按钮，时间轴标题右侧数量徽标已移除；搜索 `RNA` 后重置视图清空输入
- `npm run lint`
- `npm run build`
- in-app browser smoke：刷新患者旅程页，确认顶部不再常驻显示患者卡片/快捷模块；搜索 `NMOSD` 弹出 10/50 下拉；点击 `CJY-104` 后下拉收起且患者切换成功
- `npm run lint`
- `npm run build`
- in-app browser smoke：刷新患者旅程页，确认默认显示 50 名患者提示；搜索 `NMOSD` 匹配 10/50；点击 `CJY-104` 后切换患者成功
- `npm run lint`
- `npm run build`
- in-app browser smoke：刷新患者队列页，确认关键指标 50、疾病分布各 10、样本汇总 40/30/6/76、完整性 83.7% 来自数据库数据
- `npm run lint`
- `npm run build`
- in-app browser smoke：刷新样本及检测页，确认统计卡、筛选区、表格和分页文字风格一致
- `npm run lint`
- `npm run build`
- in-app browser smoke：刷新患者队列和知情同意页，确认正文、表格、筛选区和分页文字更深更大且布局正常
- `npm run lint`
- `npm run build`
- in-app browser smoke：患者旅程默认 5 个候选患者、搜索 `NMOSD` 并切换 `CJY-104`、患者队列表格默认 5 行
- `npm run lint`
- `npm run build`
- `python3 -m py_compile backend/*.py`
- `backend/.venv/bin/pip install -r backend/requirements.txt`
- `python3 -m backend.seed`
- `backend/.venv/bin/python` TestClient smoke：`/auth/login`、`/patients`、`/patients/PAT-001/journey`、`/crf`、`/analytics/summary`、`/exports`、`/files`
- `backend/.venv/bin/python -m backend.seed`
- `python3 -m py_compile backend/*.py`
- `npm run lint`
- `npm run build`
- `python3 -m py_compile backend/*.py`
- `backend/.venv/bin/python` TestClient smoke：`/auth/login`、`/auth/me`、缺 token 401、CRC 导出 403、CRC 创建 CRF 201
- `npm run lint`
- `npm run build`
- `backend/.venv/bin/python -m backend.seed`
- `backend/.venv/bin/python` TestClient 主链路 smoke：登录、患者 50、CRF 201、上传 201、Journey 200、质控 200、分析 50、导出 201、下载 200
- `python3 -m py_compile backend/*.py`
- `npm run check`
- `npm run export:html`
- `backend/.venv/bin/python -m backend.seed`
- `python3 -m py_compile backend/*.py`
- `backend/.venv/bin/python` TestClient smoke：创建 CRF 201，按实体查询审计记录 1 条且 action=create
- `npm run lint`
- `npm run build`
- `backend/.venv/bin/python -m backend.seed`
- `python3 -m py_compile backend/*.py`
- `backend/.venv/bin/python` TestClient smoke：`/quality/run` 200、生成 27 条 open issue、`/quality/issues` 查询一致
- `npm run lint`
- `npm run build`
- `backend/.venv/bin/python -m backend.seed`
- `python3 -m py_compile backend/*.py`
- `backend/.venv/bin/python` TestClient smoke：创建导出 201、下载导出 200、CSV 导入 201
- `npm run lint`
- `npm run build`
- `backend/.venv/bin/python -m backend.seed`
- `python3 -m py_compile backend/*.py`
- `backend/.venv/bin/python` TestClient smoke：非法文件分类 400、未去标识化 400、合法上传 201、上传审计写入
- `npm run lint`
- `npm run build`
- `backend/.venv/bin/python -m backend.seed`
- `python3 -c "from backend.database import initialize_schema; initialize_schema(); print('schema ok')"`
- `python3 -m py_compile backend/*.py`
- `npm run lint`
- `npm run build`
- `npm run lint`
- `npm run build`
- `python3 -m py_compile backend/*.py`

## 当前阻塞
无

## 下一步
v1 主链路已完成。后续可继续做浏览器端人工回归、真实 PostgreSQL 迁移、电子签名/Query Management 等 v1 之外能力。
