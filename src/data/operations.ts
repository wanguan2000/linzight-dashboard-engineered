import { calculateClinicalCompleteness, patientRecords, type PatientRecord } from './patientCohort';

export type SampleStatus = '已采集' | '已送检' | '检测中' | '检测完成' | '结果回传' | '待处理';
export type OmicsQcStatus = '通过' | '未通过' | '待确认';
export type ConsentStatus = '已签署' | '待签署' | '已撤回';
export type SampleLibraryCode =
  | 'T01'
  | 'T02'
  | 'T03'
  | 'T04'
  | 'T05'
  | 'T06'
  | 'T07'
  | 'T08'
  | 'T09'
  | 'T10'
  | 'T11'
  | 'T12'
  | 'T13'
  | 'T14'
  | 'T15';

export interface SampleLibraryCatalogItem {
  code: SampleLibraryCode;
  nameCn: string;
  nameEn: string;
  attribute: string;
  scenario: string;
  aliases: string[];
}

export interface SampleRecord {
  id: string;
  patientId?: string;
  patientName: string;
  hospitalNo: string;
  sampleType: string;
  visit: string;
  collectedAt: string;
  storage: string;
  status: SampleStatus;
  linkedOmics: string[];
}

export interface OmicsRecord {
  id: string;
  patientId?: string;
  patientName: string;
  sampleId: string;
  sampleType: string;
  assay: 'WGS' | 'TCR/BCR' | 'Olink/Simoa' | '蛋白组' | '代谢组';
  platform: string;
  runId: string;
  status: '样本接收' | '文库构建' | '测序完成' | '数据分析' | '结果归档';
  qc: OmicsQcStatus;
  sentAt: string;
  completedAt: string;
}

export interface ConsentRecord {
  id: string;
  patientName: string;
  hospitalNo: string;
  diseaseType: string;
  status: ConsentStatus;
  signedAt: string;
  version: string;
  method: '电子' | '纸质' | '-';
}

export interface VisitRecord {
  id: string;
  patientName: string;
  visit: string;
  visitDate: string;
  visitType: string;
  sleDai: string;
  medication: string;
  sampleCollection: string;
  completeness: number;
  status: '已完成' | '进行中' | '已预约';
}

export interface ReportRecord {
  id: string;
  name: string;
  type: string;
  scope: string;
  status: '可导出' | '生成中' | '需复核';
  updatedAt: string;
}

