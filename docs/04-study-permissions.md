# RWD EDC 多研究 Study 权限体系

## 核心约定

- RWD EDC 研究隔离字段统一为 `study_id`。
- RWD EDC 不使用 `project_id`；样本检测业务如需项目编号，使用 `testing_project_id`。
- “项目”在 EDC 主链路中统一称为 Study / 研究。
- 平台级角色负责跨 Study 管理，研究级角色只在所属 Study 内生效。

## 角色编码

平台级角色：

- `LZ_ADMIN`
- `LZ_CRC`
- `LZ_CRF_ADMIN`
- `LZ_DATA_MANAGER`
- `LZ_AUDITOR`

研究级角色：

- `STUDY_PI`
- `STUDY_CRC`
- `STUDY_CONFIG_ADMIN`
- `STUDY_DATA_MANAGER`

## Study Scope

后端统一返回并使用：

```ts
type StudyScope = {
  scopeType: "all_studies" | "assigned_studies" | "own_studies";
  studyIds?: string[];
};
```

当前 Demo seed：

- `crc@demo.linzight`：`STUDY_CRC`，只访问 `LGL-1111`。
- `lung-pi@demo.linzight`：`STUDY_PI`，只访问 `LZXK-01`。
- `lung-crc@demo.linzight`：`STUDY_CRC`，只访问 `LZXK-01`。
- `lung-config@demo.linzight`：`STUDY_CONFIG_ADMIN`，拥有 `LZXK-01` 本 Study 全部业务、配置、成员、导出和审批权限。
- `lung-dm@demo.linzight`：`STUDY_DATA_MANAGER`，只访问 `LZXK-01` 质控、Query、导出和审批流程。
- `admin@demo.linzight`：`LZ_ADMIN`，访问全部 Study。
- `lz-crc@demo.linzight`：`LZ_CRC`，访问 `LGL-1111`、`RWD-NMO-2026`、`LZXK-01`。
- `lz-dm@demo.linzight`：`LZ_DATA_MANAGER`，只访问 `RWD-NMO-2026`。

`LZXK-01` 为“真实世界肺癌耐药研究”，seed 默认生成 20 名患者、60 条访视、40 条随访记录、60 条 CRF、44 个样本、64 条组学检测记录，以及独立 `CRFV-LZXK-01-V1.0` CRF 版本。样本检测项目编号为 `TP-LUNG-RESIST-OMICS`，不作为 EDC 隔离字段。

## 后端实现

- `backend/permissions.py` 提供 `role_can()`、`get_user_study_scope()`、`can_access_study()` 和 Study 成员查询。
- `backend/database.py` 增加 `studies`、`study_members`、`global_role_study_scope`、`study_visit_plans`、`study_configurations`、`study_crf_versions`。
- 患者、知情、访视、随访记录、CRF、样本、组学、文件、导出和质控均包含 `study_id`。
- `omics_records` 使用 `testing_project_id` 表示样本检测项目编号。
- 所有核心列表和详情接口按授权 Study 自动过滤。
- Query 创建校验患者、访视和 CRF 字段都属于当前 Study；`field_name` 必须来自该 Study 当前 CRF schema。
- 质量检查会基于 `study_visit_plans` 生成访视窗口超窗问题。
- GA 版本已移除 standalone audit log 模块；关键业务写入仍必须带 `study_id` 并由后端校验 Study scope。
- CRF 数据绑定 `study_id`、`patient_id`、`crf_version_id`、`form_id`。
- Study 配置总表 `study_configurations` 绑定病种语义、当前 published CRF、访视计划、知情同意模板和检测 profile；新建患者不得在缺少当前 Study published CRF 时回退默认 LGL。
- 访视计划配置保存在 `study_visit_plans`，`visits.visit_plan_id` 关联配置；新建患者不会自动生成患者访视或 CRF 草稿。
- 随访事实记录保存在 `follow_up_records`，隶属于患者信息，绑定 `study_id + patient_id`，可选关联 `visit_id`；普通 CRC 可录入，PI/数据管理员可查看，配置管理员不默认编辑患者随访内容。

## 前端实现

- `src/data/auth.ts` 使用新角色码和 Study scope。
- 登录后 API 请求自动携带 Bearer token。
- 后端不可用时，本地 mock/fallback 数据也按当前用户 Study scope 过滤。
- 侧边栏菜单按角色隐藏无权模块。
- `LZ_ADMIN`、多 Study 平台角色和任何实际返回多 Study 数据的列表必须显示 `Study ID`；患者队列、CRF 患者摘要、知情同意、样本/检测和导出任务不得只显示患者编号。
- 跨 Study 页面需要提供 Study selector，默认可以展示全部授权 Study，但新增患者、样本、检测、导出和质量校验必须明确落到某一个 `study_id`。
- 系统管理页展示平台级/研究级角色矩阵、Study scope 和独立 CRF 版本管理语义。
- 系统管理页展示各 Study 的访视计划配置，避免把访视窗口和时间点硬编码到 CRF 字段。

## 验收点

- 普通 Study CRC 只能看到所属 Study。
- `LZ_ADMIN` 可以看到全部 Study。
- `LZ_ADMIN` 全局患者列表每行都包含 `study_id`，且至少覆盖 seed 中的 `LGL-1111`、`RWD-NMO-2026` 和 `LZXK-01`。
- 授权平台角色只看到被授权 Study。
- RWD EDC 数据隔离使用 `study_id`。
- 样本检测项目字段使用 `testing_project_id`。
- Study 成员、CRF 版本、导出、质控和关键写操作均按当前 Study 权限校验，不再写入 `audit_logs`。
- Study CRC 请求其他 Study 的 patients、samples、omics、consents 等主链路接口必须返回 403，而不是返回空数组或前端静默停留。
- API smoke 已覆盖 files、queries、quality、exports、approvals、CRF entry 的基础越权用例；`npm run browser:matrix` 覆盖桌面和 390px 移动端的角色路由矩阵。正式发布前仍需把该矩阵纳入 CI，并扩展到更多浏览器和真实认证源。
