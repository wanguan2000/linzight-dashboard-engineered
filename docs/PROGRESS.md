# RWS EDC 开发进度

## 当前阶段
阶段 3：定义 API 接口

## 已完成
- [x] 1. 前端工程化改造
  - 新增 Demo 登录入口，覆盖 `sys_admin`、`project_admin`、`investigator`、`crc`、`data_manager`、`viewer` 六类角色。
  - 登录后保持现有前端 UI 风格进入主应用，并在 Topbar/Sidebar 展示当前用户与角色。
  - 保留现有模块导航，主链路入口为：登录 → 患者列表 → 患者详情/Patient Journey → CRF 录入 → 样本及检测 → 数据分析。
- [x] 2. 设计数据库表结构
  - 扩展 SQLite schema：用户、角色权限、CRF、上传文件、导出任务、数据质控、审计日志。
  - 新增 `docs/01-database-schema.md`，记录核心实体、关系、角色范围、索引策略与 PostgreSQL 配置保留方式。
  - 新增 `backend/.env.example`，保留 SQLite、PostgreSQL、本地 uploads 配置入口。

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
- `python3 -c "from backend.database import initialize_schema; initialize_schema(); print('schema ok')"`

## 当前阻塞
无

## 下一步
阶段 3：定义 API 接口，补齐主链路所需的认证、CRF、文件上传、导出、Patient Journey 与分析接口协议。
