# linzight-dashboard-engineered

当前版本：`v1.0.2`

`linzight-dashboard-engineered` 是 LinZight 真实世界研究数据采集与管理系统的 GA 功能测试版。项目以患者为中心，覆盖研究工作台、患者队列、知情同意、临床数据采集、样本及检测、患者旅程、数据分析和系统管理，并提供 FastAPI 后端。正式运行数据库固定为 PostgreSQL；SQLite 仅允许在显式设置 `LINZIGHT_ALLOW_SQLITE_RUNTIME=1` 的隔离 smoke、旧数据备份或迁移导出工具中使用。登录和写入动作依赖后端认证与 API；正式 Docker 首次启动为空库，仅创建首个 LZ 系统管理员，Study、患者和检测数据由用户自行创建或导入。

未来 AI 接手本项目时，请先阅读：

1. `AGENTS.md`
2. `AI_HANDOFF.md`
3. `ARCHITECTURE.md`
4. `ROADMAP.md`
5. `docs/monitoring-backup-drill.md`
6. 本文件

## 技术栈

- 前端：Vite + React + TypeScript
- 样式：分层 CSS，医疗/科研运营型 dashboard 风格，玻璃拟态侧边栏、卡片、业务表格和状态标签
- 国际化：项目内轻量 i18n，支持中文和英文，默认中文
- 后端：FastAPI + Pydantic + PostgreSQL 正式运行时
- 数据：SLE CRF V0.1 schema + LZXK-01 肺癌耐药字段；`backend/seed.py` 仅作为显式测试 fixture
- 静态导出：`npm run export:html` 生成可直接打开的交互式 HTML 页面

## 目录结构

```text
.
├── backend/                       # FastAPI 后端，正式运行默认 PostgreSQL
├── docs/                          # 工程文档、协议说明和部署运维说明
├── exports/html/                  # npm run export:html 生成的可交互 HTML 页面
├── public/                        # Vite 静态资源
├── resource/                      # 产品参考资料、截图、模板和历史原型
├── scripts/export-html-pages.mjs  # 静态 HTML 导出脚本
├── scripts/export-openapi.mjs     # OpenAPI schema 导出脚本
├── scripts/backup-sqlite.mjs      # 旧 SQLite 测试库/上传目录备份脚本
├── scripts/restore-sqlite.mjs     # 旧 SQLite 测试库/上传目录恢复脚本
├── src/                           # React 前端源码
├── uploads/.gitkeep               # 本地上传目录占位；真实上传内容不提交
├── AGENTS.md                      # Codex/AI 长期项目规则
├── AI_HANDOFF.md                  # 当前状态和接手说明
├── ARCHITECTURE.md                # 架构说明
├── DEVELOPMENT.md                 # 开发流程
├── SETUP.md                       # clone 后启动说明
├── ROADMAP.md                     # 版本路线图
├── CHANGELOG.md                   # Keep a Changelog 风格变更记录
├── API.md                         # API 与未来 API 规划
├── DEPLOYMENT.md                  # 部署说明
├── SECURITY.md                    # 安全与敏感信息规则
└── package.json
```

Beta 发布前验证与剩余正式化工作见 `docs/05-beta-release-readiness.md`。
客户演示前检查口径见 `docs/demo-readiness-checklist.md`。
生产发布收口的八条并行工作流见 `docs/07-production-release-candidate-workflows.md`。
正式权限矩阵见 `docs/08-permission-matrix.md`。

## 本地安装

建议使用 Node.js 20 LTS 或更新的 LTS 版本。

```bash
npm install
```

如需运行后端：

```bash
createdb linzight_dashboard_engineered 2>/dev/null || true
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python bootstrap.py
uvicorn main:app --reload --port 8000
```

## 本地启动

前端开发服务器：

```bash
npm run dev
```

浏览器打开 Vite 输出地址，通常是 `http://localhost:5173/`。如果端口被占用，Vite 会自动切换到下一个可用端口。

正式首次启动会创建配置的首个 LZ 系统管理员。前端登录调用后端认证，成功后保存签名 Bearer token；后端不可用或 token 无效时会回到登录页。登录页提供 `Study 研究入口` 和 `LZ 系统管理` 两种入口：Study 入口先认证账号，若账号只授权一个 Study 会直接进入该 Study Workspace，若授权多个 Study 会在认证后选择工作区；LZ 系统管理入口仅用于 Study、成员、权限配置和全局索引，不能直接绕过单个 Study Workspace 执行业务操作。

