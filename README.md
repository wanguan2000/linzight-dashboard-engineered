# linzight-dashboard-engineered

当前版本：`v0.0.1-beta.0`

`linzight-dashboard-engineered` 是 LinZight 真实世界研究数据采集与管理系统的工程化 Demo。项目以患者为中心，覆盖研究工作台、患者队列、知情同意、临床数据采集、样本及检测、患者旅程、数据分析和系统管理，并提供 FastAPI + SQLite Demo 后端。登录和写入动作依赖后端认证与 API；部分只读演示数据在后端不可用时仍可回退到本地 mock/seed 数据，适合产品演示、静态 HTML 交付和后续增量开发。

未来 AI 接手本项目时，请先阅读：

1. `AGENTS.md`
2. `AI_HANDOFF.md`
3. `ARCHITECTURE.md`
4. `ROADMAP.md`
5. 本文件

## 技术栈

- 前端：Vite + React + TypeScript
- 样式：分层 CSS，医疗/科研运营型 dashboard 风格，玻璃拟态侧边栏、卡片、业务表格和状态标签
- 国际化：项目内轻量 i18n，支持中文和英文，默认中文
- 后端：FastAPI + Pydantic + SQLite Demo API
- 数据：SLE CRF V0.1 schema + LZXK-01 肺癌耐药字段 + 70 名本地 mock/SQLite seed 患者、访视和随访记录
- 静态导出：`npm run export:html` 生成可直接打开的交互式 HTML 页面

## 目录结构

```text
.
├── backend/                       # FastAPI + SQLite Demo 后端
├── docs/                          # 工程文档、协议说明和部署运维说明
├── exports/html/                  # npm run export:html 生成的可交互 HTML 页面
├── public/                        # Vite 静态资源
├── resource/                      # 产品参考资料、截图、模板和历史原型
├── scripts/export-html-pages.mjs  # 静态 HTML 导出脚本
├── scripts/export-openapi.mjs     # OpenAPI schema 导出脚本
├── scripts/backup-sqlite.mjs      # Demo SQLite/上传目录备份脚本
├── scripts/restore-sqlite.mjs     # Demo SQLite/上传目录恢复脚本
├── src/                           # React 前端源码
├── uploads/.gitkeep               # 本地上传目录占位；真实上传内容不提交
├── AGENTS.md                      # Codex/AI 长期项目规则
├── AI_HANDOFF.md                  # 当前状态和接手说明
├── ARCHITECTURE.md                # 架构说明
├── DEVELOPMENT.md                 # 开发流程
├── SETUP.md                       # clone 后启动说明
├── ROADMAP.md                     # 版本路线图
├── CHANGELOG.md                   # Keep a Changelog 风格变更记录
├── API.md                         # Demo API 与未来 API 规划
├── DEPLOYMENT.md                  # 部署说明
├── SECURITY.md                    # 安全与敏感信息规则
└── package.json
```

Beta 发布前验证与剩余正式化工作见 `docs/05-beta-release-readiness.md`。

## 本地安装

建议使用 Node.js 20 LTS 或更新的 LTS 版本。

```bash
npm install
```

后端可选。如需运行 Demo API：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python seed.py
uvicorn main:app --reload --port 8000
```

## 本地启动

前端开发服务器：

```bash
npm run dev
```

浏览器打开 Vite 输出地址，通常是 `http://localhost:5173/`。如果端口被占用，Vite 会自动切换到下一个可用端口。

默认 Demo 登录账号可在 `src/data/auth.ts` 和 `backend/seed.py` 中查看，默认密码为 `Demo1234!`。前端登录调用后端认证，成功后保存签名 Bearer token；后端不可用或 token 无效时会回到登录页。登录页先选择 `Study 研究入口` 或 `LZ 系统管理`；选择 Study 入口时需要选择研究编号 `study_id`，账号列表只显示该 Study 的研究成员。

## CRF 与 Demo 数据

