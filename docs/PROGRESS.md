# RWS EDC 开发进度

## 当前阶段
阶段 9：数据完整性与校验

## 已完成
- [x] 1. 前端工程化改造
  - 新增 Demo 登录入口，覆盖 `sys_admin`、`project_admin`、`investigator`、`crc`、`data_manager`、`viewer` 六类角色。
  - 登录后保持现有前端 UI 风格进入主应用，并在 Topbar/Sidebar 展示当前用户与角色。
  - 保留现有模块导航，主链路入口为：登录 → 患者列表 → 患者详情/Patient Journey → CRF 录入 → 样本及检测 → 数据分析。
- [x] 2. 设计数据库表结构
  - 扩展 SQLite schema：用户、角色权限、CRF、上传文件、导出任务、数据质控、审计日志。
  - 新增 `docs/01-database-schema.md`，记录核心实体、关系、角色范围、索引策略与 PostgreSQL 配置保留方式。
  - 新增 `backend/.env.example`，保留 SQLite、PostgreSQL、本地 uploads 配置入口。
- [x] 3. 定义 API 接口
  - 新增 `docs/02-api-contract.md`，定义登录、患者、CRF、样本、多组学、文件上传、Journey、分析、导出、审计接口。
  - 扩展 `backend/schemas.py`，补齐认证、CRF、文件、导出、数据质控、审计、分析摘要的 Pydantic 模型。
- [x] 4. 建立前后端联调的数据协议
  - 新增 `src/services/contracts.ts`，集中定义后端 snake_case 响应类型。
  - 调整 `src/services/api.ts`，保持现有 fallback 行为，只负责后端响应到前端组件数据的转换。
  - 新增 `docs/03-frontend-backend-protocol.md`，记录字段映射、fallback 规则、Journey 聚合结构与错误格式。
- [x] 5. 后端开发
  - 重写 `backend/seed.py`，生成 50 个模拟患者，均匀覆盖 NPSLE、Non-NPSLE、MS、NMOSD、HC，并生成关联访视、CRF、样本、多组学和知情同意数据。
  - 补齐 FastAPI 主链路接口：登录、CRF、文件上传、Patient Journey、分析摘要、导出、审计查询。
  - 文件上传使用本地 `uploads/` 目录，导出任务可生成队列 CSV。
  - 更新 README 后端接口和数据说明。
- [x] 6. 权限与账户体系
  - 后端新增 Demo Bearer token 解析和角色权限校验，写接口缺 token 返回 401，无权限返回 403。
  - 写接口已接入权限校验：患者、CRF、样本、组学、文件、导出。
  - 前端登录优先调用后端 `/auth/login`，后端不可用时回退本地 Demo 认证。
- [x] 7. 文件上传与隐私处理
  - 后端文件上传增加分类白名单和去标识化校验，`clinical`、`omics_result`、`analysis_export` 必须标记 `is_deidentified=true`。
  - 上传成功后自动写入 `audit_logs`。
  - 前端“样本及检测”页面新增结果文件上传入口，默认按组学结果文件标记去标识化。
- [x] 8. 数据导入导出
  - 后端新增 `GET /exports/{export_id}/download`，支持下载导出任务生成的 CSV 文件。
  - 后端新增 `POST /imports/patients`，支持最小患者 CSV 导入并写入审计。
  - 前端数据分析页的导出按钮已接入 `/exports`，默认登录角色调整为项目管理员以便主链路可直接试跑导出。

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
- [ ] 11. 测试

## 最近一次运行命令
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
阶段 9：补齐数据完整性与校验，包括缺失字段扫描、质控问题生成、前端展示和 API smoke。
