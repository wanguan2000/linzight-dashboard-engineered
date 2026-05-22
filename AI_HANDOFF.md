# AI_HANDOFF.md

## 当前版本

`v1.0.3`

## 当前状态

项目处于 `v1.0.3` 内部试点发布阶段。前端为 Vite + React + TypeScript dashboard，后端为 FastAPI API，正式运行数据库固定为 PostgreSQL；本地试点运行目标切到 Homebrew PostgreSQL 17.10 的 `linzight_dashboard_engineered`，Docker Compose 后端默认连接宿主机 `host.docker.internal:5432` 的同一库。临时 smoke、旧 SQLite 备份恢复和迁移导出脚本必须显式设置 `LINZIGHT_ALLOW_SQLITE_RUNTIME=1` 才可使用 SQLite URL。正式启动只创建首个 LZ 系统管理员，不再自动 seed Study、患者或检测数据；`npm run export:html` 可生成八个可直接打开的交互式 HTML 页面。本版本用于客户在受控内部试点环境中验证真实业务场景、真实角色分工和真实 Study 配置；PostgreSQL RLS 已按当前试点范围移入后续生产强化项，未经合规审批、备份恢复演练和安全签字前，不应直接承载真实患者生产数据。

## 已实现功能

- 登录页使用后端账号认证，不再展示 Demo 账号认证回退；登录页支持 `Study 研究入口` 和 `LZ 系统管理`。Study 入口先认证账号，账号只授权一个 Study 时直接进入该 Study Workspace，授权多个 Study 时再选择工作区；LZ 平台角色可在 LZ 系统管理态跨授权 Study 管理业务数据，但读写仍使用 `/studies/{study_id}/...`。
- 首页工作台、患者队列管理、知情同意、临床数据采集、样本及检测、患者旅程、数据分析、系统管理。
- 患者队列搜索、筛选、列表和进入患者旅程/临床数据采集的联动。
- 临床数据采集 CRF 和随访录入；样本采集台账已移动到患者队列管理页面下方。
- 知情同意列表、状态管理、版本信息和同意书预览；当前患者知情同意页按内部试点的线下流程收敛为打印 Study 模板、上传已签署纸质文件、查看上传归档和直接标记撤回，重签申请与 eConsent 审批队列摘要暂不在患者知情同意页展示。Study 系统管理中的知情同意模板配置支持上传和查看当前 Study 绑定的已审批 PDF 模板文件。
- 样本台账、多组学检测记录、QC 状态和结果文件状态展示；样本记录支持存储位置、初始量、剩余量和混合单位，检测记录支持人工选择一个或多个样本并记录每个样本的使用量。
- 患者旅程单患者全景视图。
- 中英双语切换，偏好保存在浏览器 localStorage。
- SLE CRF V0.1：由 `resource/SLE临床数据记录表.csv` 派生，当前 schema 文件为 `resource/sle-crf-v0.1.schema.json`，共 10 个分组、89 个字段。
- 测试 seed：`backend/seed.py` 读取 CRF V0.1 schema，可显式生成 70 名测试患者、210 条访视、140 条随访记录、210 条 CRF 记录及关联样本/组学/知情同意数据；该 seed 不在正式 Docker 首次启动时自动执行。
- 多 Study 权限测试 fixture：后端 seed 包含 `LGL-1111`、`RWD-NMO-2026` 与 `LZXK-01`，所有 RWD EDC 核心表通过 `study_id` 隔离，样本检测项目使用 `testing_project_id`。
- 跨 Study 管理视角：`LZ_ADMIN`、`LZ_CRC`、`LZ_DATA_MANAGER` 登录后默认进入 LZ 全局态，可进入首页工作台、患者队列管理、样本及检测、临床数据采集、患者旅程、导出/报表和 Study 系统管理。全局首页工作台读取后端 `/analytics/summary`，由后端按平台角色 Study scope 聚合；跨 Study 业务列表读取由前端按授权 Study 列表逐个调用 `/studies/{study_id}/...` 后汇总；患者、CRF、样本/检测、访视、随访、导出、Query、质控和审批等业务 list 仍不能使用无 Study 上下文的旧路径。
- 患者主档编号规则：`patient_number` 由后端自动生成，范围 `H00010`-`H99999`，全局唯一；前端新建患者时只展示“保存后自动生成”，编辑时只读，后端忽略创建/更新请求里的 `patient_number` 和兼容字段 `name`。
- 样本编号规则：`samples.id` 由后端自动生成且不可修改，格式为 `S` + 两位 `Study Code` + 患者编号后三位数字 + 该患者样本序号 `01`-`99`，例如 Study Code `05`、患者编号 `H00080` 的第一个样本为 `S0508001`；前端新增样本时显示“保存后自动生成”，编辑时只读。
- LZ 系统管理 first pass：`LZ_ADMIN` 已可通过 `POST /studies`、`PATCH /studies/{study_id}` 和 `DELETE /studies/{study_id}` 新建、终止和软删除 Study；Study 主数据已包含 `leading_pi_info` 和 `system_admin`，`code` 统一作为 `01`-`99` 两位 Study Code 展示，`study_id` 继续作为路由和权限隔离键。`terminated` / `deleted` Study 会在后端拒绝患者、CRF、访视、随访、样本、组学、文件、质控和导出写入。`GET/PATCH /users`、`PATCH /users/{user_id}/study-scope` 和 `/studies/{study_id}/members` 已支持用户资料修改、平台级 Study scope 管理、Study 系统管理员分配和本 Study 成员启停；`users.last_login_at` 由登录接口写入并显示在账号列表。
- Study 系统管理全局配置已加入疾病类型、样本类型和检测类型字典维护；患者队列新建/编辑患者使用疾病类型下拉框，样本及检测新增样本/检测使用样本类型和检测类型下拉框。新建平台账户支持 `LZ_ADMIN`、`LZ_CRC` 和 `LZ_DATA_MANAGER`，非 Admin 平台角色创建后会同步平台 Study scope。
- `LZXK-01`：真实世界肺癌耐药研究，默认 20 名患者、60 条访视、40 条随访记录、60 条 CRF、44 个样本、84 条组学记录；CRF 为独立 15 字段肺癌耐药 schema，不再继承或追加 SLE 字段。账号 `lung-pi@demo.linzight`、`lung-crc@demo.linzight`、`lung-config@demo.linzight`、`lung-dm@demo.linzight` 分别覆盖 Study PI/CRC/配置管理员/数据管理员。
- 平台级/研究级角色：正式 UI 以 `LZ_ADMIN`、`LZ_CRC`、`LZ_DATA_MANAGER` 与 `STUDY_PI`、`STUDY_CRC`、`STUDY_CONFIG_ADMIN`、`STUDY_DATA_MANAGER` 为主；后端仍保留旧 smoke fixture 兼容角色。
- Study CRF 版本：正式运行直接以 `study_crf_versions.schema_json` 保存每个 Study 的 CRF schema，`crf_entries.crf_version_id` 保留历史版本引用；旧版 `crf_templates` 表已从 GA runtime schema 移除。
- Study 配置总表：`study_configurations` 绑定 `study_id -> disease_area -> active_crf_version_id -> visit_plan -> consent_template -> testing_profile`；`LZXK-01` 绑定肺癌 CRF、肺癌知情同意模板和 `TP-LUNG-RESIST-OMICS` 检测 profile。
- GA 核心数据库字段已显式化：`patients.patient_number`、`patients.patient_name`、`samples.note`、`omics_records.vendor`、`omics_records.result_file_id`、`follow_up_records.record_note` 和 `follow_up_records.payload`。患者姓名默认显示拼音首字母，完整姓名只默认授权给 `LZ_ADMIN`、`STUDY_CONFIG_ADMIN`、`STUDY_CRC` 和 `LZ_CRC`。患者 CRF 由每个 Study 的 `study_crf_versions.schema_json` 与 `crf_entries.payload` 承载；患者随访由 `study_configurations.follow_up_schema` 与 `follow_up_records.payload` 承载；患者旅程必须从患者、CRF、访视、随访、样本、检测和文件记录聚合。
- Study 访视计划：`study_visit_plans` 独立于 CRF 结构，按 Study 定义访视编码、时间窗、必填表单和样本要求；`visits.visit_plan_id` 关联计划。新建患者只创建患者主档和待签署知情同意，不自动生成计划访视、CRF 草稿或 Patient Journey 事件。
- 随访记录：`follow_up_records` 独立于 CRF 版本配置，隶属于患者信息，绑定 `study_id + patient_id`，可选关联 `visit_id`，Patient Journey 已接入展示。
- FastAPI 后端：患者、样本、组学、知情同意、CRF、文件、质量、导出、审批和患者全景接口。
- 静态 HTML 导出：八个业务模块各一个入口页面。
- 本地 Docker Compose 功能测试环境：`Dockerfile.frontend`、`Dockerfile.backend` 和 `docker-compose.yml` 可一键启动前端、后端和上传 volume；后端默认连接宿主机 Homebrew PostgreSQL 17.10。
- 旧 SQLite 运维脚本：`npm run backup:sqlite` 与 `npm run restore:sqlite -- backups/<dir>` 仅支持本地 SQLite 测试库/上传目录备份恢复，说明见 `docs/deployment-ops.md`。
- OpenAPI schema 导出：`npm run export:openapi` 生成 `docs/openapi.json`，CI 和 release gate 会检查该契约快照。
- Beta 发布准备验证记录：`docs/05-beta-release-readiness.md`，包含本轮 CRUD smoke、API/UI smoke、release gate、浏览器 smoke、安全扫描、敏感信息检查、配置检查和剩余正式化工作。页面、数据与 CRF 一致性审计记录见 `docs/page-data-crf-consistency-audit.md`；客户演示口径见 `docs/demo-readiness-checklist.md`。
- 生产化第一版补强：字段级 Query 创建会校验 Study/患者/访视/CRF 字段一致性，支持创建、回复、关闭、重开和筛选；质量检查会生成访视窗口超窗问题；eConsent 撤回/重签先进入 Approval Center 审批中状态，审批完成后同步为已撤回或已重签；文件上传具备 object-storage 与 external virus scanner 适配点；`backend/migrations/postgres/` 提供 schema/index/constraint/seed 分层 PostgreSQL 迁移，`npm run export:postgres-migration` 仍可生成 staging 数据导出包；`npm run smoke:performance` 覆盖 70 demo patients 与导出响应；`npm run deploy:staging` 输出 staging 部署计划；`npm run browser:matrix` 覆盖桌面/移动端角色矩阵；患者/模块表格在 390px 移动端卡片化展示。