export const sampleLibraryCatalog: SampleLibraryCatalogItem[] = [
  { code: 'T01', nameCn: '血液', nameEn: 'Blood', attribute: '液体样本', scenario: 'NPSLE、Non-NPSLE、MS、NMOSD、HC', aliases: ['血液', 'Blood'] },
  { code: 'T02', nameCn: '脑脊液', nameEn: 'Cerebrospinal Fluid, CSF', attribute: '液体样本', scenario: 'NPSLE、MS、NMOSD', aliases: ['脑脊液', 'CSF', 'Cerebrospinal Fluid'] },
  { code: 'T03', nameCn: '肾组织', nameEn: 'Kidney Tissue', attribute: '实体组织', scenario: 'SLE、NPSLE、Non-NPSLE，尤其狼疮肾炎', aliases: ['肾组织', '肾', 'Kidney Tissue'] },
  { code: 'T04', nameCn: '尿液', nameEn: 'Urine', attribute: '液体样本', scenario: 'SLE、NPSLE、Non-NPSLE，肾脏受累监测', aliases: ['尿液', '尿', 'Urine'] },
  { code: 'T05', nameCn: '皮肤组织', nameEn: 'Skin Tissue', attribute: '实体组织', scenario: 'SLE皮疹、血管炎、皮肤黏膜受累', aliases: ['皮肤组织', '皮肤', 'Skin Tissue'] },
  { code: 'T06', nameCn: '唾液腺组织', nameEn: 'Salivary Gland Tissue', attribute: '实体组织', scenario: 'SLE合并干燥综合征、抗SSA阳性', aliases: ['唾液腺组织', 'Salivary Gland Tissue'] },
  { code: 'T07', nameCn: '脊髓组织', nameEn: 'Spinal Cord Tissue', attribute: '机会性神经组织', scenario: 'MS、NMOSD、NPSLE横贯性脊髓炎；极少机会性获取', aliases: ['脊髓组织', 'Spinal Cord Tissue'] },
  { code: 'T08', nameCn: '淋巴结组织', nameEn: 'Lymph Node Tissue', attribute: '实体免疫组织', scenario: '淋巴结肿大、B细胞活化、EBV相关免疫异常', aliases: ['淋巴结组织', 'Lymph Node Tissue'] },
  { code: 'T09', nameCn: '视神经相关组织', nameEn: 'Optic Nerve-related Tissue', attribute: '机会性神经组织', scenario: 'NMOSD、MS视神经炎；极少获取', aliases: ['视神经相关组织', 'Optic Nerve-related Tissue'] },
  { code: 'T10', nameCn: '周围神经组织', nameEn: 'Peripheral Nerve Tissue', attribute: '实体神经组织', scenario: 'NPSLE外周神经病、血管炎性神经病变', aliases: ['周围神经组织', 'Peripheral Nerve Tissue'] },
  { code: 'T11', nameCn: '肌肉组织', nameEn: 'Muscle Tissue', attribute: '实体组织', scenario: 'SLE合并肌炎、肌病、血管炎', aliases: ['肌肉组织', 'Muscle Tissue'] },
  { code: 'T12', nameCn: '粪便', nameEn: 'Stool/Feces', attribute: '微生态样本', scenario: '肠道菌群、免疫-肠脑轴探索，可选', aliases: ['粪便', 'Stool', 'Feces'] },
  { code: 'T13', nameCn: '口腔', nameEn: 'Buccal Swab', attribute: '黏膜/遗传样本', scenario: '生殖系DNA、口腔菌群，可选', aliases: ['口腔', 'Buccal Swab'] },
  { code: 'T14', nameCn: '鼻咽', nameEn: 'Nasopharyngeal/Oropharyngeal Swab', attribute: '黏膜样本', scenario: 'EBV/病毒感染背景、呼吸道感染排查，可选', aliases: ['鼻咽', 'Nasopharyngeal Swab', 'Oropharyngeal Swab'] },
  { code: 'T15', nameCn: '脑组织', nameEn: 'Brain Tissue', attribute: '机会性神经组织', scenario: 'NPSLE、MS、NMOSD；脑活检/手术/尸检等特殊场景', aliases: ['脑组织', 'Brain Tissue'] }
];

export function getSampleLibraryCode(sampleType: string) {
  const normalized = sampleType.trim().toLowerCase();
  const catalogItem = sampleLibraryCatalog.find((item) =>
    item.aliases.some((alias) => alias.trim().toLowerCase() === normalized)
  );

  return catalogItem?.code;
}

export function formatSampleLibraryId(sample: Pick<SampleRecord, 'id' | 'patientName' | 'sampleType'>) {
  const code = getSampleLibraryCode(sample.sampleType);
  return code ? `${sample.patientName}-${code}` : sample.id;
}

