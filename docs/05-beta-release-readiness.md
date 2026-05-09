# Beta 发布准备与验证记录

记录日期：2026-05-10

本文记录 `v0.0.1-beta.0` 进入 GitHub private beta 前的工程验证结果。当前结论是：项目适合发布为 Demo / private beta 仓库，不适合作为生产级临床系统直接部署。

## 已完成检查

- 代码审查：检查前后端 Study 权限、`study_id` 隔离、CRF 版本、访视计划、随访记录、患者旅程聚合与静态导出链路。
- 后端 CRUD smoke：使用临时 SQLite 数据库验证登录、患者创建/更新/删除、样本创建/更新/删除、组学创建/更新/删除、CRF 创建/更新、随访创建/更新、访视计划 upsert/update、Patient Journey 聚合、跨 Study 403 权限拒绝。
- 前端浏览器 smoke：验证 Study 登录、LZXK-01 后端实时数据展示、患者列表筛选数据、患者“查看”进入 Journey、“编辑”进入临床数据采集、模块切换与控制台错误。
- 配置检查：确认 `LINZIGHT_DATABASE_URL` 已被后端连接函数实际读取，可使用临时或自定义 SQLite 路径运行验证。
- 敏感信息检查：扫描常见 token、API key、私钥、明文 secret 模式，未发现命中。
- 大文件检查：历史原型目录 `resource/clinical-patient-journey-nextjs/` 下存在未跟踪依赖和构建缓存，但未被 Git 跟踪；`.gitignore` 已覆盖这些目录。
- 依赖安全检查：`npm audit --audit-level=high --omit=dev` 未发现高危生产依赖漏洞。
- 构建检查：`npm run lint`、`npm run build`、`npm run export:html`、`python -m compileall -q backend` 通过。

## 发布前已修复

- 后端 `connect()` 原先声明支持 `LINZIGHT_DATABASE_URL`，但实际总是连接默认 `backend/linzight_demo.db`；已修复为读取 `sqlite:///...` 配置路径。
- 首页欢迎语原先写死为默认 PI 名称；已改为按当前登录用户展示，避免多 Study / 多角色演示时产生误导。

## Beta 发布范围

- 前端：Vite + React + TypeScript dashboard，支持登录、Study scope、模块路由、患者队列、知情同意、临床数据采集、样本及检测、患者旅程、数据分析和系统管理。
- 后端：FastAPI + SQLite Demo API，包含 demo token、Study 权限、CRUD、导出、导入、质量规则、审计和患者全景接口。
- 数据：三 Study demo seed，SLE CRF V0.1 schema，LZXK-01 肺癌耐药字段和患者/访视/随访/样本/组学数据。
- 交付：源码、工程文档、环境示例、静态 HTML 导出产物。

## 仍需完成的正式化工作

- GitHub Actions：增加 install、lint、build、backend compile、API smoke 和静态导出检查。
- 自动化测试：补前端组件/交互测试、后端 API 测试、权限矩阵回归测试和浏览器 smoke 脚本。
- 安全：替换 Demo token 为生产认证；增加密码策略、JWT/session 策略、字段级权限、脱敏规则、导出审批、文件病毒扫描和对象存储安全策略。
- 合规：完善真实患者数据进入系统前的脱敏流程、审计检索、下载审批、数据留存和删除策略。
- 配置与安装：补 Dockerfile / docker-compose、生产环境变量清单、Nginx 反向代理示例、备份恢复说明。
- 数据层：将 SQLite Demo 明确升级为生产数据库适配层，并补迁移工具和 schema 版本管理。
- 发布管理：建立 release checklist、版本 tag、CHANGELOG 发布段落、GitHub release notes 和回滚方案。

## 当前限制

- 当前删除、新增等完整编辑动作主要通过后端 API 验证；前端患者队列页面的“新建患者”入口会进入临床数据采集上下文，尚未形成完整生产级表单工作流。
- 后端仍是 Demo API，使用 SQLite 与 demo token，不应承载真实患者隐私数据。
- `exports/html/` 是生成产物，源码变化后必须重新运行 `npm run export:html`。
