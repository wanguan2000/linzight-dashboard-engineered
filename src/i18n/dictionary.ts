import type { Locale } from './types';

type DynamicRule = {
  pattern: RegExp;
  format: (...matches: string[]) => string;
};

const exactEnglish: Record<string, string> = {
  '账号或密码不正确': 'Incorrect account or password',
  '账号或密码不正确，或账号已被禁用。': 'Incorrect account or password, or the account has been disabled.',
  'LinZight 登录': 'LinZight login',
  '沪ICP备2026020480号': '沪ICP备2026020480号',
  '真实世界研究工作台': 'Real-world study workspace',
  '登录后进入患者队列、CRF 录入、样本登记、多组学检测、Patient Journey 与数据分析主链路。':
    'Sign in to access patient cohorts, CRF entry, sample registration, multi-omics testing, Patient Journey, and analytics workflows.',
  '登录后按 Study 权限进入患者队列、CRF 录入、样本登记、多组学检测、Patient Journey 与数据分析主链路。':
    'Sign in to access patient cohorts, CRF entry, sample registration, multi-omics testing, Patient Journey, and analytics by Study permissions.',
  '主链路': 'Primary workflow',
  '登录': 'Login',
  '患者列表': 'Patient list',
  '患者索引': 'Patient index',
  'Study 系统管理': 'Study System Management',
  'Study 名称': 'Study name',
  '进入 Study': 'Enter Study',
  '样本': 'Samples',
  '组学': 'Omics',
  '上传': 'Upload',
  '分析': 'Analytics',
  '导出': 'Export',
  '账号登录': 'Account login',
  '正式系统认证': 'Production sign-in',
  '入口类型': 'Entry type',
  'Study 研究入口': 'Study entry',
  'LZ 系统管理': 'LZ System Admin',
  'Study Workspace': 'Study Workspace',
  'Study 项目': 'Study project',
  '选择 Study Workspace': 'Select Study Workspace',
  '登录后如账号只授权一个 Study，将直接进入；多个 Study 时再选择工作区。':
    'After sign-in, accounts with one authorized Study enter directly; accounts with multiple Studies choose a workspace.',
  '平台级账号仅管理 Study、成员、权限配置和全局索引；业务操作需进入单个 Study Workspace。':
    'Platform accounts manage Studies, members, permission configuration, and cross-Study business workflows through Study-scoped APIs.',
  '平台级账号可跨 Study 管理业务数据；读写仍使用 Study-scoped API。':
    'Platform accounts can manage business data across Studies; reads and writes still use Study-scoped APIs.',
  'LZ 系统管理入口仅支持平台级账号。': 'The LZ System Admin entry only supports platform-level accounts.',
  '当前账号没有可进入的 Study。': 'This account has no Study workspace access.',
  '工作区边界': 'Workspace boundary',
  '登录后选择或自动进入单个 Study': 'Choose or automatically enter one Study after sign-in',
  'LZ 系统管理 · 全局配置与索引': 'LZ System Admin · Global configuration and index',
  '进入 Study Workspace': 'Enter Study Workspace',
  '研究编号 / study_id': 'Study ID / study_id',
  '平台级账号，可跨 Study 管理研究、成员、CRF、质控、导出和审计。':
    'Platform accounts can manage studies, members, CRF, quality, exports, and audit across Studies.',
  '管理入口': 'Admin entry',
  '全局管理': 'Global admin',
  'LZ 全局管理': 'LZ Global Admin',
  'LZ 全局层只展示患者索引；业务管理必须进入单个 Study Workspace。':
    'The LZ global layer only shows the patient index; business management must enter a single Study Workspace.',
  'LZ 平台视角按 Study 汇总患者队列；业务读写仍逐个使用 Study Workspace API。':
    'The LZ platform view aggregates patient cohorts by Study; business reads and writes still use Study Workspace APIs per Study.',
  '搜索患者、Study ID、疾病类型或状态...': 'Search patients, Study ID, disease type, or status...',
  '管理 Study、用户和授权范围；不直接编辑 CRF、样本、随访或导出数据。':
    'Manage Studies, users, and authorization scopes; do not directly edit CRF, samples, follow-up, or export data.',
  '管理 Study、用户、Study 绑定和平台角色；业务数据继续按 study_id 隔离。':
    'Manage Studies, users, Study bindings, and platform roles; business data remains isolated by study_id.',
  '搜索患者索引、Study ID 或状态...': 'Search patient index, Study ID, or status...',
  '询问 Study、用户、角色或授权范围...': 'Ask about Studies, users, roles, or authorization scopes...',
  'LZ 全局层只管理 Study、用户和授权范围，不直接编辑业务数据。':
    'The LZ global layer only manages Studies, users, and authorization scopes; it does not directly edit business data.',
  'LZ 平台层管理 Study、用户、Study 绑定和跨 Study 业务权限。':
    'The LZ platform layer manages Studies, users, Study bindings, and cross-Study business permissions.',
  'Search studies, users, roles, or authorization scopes...': 'Search studies, users, roles, or authorization scopes...',
  'LZ 管理页不是业务租户；业务操作必须进入单个 Study Workspace。':
    'The LZ admin page is not a business tenant; business operations must enter a single Study Workspace.',
  'LZ 平台跨 Study 汇总业务数据，读写仍逐个校验 study_id。':
    'The LZ platform aggregates business data across Studies, while reads and writes are still checked by study_id.',
  'Study Registry | Study 管理': 'Study Registry | Study Management',
  '新建 Study 表单': 'Create Study form',
  '新建用户表单': 'Create user form',
  '编辑用户表单': 'Edit user form',
  '请输入 Study 名称': 'Enter Study name',
  '适应症 / 疾病领域': 'Indication / disease area',
  '请输入适应症或疾病领域': 'Enter indication or disease area',
  '提交新建': 'Submit create',
  '保存调整': 'Save changes',
  '请输入姓名': 'Enter name',
  '角色': 'Role',
  '账号基础角色': 'Account base role',
  '平台 Study Scope': 'Platform Study Scope',
  '请输入初始密码': 'Enter initial password',
  '留空则不修改密码': 'Leave blank to keep password',
  '具体权限': 'Concrete permissions',
  '当前角色没有矩阵授权项': 'No matrix permissions for this role',
  '账户状态': 'Account status',
  'Study 成员状态': 'Study member status',
  'Study 角色绑定': 'Study role bindings',
  '一个用户可以绑定多个 Study，每个 Study 独立选择角色': 'One user can be bound to multiple Studies, with an independent role per Study',
  '添加 Study 绑定': 'Add Study binding',
  '暂无 Study 绑定': 'No Study binding yet',
  '按每个 Study 绑定角色匹配权限策略矩阵': 'Match the permission strategy matrix by each Study binding role',
  '移除': 'Remove',
  '维护 Study、用户和授权范围；业务数据在单个 Study Workspace 内处理。':
    'Maintain Studies, users, and authorization scopes; business data is handled inside a single Study Workspace.',
  '维护 Study、用户、平台角色和每个 Study 的角色绑定。':
    'Maintain Studies, users, platform roles, and per-Study role bindings.',
  '授权账号': 'Authorized accounts',
  '平台角色': 'Platform roles',
  '研究角色': 'Study roles',
  '边界': 'Boundary',
  '业务操作进入 Study Workspace': 'Business operations enter the Study Workspace',
  '全局患者列表仅作为索引；请先进入单个 Study Workspace': 'The global patient list is index-only; enter a single Study Workspace first.',
  '全局患者列表仅作为索引；请通过患者链接进入所属 Study 后再管理':
    'The global patient list is index-only; use the patient link to enter the owning Study before managing it.',
  '全局患者列表不能直接写入；请先进入单个 Study Workspace':
    'The global patient list cannot be written directly; enter a single Study Workspace first.',
  '请先选择一个 Study，再新建患者': 'Select a Study before creating a patient.',
  '请先选择一个 Study，再编辑患者': 'Select a Study before editing a patient.',
  '请先选择一个 Study，再保存患者': 'Select a Study before saving the patient.',
  '请先选择一个 Study，再生成导出': 'Select a Study before generating an export.',
  '请先选择一个 Study，再运行校验': 'Select a Study before running validation.',
  '暂无 Study': 'No Study',
  'LZ 系统管理 · 全部或授权 Study': 'LZ System Admin · All or assigned Studies',
  '角色账号': 'Role account',
  '账号邮箱': 'Account email',
  '新密码': 'New password',
  '忘记密码 / 修改密码': 'Forgot / change password',
  '发送重置邮件': 'Send reset email',
  '修改密码': 'Change password',
  '返回登录': 'Back to sign in',
  '重置邮件正在发送...': 'Sending reset email...',
  '如果账号存在，系统会发送密码重置邮件。': 'If the account exists, the system will send a password reset email.',
  '邮件服务暂不可用，请联系 LZ 系统管理员。': 'Email service is temporarily unavailable; contact the LZ system administrator.',
  '缺少密码重置 token。': 'Missing password reset token.',
  '密码正在更新...': 'Updating password...',
  '密码已更新，请使用新密码登录。': 'Password updated. Sign in with the new password.',
  '密码重置链接无效或已过期。': 'The password reset link is invalid or expired.',
  '暂无 Study，请点击新建 Study 创建第一个研究。': 'No Study yet. Use Create Study to create the first Study.',
  '暂无可生成洞察的数据。': 'No data is available for insight generation.',
  '密码': 'Password',
  '登录中': 'Signing in',
  '进入系统': 'Enter system',
  '当前角色没有用户状态写入权限': 'Current role cannot update user status',
  'Approval Center': 'Approval Center',
  'Export, de-identified export, and CRF publish approvals': 'Export, de-identified export, and CRF publish approvals',
  'Export and CRF publish approvals': 'Export and CRF publish approvals',
  'No approval comment': 'No approval comment',
  'No approvals yet': 'No approvals yet',
  'Reject': 'Reject',
  'export': 'Export',
  'deidentified_export': 'De-identified export',
  'crf_publish': 'CRF publish',
  'submitted': 'Submitted',
  'cancelled': 'Cancelled',
  'completed': 'Completed',

  '主导航': 'Main navigation',
  '首页工作台': 'Home',
  '患者队列管理': 'Patient Cohort',
  '知情同意': 'Informed Consent',
  '临床数据采集': 'Clinical Data Capture',
  '样本及检测': 'Samples & Testing',
  '患者旅程': 'Patient Journey',
  '数据分析': 'Analytics',
  '系统管理': 'System Admin',
  '主要研究者': 'Principal Investigator',
  '系统管理员': 'System Administrator',
  '项目管理员': 'Project Administrator',
  'PI研究者': 'PI Investigator',
  '数据管理员': 'Data Manager',
  '只读访客': 'Read-only Visitor',
  'LZ 系统管理员': 'LZ System Administrator',
  'LZ CRC / 中央 CRC': 'LZ CRC / Central CRC',
  'CRF 管理员': 'CRF Administrator',
  '平台数据管理员': 'Platform Data Manager',
  '平台审计员': 'Platform Auditor',
  'LZ CRF 管理员': 'LZ CRF Administrator',
  'LZ 数据管理员': 'LZ Data Manager',
  'LZ 平台审计员': 'LZ Platform Auditor',
  '研究 PI / 医生': 'Study PI / Physician',
  '研究 CRC': 'Study CRC',
  '研究配置管理员': 'Study Configuration Admin',
  '研究数据管理员': 'Study Data Manager',
  'Visit Plan Configuration | 访视计划配置': 'Visit Plan Configuration',
  '按 Study 配置访视时间窗、必填 CRF 表单和样本要求': 'Configure visit windows, required CRF forms, and sample requirements by Study.',
  '新增访视': 'New Visit',
  '天': 'days',
  'V1 基线访视': 'V1 baseline visit',
  'V2 1月耐药评估': 'V2 1-month resistance assessment',
  'V3 3月疗效评估': 'V3 3-month response assessment',
  '肺癌 PI': 'Lung Cancer PI',
  '肺癌 CRC': 'Lung Cancer CRC',
  '肺癌配置管理员': 'Lung Cancer Configuration Admin',
  '肺癌数据管理员': 'Lung Cancer Data Manager',
  '真实世界肺癌耐药研究': 'Real-world Lung Cancer Resistance Study',
  '真实世界肺癌耐药研究知情同意': 'Real-world Lung Cancer Resistance Study Informed Consent',
  '肺癌耐药研究概述': 'Lung cancer resistance study overview',
  '真实世界肺癌耐药队列': 'Real-world lung cancer resistance cohort',
  '样本和检测用途': 'Sample and testing use',
  '组织、血液与 ctDNA/NGS': 'Tissue, blood, and ctDNA/NGS',
  '风险与隐私保护': 'Risks and privacy protection',
  '低风险、匿名化与合规': 'Low risk, de-identification, and compliance',
  '自愿参加与签署确认': 'Voluntary participation and signature confirmation',
  '肺癌耐药研究字段': 'Lung Cancer Resistance Study Fields',
  '肺癌耐药': 'Lung Cancer Resistance',
  '肺癌研究基本信息': 'Lung cancer study basics',
  '肺癌治疗与耐药评估': 'Lung cancer treatment and resistance assessment',
  '肺癌组学与疗效终点': 'Lung cancer omics and efficacy endpoints',
  'LZXK-01 肺癌耐药 CRF V1.0 · ECOG / TNM / ctDNA / NGS': 'LZXK-01 Lung Resistance CRF V1.0 · ECOG / TNM / ctDNA / NGS',
  'ECOG / 疗效': 'ECOG / Response',
  'ctDNA丰度': 'ctDNA abundance',
  'PFS（月）': 'PFS (months)',
  '靶病灶变化': 'Target lesion change',
  'ORR': 'ORR',
  '驱动基因突变': 'Driver Gene Mutation',
  '耐药机制': 'Resistance Mechanism',
  '治疗线数': 'Treatment Line',
  'RECIST 评估': 'RECIST Assessment',
  'RECIST评估': 'RECIST assessment',
  'ECOG 1 / 待评估': 'ECOG 1 / pending assessment',
  'ECOG / 疗效待录入': 'ECOG / response pending',
  '待录入治疗方案': 'Treatment plan pending',
  'ctDNA / NGS待确认': 'ctDNA / NGS pending',
  'ctDNA / 影像待录入': 'ctDNA / imaging pending',
  'I期': 'Stage I',
  'II期': 'Stage II',
  'III期': 'Stage III',
  'IV期': 'Stage IV',
  'TNM text': 'TNM text',
  'integer 0-5': 'integer 0-5',
  'percentage 0-100': 'percentage 0-100',
  '任约翰': 'John Ren',
  '任约翰博士': 'Dr. John Ren',
  '林清妍': 'Qingyan Lin',
  '陈序': 'Xu Chen',
  '顾明远': 'Mingyuan Gu',
  '中央 CRC': 'Central CRC',
  'ALK耐药': 'ALK resistance',
  'ALK 耐药': 'ALK resistance',
  'EGFR-TKI耐药': 'EGFR-TKI resistance',
  'EGFR-TKI 耐药': 'EGFR-TKI resistance',
  '奥希替尼': 'Osimertinib',
  'MET抑制剂': 'MET inhibitor',
  '阿来替尼': 'Alectinib',
  '洛拉替尼': 'Lorlatinib',
  '局部放疗': 'Local radiotherapy',
  '疲乏': 'Fatigue',
  '研究名称': 'Study name',
  '肿瘤类型': 'Tumor type',
  '肿瘤分期': 'Tumor stage',
  'ECOG评分': 'ECOG score',
  '驱动基因': 'Driver gene',
  '初始治疗方案': 'Initial treatment plan',
  'T790M / C797S 或旁路激活': 'T790M / C797S or bypass activation',
  'ALK 二级突变或旁路激活': 'ALK secondary mutation or bypass activation',
  '三代 EGFR-TKI 后耐药评估': 'Resistance assessment after third-generation EGFR-TKI',
  '二代 ALK-TKI 后耐药评估': 'Resistance assessment after second-generation ALK-TKI',
  'ctDNA突变丰度': 'ctDNA mutation abundance',
  'ORR评估': 'ORR assessment',
  '当前治疗方案': 'Current treatment plan',
  '分期': 'Stage',
  '病种': 'Disease',
  'TNM分期': 'TNM stage',
  '转移部位': 'Metastasis site',
  '标本类型': 'Specimen type',
  'NGS 520基因 panel + ctDNA 动态监测': 'NGS 520-gene panel + ctDNA dynamic monitoring',
  '当前治疗线数': 'Current treatment line',
  'CRF版本': 'CRF version',
  '血液、组织': 'Blood / Tissue',
  '血液、组织、胸水': 'Blood / Tissue / Pleural effusion',
  '未见远处转移': 'No distant metastasis observed',
  '肺': 'lung',
  '肝': 'liver',
  '脑': 'brain',
  '组织': 'Tissue',
  '胸水': 'Pleural effusion',
  'NGS panel': 'NGS panel',
  'ctDNA': 'ctDNA',
  '病理复核': 'Pathology review',
  '研究助理 / CRC': 'Research Assistant / CRC',
  '研究医生 / PI': 'Research Doctor / PI',
  '当前角色': 'Current role',
  '当前角色：PI研究者': 'Current role: PI Investigator',
  '研究编号': 'Study ID',
  '研究编号：LGL-1111': 'Study ID: LGL-1111',
  'Study 范围': 'Study scope',
  '全部 Study': 'All Studies',
  '未授权 Study': 'No authorized Study',
  'IgG': 'IgG',
  '通知': 'Notifications',
  '通知功能将在生产环境接入': 'Notifications will be connected in production',
  '退出登录': 'Sign out',
  '询问 LinZight AI': 'Ask LinZight AI',
  '询问 LinZight AI，例如：“查看本季度患者入组趋势”': 'Ask LinZight AI, for example: "Show this quarter enrollment trend"',
  '发送提示词': 'Send prompt',
  'AI 提示示例': 'AI prompt examples',
  '请输入 AI 指令': 'Enter an AI instruction',
  '查看数据完整性': 'View data completeness',
  '当前角色没有快捷写入权限': 'Current role cannot use quick write actions',
  '当前角色不能进入系统管理': 'Current role cannot access System Admin',

  '欢迎回来，任约翰博士': 'Welcome back, Dr. John Ren',
  '这里是今日临床研究运营概览。': "Here is today's clinical study operations overview.",
  '管理和审核 LGL-1111 研究患者队列。': 'Manage and review the LGL-1111 study patient cohort.',
  '按 Study 权限管理和审核研究患者队列。': 'Manage and review study patient cohorts by Study permissions.',
  '知情同意管理': 'Informed Consent Management',
  '管理患者授权、版本签署与审计轨迹。': 'Manage patient authorization, version signing, and audit trails.',
  '采集和审核 LGL-1111 研究结构化临床数据。': 'Capture and review structured clinical data for LGL-1111.',
  '采集和审核当前授权 Study 的结构化临床数据。': 'Capture and review structured clinical data for the authorized Study.',
  '管理样本采集、检测项目、结果文件和检测进度。': 'Manage sample collection, tests, result files, and testing progress.',
  '查看单患者从筛选、知情同意、临床随访到样本检测的全景数据。':
    'View the complete single-patient journey from screening and consent to follow-up and sample testing.',
  '导出 / 报表': 'Exports / Reports',
  '生成研究数据集、患者全景报表与审计导出。': 'Generate study datasets, patient panorama reports, and audit exports.',
  '管理账户、角色、字段配置和权限策略。': 'Manage accounts, roles, field configuration, and permission policies.',
  '管理 Study 成员、平台角色、权限策略和 CRF 版本。': 'Manage Study members, platform roles, permission policies, and CRF versions.',
  '搜索患者、住院号、疾病类型，或询问 LinZight AI...': 'Search patient, hospital number, disease type, or ask LinZight AI...',
  '询问 LinZight AI... 例如：列出待签署患者、汇总撤回情况':
    'Ask LinZight AI... For example: list patients pending signature or summarize withdrawals',
  '询问样本采集、检测状态、结果文件或患者样本情况...': 'Ask about sample collection, testing status, result files, or patient samples...',
  '询问单患者病程、样本结果、下次随访风险...': 'Ask about patient timeline, sample results, or next follow-up risk...',
  '询问报表生成、数据导出、SDTM 草稿或审计记录...': 'Ask about reports, data export, SDTM drafts, or audit records...',
  '询问角色权限、字段配置或系统审计...': 'Ask about role permissions, field configuration, or system audits...',

  '研究关键指标': 'Study key metrics',
  '看板可视化': 'Dashboard visualization',
  '运营概览': 'Operations overview',
  '当前模块': 'Current module',
  '已入组患者': 'Enrolled patients',
  '样本统计': 'Sample statistics',
  '较近 30 天': 'Last 30 days',
  '随访次数': 'Follow-up visits',
  '临床数据完整性': 'Clinical data completeness',
  '来自 patients 表': 'From patients table',
  '来自 samples 表': 'From samples table',
  '来自 visits 表': 'From visits table',
  'clinical_data 平均值': 'clinical_data average',
  '等待 patients API': 'Waiting for patients API',
  '等待 samples API': 'Waiting for samples API',
  '等待 omics API': 'Waiting for omics API',
  '等待 visits API': 'Waiting for visits API',
  '等待 clinical_data': 'Waiting for clinical_data',
  '已归档': 'archived',
  '来自 FastAPI / SQLite': 'From FastAPI / SQLite',
  '已识别': 'Identified',
  '已筛选': 'Screened',
  '已入组': 'Enrolled',
  '治疗中': 'On treatment',
  '随访中': 'In follow-up',
  '已完成': 'Completed',
  '患者总数': 'Total patients',
  '总患者数': 'Total patients',
  '唯一患者': 'Unique patients',
  '中位年龄': 'Median age',
  '女性占比': 'Female ratio',
  '平均合并症': 'Average comorbidities',
  '中位随访': 'Median follow-up',
  '患者筛选': 'Patient screening',
  '基线访视': 'Baseline visit',
  '样本采集': 'Sample collection',
  '访视': 'Visit',
  '日期': 'Date',
  '类型': 'Type',
  '用药变化': 'Medication change',
  '随访访视': 'Follow-up visit',
  '数据锁库': 'Database lock',
  '导出审计': 'Export audit',
  '已处理样本': 'Processed samples',
  '检测归档率': 'Testing archive rate',
  '检测项目': 'Testing items',
  'SLA 达标率': 'SLA attainment',
  'SLA 目标': 'SLA target',
  '↑ 12.4%': '+12.4%',
  '↑ 5.3%': '+5.3%',
  '≤ 5 天': '<= 5 days',
  '智能摘要': 'Smart summary',
  'LinZight AI 生成': 'Generated by LinZight AI',
  '中': 'C',
  '数': 'D',
  '查看全部洞察': 'View all insights',
  '查看全部洞察 →': 'View all insights ->',
  '工作流进度': 'Workflow progress',
  '工作流研究筛选': 'Workflow study filter',
  '全部研究': 'All studies',
  '总体': 'Overall',
  '进度': 'Progress',
  '入组趋势': 'Enrollment trend',
  '入组时间范围': 'Enrollment time range',
  '本季度': 'This quarter',
  '入组趋势图': 'Enrollment trend chart',
  '4月': 'Apr',
  '5月': 'May',
  '6月': 'Jun',
  '累计入组': 'Cumulative enrollment',
  '较上季度 18.6%': '18.6% vs last quarter',
  '多组学检测的统计': 'Multi-omics testing statistics',
  '多组学时间范围': 'Multi-omics time range',
  '本月': 'This month',
  '查看实验室看板': 'View lab dashboard',
  '查看实验室看板 →': 'View lab dashboard ->',
  '中位 TAT': 'Median TAT',
  '实时统计': 'Real-time stats',
  '患者旅程概览': 'Patient journey overview',
  '查看全部患者': 'View all patients',
  '查看全部患者 →': 'View all patients ->',
  '真实世界队列概览': 'Real-world cohort overview',
  '查看队列分析': 'View cohort analytics',
  '查看队列分析 →': 'View cohort analytics ->',
  'CRF 录入': 'CRF entry',
  '组学归档': 'Omics archive',
  '更多快捷操作': 'More quick actions',
  '入组趋势较上一季度提升 18.6%。': 'Enrollment trend improved by 18.6% vs last quarter.',
  '入组趋势较上一季度提升 ': 'Enrollment trend improved by ',
  '7 号中心和 12 号中心入组增长领先。': 'Sites 7 and 12 lead enrollment growth.',
  '7 号中心': 'Site 7',
  '12 号中心': 'Site 12',
  '和 ': ' and ',
  '入组增长领先。': ' lead enrollment growth.',
  '受 ePRO 推动，数据完整性提升 3.4%。': 'Driven by ePRO, data completeness improved by 3.4%.',
  '受 ePRO 推动，数据完整性提升 ': 'Driven by ePRO, data completeness improved by ',
  '12 名患者存在错过下次访视风险。': '12 patients are at risk of missing the next visit.',
  '12 名患者': '12 patients',
  '存在错过下次访视风险。': ' are at risk of missing the next visit.',
  '。': '.',

  '患者队列关键指标': 'Patient cohort key metrics',
  '队列概览': 'Cohort overview',
  '总计': 'Total',
  '数据完整性趋势': 'Data completeness trend',
  '当前': 'Current',
  '样本采集汇总': 'Sample collection summary',
  '患者编号': 'Patient ID',
  '住院号': 'Hospital No.',
  '性别': 'Sex',
  '年龄': 'Age',
  '疾病类型': 'Disease type',
  '受累脏器': 'Affected organs',
  '多组学检测': 'Multi-omics testing',
  '完整性': 'Completeness',
  '注释': 'Notes',
  '操作': 'Actions',
  '查看': 'View',
  '编辑': 'Edit',
  'Edit': 'Edit',
  'Enable': 'Enable',
  'Disable': 'Disable',
  '文件': 'File',
  '打印知情': 'Print consent',
  '上传知情': 'Upload consent',
  '查看知情': 'View consent',
  '预览打印': 'Preview print',
  '暂无匹配患者': 'No matching patients',
  '按患者、样本和组学进度筛选队列': 'Filter cohorts by patient, sample, and omics progress',
  '新建患者': 'New patient',
  '患者搜索': 'Patient search',
  '输入患者编号、住院号或疾病类型': 'Enter patient ID, hospital number, or disease type',
  '年龄范围': 'Age range',
  '排序': 'Sort',
  '上一页': 'Previous page',
  '下一页': 'Next page',
  '患者队列筛选': 'Patient cohort filters',
  '女性': 'Female',
  '样本已采集': 'Samples collected',
  '完整性 >80%': 'Completeness >80%',
  '数据源：数据库实时同步': 'Source: real-time database sync',
  '数据库实时': 'Live database',
  '占总数': 'Of total',
  '平均完整度': 'Average completeness',
  '前段': 'Earlier',
  '中段': 'Middle',
  '当前角色没有患者写入权限': 'Current role cannot write patient records',
  '当前角色只读：患者新增/编辑已禁用': 'Current role is read-only: patient create/edit is disabled',
  '当前角色没有患者写入权限，请切换到 Study CRC 或 LZ CRC': 'Current role cannot write patient records; switch to Study CRC or LZ CRC',
  '正在新建当前 Study 患者': 'Creating a patient in the current Study',
  '等待患者操作': 'Waiting for patient action',
  '患者编号和住院号为必填项': 'Patient ID and hospital No. are required',
  '当前角色没有患者写入权限，变更仅保存在本页': 'Current role cannot write patient records; changes are only saved on this page',
  '后端不可用，患者变更已保存在本页': 'Backend unavailable; patient changes are saved on this page',
  '最近更新': 'Latest update',
  '完整性优先': 'Completeness first',
  '年龄升序': 'Age ascending',
  '全部': 'All',
  '男': 'Male',
  '女': 'Female',
  '血液': 'Blood',
  '脑脊液': 'CSF',
  '肾': 'Kidney',
  '尿液': 'Urine',
  '总样本数': 'Total samples',
  '完成': 'Complete',
  '进行中': 'In progress',
  '结果归档': 'Result archived',

  '临床 Patient Journey': 'Clinical Patient Journey',
  '查找患者': 'Find patient',
  '清空': 'Clear',
  '开始': 'start',
  '结束': 'end',
  '搜索患者编号、住院号、疾病类型、性别或受累脏器': 'Search patient ID, hospital No., disease type, sex, or affected organ',
  '患者查找结果': 'Patient search results',
  '无匹配患者': 'No matching patients',
  '旅程事件分类筛选': 'Journey event filters',
  '多轨临床事件轴': 'Multi-track clinical timeline',
  '搜索事件、治疗或样本': 'Search timeline events',
  '重置视图': 'Reset view',
  '患者旅程时间范围': 'Patient journey time range',
  '指标趋势时间范围': 'Indicator trend time range',
  '事件明细流': 'Event detail stream',
  '事件分页': 'Event pagination',
  '关键指标趋势': 'Key indicator trend',
  '指标日期': 'Indicator date',
  '患者关键指标趋势': 'Patient key indicator trend',
  '选中时间点': 'Selected time point',
  '24h尿蛋白': '24h urine protein',
  '病程主线': 'Clinical course',
  '住院/急性事件': 'Admissions / acute events',
  '治疗方案': 'Treatment plan',
  '样本与组学': 'Samples & omics',
  '病程': 'Course',
  '住院': 'Admission',
  '治疗': 'Treatment',
  '随访': 'Follow-up',
  '随访记录': 'Follow-up record',
  'Omics检测': 'Omics testing',
  '诊断': 'Diagnosis',
  '发病': 'Onset',
  '复发': 'Relapse',
  '健康对照入组': 'Healthy control enrolled',
  '筛选入组': 'Screening enrollment',
  '症状记录': 'Symptom record',
  '首次住院': 'First admission',
  '初次住院': 'Initial admission',
  '活动评估住院': 'Disease activity admission',
  '基线评估住院': 'Baseline assessment admission',
  '狼疮活动复发住院': 'Lupus flare admission',
  '观察住院': 'Observation admission',
  '激素冲击': 'Steroid pulse',
  'MMF维持': 'MMF maintenance',
  'CD20启动': 'CD20 started',
  '血液采集': 'Blood collection',
  'CSF采集': 'CSF collection',
  '血液、CSF采集': 'Blood and CSF collection',
  'Proteomics送检': 'Proteomics sent',
  '未记录': 'Not recorded',
  '未评估': 'Not assessed',
  '影像/检验': 'Imaging/labs',
  '转移': 'Metastasis',
  '用药': 'Medication',
  '完整度': 'Completeness',
  '存储位置': 'Storage',
  '关联检测': 'Linked testing',
  '待选择': 'Pending selection',
  '待指定': 'Pending assignment',
  '疗效评估': 'Response assessment',
  '耐药评估': 'Resistance assessment',
  '蛋白组': 'Proteomics',
  '代谢组': 'Metabolomics',
  '含铂双药': 'Platinum doublet',
  '结果': 'Result',
  '送检': 'Sent for testing',
  '外周血样本': 'Peripheral blood sample',
  '脑脊液样本': 'CSF sample',
  '血液与 CSF': 'Blood and CSF',
  '转录组检测': 'Transcriptomics testing',
  '血浆蛋白组学检测': 'Plasma proteomics testing',
  '代谢组学检测': 'Metabolomics testing',
  '门诊': 'Outpatient',
  '电话': 'Phone',
  '线上': 'Online',
  '家访': 'Home visit',
  '存活': 'Alive',
  '死亡': 'Deceased',
  '稳定': 'Stable',
  '进展': 'Progression',
  '缓解': 'Response',
  '无病': 'No evidence of disease',
  '无': 'None',
  '符合 ACR/EULAR 标准': 'Meets ACR/EULAR criteria',
  '完善检查并制定方案': 'Workup completed and plan set',
  '皮疹与肾脏受累': 'Rash and kidney involvement',
  '联合 MMF 维持': 'Combined with MMF maintenance',
  'SLEDAI 4，病情稳定': 'SLEDAI 4, stable disease',
  '2022-06-10 ~ 2022-06-20': '2022-06-10 - 2022-06-20',
  '高热、关节痛、补体下降': 'Fever, joint pain, low complement',
  '评估 CD20 后反应': 'Post-CD20 response assessment',
  '甲泼尼龙冲击': 'Methylprednisolone pulse',
  '定期监测血常规和肝肾功能': 'Routine CBC and liver/kidney monitoring',
  '联合维持治疗': 'Combined maintenance therapy',
  '静脉免疫球蛋白': 'Intravenous immunoglobulin',
  '记录 SLEDAI 与用药': 'SLEDAI and medication recorded',
  '记录治疗反应': 'Treatment response recorded',

  '快捷操作': 'Quick actions',
  '新增患者': 'Add patient',
  '数据录入': 'Data entry',
  '样本录入': 'Sample entry',
  '随访录入': 'Follow-up entry',

  'Account Summary | 账户概览': 'Account Summary',
  '当前研究站点账户结构': 'Current study site account structure',
  'Create Account新增账户': 'Create Account',
  '新增账户': 'Add account',
  'Study 成员、CRF 版本、导出和权限策略变更均进入审计日志。':
    'Study member, CRF version, export, and permission policy changes are recorded in the audit log.',
  '账户创建、权限策略变更均进入审计日志。': 'Account creation and permission policy changes are recorded in the audit log.',
  'User Accounts & Roles List | 用户账户与角色列表': 'User Accounts & Roles List',
  '按角色和状态管理研究团队账号': 'Manage study team accounts by role and status',
  'Field & CRF Configuration | CRF 与字段配置': 'Field & CRF Configuration',
  '维护结构化 CRF 字段、类型和所属模块': 'Maintain structured CRF fields, types, and modules',
  '维护每个 Study 独立 CRF 字段、类型、版本和所属模块': 'Maintain independent CRF fields, types, versions, and modules for each Study',
  '新增字段': 'Add field',
  'Edit CRF Field': 'Edit CRF Field',
  'Field Name': 'Field Name',
  'CRF Module': 'CRF Module',
  'Required': 'Required',
  'Optional': 'Optional',
  'Options': 'Options',
  'Validation': 'Validation',
  'Conditional Logic': 'Conditional Logic',
  'Comma-separated options': 'Comma-separated options',
  'CRF Version Workflow': 'CRF Version Workflow',
  'Draft ready': 'Draft ready',
  'No draft version': 'No draft version',
  'Preview Migration': 'Preview Migration',
  'Migration Preview': 'Migration Preview',
  'Added': 'Added',
  'Changed': 'Changed',
  'Removed': 'Removed',
  'Unchanged': 'Unchanged',
  '变更明细': 'Change Details',
  '无字段级差异': 'No field-level differences',
  '新增字段项': 'Added',
  '变更字段项': 'Changed',
  '移除字段项': 'Removed',
  'name': 'name',
  'type': 'type',
  'module': 'module',
  'status': 'status',
  'options': 'options',
  'required': 'required',
  'validation_rule': 'validation rule',
  'conditional_logic': 'conditional logic',
  'New Draft': 'New Draft',
  'Publish Draft': 'Publish Draft',
  'Request Approval': 'Request Approval',
  'Apply Approved': 'Apply Approved',
  'CRF Migration Approval': 'CRF Migration Approval',
  'No active migration request': 'No active migration request',
  'No migration approvals yet': 'No migration approvals yet',
  'Execution Logs': 'Execution Logs',
  'Execution logs are stored for request, approval, and apply steps.': 'Execution logs are stored for request, approval, and apply steps.',
  'Approve': 'Approve',
  'Apply': 'Apply',
  'request': 'Request',
  'approve': 'Approve',
  'apply': 'Apply',
  'reused': 'Reused',
  'blocked': 'Blocked',
  'Existing pending or approved migration request reused': 'Existing pending or approved migration request reused',
  'Requester attempted to approve their own CRF migration': 'Requester attempted to approve their own CRF migration',
  'Migration approved by a separate reviewer': 'Migration approved by a separate reviewer',
  'Requester attempted to apply their own CRF migration': 'Requester attempted to apply their own CRF migration',
  'Separate reviewer required': 'Separate reviewer required',
  'Text': 'Text',
  'Number': 'Number',
  'Dropdown': 'Dropdown',
  'Boolean': 'Boolean',
  'draft': 'Draft',
  'published': 'Published',
  'retired': 'Retired',
  'pending': 'Pending',
  'approved': 'Approved',
  'applied': 'Applied',
  'rejected': 'Rejected',
  'Permission Strategy Matrix | 权限策略矩阵': 'Permission Strategy Matrix',
  '按角色定义患者、样本、组学、导入与系统配置权限': 'Define patient, sample, omics, import, and system permissions by role',
  '平台级角色跨 Study；研究级角色只在所属 Study 内生效': 'Global roles work across Studies; Study roles apply only inside assigned Studies',
  'Active': 'Active',
  'Pending': 'Pending',
  'Disabled': 'Disabled',
  '跨 Study 访问 / Cross-study scope': 'Cross-study scope',
  '新建研究 / Create Study': 'Create Study',
  '研究成员管理 / Study Members': 'Study Members',
  '患者查看 / View Patients': 'View Patients',
  '患者与 CRF 录入 / Enter Patient & CRF Data': 'Enter Patient & CRF Data',
  'Study CRF 配置 / Study CRF Config': 'Study CRF Config',
  '访视计划配置 / Study Visit Plan Config': 'Study Visit Plan Config',
  'CRF 版本发布 / Publish CRF Version': 'Publish CRF Version',
  'Query 与质控 / Query & QC': 'Query & QC',
  '数据冻结与锁定 / Freeze & Lock': 'Freeze & Lock',
  '导出与分析 / Export & Analytics': 'Export & Analytics',
  '审计日志 / Audit Logs': 'Audit Logs',
  'active': 'Active',
  'disabled': 'Disabled',
  'open': 'Open',
  'answered': 'Answered',
  'closed': 'Closed',
  'Query Management | Query 管理': 'Query Management',
  '创建、指派、回复和关闭 Query，绑定 subject / visit / form。':
    'Create, assign, answer, and close Queries linked to subject / visit / form.',
  '新增 Query': 'New Query',
  '回复': 'Reply',
  '关闭': 'Close',
  '暂无 Query': 'No Queries yet',
  '数据核查 Query': 'Data review Query',
  'Site Configuration | 多中心配置': 'Site Configuration',
  '维护 Study site、site user assignment 和 study-site 隔离。':
    'Manage Study sites, site user assignments, and study-site isolation.',
  '新增中心': 'New Site',
  '新增研究中心': 'New Study Site',
  '指派当前用户': 'Assign Current User',
  '暂无中心': 'No Sites yet',
  '等待系统管理操作': 'Waiting for system management action',
  'Study site 正在创建并写入后端...': 'Creating Study site and writing to backend...',
  'Query 正在创建并写入后端...': 'Creating Query and writing to backend...',
  '当前 Study 没有可绑定 Query 的患者': 'The current Study has no subject available for Query binding',
  '请先登录真实用户后再分配 site 用户': 'Sign in as a real user before assigning a site user',
  '后端不可用或当前角色无 Study site 写入权限，中心草稿已保存在本页':
    'Backend unavailable or current role lacks Study site write permission; site draft saved on this page',
  '后端不可用或当前角色无 site 用户分配权限':
    'Backend unavailable or current role lacks site-user assignment permission',
  '后端不可用或当前角色无 Query 创建权限':
    'Backend unavailable or current role lacks Query creation permission',
  '后端不可用或当前角色无 Query 回复权限':
    'Backend unavailable or current role lacks Query answer permission',
  '后端不可用或当前角色无 Query 关闭权限':
    'Backend unavailable or current role lacks Query close permission',
  'Research Doctor / PI研究医生 / PI': 'Research Doctor / PI',
  'CRC / Research AssistantCRC / 研究助理': 'CRC / Research Assistant',
  'System Administrator系统管理员': 'System Administrator',

  '等待导出任务': 'Waiting for export task',
  '等待数据校验': 'Waiting for data validation',
  '当前角色没有导出写入权限': 'Current role cannot create exports',
  '当前角色没有导出写入权限，请切换到数据管理员或 CRC': 'Current role cannot create exports; switch to Data Manager or CRC',
  '当前角色没有数据校验写入权限': 'Current role cannot run data validation',
  '当前角色没有数据校验写入权限，请切换到数据管理员或 CRC': 'Current role cannot run data validation; switch to Data Manager or CRC',
  '导出失败：请确认已登录且当前角色具备导出权限': 'Export failed: confirm login and export permission',
  '下载失败：请确认导出文件仍可访问': 'Download failed: confirm the export file is still accessible',
  '数据校验运行中...': 'Data validation running...',
  '校验失败：请确认当前角色具备质控权限': 'Validation failed: confirm quality control permission',
  '可导出报表': 'Exportable reports',
  '数据库记录': 'Database records',
  '审计轨迹': 'Audit trail',
  '待复核': 'Pending review',
  '下载': 'Download',
  '患者全景数据包': 'Patient panorama data package',
  '临床数据完整性报表': 'Clinical data completeness report',
  '样本采集与送检台账': 'Sample collection and testing ledger',
  '知情同意审计轨迹': 'Consent audit trail',
  '单患者 / Journey': 'Single patient / Journey',
  'LGL-1111 全队列': 'LGL-1111 full cohort',
  '样本 / 组学检测': 'Samples / omics testing',
  'Consent Audit': 'Consent Audit',
  '患者、样本、组学检测': 'Patients, samples, omics tests',
  '含知情同意与数据修改': 'Includes consent and data changes',
  'SDTM 数据集草稿': 'SDTM dataset draft',
  '数据导出流水线': 'Data export pipeline',
  '用于后端 API 联调': 'For backend API integration',
  '运行校验': 'Run validation',
  '患者主数据': 'Patient master data',
  '临床 CRF': 'Clinical CRF',
  '样本台账': 'Sample ledger',
  '多组学结果': 'Multi-omics results',
  '知情同意审计': 'Consent audit',
  '数据包归档': 'Data package archive',
  '可导出': 'Exportable',
  '格式': 'Format',
  '状态': 'Status',
  '按项目展开': 'By testing item',
  '待完成检测': 'Pending tests',
  '含结果文件': 'Includes result files',
  '样本编号': 'Sample ID',
  '样本类型': 'Sample type',
  '采集日期': 'Collection date',
  '检测编号': 'Test ID',
  '当前状态': 'Current status',
  '送检测时间': 'Sent for testing',
  '结果文件': 'Result file',
  '平台': 'Platform',
  '批次': 'Run',
  '完成日期': 'Completion date',
  '样本编辑表单': 'Sample edit form',
  '检测编辑表单': 'Test edit form',
  '样本表单缺少必填字段': 'Sample form is missing required fields',
  '检测表单缺少必填字段': 'Test form is missing required fields',
  '更新时间': 'Updated at',

  '已签署': 'Signed',
  '待签署': 'Pending signature',
  '已撤回': 'Withdrawn',
  '电子': 'Electronic',
  '纸质': 'Paper',
  '签署': 'Sign',
  '撤回': 'Withdraw',
  '重签': 'Re-sign',
  '当前版本': 'Current version',
  '当前患者': 'Current patient',
  '伦理批准': 'IRB approved',
  '知情同意书章节': 'Consent form sections',
  '知情同意内容': 'Consent content',
  '知情同意书 V1.0 PDF 预览': 'Consent form V1.0 PDF preview',
  '知情同意流程': 'Consent workflow',
  '阅读知情同意书': 'Read consent form',
  '了解研究目的与内容': 'Understand study purpose and content',
  '确认理解': 'Confirm understanding',
  '确认已充分理解': 'Confirm adequate understanding',
  '完成签署流程': 'Complete signature workflow',
  '归档': 'Archive',
  '电子归档与留痕': 'Electronic archive and audit trail',
  '患者知情同意列表': 'Patient consent list',
  '搜索患者编号或住院号': 'Search patient ID or hospital No.',
  '签署日期': 'Signed date',
  '版本': 'Version',
  '免疫相关性神经系统疾病多组学解析及机制探索': 'Multi-omics Analysis and Mechanistic Study of Immune-related Neurological Diseases',
  '研究详情入口当前为展示状态': 'Study detail entry is display-only in this demo',
  '研究项目概述': 'Study overview',
  '项目性质与研究目标': 'Study type and objectives',
  '样本和信息用途': 'Use of samples and information',
  '研究性检测与样本保存': 'Research testing and sample storage',
  '可能的风险': 'Potential risks',
  '低风险与采样说明': 'Low risk and sampling information',
  '预期获益': 'Expected benefits',
  '直接获益与长期价值': 'Direct benefits and long-term value',
  '技术的局限性': 'Technology limitations',
  '前沿技术与探索性结论': 'Advanced technologies and exploratory findings',
  '隐私保护': 'Privacy protection',
  '匿名化、保密与合规': 'De-identification, confidentiality, and compliance',
  '退出研究': 'Study withdrawal',
  '自愿退出与咨询渠道': 'Voluntary withdrawal and contact channels',
  '知情同意声明': 'Consent declaration',
  '声明确认与签署信息': 'Declaration confirmation and signature information',
  '声明确认': 'Declaration confirmation',
  '选择项': 'Choice',
  '同意': 'Agree',
  '不同意': 'Do not agree',
  '签署信息': 'Signature information',
  '本项目《免疫相关性神经系统疾病的多组学解析及机制探索》是由上海交通大学医学院附属仁济医院主持开展的非干预性临床研究。':
    'This non-interventional clinical study, "Multi-omics Analysis and Mechanistic Study of Immune-related Neurological Diseases," is led by Renji Hospital, Shanghai Jiao Tong University School of Medicine.',
  '研究聚焦于神经精神性系统性红斑狼疮（NPSLE）、多发性硬化（MS）及视神经脊髓炎谱系疾病（NMOSD）等免疫相关性神经系统疾病。':
    'The study focuses on immune-related neurological diseases including neuropsychiatric systemic lupus erythematosus (NPSLE), multiple sclerosis (MS), and neuromyelitis optica spectrum disorder (NMOSD).',
  '本研究旨在通过多组学技术，包括全基因组测序、TCR/BCR 免疫组库测序、超敏蛋白组学及空间转录组学，解析疾病发病机制，发现具有诊断和预后价值的生物标志物，并实现基于分子机制的疾病精准分型，为未来精准化治疗提供科学依据。':
    'The study uses multi-omics technologies, including whole-genome sequencing, TCR/BCR immune repertoire sequencing, ultra-sensitive proteomics, and spatial transcriptomics, to explore mechanisms, identify diagnostic and prognostic biomarkers, and support mechanism-based disease stratification for future precision treatment.',
  '本研究属于纯观察性研究，研究人员不会对受试者的临床诊疗方案作出任何干预或更改。所有研究性检测均在临床诊疗所需样本采集的基础上进行。研究结果仅用于科学研究目的，不直接用于指导个人临床治疗。研究所得数据将经匿名化处理，由仁济医院研究团队进行多组学联合分析。':
    'This is an observational study. Researchers will not intervene in or change clinical care. Research testing is performed on samples collected as part of clinical care. Results are for scientific research only and are not used directly to guide individual treatment. Data will be de-identified and analyzed by the Renji Hospital study team.',
  '受试者的信息和样本将用于以下研究性检测与分析：':
    'Participant information and samples will be used for the following research tests and analyses:',
  '全基因组测序（WGS）：用于检测免疫相关易感基因位点。':
    'Whole-genome sequencing (WGS): used to detect immune-related susceptibility loci.',
  'TCR/BCR 免疫组库测序：用于分析外周血及脑脊液中 T 细胞和 B 细胞克隆扩增情况。':
    'TCR/BCR immune repertoire sequencing: used to analyze T-cell and B-cell clonal expansion in peripheral blood and cerebrospinal fluid.',
  '超敏蛋白组学检测（Olink/Simoa）：用于检测血清及脑脊液中神经损伤标志物，如 NfL、GFAP，炎症因子如 CXCL13，以及自身抗体谱。':
    'Ultra-sensitive proteomics (Olink/Simoa): used to measure markers in serum and cerebrospinal fluid, including NfL, GFAP, CXCL13, and autoantibody profiles.',
  '空间转录组学分析：适用于有肾穿刺活检组织的 SLE 患者。':
    'Spatial transcriptomics: applicable to SLE patients with kidney biopsy tissue.',
  '受试者的信息和剩余样本将由仁济医院研究团队长期保存，未来可能用于免疫相关性神经系统疾病机制、诊断标志物及治疗靶点的相关研究。':
    'Participant information and remaining samples will be stored by the Renji Hospital study team and may be used in future research on mechanisms, diagnostic biomarkers, and therapeutic targets for immune-related neurological diseases.',
  '在样本和信息保存期间，如受试者明确提出样本和/或信息销毁申请，研究团队将按照仁济医院相关规程进行处理。':
    'During storage, if a participant requests destruction of samples and/or information, the study team will handle the request according to Renji Hospital procedures.',
  '研究团队可能在研究期间对受试者进行定期随访，采集并更新临床信息，包括疾病活动评分、影像学及认知评估等，以了解疾病进展情况。':
    'The study team may conduct regular follow-up during the study and update clinical information, including disease activity scores, imaging, and cognitive assessments, to understand disease progression.',
  '研究团队不会对受试者的个人信息和样本进行买卖、基因编辑等违反法律法规、伦理道德和国家利益的活动。':
    'The study team will not sell participant information or samples, perform gene editing, or conduct any activity that violates law, ethics, or national interests.',
  '参与本研究对受试者的风险极低。': 'Participation in this study carries very low risk.',
  '血液样本：研究所需血液采集将与临床诊疗常规抽血同步进行，通常需要额外提供 10-20 ml 血液，可能引起轻微疼痛或淤青，属于常规静脉采血的正常风险范围。':
    'Blood samples: study blood collection will be coordinated with routine clinical blood draws and usually requires an additional 10-20 ml of blood. Minor pain or bruising may occur, which is within the normal risk range of venipuncture.',
  '脑脊液样本：适用于临床已决定行腰椎穿刺检查的患者。研究仅使用临床操作中剩余的脑脊液样本，不额外增加穿刺次数，不带来额外风险。':
    'Cerebrospinal fluid samples: applicable to patients already scheduled for lumbar puncture. The study uses only remaining clinical samples, adds no puncture procedures, and brings no additional risk.',
  '肾穿刺组织：适用于临床已决定行肾穿刺活检的 SLE 患者。研究仅在充分保证病理诊断所需样本后，使用剩余组织，不增加额外创伤。':
    'Kidney biopsy tissue: applicable to SLE patients already scheduled for kidney biopsy. The study uses remaining tissue only after diagnostic needs are met and adds no additional injury.',
  '所有样本采集均不影响受试者的临床诊疗结果，也不额外增加健康风险。':
    'Sample collection will not affect clinical care or add health risk.',
  '如发现样本质量不符合研究要求，研究人员会与受试者沟通是否愿意配合重新采集，但受试者有权拒绝。':
    'If sample quality does not meet study requirements, researchers may ask whether the participant is willing to provide another sample, and the participant may refuse.',
  '参与本研究不会为受试者提供额外的经济补偿，受试者也不会直接从本研究结果中获得经济利益。':
    'Participation does not provide additional financial compensation, and participants will not directly receive economic benefits from study results.',
  '由于本研究属于探索性研究，受试者个人目前极有可能不会因研究结果而获得直接的医疗获益。':
    'Because this is exploratory research, individual participants are unlikely to receive direct medical benefit from the study results at this stage.',
  '但本研究成果未来有望为免疫相关性神经系统疾病患者的精准诊断与治疗提供科学依据。从长远来看，可能使受试者及更多同类疾病患者受益。':
    'However, the findings may support future precision diagnosis and treatment for immune-related neurological diseases and may benefit participants and similar patients over the long term.',
  '研究结果若衍生任何知识产权或商业利益，所有权益将归属仁济医院及相关研究机构，与参与者个人无关。':
    'Any intellectual property or commercial benefits derived from the study will belong to Renji Hospital and related research institutions, not individual participants.',
  '本研究采用的多组学技术处于科学前沿，但仍存在一定局限性。':
    'The multi-omics technologies used in this study are scientifically advanced but still have limitations.',
  '依据现有医学研究水平，部分基因变异、蛋白标志物或免疫克隆特征可能无法被当前技术全面检出，相关发现的临床意义有待进一步验证。':
    'Given current medical knowledge, some genetic variants, protein markers, or immune clonal features may not be fully detected, and the clinical significance of findings requires further validation.',
  '此外，本研究为探索性研究，所得结论属于初步科学发现，尚不能直接转化为临床诊疗建议。':
    'In addition, this exploratory study produces preliminary scientific findings that cannot yet be directly translated into clinical treatment recommendations.',
  '仁济医院将在法律规定的范围内严格保护受试者的个人隐私。':
    'Renji Hospital will strictly protect participant privacy within the scope required by law.',
  '受试者的样本和信息将被匿名化编码处理，研究人员无法通过编码直接获得可辨识身份的个人资料。':
    'Participant samples and information will be coded and de-identified so researchers cannot directly identify individuals from the codes.',
  '研究所得数据可能以匿名形式在学术期刊或学术会议上公开发表，但不会公布受试者患者编号或任何可辨识身份的个人资料。':
    'Study data may be published anonymously in academic journals or conferences, but patient IDs or identifiable personal information will not be disclosed.',
  '受试者的遗传信息及其他个人健康信息将被严格保密，任何可识别个人身份的信息都不会被擅自转交给其他未授权第三方机构或个人。':
    'Genetic and other personal health information will be kept strictly confidential, and identifiable information will not be transferred to unauthorized third parties.',
  '数据的存储、传输和使用均遵循国家相关法律法规，包括《中华人民共和国个人信息保护法》及《人类遗传资源管理条例》的相关要求。':
    'Data storage, transfer, and use will follow applicable national laws and regulations, including personal information protection and human genetic resource requirements.',
  '受试者有权在任何时候无需说明理由地退出本研究。':
    'Participants may withdraw from the study at any time without giving a reason.',
  '退出研究不会影响受试者在仁济医院接受的正常临床诊疗服务。':
    'Withdrawal will not affect normal clinical care at Renji Hospital.',
  '如果受试者对本研究项目有任何问题或疑虑，可以随时联系临床协调员（CRC）或仁济医院研究团队负责人，研究团队将及时答复相关问题。':
    'If participants have questions or concerns, they may contact the clinical research coordinator (CRC) or the Renji Hospital study lead at any time, and the team will respond promptly.',
  '我已经阅读并理解了本知情同意书的全部内容。': 'I have read and understood the full consent form.',
  '我有机会提问，而且所有问题均已得到解答。': 'I had the opportunity to ask questions, and all questions have been answered.',
  '我理解参加本项目完全是自愿的。': 'I understand that participation is entirely voluntary.',
  '我清楚签署以后如还有疑问，可以随时联系仁济医院研究团队的临床协调员或负责人。':
    'I understand that after signing, I may contact the Renji Hospital study coordinator or study lead at any time if I have further questions.',
  '我知道签名并不意味可以免去任何费用、应尽责的事项。':
    'I understand that signing does not waive any fees or responsibilities that still apply.',
  '我的样本和/或信息在移除可识别个人身份信息后，可能用于免疫相关性神经系统疾病发病机制、诊断标志物及治疗靶点相关研究，并可能在学术期刊或学术会议上发表。':
    'After identifiable information is removed, my samples and/or information may be used for research on mechanisms, diagnostic biomarkers, and therapeutic targets for immune-related neurological diseases, and may be published in academic journals or conferences.',
  '已采集': 'Collected',
  '已送检': 'Sent for testing',
  '检测中': 'Testing',
  '检测完成': 'Testing complete',
  '结果回传': 'Results returned',
  '待处理': 'Pending',
  '待检测': 'Pending testing',
  '待检': 'Pending',
  '已通过': 'Passed',
  '通过': 'Passed',
  '未通过': 'Failed',
  '待确认': 'Pending confirmation',
  '样本接收': 'Sample received',
  '文库构建': 'Library prep',
  '测序完成': 'Sequencing complete',
  '已预约': 'Scheduled',
  '生成中': 'Generating',
  '需复核': 'Needs review',
  '启用': 'Enabled',
  '草稿': 'Draft',
  '保存': 'Save',
  '取消': 'Cancel',
  '保存草稿': 'Save draft',
  '提交': 'Submit',
  '新增': 'Add',
  '待录入': 'Pending entry',
  '无明显不良事件': 'No obvious adverse events',
  '1级乏力': 'Grade 1 fatigue',
  '胸部CT提示靶病灶稳定；ctDNA 动态监测与 NGS 结果已同步复核。':
    'Chest CT indicates stable target lesions; ctDNA dynamic monitoring and NGS results have been reconciled.',
  '等待 API': 'Waiting for API',
  '等待 API 数据': 'Waiting for API data',
  '等待 FastAPI / SQLite': 'Waiting for FastAPI / SQLite',
  'SQLite 实时': 'SQLite live',
  'SQLite JSONB': 'SQLite JSONB',
  'SQLite JSON': 'SQLite JSON',
  '等待保存': 'Waiting to save',
  '草稿保存中...': 'Saving draft...',
  '提交中...': 'Submitting...',
  '草稿已保存到后端': 'Draft saved to backend',
  'CRF 已提交到后端': 'CRF submitted to backend',
  '草稿已保存到本地': 'Draft saved locally',
  'CRF 已提交到本地': 'CRF submitted locally',
  '后端不可用，草稿已保存在本页': 'Backend unavailable; draft saved on this page',
  '后端不可用，提交已保存在本页': 'Backend unavailable; submission saved on this page',
  '等待知情同意操作': 'Waiting for consent action',
  '已上传并签署，正在同步后端中...': 'Uploaded and signed; syncing backend...',
  '已上传并签署，已同步后端': 'Uploaded and signed; backend synced',
  '已上传并签署，后端不可用，已保存在本页': 'Uploaded and signed; backend unavailable, saved on this page',
  '已完成签署，正在同步后端中...': 'Signed; syncing backend...',
  '已完成签署，已同步后端': 'Signed; backend synced',
  '已完成签署，后端不可用，已保存在本页': 'Signed; backend unavailable, saved on this page',
  '已撤回知情同意，正在同步后端中...': 'Consent withdrawn; syncing backend...',
  '已撤回知情同意，已同步后端': 'Consent withdrawn; backend synced',
  '已撤回知情同意，后端不可用，已保存在本页': 'Consent withdrawn; backend unavailable, saved on this page',
  '已发起重签，正在同步后端中...': 'Re-sign started; syncing backend...',
  '已发起重签，已同步后端': 'Re-sign started; backend synced',
  '已发起重签，后端不可用，已保存在本页': 'Re-sign started; backend unavailable, saved on this page',
  '平台级用户状态需要后端用户状态 API，当前已禁用': 'Platform user status changes require a backend user-status API and are disabled for now',
  '快捷操作已在顶部工作台接入': 'Quick actions are connected in the main workbench',
  '等待样本操作': 'Waiting for sample action',

  '基本信息': 'Basic info',
  '目前病情评估': 'Current disease assessment',
  '目前用药情况': 'Current medication',
  '体格检查': 'Physical examination',
  '常规生化': 'Routine biochemistry',
  '尿蛋白': 'Urine protein',
  '免疫球蛋白及补体': 'Immunoglobulin & complement',
  '自身抗体': 'Autoantibodies',
  '淋巴细胞计数及活性检测': 'Lymphocyte count & activity',
  '特殊检查': 'Special examinations',
  '患者数据录入': 'Patient data entry',
  '患者ID': 'Patient ID',
  '已填字段': 'Completed fields',
  '存储格式': 'Storage format',
  '其他已录入字段': 'Other captured fields',
  '数据源': 'Data source',
  '多次随访模块': 'Repeated follow-up module',
  '样本采集模块': 'Sample collection module',
  '新建随访': 'New follow-up',
  '新增样本': 'Add sample',
  '新增检测': 'Add test',
  '已采集样本数': 'Collected samples',
  '按患者、样本和采集日期维护样本登记': 'Maintain sample registration by patient, sample, and collection date',
  '近30天趋势': 'Last 30 days trend',
  '5月1日': 'May 1',
  '5月15日': 'May 15',
  '5月29日': 'May 29',
  '样本处理流程': 'Sample processing workflow',
  '采集登记': 'Collection registration',
  '12 个样本完成': '12 samples completed',
  '离心 / 分装': 'Centrifugation / aliquoting',
  '10 个样本完成': '10 samples completed',
  '入库定位': 'Storage location',
  '送检交接': 'Testing handoff',
  '9 个样本已送检': '9 samples sent for testing',
  '存储分布': 'Storage distribution',
  '-80℃冰箱A': '-80C freezer A',
  '-80℃冰箱B': '-80C freezer B',
  '液氮罐C': 'Liquid nitrogen tank C',
  '病理库R': 'Pathology archive R',
  '4 份': '4 aliquots',
  '1 份': '1 aliquot',
  '采集完成率趋势': 'Collection completion trend',
  '搜索患者编号': 'Search patient ID',
  '搜索样本编号': 'Search sample ID',
  '采集开始': 'Collection start',
  '采集结束': 'Collection end',
  '多组学检测列表': 'Multi-omics testing list',
  '按检测项目追踪平台、批次、QC 和结果归档': 'Track platform, batch, QC, and result archive by testing item',
  '失败/重测': 'Failed / retest',
  '该筛选在新版样本及检测页中处理': 'This filter is handled in the newer Samples & Testing view',
  '空间转录组': 'Spatial transcriptomics',
  '当前样本检测详情': 'Current sample testing details',
  '当前 Study 暂无检测记录': 'No testing records for the current Study',
  '文件下载需等待结果文件上传': 'File download requires an uploaded result file',
  '检测流程与时间线': 'Testing workflow and timeline',
  '上机测序': 'Sequencing run',
  '待完成': 'Pending completion',
  '检测结果概览': 'Testing result overview',
  '研究用途，不直接用于临床决策': 'Research use only, not for direct clinical decision-making',
  '结果摘要': 'Result summary',
  '检测到免疫相关候选变异位点，建议结合临床表型与其他组学联合解读。':
    'Immune-related candidate variants were detected; interpret with clinical phenotypes and other omics layers.',
  '可关联 TCR/BCR、Olink/Simoa、空间转录组结果做多维分析。':
    'Can be linked with TCR/BCR, Olink/Simoa, and spatial transcriptomics results for multidimensional analysis.',
  '蛋白组学': 'Proteomics',
  '上传结果': 'Upload result',
  '未上传文件': 'No file uploaded',
  '上传中...': 'Uploading...',
  '待分配': 'Unassigned',
  '后端不可用，新增样本已保存在本页': 'Backend unavailable; new sample saved on this page',
  '后端不可用，新增检测已保存在本页': 'Backend unavailable; new test saved on this page',
  '暂无患者样本上下文，无法新增样本': 'No patient sample context; cannot add sample',
  '暂无样本上下文，无法新增检测': 'No sample context; cannot add test',
  '已新增本地待激活账户；生产环境需接入 Study 成员 API': 'Added a local pending account; production needs Study member API linkage',
  '已新增 CRF 草稿字段；生产环境需接入 Study CRF 版本发布 API': 'Added a draft CRF field; production needs Study CRF version publishing API linkage',
  '已新增本地访视计划草稿；生产环境需通过 /studies/{study_id}/visit-plans 发布':
    'Added a local visit-plan draft; production should publish through /studies/{study_id}/visit-plans',
  'CRF 字段正在同步后端...': 'CRF field syncing to backend...',
  '后端不可用或当前角色无 CRF 配置写入权限，字段已保存在本页':
    'Backend unavailable or current role lacks CRF config write permission; field saved on this page',
  '新增记录': 'New record',
  '姓名': 'Name',
  '身高（cm）': 'Height (cm)',
  '体重（Kg）': 'Weight (kg)',
  '病程（发病-使用CD20时）': 'Disease duration (onset to CD20 use)',
  '出院诊断': 'Discharge diagnosis',
  'SLEDAI评分': 'SLEDAI score',
  'LN病理分型（如有）': 'LN pathological class (if any)',
  'PGA评分': 'PGA score',
  '免疫抑制剂1': 'Immunosuppressant 1',
  '免疫制剂2': 'Immunotherapy agent 2',
  '免疫制剂2（第2项）': 'Immunotherapy agent 2 (second item)',
  '其他合并用药': 'Other concomitant medication',
  '体温': 'Body temperature',
  '神经系统症状': 'Neurological symptoms',
  '关节肿胀': 'Joint swelling',
  '关节疼痛': 'Joint pain',
  '皮疹': 'Rash',
  '口腔溃疡': 'Oral ulcer',
  '脱发': 'Alopecia',
  '其他': 'Other',
  'N绝对值10^9/L': 'Neutrophil absolute count 10^9/L',
  '淋巴绝对值': 'Lymphocyte absolute count',
  '单核绝对值': 'Monocyte absolute count',
  '前白蛋白（mg/L）': 'Prealbumin (mg/L)',
  '总胆红素 umol/L': 'Total bilirubin umol/L',
  'EPI-GFR（mmol/l*min）': 'EPI-GFR (mmol/l*min)',
  '甘油三酯': 'Triglycerides',
  '胆固醇': 'Cholesterol',
  '24小时尿蛋白 g/24h': '24h urine protein g/24h',
  '尿白细胞/Hp': 'Urine WBC/Hp',
  '尿红细胞/Hp': 'Urine RBC/Hp',
  '总补体CH50 （U/mL)': 'Total complement CH50 (U/mL)',
  'C1抑制剂 (g/l)': 'C1 inhibitor (g/l)',
  'ANA1:80为阳性（1-yes，0-none）': 'ANA 1:80 positive (1=yes, 0=none)',
  '滴度': 'Titer',
  '核型': 'Karyotype',
  'ds-DNA（ELISA）': 'ds-DNA (ELISA)',
  'ds-DNA(放免法iu/ml)': 'ds-DNA (RIA iu/ml)',
  '其他阳性抗体': 'Other positive antibodies',
  '淋巴细胞绝对值 *10^9': 'Lymphocyte absolute count *10^9',
  'B淋巴细胞绝对值': 'B lymphocyte absolute count',
  'T淋巴细胞绝对值': 'T lymphocyte absolute count',
  'Th淋巴细胞绝对值': 'Th lymphocyte absolute count',
  'Ts淋巴细胞绝对值': 'Ts lymphocyte absolute count',
  '自然杀伤细胞绝对值': 'Natural killer cell absolute count',
  'CD20细胞百分比%': 'CD20 cell percentage %',
  '外周血浆细胞检测%': 'Peripheral plasma cell test %',
  '胸膜炎': 'Pleuritis',
  '心包炎': 'Pericarditis',
  '肺动脉高压': 'Pulmonary hypertension',
  '其他异常结果': 'Other abnormal findings',
  '有': 'Yes',
  '随访日期': 'Follow-up date',
  '多次随访': 'Repeated follow-up',
  '标志物结果': 'Biomarker result',
  '实验室结果': 'Lab results',
  '字段配置': 'Field configuration',
  '权限策略管理': 'Permission policy'
};