export const samples: SampleRecord[] = [
  { id: 'SPL-2024-0501-001', patientName: 'LQH-023', hospitalNo: '23018456', sampleType: '血液', visit: 'V1 基线访视', collectedAt: '2024-05-01', storage: '-80℃冰箱A1', status: '结果回传', linkedOmics: ['WGS', '蛋白组'] },
  { id: 'SPL-2024-0501-002', patientName: 'LQH-023', hospitalNo: '23018456', sampleType: '血液', visit: 'V1 基线访视', collectedAt: '2024-05-01', storage: '-80℃冰箱A2', status: '结果回传', linkedOmics: ['代谢组'] },
  { id: 'SPL-2024-0501-003', patientName: 'LQH-023', hospitalNo: '23018456', sampleType: 'CSF', visit: 'V1 基线访视', collectedAt: '2024-05-01', storage: '液氮罐C1', status: '检测中', linkedOmics: ['Olink/Simoa'] },
  { id: 'SPL-2024-0601-004', patientName: 'WYM-184', hospitalNo: '24002391', sampleType: '血液', visit: 'V2 1月随访', collectedAt: '2024-06-01', storage: '-80℃冰箱B1', status: '已送检', linkedOmics: ['TCR/BCR'] },
  { id: 'SPL-2024-0601-005', patientName: 'ZXR-512', hospitalNo: '22091734', sampleType: 'CSF', visit: 'V2 1月随访', collectedAt: '2024-06-01', storage: '液氮罐C2', status: '结果回传', linkedOmics: ['Olink/Simoa'] },
  { id: 'SPL-2024-0801-006', patientName: 'CJY-308', hospitalNo: '21056288', sampleType: '血液', visit: 'V3 3月随访', collectedAt: '2024-08-01', storage: '-80℃冰箱A3', status: '检测中', linkedOmics: ['WGS'] },
  { id: 'SPL-2024-0801-007', patientName: 'CJY-308', hospitalNo: '21056288', sampleType: 'CSF', visit: 'V3 3月随访', collectedAt: '2024-08-01', storage: '液氮罐C3', status: '已采集', linkedOmics: ['Olink/Simoa'] },
  { id: 'SPL-2024-0901-008', patientName: 'LYT-447', hospitalNo: '23047322', sampleType: '血液', visit: 'V3 3月随访', collectedAt: '2024-09-01', storage: '-80℃冰箱B2', status: '已送检', linkedOmics: ['蛋白组'] },
  { id: 'SPL-2024-0901-009', patientName: 'HQN-065', hospitalNo: '24011873', sampleType: '肾', visit: 'V1 基线访视', collectedAt: '2024-09-01', storage: '病理库R1', status: '结果回传', linkedOmics: ['代谢组'] },
  { id: 'SPL-2024-1001-010', patientName: 'QML-731', hospitalNo: '21083451', sampleType: '血液', visit: 'V4 6月随访', collectedAt: '2024-10-01', storage: '-80℃冰箱A4', status: '结果回传', linkedOmics: ['WGS', 'TCR/BCR'] },
  { id: 'SPL-2024-1101-011', patientName: 'SYF-209', hospitalNo: '22030467', sampleType: '血液', visit: 'V1 基线访视', collectedAt: '2024-11-01', storage: '-80℃冰箱B3', status: '待处理', linkedOmics: ['蛋白组'] },
  { id: 'SPL-2024-1101-012', patientName: 'ZYW-912', hospitalNo: '23099812', sampleType: 'CSF', visit: 'V4 6月随访', collectedAt: '2024-11-01', storage: '液氮罐C4', status: '检测中', linkedOmics: ['Olink/Simoa'] }
];