## 尚未实现功能

- 完整生产级认证、集中身份源、权限审批流和企业级用户管理；当前已有内部试点级用户资料修改、Study 成员管理、Study 系统管理员分配和平台角色 Study scope 管理。
- 真实 EDC/EMR/LIS/组学平台 API 接入。
- 前端组件/真实浏览器自动化测试需要继续扩展；当前已提供并纳入 CI/release gate 的检查包括 `npm run smoke:api`、`npm run smoke:crf-semantics`、`npm run export:openapi`、`npm run smoke:ui`、`npm run smoke:static-runtime`、`npm run browser:matrix`、`npm run demo:e2e`、`npm run smoke:performance`、`npm run release:check` 和 `npm test` 综合 smoke，后续仍需扩展到更多浏览器和截图基线。
- 静态导出 runtime smoke 已加入 `npm run smoke:static-runtime`：启动 `exports/html` 静态服务器，登录 `LZXK-01` 肺癌 CRC，验证 390px 临床数据采集页可见内容包含肺癌字段且不漏 SLE/免疫病字段。
- CI/CD 自动发布流程；GitHub Actions 已覆盖基础验证、CRF 语义 smoke、角色浏览器矩阵、demo E2E、release gate 和静态 HTML artifact 上传。
- 生产级部署模板；当前已提供本地 PostgreSQL 功能测试用 `Dockerfile.frontend`、`Dockerfile.backend`、`docker-compose.yml` 和 staging dry-run 计划脚本。
- 真实文件对象存储、病毒扫描、长期归档策略仍需接入生产基础设施并完成演练；PostgreSQL RLS 作为 GA 后强化项处理。
- Query 管理、eConsent 撤回/重签审批、访视窗口超窗预警和数据字典规则已有 RC first pass，仍需更完整的 reviewer UX、报表和供应商级验证。锁库、脱敏审批和 standalone audit log 模块不作为当前 GA 外显范围。

