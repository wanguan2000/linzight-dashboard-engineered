# LinZight 静态 HTML 导出

这些页面由 `npm run export:html` 生成，可直接打开，也可以放到任意静态文件服务器中浏览。

## 页面

- 首页工作台: `home-workbench.html`
- 患者队列管理: `patient-cohort-management.html`
- 知情同意: `informed-consent.html`
- 临床数据采集: `clinical-data-capture.html`
- 样本及检测: `sample-testing.html`
- 患者旅程: `patient-journey.html`
- 数据分析: `data-analysis.html`
- 系统管理: `system-management.html`

## 说明

- `index.html` 默认进入首页工作台。
- 各模块 HTML 已内联前端 CSS 与 JS；Logo 和知情同意 PDF 仍作为相邻静态资源保留。
- 未连接后端时，前端自动使用本地 Demo 数据，交互仍可浏览。
