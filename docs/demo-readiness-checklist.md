# Demo Readiness Checklist

Last checked: 2026-05-16

This checklist is for customer-facing walkthroughs of the LinZight RWD EDC demo. It separates what can be shown confidently from internal governance items and remaining formal-product blockers.

## Fixed Demo Chain

Run the browser chain before a customer demo:

```bash
npm run demo:e2e
```

The script starts a temporary seeded backend and a temporary Vite frontend, then validates these three roles:

| Role | Demo account | Expected scope |
| --- | --- | --- |
| LZ system admin | `admin@demo.linzight` | All Study operational view; every patient row carries `Study ID`. |
| Lung Study CRC | `lung-crc@demo.linzight` | `LZXK-01` only; can run patient, CRF, consent, sample, Journey, analytics and quality-to-Query flow. |
| Lung Study data manager | `lung-dm@demo.linzight` | `LZXK-01` only; can run quality Query plus System Management Query, approval and audit views. |

Validated chain:

`登录 -> 患者队列 -> CRF -> 知情/eConsent -> 样本/检测 -> Journey -> 数据分析 -> Query -> 审批 -> 审计`

Study CRC does not open System Management by design. Its customer-facing Query path is Data Analysis quality issue to Query. Approval and audit are shown through Data Manager or Admin.

## 可演示

- 登录按 `Study 研究入口` 或 `LZ 系统管理` 分流，Study 角色账号列表按 Study 过滤。
- 患者队列显示 `Study ID`，管理员能解释 70 名全局患者与单 Study 患者数之间的口径差异。
- `LZXK-01` 肺癌耐药 Study 使用独立肺癌 CRF：ECOG、TNM、治疗线数、驱动基因、耐药机制、RECIST、ctDNA、PFS、ORR 和检测项目。
- `LZXK-01` 知情同意、样本、检测和 Journey 使用肺癌耐药语义，不显示 SLE/NPSLE 同意书或 SLEDAI/C3/IgG 指标。
- 新增患者、新增样本、新增检测、新建随访都是表单式交互，并写入明确的 `study_id`。
- 数据分析页可运行质量校验，访视窗口问题可以生成 Query，并显示创建后的 Query 编号。
- eConsent 撤回/重签通过 Approval Center，不再直接静默改状态。
- System Management 可展示当前 Study 的 CRF 字段、CRF 版本、Query、Approval Center 和 Audit Diff。
- 静态 HTML 导出包含八个业务模块，适合无后端的页面 walkthrough。
- 移动端 390px 主表格已卡片化，适合演示“可用”，但不是移动优先产品。

## 内部治理先不展示

- 锁库和脱敏审批作为内部治理流程，客户演示阶段不主动展开。
- 真实对象存储、外部病毒扫描、PostgreSQL staging migration 已有适配点或导出包，但不作为生产就绪承诺展示。
- Docker Compose、SQLite backup/restore、OpenAPI 导出用于工程交付说明，不作为临床客户主演示链路。
- 审计 diff 可展示“修改前/后值”，但不要承诺已覆盖全部法规级审计场景。

## 正式产品仍未完成

- 生产级身份源、SSO、组织/中心权限同步、字段级权限和审批授权矩阵。
- PostgreSQL 正式 migration、索引、约束、备份恢复演练和数据保留策略。
- 对象存储、病毒扫描、文件归档和长期可追溯下载审计的真实基础设施。
- Query 的 reviewer 工作台、批量处理、SLA、通知和报表。
- eConsent 撤回/重签的签署文件、扫描件、签署方式、审批原因和完整审计报表。
- 访视窗口规则的日历化、超窗原因、漏访原因、中心维度配置和提醒。
- 数据字典的单位、范围、必填、逻辑校验、版本迁移影响分析和回滚策略。
- 浏览器矩阵需要纳入 CI，并扩展到更多浏览器、截图基线和真实用户权限组合。

## Demo 口径

- 这是工程化 RWD EDC Demo/private beta，不是可承载真实患者数据的生产临床系统。
- 演示重点是 Study 隔离、Study 绑定 CRF、患者中心数据链路、质量到 Query、eConsent 审批和审计闭环。
- 如被问到“正式上线还差什么”，使用上面的正式产品未完成清单，不要把 Demo 适配点说成已生产落地。