- `resource/SLE临床数据记录表.csv` 是 SLE 临床数据记录参考模板。
- `resource/sle-crf-v0.1.schema.json` 是由该 CSV 生成的 CRF V0.1 schema，包含 10 个分组、89 个字段。
- `src/data/crfTemplate.ts` 将 CRF V0.1 schema 接入前端临床数据采集和系统管理字段配置。
- `backend/seed.py` 读取同一份 schema，生成 70 名测试患者、210 条访视、140 条随访记录、210 条 CRF 记录及关联样本/组学/知情同意数据；其中 `LZXK-01` 为真实世界肺癌耐药研究，默认 20 名患者。
- `study_visit_plans` 为每个 Study 独立配置 V1/V2/V3 访视计划、时间窗、必填 CRF 表单和样本要求；`visits.visit_plan_id` 关联配置，新建患者时后端自动生成计划访视和 CRF 草稿。
- `follow_up_records` 隶属于患者信息，绑定 `study_id + patient_id`，可选关联 `visit_id`，记录随访方式、随访人、生存/疾病状态、疗效、转移、不良事件、生活质量和失访原因。
- `LZXK-01` 发布独立 Study CRF V1.0，在 SLE CRF V0.1 基础上追加 15 个肺癌耐药字段，已录入数据保留各自 `crf_version_id`。
- SQLite 使用 JSONB（二进制 JSON）优先保存 CRF：`patients.clinical_data_jsonb` 与 `crf_entries.payload_jsonb` 为 BLOB，同时保留 `*_version` 与 `*_format` 供 API 和迁移校验。
- 当前 CSV 中 `免疫制剂2` 出现两次，V0.1 schema 将第二个字段规范为 `免疫制剂2（第2项）`，避免 JSON payload 字段覆盖。

## Study 权限与隔离

- RWD EDC 主链路统一使用 `study_id` 作为研究隔离字段，不使用 `project_id`。
- 当前 Demo seed 包含 `LGL-1111`、`RWD-NMO-2026` 和 `LZXK-01` 三个 Study，并生成 Study 成员、平台授权范围和独立 CRF 版本。
- 平台角色使用 `LZ_ADMIN`、`LZ_CRC`、`LZ_CRF_ADMIN`、`LZ_DATA_MANAGER`、`LZ_AUDITOR`。
- 研究角色使用 `STUDY_PI`、`STUDY_CRC`、`STUDY_CONFIG_ADMIN`、`STUDY_DATA_MANAGER`。
- 样本检测项目编号字段为 `testing_project_id`，与 RWD EDC Study 概念分离。
- 详细设计见 `docs/04-study-permissions.md`。

常用 Demo 账号：

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

静态 UI smoke（检查导出 manifest、8 个 HTML 页面、关键按钮文案、CRF migration approval、execution logs、separate reviewer 和多 Study selector 文案）：

```bash
npm run smoke:ui
```

发布检查（检查必备脚本/文档/CI gate、静态导出、敏感文件和大文件跟踪风险）：

```bash
npm run release:check
```

综合 smoke 测试（API smoke、OpenAPI 导出、静态导出、UI smoke、release gate）：

```bash
npm test
```

Docker Compose 一键 Demo 环境：

```bash
docker compose up --build
```

Compose 会构建 `Dockerfile.backend` 和 `Dockerfile.frontend`，首次启动时在持久化 volume 中 seed SQLite Demo 数据，前端通过 `http://localhost:8000` 访问后端，避免和本机可能存在的 `127.0.0.1:8000` 开发服务冲突。浏览器打开 `http://127.0.0.1:5173/`。

Demo SQLite / 上传目录备份恢复：

```bash
npm run backup:sqlite
npm run restore:sqlite -- backups/linzight-<timestamp>
```

部署运维说明见 `docs/deployment-ops.md`。

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
| `LINZIGHT_DATABASE_URL` | 后端 SQLite 数据库 URL |
| `LINZIGHT_POSTGRES_URL` | 预留 PostgreSQL 配置 |
| `LINZIGHT_UPLOADS_DIR` | 后端本地上传目录 |
| `LINZIGHT_BACKUP_DIR` | Demo SQLite 备份目录，默认 `./backups` |

不要提交 `.env`、`.env.local`、真实 token、真实患者数据或真实医疗敏感数据。

## 常见问题

### `npm run lint` 扫到生成目录怎么办？

当前 lint 脚本已限定为 `eslint src scripts`。不要把 `dist/`、`.next/`、`node_modules/`、上传目录或缓存目录加入 lint 范围。

### 前端没有后端是否能运行？

可以。`src/services/api.ts` 会优先访问 `VITE_API_BASE_URL`、`http://127.0.0.1:8000`、`http://127.0.0.1:8001`，失败后页面会使用本地 Demo 数据。

### 静态 HTML 为什么还会有 `assets/`？

导出脚本会内联构建后的 CSS/JS，但 Logo、PDF 等二进制静态资源仍保留在相邻目录，方便本地和静态部署浏览。

### 后端数据库文件是否提交？

不提交。`backend/linzight_demo.db` 是本地生成文件，已被 `.gitignore` 排除。需要数据时运行 `python backend/seed.py`。

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
