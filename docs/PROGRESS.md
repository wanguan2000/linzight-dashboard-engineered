# RWS EDC 开发进度

## 当前阶段
阶段 7：文件上传与隐私处理

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
阶段 7：完善文件上传隐私处理，包括去标识化标记、文件分类校验、上传审计和前端文件上传入口。
