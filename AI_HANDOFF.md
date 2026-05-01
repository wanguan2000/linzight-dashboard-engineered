# AI_HANDOFF.md

## 当前版本

`v0.0.1-beta.0`

## 当前状态

项目处于可上传 GitHub private 仓库的 beta 整理阶段。前端为 Vite + React + TypeScript dashboard，后端为可选 FastAPI + SQLite Demo API。前端在 API 不可用时会回退到本地 Demo 数据；`npm run export:html` 可生成八个可直接打开的交互式 HTML 页面。

## 已实现功能

- 登录页与 Demo 账号认证回退。
- 首页工作台、患者队列管理、知情同意、临床数据采集、样本及检测、患者旅程、数据分析、系统管理。
- 患者队列搜索、筛选、列表和进入患者旅程/临床数据采集的联动。
- 临床数据采集 CRF、随访、样本联动和样本库编码展示。
- 知情同意列表、状态管理、版本信息和同意书预览。
- 样本台账、多组学检测记录、QC 状态和结果文件状态展示。
- 患者旅程单患者全景视图。
- 中英双语切换，偏好保存在浏览器 localStorage。
- FastAPI Demo 后端：患者、样本、组学、知情同意、CRF、文件、质量、导出、审计和患者全景接口。
- 静态 HTML 导出：八个业务模块各一个入口页面。

## 尚未实现功能

- 完整生产级认证、权限、审计和用户管理。
- 真实 EDC/EMR/LIS/组学平台 API 接入。
- 前端自动化测试和后端 API 测试。
- CI/CD、GitHub Actions 和自动发布流程。
- Docker 镜像和生产部署模板。
- 数据脱敏、字段级权限和合规审批工作流。
- 真实文件对象存储、病毒扫描和长期归档策略。

## 已知问题

- `test` 脚本尚未配置。
- 后端使用 Demo token 和 SQLite，不能直接作为生产认证/数据层。
- `resource/clinical-patient-journey-nextjs/` 是历史 Next.js 原型参考，不是当前主应用。
- `exports/html/` 是生成产物；修改源码后必须重新运行 `npm run export:html` 才能同步。
- 项目包含 Demo 医疗研究样例数据和模板资料；发布前必须持续检查不要混入真实患者隐私数据。

## 下一步开发优先级

1. 增加 GitHub Actions：install、lint、build、后端 compile。
2. 增加最小前端测试和 API smoke test。
3. 抽离 mock data，形成可替换的 demo dataset 层。
4. 细化 API 契约和错误处理。
5. 增加 Dockerfile / docker-compose 供本地一键启动。
6. 完善权限模型、审计和脱敏策略。
7. 接入真实后端前完成字段字典和数据质量规则。

## 未来 AI 接手第一步

先阅读：

1. `AGENTS.md`
2. `README.md`
3. `ARCHITECTURE.md`
4. `API.md`
5. `ROADMAP.md`
6. `docs/frontend-html-export.md`

然后运行：

```bash
npm install
npm run lint
npm run build
```

如需同步静态页面：

```bash
npm run export:html
```

如需检查后端：

```bash
python3 -m compileall -q backend
```

## 重要提醒

不要重写项目，不要大规模改变现有 UI。后续开发应以增量方式进行：先定位相关模块，复用现有组件、样式 token、API 映射和文档结构，再做小范围变更并补充验证。
