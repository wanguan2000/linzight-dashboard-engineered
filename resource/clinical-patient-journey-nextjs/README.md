# Clinical Patient Journey 前端页面

这是一个贴近附件风格的 **临床 Patient Journey** 前端页面源码包，技术栈：

```text
Next.js + TypeScript + Ant Design v5 + Apache ECharts + Zustand + Day.js
```

## 已实现功能

- 多轨临床事件轴：病程主线、住院/急性事件、治疗方案、随访访视、样本与组学
- 点事件与区间事件混合展示
- ECharts `custom series` 绘制多轨事件轴、治疗条、住院区间、随访点、样本点、组学检测点
- 时间缩放 `dataZoom`，上方事件轴与下方趋势图共享缩放范围
- 当前选中时间点竖线标记
- Biomarker 趋势图：SLEDAI、C3、ESR、24h尿蛋白、IgG
- 顶部关键指标卡片随选中时间点更新
- 右侧 Event Detail Stream 事件明细流
- 图表点击 → 右侧事件列表高亮/滚动定位/打开详情 Drawer
- 右侧事件悬停 → 左侧图表双向高亮
- 事件类型筛选：病程、住院、治疗、随访、样本采集、Omics 检测
- 关键词搜索
- 重置视图
- 加载更多
- 事件详情 Drawer
- 附件一致的视觉风格：白色卡片、浅蓝边框、细网格线、圆角、柔和阴影、医疗 SaaS 浅色风格

## 本地运行

```bash
npm install
npm run dev
```

浏览器访问：

```text
http://localhost:3000
```

## 生产构建

```bash
npm run build
npm run start
```

## 目录结构

```text
app/
├── layout.tsx
└── page.tsx

src/
├── App.tsx
├── data.ts
├── store.ts
├── styles.css
└── components/
    ├── BiomarkerTrendChart.tsx
    ├── EventDetailDrawer.tsx
    ├── EventDetailStream.tsx
    ├── FilterBar.tsx
    ├── MetricCards.tsx
    └── MultiTrackTimeline.tsx
```

## 接入真实临床数据

当前使用 `src/data.ts` 中的 mock 数据。后端建议按以下结构返回：

```ts
JourneyEvent[]
BiomarkerPoint[]
PatientSummary
```

替换 `src/data.ts` 即可接入真实数据。建议后端事件字段至少包含：

```ts
id, kind, category, track, title, date, endDate, description, tag
```

其中：

- `kind = point`：单点事件，如发病、诊断、随访、样本采集、组学检测。
- `kind = range`：区间事件，如住院、治疗方案、持续用药。
