# LinZight 真实世界研究数据采集与管理系统 Demo

当前基线版本：`0.01beta`

这是一个以患者为中心的真实世界研究数据采集与管理系统 Demo，覆盖研究首页、患者队列、临床数据采集、知情同意、样本及检测、患者旅程、导出报表和系统管理，并提供 FastAPI + SQLite 后端接口用于 CRUD 与单患者全景数据查询。

## 技术栈

- 前端：Vite + React + TypeScript
- 样式：分层 CSS，玻璃拟态卡片与响应式业务表格
- 后端：FastAPI + Pydantic + SQLite
- 数据：本地 mock/seed 数据，默认研究编号 `LGL-1111`
- 版本标记：`VERSION` 保存产品基线版本，`package.json` 使用合法 npm semver `0.0.1-beta`
- 静态导出：`npm run export:html` 生成可离线浏览的交互式 HTML 页面

## 前端功能

- 首页 Dashboard：患者入组、样本、组学检测、随访和数据完整性概览
- 患者队列管理：患者搜索、筛选、患者列表、队列概览、样本采集汇总
- 临床数据采集：患者检索、CRF 结构化模块、随访记录、样本联动和数据质量提醒
- 临床样本编号：在临床数据采集模块按 `患者编号-Txx` 展示样本库编码，例如 `CJY-308-T01`
- 知情同意：签署状态列表、版本流程、签署详情和同意书预览
- 样本管理：样本 CRUD 台账视图、采集/入库/送检流程、存储分布
- 多组学检测：检测记录列表、QC 状态、检测流程、结果概览
- 样本及检测：在同一工作区内联动样本台账、检测记录、QC 与结果文件状态
- 患者旅程：单患者全景、随访时间线、知情同意、样本与组学联动
- 数据分析：导出/报表卡片、数据导出流水线
- 系统管理：账户、角色、字段字典、权限矩阵和系统审计入口

## 后端接口

后端入口在 `backend/main.py`，数据库文件默认生成在 `backend/linzight_demo.db`。

主要接口：

- `GET /health`
- `POST /seed`
- `POST /auth/login`
- `GET /auth/me`
- `GET /patients`
- `POST /patients`
- `GET /patients/{patient_id}`
- `PUT /patients/{patient_id}`
- `DELETE /patients/{patient_id}`
- `GET /samples`
- `POST /samples`
- `GET /samples/{sample_id}`
- `PUT /samples/{sample_id}`
- `DELETE /samples/{sample_id}`
- `GET /omics`
- `POST /omics`
- `GET /omics/{record_id}`
- `PUT /omics/{record_id}`
- `DELETE /omics/{record_id}`
- `GET /crf`
- `POST /crf`
- `PUT /crf/{entry_id}`
- `POST /files`
- `GET /files`
- `GET /patients/{patient_id}/panorama`
- `GET /patients/{patient_id}/journey`
- `GET /analytics/summary`
- `POST /exports`
- `GET /exports`
- `GET /audit-logs`
- 前端默认依次尝试 `VITE_API_BASE_URL`、`http://127.0.0.1:8000`、`http://127.0.0.1:8001`，接口不可用时回退到本地 mock 数据。

## 启动方式

前端：

```bash
npm install
npm run dev
```

浏览器打开 Vite 输出的地址，通常是 `http://localhost:5173/`；如果端口被占用，Vite 会自动切到 `5174` 等可用端口。

静态 HTML 导出：

```bash
npm run export:html
```

导出结果位于 `exports/html/`，包含以下可交互页面：

- `index.html`：默认首页工作台
- `home-workbench.html`：首页工作台
- `patient-cohort-management.html`：患者队列管理
- `informed-consent.html`：知情同意
- `clinical-data-capture.html`：临床数据采集
- `sample-testing.html`：样本及检测
- `patient-journey.html`：患者旅程
- `data-analysis.html`：数据分析
- `system-management.html`：系统管理

这些 HTML 文件已内联前端 CSS 与 JS；`exports/html/assets/` 保留 Logo 等静态资源。直接打开本地文件即可浏览，部署到静态服务器时也不依赖后端。若后端 API 可用，前端会优先读取 API；不可用时自动回退到本地 Demo 数据。

后端：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python seed.py
uvicorn main:app --reload --port 8000
```

也可以在项目根目录启动：

```bash
backend/.venv/bin/python -m backend.seed
backend/.venv/bin/uvicorn backend.main:app --reload --port 8000
```

验证 API：

```bash
curl http://localhost:8000/health
curl http://localhost:8000/patients
curl http://localhost:8000/patients/PAT-001/panorama
```

Demo 登录：

```bash
curl -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"crc@demo.linzight","password":"demo123"}'
```

写接口使用返回的 `access_token` 作为 Bearer token。前端登录会优先调用后端认证；后端不可用时回退到本地 Demo 账号。

文件上传：

- `category` 支持 `consent`、`clinical`、`sample`、`omics_result`、`analysis_export`、`other`
- `clinical`、`omics_result`、`analysis_export` 必须显式标记 `is_deidentified=true`
- 上传成功后文件保存到本地 `uploads/{category}/`，并写入审计日志

## 数据说明

`backend/seed.py` 会初始化 SQLite schema 并写入：

- 50 个患者，均匀覆盖 NPSLE、Non-NPSLE、MS、NMOSD、HC
- 关联样本、CRF、访视、多组学检测记录
- 知情同意记录
- 6 个 Demo 账号角色：sys_admin、project_admin、investigator、crc、data_manager、viewer

前端核心业务页已接入 `backend` API：

- 患者队列页读取 `/patients`、`/samples`、`/omics`
- 样本管理页读取 `/samples`
- 多组学检测页读取 `/omics`
- 患者旅程页读取 `/patients/{patient_id}/panorama`

如果后端未启动，前端会自动回退到 `src/data/*.ts` mock 数据，以保证 Demo 离线也可浏览。

## 验收命令

```bash
npm run lint
npm run build
npm run export:html
npm run check
python3 backend/seed.py
python3 -m py_compile backend/*.py
```

## 版本基线

`0.01beta` 是后续开发基线，详见 `RELEASE_NOTES.md`。建议每轮较大功能开发后更新：

- `VERSION`
- `package.json` / `package-lock.json`
- `RELEASE_NOTES.md`
- README 启动和验收说明

如需实际启动后端，需要先安装 `backend/requirements.txt` 中的依赖，然后运行：

```bash
cd backend
uvicorn main:app --reload --port 8000
```