const phraseEnglish = ([
  [
    '登录后按 Study 权限进入患者队列、CRF 录入、样本登记、多组学检测、Patient Journey 与数据分析主链路。',
    'Sign in to access patient cohorts, CRF entry, sample registration, multi-omics testing, Patient Journey, and analytics by Study permissions.'
  ],
  [
    '登录后进入患者队列、CRF 录入、样本登记、多组学检测、Patient Journey 与数据分析主链路。',
    'Sign in to access patient cohorts, CRF entry, sample registration, multi-omics testing, Patient Journey, and analytics workflows.'
  ],
  ['平台级账号，可跨 Study 管理研究、成员、CRF、质控、导出和审计。', 'Platform accounts can manage studies, members, CRF, quality, exports, and audit across Studies.'],
  ['LZ 系统管理 · 全部或授权 Study', 'LZ System Admin · All or assigned Studies'],
  ['真实世界肺癌耐药研究', 'Real-world Lung Cancer Resistance Study'],
  ['免疫相关性神经系统疾病 RWD 研究', 'Immune-related Neurological Disease RWD Study'],
  ['NMOSD 真实世界随访研究', 'NMOSD Real-world Follow-up Study'],
  ['研究编号 / study_id', 'Study ID / study_id'],
  ['Study 研究入口', 'Study entry'],
  ['LZ 系统管理', 'LZ System Admin'],
  ['研究配置管理员', 'Study Configuration Admin'],
  ['研究数据管理员', 'Study Data Manager'],
  ['研究 PI / 医生', 'Study PI / Physician'],
  ['肺癌配置管理员', 'Lung Cancer Configuration Admin'],
  ['肺癌数据管理员', 'Lung Cancer Data Manager'],
  ['肺癌 PI', 'Lung Cancer PI'],
  ['肺癌 CRC', 'Lung Cancer CRC'],
  ['账号登录', 'Account login'],
  ['正式系统认证', 'Production sign-in'],
  ['角色账号', 'Role account'],
  ['账号邮箱', 'Account email'],
  ['忘记密码 / 修改密码', 'Forgot / change password'],
  ['研究编号', 'Study ID'],
  ['研究入口', 'study entry'],
  ['系统管理', 'system admin'],
  ['权限进入', 'permissions to access'],
  ['按 Study 权限', 'by Study permissions'],
  ['新建随访', 'New follow-up'],
  ['登录后按', 'Sign in by'],
  ['登录后', 'After login'],
  ['CRF 录入', 'CRF entry'],
  ['样本登记', 'sample registration'],
  ['数据分析主链路', 'analytics primary workflow'],
  ['主链路', 'primary workflow'],
  ['真实世界', 'real-world'],
  ['肺癌耐药', 'Lung Cancer Resistance'],
  ['肺癌', 'Lung Cancer'],
  ['胸水', 'Pleural effusion'],
  ['肺', 'lung'],
  ['肝', 'liver'],
  ['脑', 'brain'],
  ['耐药', 'Resistance'],
  ['配置管理员', 'Configuration Admin'],
  ['数据管理员', 'Data Manager'],
  ['管理员', 'Administrator'],
  ['医生', 'Physician'],
  ['进入', 'access'],
  ['录入', 'entry'],
  ['登记', 'registration'],
  ['成员', 'members'],
  ['质控', 'quality control'],
  ['与', 'and'],
  ['真实世界研究', 'real-world study'],
  ['真实世界队列', 'real-world cohort'],
  ['患者编号', 'patient ID'],
  ['住院号', 'hospital No.'],
  ['疾病类型', 'disease type'],
  ['受累脏器', 'affected organs'],
  ['临床事件轴', 'clinical timeline'],
  ['事件明细流', 'event detail stream'],
  ['关键指标', 'key indicator'],
  ['时间范围', 'time range'],
  ['患者旅程时间范围开始', 'Patient journey range start'],
  ['患者旅程时间范围结束', 'Patient journey range end'],
  ['指标趋势时间范围开始', 'Indicator trend range start'],
  ['指标趋势时间范围结束', 'Indicator trend range end'],
  ['疗效评估', 'response assessment'],
  ['耐药评估', 'resistance assessment'],
  ['疗效', 'response'],
  ['蛋白组学', 'proteomics'],
  ['蛋白组', 'Proteomics'],
  ['含铂双药', 'Platinum doublet'],
  ['结果回传', 'results returned'],
  ['结果归档', 'result archived'],
  ['完整度', 'completeness'],
  ['家访', 'Home visit'],
  ['门诊', 'Outpatient'],
  ['存活', 'Alive'],
  ['稳定', 'Stable'],
  ['缓解', 'Response'],
  ['组织', 'Tissue'],
  ['病程主线', 'clinical course'],
  ['急性事件', 'acute events'],
  ['治疗方案', 'treatment plan'],
  ['随访记录', 'Follow-up record'],
  ['样本采集', 'Sample collection'],
  ['样本与组学', 'samples and omics'],
  ['组学检测', 'omics testing'],
  ['健康对照', 'healthy control'],
  ['症状记录', 'symptom record'],
  ['首次住院', 'first admission'],
  ['初次住院', 'initial admission'],
  ['基线评估', 'baseline assessment'],
  ['活动评估', 'activity assessment'],
  ['观察住院', 'observation admission'],
  ['激素冲击', 'steroid pulse'],
  ['维持治疗', 'maintenance therapy'],
  ['联合维持', 'combined maintenance'],
  ['结果归档', 'result archived'],
  ['实验室指标', 'lab indicators'],
  ['影像/检验', 'imaging/labs'],
  ['不良事件', 'adverse events'],
  ['生活质量', 'quality of life'],
  ['失访原因', 'lost-to-follow-up reason'],
  ['存储位置', 'storage'],
  ['关联检测', 'linked testing'],
  ['外周血', 'peripheral blood'],
  ['转录组', 'transcriptomics'],
  ['代谢组学', 'metabolomics'],
  ['血常规', 'CBC'],
  ['肝肾功能', 'liver/kidney function'],
  ['患者队列', 'patient cohort'],
  ['知情同意', 'informed consent'],
  ['临床数据采集', 'clinical data capture'],
  ['样本及检测', 'samples and testing'],
  ['患者旅程', 'patient journey'],
  ['数据分析', 'analytics'],
  ['系统管理', 'system admin'],
  ['多组学检测', 'multi-omics testing'],
  ['多组学', 'multi-omics'],
  ['患者', 'patient'],
  ['编号', 'ID'],
  ['性别', 'sex'],
  ['疾病', 'disease'],
  ['脏器', 'organ'],
  ['查找', 'find'],
  ['清空', 'clear'],
  ['事件', 'event'],
  ['明细', 'detail'],
  ['临床', 'clinical'],
  ['病程', 'course'],
  ['住院', 'admission'],
  ['治疗', 'treatment'],
  ['诊断', 'diagnosis'],
  ['发病', 'onset'],
  ['复发', 'relapse'],
  ['记录', 'record'],
  ['指标', 'indicator'],
  ['日期', 'date'],
  ['基线', 'baseline'],
  ['评估', 'assessment'],
  ['用药', 'medication'],
  ['影像', 'imaging'],
  ['检验', 'labs'],
  ['转移', 'metastasis'],
  ['失访', 'lost to follow-up'],
  ['原因', 'reason'],
  ['样本', 'sample'],
  ['检测', 'testing'],
  ['随访', 'follow-up'],
  ['下次', 'next'],
  ['访视', 'visit'],
  ['入组', 'enrollment'],
  ['趋势', 'trend'],
  ['增长', 'growth'],
  ['上一季度', 'last quarter'],
  ['提升', 'improved'],
  ['中心', 'site'],
  ['领先', 'lead'],
  ['风险', 'risk'],
  ['错过', 'missing'],
  ['研究', 'study'],
  ['队列', 'cohort'],
  ['数据', 'data'],
  ['完整性', 'completeness'],
  ['审计', 'audit'],
  ['报表', 'report'],
  ['导出', 'export'],
  ['角色', 'role'],
  ['账户', 'account'],
  ['权限', 'permission'],
  ['字段', 'field'],
  ['配置', 'configuration'],
  ['状态', 'status'],
  ['更新时间', 'updated at'],
  ['总计', 'total'],
  ['当前', 'current'],
  ['全部', 'all'],
  ['新增', 'add'],
  ['查看', 'view'],
  ['编辑', 'edit'],
  ['运行', 'run'],
  ['校验', 'validation'],
  ['完成', 'complete'],
  ['待复核', 'pending review'],
  ['进行中', 'in progress'],
  ['已归档', 'archived'],
  ['已签署', 'signed'],
  ['待签署', 'pending signature'],
  ['已撤回', 'withdrawn'],
  ['数据库', 'database'],
  ['实时', 'real-time'],
  ['搜索', 'search'],
  ['筛选', 'filter'],
  ['排序', 'sort'],
  ['密码', 'password'],
  ['登录', 'login'],
  ['退出', 'sign out'],
  ['通知', 'notifications'],
  ['女', 'female'],
  ['男', 'male'],
  ['血液', 'Blood'],
  ['脑脊液', 'CSF'],
  ['肾组织', 'kidney tissue'],
  ['肾', 'kidney'],
  ['尿液', 'urine'],
  ['皮肤组织', 'skin tissue'],
  ['唾液腺组织', 'salivary gland tissue'],
  ['脊髓组织', 'spinal cord tissue'],
  ['淋巴结组织', 'lymph node tissue'],
  ['视神经相关组织', 'optic nerve-related tissue'],
  ['周围神经组织', 'peripheral nerve tissue'],
  ['肌肉组织', 'muscle tissue'],
  ['粪便', 'stool'],
  ['口腔', 'buccal swab'],
  ['鼻咽', 'nasopharyngeal swab'],
  ['脑组织', 'brain tissue'],
  ['天', 'days'],
  ['月', 'months'],
  ['岁', 'years']
] as Array<[string, string]>).sort((a, b) => b[0].length - a[0].length);