export const omicsRecords: OmicsRecord[] = [
  { id: 'OMX-001', patientName: 'LQH-023', sampleId: 'SPL-2024-0501-001', sampleType: '血液', assay: 'WGS', platform: 'NovaSeq 6000', runId: 'WGS-260423-A', status: '结果归档', qc: '通过', sentAt: '2024-04-20', completedAt: '2024-04-26' },
  { id: 'OMX-002', patientName: 'LQH-023', sampleId: 'SPL-2024-0501-002', sampleType: '血液', assay: '蛋白组', platform: 'Exploris 480', runId: 'PRO-260423-B', status: '结果归档', qc: '通过', sentAt: '2024-04-20', completedAt: '2024-04-25' },
  { id: 'OMX-003', patientName: 'LQH-023', sampleId: 'SPL-2024-0501-003', sampleType: 'CSF', assay: 'Olink/Simoa', platform: 'Olink Explore', runId: 'OL-260423-C', status: '数据分析', qc: '待确认', sentAt: '2024-04-22', completedAt: '-' },
  { id: 'OMX-004', patientName: 'WYM-184', sampleId: 'SPL-2024-0601-004', sampleType: '血液', assay: 'TCR/BCR', platform: 'Illumina', runId: 'IR-260420-B', status: '测序完成', qc: '通过', sentAt: '2024-04-18', completedAt: '2024-04-24' },
  { id: 'OMX-005', patientName: 'ZXR-512', sampleId: 'SPL-2024-0601-005', sampleType: 'CSF', assay: 'Olink/Simoa', platform: 'Simoa HD-X', runId: 'SM-260418-A', status: '结果归档', qc: '通过', sentAt: '2024-04-18', completedAt: '2024-04-22' },
  { id: 'OMX-006', patientName: 'CJY-308', sampleId: 'SPL-2024-0801-006', sampleType: '血液', assay: 'WGS', platform: 'NovaSeq', runId: 'WGS-260416-F', status: '数据分析', qc: '待确认', sentAt: '2024-04-16', completedAt: '-' },
  { id: 'OMX-007', patientName: 'CJY-308', sampleId: 'SPL-2024-0801-007', sampleType: 'CSF', assay: 'Olink/Simoa', platform: 'Olink Explore', runId: 'OL-260416-G', status: '文库构建', qc: '待确认', sentAt: '2024-04-16', completedAt: '-' },
  { id: 'OMX-008', patientName: 'LYT-447', sampleId: 'SPL-2024-0901-008', sampleType: '血液', assay: '蛋白组', platform: 'Exploris 480', runId: 'PRO-260417-D', status: '样本接收', qc: '待确认', sentAt: '2024-04-17', completedAt: '-' },
  { id: 'OMX-009', patientName: 'HQN-065', sampleId: 'SPL-2024-0901-009', sampleType: '肾', assay: '代谢组', platform: 'Q-Exactive', runId: 'MET-260418-E', status: '结果归档', qc: '通过', sentAt: '2024-04-18', completedAt: '2024-04-23' },
  { id: 'OMX-010', patientName: 'QML-731', sampleId: 'SPL-2024-1001-010', sampleType: '血液', assay: 'TCR/BCR', platform: 'MiSeq', runId: 'IR-260419-H', status: '结果归档', qc: '通过', sentAt: '2024-04-19', completedAt: '2024-04-26' }
];

const consentSignedDates = [
  '2026-04-23',
  '2026-04-22',
  '2026-04-21',
  '2026-04-20',
  '2026-04-19',
  '2026-04-18',
  '2026-04-17',
  '2026-04-16',
  '2026-04-15',
  '2026-04-14'
];

function consentStatusForIndex(index: number): ConsentStatus {
  if (index % 15 === 3) return '已撤回';
  if (index % 5 === 1) return '待签署';
  return '已签署';
}

export const consentRecords: ConsentRecord[] = patientRecords.map((patient, index) => {
  const status = consentStatusForIndex(index);
  const signedAt = status === '待签署' ? '-' : consentSignedDates[index % consentSignedDates.length];

  return {
    id: `LGL-1111-${String(index + 1).padStart(3, '0')}`,
    patientName: patient.name,
    hospitalNo: `RJ${patient.hospitalNo}`,
    diseaseType: patient.diseaseType,
    status,
    signedAt,
    version: 'V1.0',
    method: status === '待签署' ? '-' : index % 3 === 0 ? '纸质' : '电子'
  };
});