## CRF 与测试数据

- `resource/SLE临床数据记录表.csv` 是 SLE 临床数据记录参考模板。
- `resource/sle-crf-v0.1.schema.json` 是由该 CSV 生成的 CRF V0.1 schema，包含 10 个分组、89 个字段。
- `src/data/crfTemplate.ts` 将 CRF V0.1 schema 接入前端临床数据采集和系统管理字段配置。
- `backend/seed.py` 读取同一份 schema，可显式生成 70 名测试患者、210 条访视、140 条随访记录、210 条 CRF 记录及关联样本/组学/知情同意数据；正式 Docker 首次启动不会自动执行该测试 seed。
- `study_visit_plans` 为每个 Study 独立配置 V1/V2/V3 访视计划、时间窗、必填 CRF 表单和样本要求；`visits.visit_plan_id` 关联配置，新建患者时后端自动生成计划访视和 CRF 草稿。
- `study_configurations` 是 Study 配置总表，绑定 `study_id -> disease_area -> active_crf_version_id -> visit_plan -> consent_template -> testing_profile`。新建患者必须使用当前 Study 的 published CRF；如果该 Study 没有 published CRF，后端拒绝创建，不再回退到默认 LGL。
- `follow_up_records` 隶属于患者信息，绑定 `study_id + patient_id`，可选关联 `visit_id`，记录随访方式、随访人、生存/疾病状态、疗效、转移、不良事件、生活质量和失访原因。
- `LZXK-01` 发布独立 Study CRF V1.0，使用 15 个肺癌耐药字段，不继承 SLE CRF 字段；已录入数据保留各自 `crf_version_id`。
- PostgreSQL runtime 默认通过 `DATABASE_URL`、`LINZIGHT_DATABASE_URL` 或 `LINZIGHT_POSTGRES_URL` 配置；如果配置成 `sqlite:///...` 且未显式设置 `LINZIGHT_ALLOW_SQLITE_RUNTIME=1`，后端会拒绝启动。
- SQLite 仅用于隔离 smoke、旧测试库备份和迁移导出；正式功能测试和后续 GA 部署均以 PostgreSQL 为数据库。
- 当前 CSV 中 `免疫制剂2` 出现两次，V0.1 schema 将第二个字段规范为 `免疫制剂2（第2项）`，避免 JSON payload 字段覆盖。

## Study 权限与隔离

- RWD EDC 主链路统一使用 `study_id` 作为研究隔离字段，不使用 `project_id`。
- Study Workspace 是唯一业务租户边界；患者、CRF、样本、随访、文件、Query、质控、导出、审批和审计等业务 list 接口使用 `/studies/{study_id}/...`，未带 Study 上下文的业务 list 请求会被后端拒绝。
- LZ 平台角色可在 LZ 系统管理态查看首页工作台、患者队列管理、样本及检测、临床数据采集、患者旅程、导出/报表和 Study 系统管理。跨 Study 读取由前端按授权 Study 列表逐个调用 `/studies/{study_id}/...` 后汇总，不使用无 Study 上下文的业务 list 接口。
- LZ 全局态的 `Study 系统管理` 管理 Study、用户、Study 绑定和平台角色；业务写入仍必须带明确 `study_id`，并由后端按 Study scope、角色权限和 Study 生命周期状态独立校验。
- `LZ_ADMIN` 可通过 Study Registry 新建、终止和软删除 Study，并可管理平台级角色的授权 Study scope；`STUDY_CONFIG_ADMIN` 是本 Study 系统管理员，拥有本 Study 内患者、知情同意、CRF、访视、随访、样本、检测、文件、Query、质控、导出、审批、审计和 Study 配置的全部权限，同时可创建/修改本 Study 研究级用户、启停成员角色并分配本 Study 系统管理员。`terminated` 或 `deleted` Study 会拒绝患者、CRF、访视、随访、样本、组学、文件、质控和导出等业务写入。
- 当前版本先使用后端应用层过滤；真实患者生产上线前应在 PostgreSQL 同一租户边界上补 Row Level Security（RLS）。
- 显式测试 seed 包含 `LGL-1111`、`RWD-NMO-2026` 和 `LZXK-01` 三个 Study，并生成 Study 成员、平台授权范围和独立 CRF 版本。
- 正式 UI 的平台角色使用 `LZ_ADMIN`、`LZ_CRC`、`LZ_DATA_MANAGER`。
- 研究角色使用 `STUDY_PI`、`STUDY_CRC`、`STUDY_CONFIG_ADMIN`、`STUDY_DATA_MANAGER`。
- 样本检测项目编号字段为 `testing_project_id`，与 RWD EDC Study 概念分离。
- 详细设计见 `docs/04-study-permissions.md`。