const dynamicRules: DynamicRule[] = [
  {
    pattern: /^真实世界肺癌耐药研究随访中，耐药机制与组学检测已生成，完整度 (\d+)%$/,
    format: (completeness) => `Real-world lung cancer resistance follow-up is active; resistance mechanism and omics testing are generated, ${completeness}% complete`
  },
  {
    pattern: /^健康对照样本采集中，完整度 (\d+)%$/,
    format: (completeness) => `Healthy-control sample collection is in progress, ${completeness}% complete`
  },
  {
    pattern: /^(.+) 队列随访中，完整度 (\d+)%$/,
    format: (disease, completeness) => `${translateToEnglish(disease)} cohort is in follow-up, ${completeness}% complete`
  },
  {
    pattern: /^(\d+)例$/,
    format: (count) => `${count} cases`
  },
  {
    pattern: /^(\d+) 名患者 · 输入编号、住院号或疾病类型切换$/,
    format: (count) => `${count} patients · Search by patient ID, hospital No., or disease type`
  },
  {
    pattern: /^匹配 (\d+) \/ (\d+) 名患者$/,
    format: (matched, total) => `${matched} / ${total} patients matched`
  },
  {
    pattern: /^(.+) \/ (.+) · (.+) · (\d+)岁 · (.+)$/,
    format: (studyId, patient, sex, age, disease) => `${studyId} / ${patient} · ${translateToEnglish(sex)} · ${age} years · ${translateToEnglish(disease)}`
  },
  {
    pattern: /^(.+) · (.+) · (\d+)岁 · (.+)$/,
    format: (hospitalNo, sex, age, disease) => `${hospitalNo} · ${translateToEnglish(sex)} · ${age} years · ${translateToEnglish(disease)}`
  },
  {
    pattern: /^显示 (\d+) 至 (\d+) 条，共 (\d+) 条记录$/,
    format: (start, end, total) => `Showing ${start}-${end} of ${total} records`
  },
  {
    pattern: /^患者正在写入后端\.\.\.$/,
    format: () => 'Writing patient to backend...'
  },
  {
    pattern: /^患者 (.+) 正在同步后端\.\.\.$/,
    format: (patient) => `Patient ${patient} is syncing to backend...`
  },
  {
    pattern: /^患者已创建：(.+)$/,
    format: (patient) => `Patient created: ${patient}`
  },
  {
    pattern: /^患者已保存：(.+)$/,
    format: (patient) => `Patient saved: ${patient}`
  },
  {
    pattern: /^正在编辑患者 (.+)$/,
    format: (patient) => `Editing patient ${patient}`
  },
  {
    pattern: /^已定位患者：(.+) \/ 住院号 (.+)$/,
    format: (patient, hospitalNo) => `Selected patient: ${patient} / Hospital No. ${hospitalNo}`
  },
  {
    pattern: /^(.+) 生成中\.\.\.$/,
    format: (name) => `${translateToEnglish(name)} generating...`
  },
  {
    pattern: /^(.+) 已生成：(.+)$/,
    format: (name, id) => `${translateToEnglish(name)} generated: ${id}`
  },
  {
    pattern: /^(.+) 下载中\.\.\.$/,
    format: (name) => `${translateToEnglish(name)} downloading...`
  },
  {
    pattern: /^(.+) 已开始下载：(.+)$/,
    format: (name, id) => `${translateToEnglish(name)} download started: ${id}`
  },
  {
    pattern: /^最近更新 (.+)$/,
    format: (date) => `Latest update ${date}`
  },
  {
    pattern: /^新增记录 (\d+)$/,
    format: (index) => `New record ${index}`
  },
  {
    pattern: /^新账户 (\d+)$/,
    format: (index) => `New Account ${index}`
  },
  {
    pattern: /^咳嗽\/胸痛较前稳定，ECOG (\d)，耐药相关症状继续观察。$/,
    format: (ecog) => `Cough/chest pain stable vs prior, ECOG ${ecog}; resistance-related symptoms remain under observation.`
  },
  {
    pattern: /^欢迎回来，(.+)$/,
    format: (name) => `Welcome back, ${translateToEnglish(name)}`
  },
  {
    pattern: /^新增样本已同步后端：(.+)$/,
    format: (id) => `New sample synced to backend: ${id}`
  },
  {
    pattern: /^新增检测已同步后端：(.+)$/,
    format: (id) => `New test synced to backend: ${id}`
  },
  {
    pattern: /^新增样本已加入列表，正在同步后端\.\.\.$/,
    format: () => 'New sample added to the list; syncing backend...'
  },
  {
    pattern: /^新增检测已加入列表，正在同步后端\.\.\.$/,
    format: () => 'New test added to the list; syncing backend...'
  },
  {
    pattern: /^已定位样本 (.+)$/,
    format: (id) => `Selected sample ${id}`
  },
  {
    pattern: /^已定位检测 (.+)$/,
    format: (id) => `Selected test ${id}`
  },
  {
    pattern: /^样本 (.+) 状态已更新为 (.+)，正在同步后端\.\.\.$/,
    format: (id, status) => `Sample ${id} status updated to ${translateToEnglish(status)}; syncing backend...`
  },
  {
    pattern: /^样本 (.+) 正在同步后端\.\.\.$/,
    format: (id) => `Sample ${id} syncing backend...`
  },
  {
    pattern: /^样本 (.+) 已同步后端$/,
    format: (id) => `Sample ${id} synced to backend`
  },
  {
    pattern: /^正在编辑样本 (.+)$/,
    format: (id) => `Editing sample ${id}`
  },
  {
    pattern: /^正在编辑检测 (.+)$/,
    format: (id) => `Editing test ${id}`
  },
  {
    pattern: /^正在为样本 (.+) 新建检测$/,
    format: (id) => `Creating a test for sample ${id}`
  },
  {
    pattern: /^随访 (.+) 正在同步后端\.\.\.$/,
    format: (visit) => `Follow-up ${translateToEnglish(visit)} syncing to backend...`
  },
  {
    pattern: /^随访 (.+) 已写入 follow_up_records$/,
    format: (visit) => `Follow-up ${translateToEnglish(visit)} written to follow_up_records`
  },
  {
    pattern: /^后端不可用，随访 (.+) 已保存在本页$/,
    format: (visit) => `Backend unavailable; follow-up ${translateToEnglish(visit)} saved on this page`
  },
  {
    pattern: /^后端不可用，样本 (.+) 已保存在本页$/,
    format: (id) => `Backend unavailable; sample ${id} saved on this page`
  },
  {
    pattern: /^后端不可用，样本 (.+) 更新已保存在本页$/,
    format: (id) => `Backend unavailable; sample ${id} update saved on this page`
  },
  {
    pattern: /^检测 (.+) 状态已更新为 (.+)，正在同步后端\.\.\.$/,
    format: (id, status) => `Test ${id} status updated to ${translateToEnglish(status)}; syncing backend...`
  },
  {
    pattern: /^检测 (.+) 已同步后端$/,
    format: (id) => `Test ${id} synced to backend`
  },
  {
    pattern: /^后端不可用，检测 (.+) 更新已保存在本页$/,
    format: (id) => `Backend unavailable; test ${id} update saved on this page`
  },
  {
    pattern: /^正在查看 (.+) 的知情同意记录$/,
    format: (patient) => `Viewing consent record for ${patient}`
  },
  {
    pattern: /^知情文件 (.+) 正在上传\.\.\.$/,
    format: (filename) => `Consent file ${filename} is uploading...`
  },
  {
    pattern: /^知情文件 (.+) 已上传并签署，正在同步后端中\.\.\.$/,
    format: (filename) => `Consent file ${filename} uploaded and signed; syncing backend...`
  },
  {
    pattern: /^知情文件 (.+) 已上传并签署，已同步后端$/,
    format: (filename) => `Consent file ${filename} uploaded and signed; backend synced`
  },
  {
    pattern: /^知情文件 (.+) 已上传并签署，后端不可用，已保存在本页$/,
    format: (filename) => `Consent file ${filename} uploaded and signed; backend unavailable, saved on this page`
  },
  {
    pattern: /^知情文件 (.+) 上传失败；请确认后端连接和文件权限$/,
    format: (filename) => `Consent file ${filename} upload failed; check backend connectivity and file permission`
  },
  {
    pattern: /^账户 (.+) 已(.+)；生产环境需接入用户状态 API$/,
    format: (email, action) => `Account ${email} ${action === '停用' ? 'disabled' : 'enabled'}; production needs user status API linkage`
  },
  {
    pattern: /^用户账户正在创建并同步 Study 成员\.\.\.$/,
    format: () => 'Creating user account and syncing Study membership...'
  },
  {
    pattern: /^用户账户已创建并加入 Study：(.+)$/,
    format: (email) => `User account created and added to Study: ${email}`
  },
  {
    pattern: /^Study site 已同步后端：(.+) \/ (.+)$/,
    format: (study, site) => `Study site synced to backend: ${study} / ${site}`
  },
  {
    pattern: /^Site 用户分配正在同步后端：(.+) \/ (.+)$/,
    format: (site, user) => `Site user assignment syncing to backend: ${site} / ${user}`
  },
  {
    pattern: /^Site 用户分配已写入后端：(.+) \/ (.+)$/,
    format: (site, user) => `Site user assignment written to backend: ${site} / ${user}`
  },
  {
    pattern: /^Query 已创建并绑定患者：(.+) \/ (.+)$/,
    format: (query, patient) => `Query created and linked to subject: ${query} / ${patient}`
  },
  {
    pattern: /^Query (.+) 正在回复\.\.\.$/,
    format: (query) => `Query ${query} is being answered...`
  },
  {
    pattern: /^Query 已回复：(.+)$/,
    format: (query) => `Query answered: ${query}`
  },
  {
    pattern: /^Query (.+) 正在关闭\.\.\.$/,
    format: (query) => `Query ${query} is being closed...`
  },
  {
    pattern: /^Query 已关闭：(.+)$/,
    format: (query) => `Query closed: ${query}`
  },
  {
    pattern: /^后端不可用或当前角色无用户创建权限，账户已保存在本页$/,
    format: () => 'Backend unavailable or current role lacks user creation permission; account saved on this page'
  },
  {
    pattern: /^已定位账户 (.+)，可继续按角色或状态筛选$/,
    format: (email) => `Selected account ${email}; continue filtering by role or status`
  },
  {
    pattern: /^字段 (.+) 已切换为 (.+)$/,
    format: (id, status) => `Field ${id} switched to ${translateToEnglish(status)}`
  },
  {
    pattern: /^CRF 字段 (.+) 正在同步后端\.\.\.$/,
    format: (id) => `CRF field ${id} syncing to backend...`
  },
  {
    pattern: /^正在编辑 CRF 字段 (.+)$/,
    format: (id) => `Editing CRF field ${id}`
  },
  {
    pattern: /^CRF 版本 (.+) 正在创建草稿\.\.\.$/,
    format: (version) => `CRF version ${version} draft is being created...`
  },
  {
    pattern: /^CRF 版本草稿已创建：(.+)$/,
    format: (version) => `CRF draft version created: ${version}`
  },
  {
    pattern: /^CRF 迁移预览正在生成\.\.\.$/,
    format: () => 'Generating CRF migration preview...'
  },
  {
    pattern: /^CRF 迁移预览已生成：新增 (\d+)，变更 (\d+)，移除 (\d+)$/,
    format: (added, changed, removed) => `CRF migration preview generated: added ${added}, changed ${changed}, removed ${removed}`
  },
  {
    pattern: /^后端不可用或当前角色无 CRF 迁移预览权限$/,
    format: () => 'Backend unavailable or current role lacks CRF migration preview permission'
  },
  {
    pattern: /^请先创建 CRF 草稿版本，再提交迁移审批$/,
    format: () => 'Create a CRF draft version before submitting migration approval'
  },
  {
    pattern: /^CRF 迁移 (.+) 正在提交审批\.\.\.$/,
    format: (version) => `CRF migration ${version} is being submitted for approval...`
  },
  {
    pattern: /^CRF 迁移审批已提交：(.+)$/,
    format: (id) => `CRF migration approval submitted: ${id}`
  },
  {
    pattern: /^后端不可用或当前角色无 CRF 迁移审批提交权限$/,
    format: () => 'Backend unavailable or current role lacks CRF migration approval submission permission'
  },
  {
    pattern: /^CRF 迁移审批 (.+) 正在批准\.\.\.$/,
    format: (id) => `CRF migration approval ${id} is being approved...`
  },
  {
    pattern: /^CRF 迁移已批准：(.+)$/,
    format: (id) => `CRF migration approved: ${id}`
  },
  {
    pattern: /^后端不可用或当前角色无 CRF 迁移批准权限$/,
    format: () => 'Backend unavailable or current role lacks CRF migration approval permission'
  },
  {
    pattern: /^CRF 迁移 (.+) 正在应用并发布目标版本\.\.\.$/,
    format: (id) => `CRF migration ${id} is being applied and publishing the target version...`
  },
  {
    pattern: /^CRF 迁移已应用，目标版本已发布：(.+)$/,
    format: (versionId) => `CRF migration applied; target version published: ${versionId}`
  },
  {
    pattern: /^后端不可用或当前角色无 CRF 迁移应用权限$/,
    format: () => 'Backend unavailable or current role lacks CRF migration apply permission'
  },
  {
    pattern: /^后端不可用或当前角色无 CRF 版本创建权限$/,
    format: () => 'Backend unavailable or current role lacks CRF version creation permission'
  },
  {
    pattern: /^当前没有可发布的 CRF 草稿版本$/,
    format: () => 'No draft CRF version is available to publish'
  },
  {
    pattern: /^CRF 版本 (.+) 正在发布\.\.\.$/,
    format: (version) => `CRF version ${version} is being published...`
  },
  {
    pattern: /^CRF 版本已发布：(.+)$/,
    format: (version) => `CRF version published: ${version}`
  },
  {
    pattern: /^Migration request created for target (.+)$/,
    format: (version) => `Migration request created for target ${version}`
  },
  {
    pattern: /^Target CRF version (.+) published$/,
    format: (version) => `Target CRF version ${version} published`
  },
  {
    pattern: /^后端不可用或当前角色无 CRF 版本发布权限$/,
    format: () => 'Backend unavailable or current role lacks CRF version publishing permission'
  },
  {
    pattern: /^请填写字段名称和所属模块$/,
    format: () => 'Please fill in the field name and CRF module'
  },
  {
    pattern: /^CRF 字段 (.+) 正在保存到后端\.\.\.$/,
    format: (id) => `CRF field ${id} saving to backend...`
  },
  {
    pattern: /^CRF 字段 (.+) 已保存：(.+) \/ (.+) \/ (.+) \/ (.+)$/,
    format: (id, name, type, module, status) =>
      `CRF field ${id} saved: ${translateToEnglish(name)} / ${type} / ${translateToEnglish(module)} / ${translateToEnglish(status)}`
  },
  {
    pattern: /^CRF 字段已同步后端：(.+)$/,
    format: (id) => `CRF field synced to backend: ${id}`
  },
  {
    pattern: /^后端不可用或当前角色无 CRF 配置写入权限，字段 (.+) 状态已保存在本页$/,
    format: (id) => `Backend unavailable or current role lacks CRF config write permission; field ${id} status saved on this page`
  },
  {
    pattern: /^后端不可用或当前角色无 CRF 配置写入权限，字段 (.+) 编辑已保存在本页$/,
    format: (id) => `Backend unavailable or current role lacks CRF config write permission; field ${id} edit saved on this page`
  },
  {
    pattern: /^字段 (.+) 详情：(.+) \/ (.+)$/,
    format: (id, module, type) => `Field ${id} details: ${translateToEnglish(module)} / ${type}`
  },
  {
    pattern: /^(.+)字段$/,
    format: (section) => `${translateToEnglish(section)} fields`
  },
  {
    pattern: /^校验完成：发现 (\d+) 条待处理问题$/,
    format: (count) => `Validation complete: ${count} pending issues found`
  },
  {
    pattern: /^(.+) 项已归档$/,
    format: (count) => `${count} archived`
  },
  {
    pattern: /^(.+)例$/,
    format: (count) => `${count} cases`
  },
  {
    pattern: /^较近 (\d+) 天$/,
    format: (days) => `Last ${days} days`
  },
  {
    pattern: /^V(\d+) 基线$/,
    format: (visit) => `V${visit} baseline`
  },
  {
    pattern: /^V(\d+) 基线访视$/,
    format: (visit) => `V${visit} baseline visit`
  },
  {
    pattern: /^V(\d+) 基线visit$/,
    format: (visit) => `V${visit} baseline visit`
  },
  {
    pattern: /^V(\d+) 新增采集$/,
    format: (visit) => `V${visit} new collection`
  },
  {
    pattern: /^(.+)；关联 (.+)$/,
    format: (visit, testing) => `${translateToEnglish(visit)}; linked ${translateToEnglish(testing)}`
  },
  {
    pattern: /^(.+)；待指定检测$/,
    format: (visit) => `${translateToEnglish(visit)}; pending test assignment`
  },
  {
    pattern: /^V(\d+) (\d+)月随访$/,
    format: (visit, month) => `V${visit} ${month}-month follow-up`
  },
  {
    pattern: /^V(\d+) (\d+)月(.+)$/,
    format: (visit, month, label) => `V${visit} ${month}-month ${translateToEnglish(label)}`
  },
  {
    pattern: /^明确(.+)$/,
    format: (disease) => `Confirmed ${translateToEnglish(disease)}`
  },
  {
    pattern: /^(.+)采集$/,
    format: (sampleType) => `${translateToEnglish(sampleType)} collection`
  },
  {
    pattern: /^(.+)(结果|送检)$/,
    format: (assay, state) => `${translateToEnglish(assay)} ${translateToEnglish(state)}`
  },
  {
    pattern: /^SLEDAI (.+)，(.+)$/,
    format: (score, status) => `SLEDAI ${score}, ${translateToEnglish(status)}`
  },
  {
    pattern: /^基线 SLEDAI (.+)$/,
    format: (score) => `Baseline SLEDAI ${score}`
  },
  {
    pattern: /^SLEDAI (.+) · 完整度 (.+)%$/,
    format: (score, completeness) => `SLEDAI ${score} · ${completeness}% complete`
  },
  {
    pattern: /^(.+) 建立患者旅程，受累脏器：(.+)。$/,
    format: (patient, organs) => `${patient} journey created. Affected organs: ${translateToEnglish(organs)}.`
  },
  {
    pattern: /^(.+) 诊断\/分组为 (.+)，住院号 (.+)。$/,
    format: (patient, disease, hospitalNo) => `${patient} diagnosis/group: ${translateToEnglish(disease)}. Hospital No. ${hospitalNo}.`
  },
  {
    pattern: /^(.+) 完成 (.+) 基线评估，记录 SLEDAI、用药和样本采集计划。$/,
    format: (patient, disease) =>
      `${patient} completed ${translateToEnglish(disease)} baseline assessment with SLEDAI, medication, and sample collection plan recorded.`
  },
  {
    pattern: /^(.+) 当前治疗方案：(.+)。$/,
    format: (patient, treatment) => `${patient} current treatment plan: ${translateToEnglish(treatment)}.`
  },
  {
    pattern: /^(.+) (.+)，用药 (.+)，样本采集 (.+)。$/,
    format: (patient, visitType, medication, sampleCollection) =>
      `${patient} ${translateToEnglish(visitType)}. Medication: ${translateToEnglish(medication)}. Sample collection: ${translateToEnglish(sampleCollection)}.`
  },
  {
    pattern: /^(.+)：(.+) 样本采集，存储位置 (.+)，关联检测 (.+)。$/,
    format: (sampleId, sampleType, storage, testing) =>
      `${sampleId}: ${translateToEnglish(sampleType)} sample collected. Storage: ${translateToEnglish(storage)}. Linked testing: ${translateToEnglish(testing)}.`
  },
  {
    pattern: /^(.+) \/ (.+)，样本 (.+)，QC (.+)。$/,
    format: (assay, platform, sampleId, qc) => `${translateToEnglish(assay)} / ${platform}, sample ${sampleId}, QC ${translateToEnglish(qc)}.`
  },
  {
    pattern: /^AI 指令已记录：(.+)$/,
    format: (prompt) => `AI instruction captured: ${translateToEnglish(prompt)}`
  },
  {
    pattern: /^(\d+)月$/,
    format: (month) => `${month}M`
  }
];

