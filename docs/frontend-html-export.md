# 前端 HTML 导出说明

## 目标

将 LinZight Demo 的八个核心前端模块导出为可直接打开的交互式 HTML 页面：

- 首页工作台
- 患者队列管理
- 知情同意
- 临床数据采集
- 样本及检测
- 患者旅程
- 数据分析
- 系统管理

## 导出命令

```bash
npm run export:html
```

该命令先执行 TypeScript 与 Vite 构建，再将 `dist/` 复制到 `exports/html/`，并为每个模块生成一个独立入口 HTML。每个模块 HTML 会内联构建后的 CSS 与 JS，便于本地直接打开；Logo、PDF 等二进制静态资源仍保留在相邻目录。

## 导出文件

| 模块 | 文件 |
| --- | --- |
| 首页工作台 | `exports/html/home-workbench.html` |
| 患者队列管理 | `exports/html/patient-cohort-management.html` |
| 知情同意 | `exports/html/informed-consent.html` |
| 临床数据采集 | `exports/html/clinical-data-capture.html` |
| 样本及检测 | `exports/html/sample-testing.html` |
| 患者旅程 | `exports/html/patient-journey.html` |
| 数据分析 | `exports/html/data-analysis.html` |
| 系统管理 | `exports/html/system-management.html` |

`exports/html/index.html` 默认进入首页工作台。

## 路由规则

前端入口按以下顺序定位初始模块：

1. 导出脚本注入的 `window.__LINZIGHT_INITIAL_MODULE__`
2. URL 参数 `?module=模块名`
3. URL hash，例如 `#patient-journey`
4. 当前 HTML 文件名，例如 `patient-journey.html`

用户在侧边栏切换模块时，页面会同步更新 URL 参数和 hash，便于复制当前模块地址。

## 运行与部署

- 本地查看：直接打开 `exports/html/*.html`。
- 静态服务器：将整个 `exports/html/` 目录作为站点根目录部署。
- 后端可选：后端 API 不可用时，页面自动使用本地 Demo 数据；后端可用时，患者、样本、组学和患者全景页优先读取接口。