测试 seed 账号：

| 账号 | 角色 | Study 范围 |
| --- | --- | --- |
| `crc@demo.linzight` | `STUDY_CRC` | `LGL-1111` |
| `lung-pi@demo.linzight` | `STUDY_PI` | `LZXK-01` |
| `lung-crc@demo.linzight` | `STUDY_CRC` | `LZXK-01` |
| `lung-config@demo.linzight` | `STUDY_CONFIG_ADMIN` | `LZXK-01` |
| `lung-dm@demo.linzight` | `STUDY_DATA_MANAGER` | `LZXK-01` |
| `admin@demo.linzight` | `LZ_ADMIN` | 全部 Study |
| `lz-crc@demo.linzight` | `LZ_CRC` | `LGL-1111`、`RWD-NMO-2026`、`LZXK-01` |
| `lz-dm@demo.linzight` | `LZ_DATA_MANAGER` | `RWD-NMO-2026` |

## 构建方式

```bash
npm run build
```

静态 HTML 导出：

```bash
npm run export:html
```

OpenAPI schema 导出：

```bash
npm run export:openapi
```

生成文件为 `docs/openapi.json`，用于和 `docs/02-api-contract.md`、`src/services/contracts.ts` 一起核对接口契约。

后端 API smoke（会启动临时 SQLite 后端、seed 测试数据并自动清理）：

```bash
npm run smoke:api
```

CRF 语义 smoke（检查 `LZXK-01` 患者、CRF payload、CRF 字段字典不混入 SLE 字段，并验证肺癌 Study 拒绝 `SLEDAI评分` Query）：
该检查同时验证 `LZXK-01` Study 配置总表绑定肺癌 CRF、肺癌知情同意模板和肺癌检测 profile。

```bash
npm run smoke:crf-semantics
```

静态 UI smoke（检查导出 manifest、8 个 HTML 页面、关键按钮文案、CRF migration approval、execution logs、separate reviewer 和多 Study selector 文案）：

```bash
npm run smoke:ui
```

静态导出 runtime smoke（启动 `exports/html` 静态服务器，登录 `LZXK-01` 肺癌 CRC，并检查 390px 临床数据采集页可见内容不漏 SLE/免疫病字段）：

```bash
npm run smoke:static-runtime
```

性能 smoke（临时后端 + 70 名 demo 患者，检查患者列表、导出任务和下载响应时间）：

```bash
npm run smoke:performance
```

分层浏览器交互回归（优先使用 Playwright；未安装 Playwright 时会生成 limitation 报告）：

```bash
npm run regression:browser
```

三角色端到端演示链路（临时后端 + 临时前端，覆盖 `admin@demo.linzight`、`lung-crc@demo.linzight`、`lung-dm@demo.linzight`）：

```bash
npm run demo:e2e
```

发布检查（检查必备脚本/文档/CI gate、静态导出、敏感文件和大文件跟踪风险）：

```bash
npm run release:check
```

staging 部署计划（dry-run 输出前端、后端、PostgreSQL、对象存储、病毒扫描、验证和回滚步骤）：

```bash
npm run deploy:staging
```

综合 smoke 测试（API smoke、CRF 语义 smoke、OpenAPI 导出、静态导出、UI smoke、release gate）：

```bash
npm test
```

Docker Compose 一键功能测试环境：

```bash
docker compose up --build
```

Compose 会构建 `Dockerfile.backend` 和 `Dockerfile.frontend`，启动 PostgreSQL、backend 和 frontend；backend 首次启动会在 PostgreSQL volume 中初始化 schema，并在用户表为空时只创建首个 LZ 系统管理员，不会自动创建 Study、患者、样本或测试用户。前端通过 `http://localhost:8000` 访问后端，避免和本机可能存在的 `127.0.0.1:8000` 开发服务冲突。浏览器打开 `http://127.0.0.1:5173/`。