function preserveOuterWhitespace(source: string, translated: string) {
  const leading = source.match(/^\s*/)?.[0] ?? '';
  const trailing = source.match(/\s*$/)?.[0] ?? '';
  return `${leading}${translated}${trailing}`;
}

function normalizeBilingualBreaks(text: string) {
  return text
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])([\u4e00-\u9fa5])/g, '$1 $2')
    .replace(/([\u4e00-\u9fa5])([a-zA-Z])/g, '$1 $2');
}

function cleanEnglishPhraseTranslation(text: string) {
  return text
    .replace(/、/g, ' / ')
    .replace(/，/g, ', ')
    .replace(/；/g, '; ')
    .replace(/：/g, ': ')
    .replace(/。/g, '.')
    .replace(/\bIg G\b/g, 'IgG')
    .replace(/(\d+)(years|months|days)\b/g, '$1 $2')
    .replace(/\bbaselinevisit\b/gi, 'baseline visit')
    .replace(/\b(patient journey|indicator trend|key indicator|study)time range\b/gi, '$1 time range')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([,;:])(?=\S)/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function translateToEnglish(source: unknown): string {
  if (source === null || source === undefined) return '';
  if (typeof source !== 'string') return String(source);

  const trimmed = source.trim();
  if (!trimmed) return source;

  const exact = exactEnglish[trimmed];
  if (exact) return preserveOuterWhitespace(source, exact);

  for (const rule of dynamicRules) {
    const match = trimmed.match(rule.pattern);
    if (match) return preserveOuterWhitespace(source, rule.format(...match.slice(1)));
  }

  let translated = normalizeBilingualBreaks(trimmed);
  for (const [zh, en] of phraseEnglish) {
    translated = translated.split(zh).join(en);
  }

  return preserveOuterWhitespace(source, cleanEnglishPhraseTranslation(translated));
}

export function translateText(source: unknown, locale: Locale) {
  if (source === null || source === undefined) return '';
  if (typeof source !== 'string') return String(source);
  if (locale === 'zh-CN') return source;
  return translateToEnglish(source);
}