## 已知问题

- `npm test` 已配置为 API smoke、OpenAPI 导出、静态导出、UI smoke 和 release gate 的组合检查。
- Docker daemon 未运行时只能执行 `docker compose config`；实际镜像构建需要先启动本机 Docker。
- 后端已替换为本地签名 Bearer token、PBKDF2 密码哈希和账号启用/禁用控制；正式运行数据库为 PostgreSQL，但真实患者生产上线前仍需集中身份源、托管密钥、PostgreSQL RLS、备份恢复演练和合规签字。
- `resource/clinical-patient-journey-nextjs/` 是历史 Next.js 原型参考，不是当前主应用。
- `exports/html/` 是生成产物；修改源码后必须重新运行 `npm run export:html` 才能同步。
- 项目包含 Demo 医疗研究样例数据和模板资料；发布前必须持续检查不要混入真实患者隐私数据。
- CSV 源模板中有重复字段 `免疫制剂2`；CRF V0.1 schema 已将第二个字段规范为 `免疫制剂2（第2项）`，后续真实字段字典确认前不要再改回重复 key。
- 当前隔离模型已按 API smoke 覆盖管理员全局索引兼容端点、Study CRC 跨 Study 403、样本/检测/知情同意/文件/Query/质量/导出/审批列表不串 Study；浏览器矩阵覆盖桌面和 390px 移动端主路由。当前版本先用应用层过滤，真实患者生产上线前仍需补 PostgreSQL RLS、真实身份源和更多浏览器覆盖。
- 新建患者已禁止在当前 Study 没有 published CRF 时回退默认 LGL；若后续新增 Study，必须先发布该 Study 的 CRF 并同步 `study_configurations`。