export const visits: VisitRecord[] = [
  { id: 'V1', patientName: 'LQH-023', visit: 'V1 基线访视', visitDate: '2024-05-01', visitType: '基线访视', sleDai: '12', medication: 'MMF 1.0g/d', sampleCollection: '血液、尿液', completeness: 92, status: '已完成' },
  { id: 'V2', patientName: 'LQH-023', visit: 'V2 1月随访', visitDate: '2024-06-01', visitType: '随访访视', sleDai: '8', medication: 'MMF 1.5g/d', sampleCollection: '血液、尿液', completeness: 90, status: '已完成' },
  { id: 'V3', patientName: 'LQH-023', visit: 'V3 3月随访', visitDate: '2024-08-01', visitType: '随访访视', sleDai: '6', medication: 'MMF 1.5g/d + HCQ', sampleCollection: '血液、尿液、CSF', completeness: 86, status: '进行中' },
  { id: 'V4', patientName: 'LQH-023', visit: 'V4 6月随访', visitDate: '2024-11-01', visitType: '随访访视', sleDai: '--', medication: '计划评估', sampleCollection: '血液、尿液', completeness: 0, status: '已预约' }
];

export const reportRecords: ReportRecord[] = [
  { id: 'RPT-001', name: '患者全景数据包', type: 'PDF', scope: '单患者 / Journey', status: '可导出', updatedAt: '2026-04-27 09:20' },
  { id: 'RPT-002', name: '临床数据完整性报表', type: 'XLSX', scope: 'LGL-1111 全队列', status: '可导出', updatedAt: '2026-04-27 09:10' },
  { id: 'RPT-003', name: '样本采集与送检台账', type: 'CSV', scope: '样本 / 组学检测', status: '可导出', updatedAt: '2026-04-27 08:50' },
  { id: 'RPT-004', name: 'SDTM 数据集草稿', type: 'ZIP', scope: 'DM / LB / VS / SUPP', status: '需复核', updatedAt: '2026-04-26 18:40' },
  { id: 'RPT-005', name: '知情同意审计轨迹', type: 'PDF', scope: 'Consent Audit', status: '生成中', updatedAt: '2026-04-26 17:30' }
];

export const clinicalSections = [
  { title: '基本信息', items: [['患者编号', 'LQH-023'], ['性别', '女'], ['年龄', '33'], ['身高', '160cm'], ['体重', '50kg'], ['住院号', '23018456']] },
  { title: '目前病情评估', items: [['SLEDAI评分', '12'], ['RSLEDAI', '4'], ['PGA评分', '2'], ['LN病理', 'IV'], ['AI', '8'], ['CI', '2']] },
  { title: '目前用药情况', items: [['MP mg/d', '240'], ['免疫抑制剂1', 'CD20'], ['免疫抑制剂2', 'MMF'], ['其他用药', 'IVIG']] },
  { title: '常规生化', items: [['WBC', '10.73'], ['NEU', '8.72'], ['HB', '111'], ['PLT', '400'], ['ALT', '26'], ['CRP', '4.10']] },
  { title: '尿蛋白', items: [['24小时尿蛋白', '0.8'], ['尿白细胞/Hp', '0'], ['尿红细胞/Hp', '0'], ['尿蛋白/Cr', '0']] },
  { title: '免疫球蛋白及补体', items: [['C3', '0.94'], ['C4', '0.71'], ['IgG', '3.18'], ['IgA', '0.71'], ['IgM', '0.86']] },
  { title: '自身抗体', items: [['ANA', '1:320'], ['ENA1', 'Sm'], ['ENA2', 'Ro-52'], ['ds-DNA', '67'], ['核型', '均质型']] },
  { title: '特殊检查', items: [['胸膜炎', '正常'], ['心包炎', '正常'], ['肺动脉高压', '正常'], ['其他异常', '无']] }
];

export const workflowEvents = [
  '患者筛选',
  '知情同意',
  '基线访视',
  '样本采集',
  '多组学检测',
  '随访管理',
  '数据锁库'
];

export function getSelectedPatient(selectedPatient?: PatientRecord | null) {
  return selectedPatient ?? patientRecords[0];
}

export function getCompleteness(patient: PatientRecord) {
  return calculateClinicalCompleteness(patient.clinicalData);
}
