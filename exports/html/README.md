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
- 正式数据状态以 PostgreSQL 后端返回为准；未连接后端时只作为静态/开发预览。
- 页面默认中文，可点击 `中 / EN` 切换语言；也可追加 `?locale=en-US` 或 `?lang=en-US` 直接以英文打开。