## 下一步开发优先级

1. 继续扩展正式 CI 权限矩阵：patients、samples、omics、visits、follow-ups、consents、CRF、files、queries、quality、exports、approvals 已有正向/越权 smoke，下一步补字段级权限、中心级权限和真实身份源映射。
2. 把浏览器矩阵扩展到更多浏览器和截图基线，覆盖管理员 Study selector、Study ID 列、Study CRC 只看本 Study、移动端卡片视图和导出下载闭环。
3. 抽离 mock data，形成可替换的 demo dataset 层，确保 API 失败 fallback 不泄露未授权 Study。
4. 细化 API 契约和错误处理，继续产品化字段级 Query、文件归档和 eConsent 重签流程。
5. 将当前 Docker Compose PostgreSQL 功能测试环境扩展为生产部署模板、备份恢复、真实对象存储、病毒扫描和集中身份源方案。
6. 将当前 Study 权限模型扩展为生产级认证和字段级权限策略。
7. 接入真实后端前完成字段字典、单位、范围、必填、逻辑校验和访视窗口规则。

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
npm run smoke:ui
```

如需检查后端：

```bash
python3 -m compileall -q backend
```

## 重要提醒

不要重写项目，不要大规模改变现有 UI。后续开发应以增量方式进行：先定位相关模块，复用现有组件、样式 token、API 映射和文档结构，再做小范围变更并补充验证。