旧 SQLite 测试库 / 上传目录备份恢复：

```bash
npm run backup:sqlite
npm run restore:sqlite -- backups/linzight-<timestamp>
npm run export:postgres-migration -- exports/postgres-migration
npm run browser:matrix
```

部署运维说明见 `docs/deployment-ops.md`，生产适配说明见 `docs/06-production-adapters.md`。

导出文件位于 `exports/html/`，包括：

- `index.html`
- `home-workbench.html`
- `patient-cohort-management.html`
- `informed-consent.html`
- `clinical-data-capture.html`
- `sample-testing.html`
- `patient-journey.html`
- `data-analysis.html`
- `system-management.html`

这些页面已内联主要前端 CSS 和 JS，可直接本地打开，也可部署到静态服务器。

## 环境变量

复制示例文件后按需修改：

```bash
cp .env.example .env.local
cp backend/.env.example backend/.env
```

常用变量：

| 变量 | 作用 |
| --- | --- |
| `VITE_API_BASE_URL` | 前端优先访问的 API 地址；为空时依次尝试本地 8000/8001 |
| `DATABASE_URL` | 后端数据库 URL，优先级最高；正式运行必须为 `postgresql://` 或 `postgresql+psycopg2://` |
| `LINZIGHT_DATABASE_URL` | 后端数据库 URL；未设置 `DATABASE_URL` 时使用 |
| `LINZIGHT_POSTGRES_URL` | PostgreSQL 配置参考值 |
| `LINZIGHT_ALLOW_SQLITE_RUNTIME` | 仅隔离 smoke、旧 SQLite 备份或迁移导出可设为 `1`；正式运行不要设置 |
| `LINZIGHT_UPLOADS_DIR` | 后端本地上传目录 |
| `LINZIGHT_BACKUP_DIR` | 旧 SQLite 测试库备份目录，默认 `./backups` |
| `LINZIGHT_STORAGE_BACKEND` | 文件存储适配器，`local` 或 Demo `object` |
| `LINZIGHT_OBJECT_BUCKET` | Demo object storage bucket 名称 |
| `LINZIGHT_OBJECT_PREFIX` | Demo object storage 路径前缀 |
| `LINZIGHT_VIRUS_SCAN_PROVIDER` | 病毒扫描适配器，默认 `mock`，可用 `clamav` 做生产式 smoke |
| `LINZIGHT_VIRUS_SCAN_ENDPOINT` | 外部扫描服务 endpoint 记录字段 |

不要提交 `.env`、`.env.local`、真实 token、真实患者数据或真实医疗敏感数据。

## 常见问题

### `npm run lint` 扫到生成目录怎么办？

当前 lint 脚本已限定为 `eslint src scripts`。不要把 `dist/`、`.next/`、`node_modules/`、上传目录或缓存目录加入 lint 范围。

### 前端没有后端是否能运行？

可以启动前端外壳。正式功能测试应连接 PostgreSQL 后端；API 不可用时页面只能作为静态/开发预览，不应作为正式数据状态判断依据。

### 静态 HTML 为什么还会有 `assets/`？

导出脚本会内联构建后的 CSS/JS，但 Logo、PDF 等二进制静态资源仍保留在相邻目录，方便本地和静态部署浏览。

### 后端数据库文件是否提交？

不提交。`backend/linzight_demo.db` 是旧 SQLite 测试库文件，已被 `.gitignore` 排除。正式运行使用 PostgreSQL；如需测试 fixture，显式设置 `LINZIGHT_ALLOW_SQLITE_RUNTIME=1` 后再运行测试 seed。

## 后续开发入口

未来 AI 或开发者重新 clone 后，建议顺序：

```bash
git clone <repo-url>
cd linzight-dashboard-engineered
npm install
npm run smoke:api
npm run export:html
npm run smoke:ui
npm run release:check
npm test
docker compose config
npm run build
npm run dev
```

然后阅读 `AGENTS.md` 和 `AI_HANDOFF.md`，按 `ROADMAP.md` 做增量开发。不要重写整个项目，不要大规模改变现有 UI 风格。
