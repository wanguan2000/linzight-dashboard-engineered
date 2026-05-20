import { calculateClinicalCompleteness, patientRecords, samplePlanForDisease, type PatientRecord } from './patientCohort';

export type SampleStatus = '已采集' | '已送检' | '检测中' | '结果回传' | '待处理';
export type OmicsQcStatus = '通过' | '未通过' | '待确认';
export type ConsentStatus = '待签署' | '已签署' | '撤回审批中' | '已撤回' | '重签审批中' | '已重签';
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
  | 'T15'
  | 'T16'
  | 'T17';

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
  studyId?: string;
  patientId?: string;
  patientName: string;
  hospitalNo: string;
  sampleType: string;
  visit: string;
  collectedAt: string;
  storage: string;
  initialQuantity?: string;
  remainingQuantity?: string;
  quantityUnit?: string;
  note?: string;
  status: SampleStatus;
  linkedOmics: string[];
}

export type OmicsSampleUsage = Record<string, { usedQuantity?: string; unit?: string; role?: string }>;

export interface OmicsRecord {
  id: string;
  studyId?: string;
  testingProjectId?: string;
  patientId?: string;
  patientName: string;
  sampleId: string;
  sampleIds?: string[];
  sampleUsage?: OmicsSampleUsage;
  sampleType: string;
  assay: string;
  vendor: string;
  platform: string;
  runId: string;
  status: '样本接收' | '文库构建' | '测序完成' | '数据分析' | '结果归档';
  qc: OmicsQcStatus;
  resultFileId?: string;
  sentAt: string;
  completedAt: string;
}

export interface ConsentRecord {
  id: string;
  studyId?: string;
  patientId?: string;
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
  studyId?: string;
  patientId?: string;
  visitPlanId?: string;
  visitPlanCode?: string;
  planDayOffset?: number;
  windowBeforeDays?: number;
  windowAfterDays?: number;
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

export interface FollowUpRecord {
  id: string;
  studyId?: string;
  patientId?: string;
  visitId?: string;
  patientName: string;
  followUpDate: string;
  followUpMethod: '门诊' | '电话' | '线上' | '家访' | '其他';
  followedBy: string;
  survivalStatus: '存活' | '死亡' | '未知';
  diseaseStatus: string;
  symptomsSigns: string;
  imagingLabSummary: string;
  efficacyAssessment: string;
  recordNote?: string;
  payload?: Record<string, string | number | boolean | null>;
  metastasisStatus: string;
  adverseEvents: string;
  qualityOfLife: string;
  lostToFollowUpReason: string;
  recordedAt: string;
}

export interface StudyVisitPlanRecord {
  id: string;
  studyId: string;
  code: string;
  name: string;
  visitType: string;
  dayOffset: number;
  windowBeforeDays: number;
  windowAfterDays: number;
  requiredForms: string[];
  requiredSamples: string[];
  status: 'active' | 'draft' | 'retired';
  sortOrder: number;
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
  { code: 'T15', nameCn: '脑组织', nameEn: 'Brain Tissue', attribute: '机会性神经组织', scenario: 'NPSLE、MS、NMOSD；脑活检/手术/尸检等特殊场景', aliases: ['脑组织', 'Brain Tissue'] },
  { code: 'T16', nameCn: '肺癌组织', nameEn: 'Lung Cancer Tissue', attribute: '实体肿瘤组织', scenario: 'LZXK-01 肺癌耐药组织 NGS / 病理复核', aliases: ['肺癌组织', '组织', 'Lung Cancer Tissue'] },
  { code: 'T17', nameCn: '胸水', nameEn: 'Pleural Effusion', attribute: '液体肿瘤样本', scenario: 'LZXK-01 肺癌耐药胸水细胞学与 ctDNA 检测', aliases: ['胸水', 'Pleural Effusion'] }
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

const assays: OmicsRecord['assay'][] = ['WGS', 'TCR/BCR', 'Olink/Simoa', '蛋白组', '代谢组'];
const assayPlatforms: Record<OmicsRecord['assay'], string> = {
  WGS: 'NovaSeq 6000',
  'TCR/BCR': 'MiSeq',
  'Olink/Simoa': 'Olink Explore',
  蛋白组: 'Exploris 480',
  代谢组: 'Q-Exactive',
  'NGS panel': 'NovaSeq 6000',
  ctDNA: 'NextSeq 2000',
  病理复核: 'Pathology Archive'
};

const assayVendors: Record<string, string> = {
  WGS: '华大智造',
  'TCR/BCR': 'MiSeq Core Lab',
  'Olink/Simoa': 'Olink Service',
  蛋白组: 'Thermo Proteomics Lab',
  代谢组: 'Metabolomics Core',
  'NGS panel': '燃石医学',
  ctDNA: '臻和科技',
  病理复核: '中心病理实验室'
};

function isoDateFromSeed(index: number, dayOffset = 0) {
  const date = new Date(Date.UTC(2024, 4, 1 + index * 3 + dayOffset));
  return date.toISOString().slice(0, 10);
}

function linkedOmicsForSample(patientIndex: number, sampleIndex: number, isControl: boolean, isLungStudy: boolean, sampleType: string): OmicsRecord['assay'][] {
  if (isLungStudy) {
    if (sampleType === '组织') return ['NGS panel', '病理复核'];
    if (sampleType === '胸水') return ['ctDNA'];
    return ['ctDNA', 'NGS panel'];
  }

  const primary = assays[(patientIndex + sampleIndex) % assays.length];
  if (isControl || sampleIndex !== 1) return [primary];
  return [primary, assays[(patientIndex + sampleIndex + 2) % assays.length]];
}

export const samples: SampleRecord[] = patientRecords.flatMap((patient, patientIndex) =>
  samplePlanForDisease(patient.diseaseType, patientIndex).map((sampleType, sampleIndex) => {
    const linkedOmics = linkedOmicsForSample(patientIndex, sampleIndex + 1, patient.diseaseType === 'HC', patient.studyId === 'LZXK-01', sampleType);
    return {
      id: `SPL-2024-${String(patientIndex + 1).padStart(3, '0')}-${String(sampleIndex + 1).padStart(2, '0')}`,
      studyId: patient.studyId,
      patientId: patient.id,
      patientName: patient.name,
      hospitalNo: patient.hospitalNo,
      sampleType,
      visit: 'V1 基线访视',
      collectedAt: isoDateFromSeed(patientIndex, sampleIndex),
      storage:
        sampleType === 'CSF'
          ? '液氮罐C1'
          : sampleType === '肾'
            ? '病理库R1'
            : sampleType === '组织'
              ? '病理库-LUNG-T1'
              : sampleType === '胸水'
                ? '液氮罐-LUNG-P1'
                : '-80℃冰箱A1',
      initialQuantity: sampleType === '组织' ? '2' : sampleType === '胸水' ? '8' : '5',
      remainingQuantity: sampleType === '组织' ? '2' : sampleType === '胸水' ? '8' : '5',
      quantityUnit: sampleType === '组织' ? '块' : 'mL',
      status: patientIndex % 4 === 0 ? '检测中' : '结果回传',
      linkedOmics
    };
  })
);

export const omicsRecords: OmicsRecord[] = samples.flatMap((sample, sampleIndex) =>
  sample.linkedOmics.map((assay, assayIndex) => {
    const status: OmicsRecord['status'] = sampleIndex % 4 === 0 ? '数据分析' : '结果归档';
    return {
      id: `OMX-${String(sampleIndex + 1).padStart(3, '0')}-${assayIndex + 1}`,
      studyId: sample.studyId,
      testingProjectId: sample.studyId === 'LZXK-01' ? 'TP-LUNG-RESIST-OMICS' : sample.studyId === 'RWD-NMO-2026' ? 'TP-NMO-OMICS' : 'TP-SLE-OMICS',
      patientId: sample.patientId,
      patientName: sample.patientName,
      sampleId: sample.id,
      sampleIds: [sample.id],
      sampleUsage: {
        [sample.id]: { usedQuantity: sample.sampleType === '组织' ? '1' : '1.5', unit: sample.quantityUnit ?? 'mL', role: '主样本' }
      },
      sampleType: sample.sampleType,
      assay: assay as OmicsRecord['assay'],
      vendor: assayVendors[assay] ?? '待定供应商',
      platform: assayPlatforms[assay as OmicsRecord['assay']],
      runId: `${assay.replace('/', '')}-${260400 + sampleIndex}-${assayIndex + 1}`,
      status,
      qc: status === '结果归档' ? '通过' : '待确认',
      sentAt: isoDateFromSeed(sampleIndex, 1),
      completedAt: status === '结果归档' ? isoDateFromSeed(sampleIndex, 7) : '-'
    };
  })
);

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
    id: `${patient.studyId}-${String(index + 1).padStart(3, '0')}`,
    studyId: patient.studyId,
    patientId: patient.id,
    patientName: patient.name,
    hospitalNo: `RJ${patient.hospitalNo}`,
    diseaseType: patient.diseaseType,
    status,
    signedAt,
    version: 'V1.0',
    method: status === '待签署' ? '-' : index % 3 === 0 ? '纸质' : '电子'
  };
});

export const studyVisitPlans: StudyVisitPlanRecord[] = [
  { id: 'SVP-LGL-1111-V1', studyId: 'LGL-1111', code: 'V1', name: 'V1 基线访视', visitType: '基线访视', dayOffset: 0, windowBeforeDays: 0, windowAfterDays: 7, requiredForms: ['baseline'], requiredSamples: ['血液', 'CSF'], status: 'active', sortOrder: 1 },
  { id: 'SVP-LGL-1111-V2', studyId: 'LGL-1111', code: 'V2', name: 'V2 1月随访', visitType: '随访访视', dayOffset: 32, windowBeforeDays: 7, windowAfterDays: 7, requiredForms: ['follow_up'], requiredSamples: ['血液'], status: 'active', sortOrder: 2 },
  { id: 'SVP-LGL-1111-V3', studyId: 'LGL-1111', code: 'V3', name: 'V3 3月随访', visitType: '随访访视', dayOffset: 64, windowBeforeDays: 14, windowAfterDays: 14, requiredForms: ['follow_up'], requiredSamples: ['血液'], status: 'active', sortOrder: 3 },
  { id: 'SVP-RWD-NMO-2026-V1', studyId: 'RWD-NMO-2026', code: 'V1', name: 'V1 基线访视', visitType: '基线访视', dayOffset: 0, windowBeforeDays: 0, windowAfterDays: 7, requiredForms: ['baseline'], requiredSamples: ['血液', 'CSF'], status: 'active', sortOrder: 1 },
  { id: 'SVP-RWD-NMO-2026-V2', studyId: 'RWD-NMO-2026', code: 'V2', name: 'V2 1月随访', visitType: '随访访视', dayOffset: 32, windowBeforeDays: 7, windowAfterDays: 7, requiredForms: ['follow_up'], requiredSamples: ['血液'], status: 'active', sortOrder: 2 },
  { id: 'SVP-RWD-NMO-2026-V3', studyId: 'RWD-NMO-2026', code: 'V3', name: 'V3 3月随访', visitType: '随访访视', dayOffset: 64, windowBeforeDays: 14, windowAfterDays: 14, requiredForms: ['follow_up'], requiredSamples: ['血液'], status: 'active', sortOrder: 3 },
  { id: 'SVP-LZXK-01-V1', studyId: 'LZXK-01', code: 'V1', name: 'V1 基线访视', visitType: '基线访视', dayOffset: 0, windowBeforeDays: 0, windowAfterDays: 7, requiredForms: ['baseline'], requiredSamples: ['血液', '组织'], status: 'active', sortOrder: 1 },
  { id: 'SVP-LZXK-01-V2', studyId: 'LZXK-01', code: 'V2', name: 'V2 1月耐药评估', visitType: '随访访视', dayOffset: 32, windowBeforeDays: 7, windowAfterDays: 7, requiredForms: ['follow_up'], requiredSamples: ['血液'], status: 'active', sortOrder: 2 },
  { id: 'SVP-LZXK-01-V3', studyId: 'LZXK-01', code: 'V3', name: 'V3 3月疗效评估', visitType: '随访访视', dayOffset: 64, windowBeforeDays: 14, windowAfterDays: 14, requiredForms: ['follow_up'], requiredSamples: ['血液'], status: 'active', sortOrder: 3 }
];

export function getStudyVisitPlans(studyId: string) {
  return studyVisitPlans
    .filter((plan) => plan.studyId === studyId && plan.status === 'active')
    .sort((a, b) => a.sortOrder - b.sortOrder || a.dayOffset - b.dayOffset);
}

export const visits: VisitRecord[] = patientRecords.flatMap((patient, patientIndex) =>
  getStudyVisitPlans(patient.studyId).map((plan, visitIndex) => {
    const baselineSledai = Number(patient.clinicalData['SLEDAI评分'] ?? 0);
    const lungVisitMetric =
      plan.code === 'V1'
        ? `ECOG ${patient.clinicalData['ECOG评分'] ?? 1} / 基线`
        : plan.code === 'V2'
          ? `ECOG ${patient.clinicalData['ECOG评分'] ?? 1} / ctDNA复核`
          : `ECOG ${patient.clinicalData['ECOG评分'] ?? 1} / RECIST ${patient.clinicalData['ORR评估'] ?? 'SD'}`;
    const completeness = Math.max(0, calculateClinicalCompleteness(patient.clinicalData) - visitIndex * 4);
    return {
      id: `VIS-${String(patientIndex + 1).padStart(3, '0')}-${visitIndex + 1}`,
      studyId: patient.studyId,
      patientId: patient.id,
      visitPlanId: plan.id,
      visitPlanCode: plan.code,
      planDayOffset: plan.dayOffset,
      windowBeforeDays: plan.windowBeforeDays,
      windowAfterDays: plan.windowAfterDays,
      patientName: patient.name,
      visit: plan.name,
      visitDate: isoDateFromSeed(patientIndex, plan.dayOffset),
      visitType: plan.visitType,
      sleDai: patient.studyId === 'LZXK-01' ? lungVisitMetric : String(Math.max(0, baselineSledai - visitIndex * 2)),
      medication:
        patient.diseaseType === 'HC'
          ? '无'
          : patient.studyId === 'LZXK-01'
            ? String(patient.clinicalData['免疫抑制剂1'] ?? '靶向 / 免疫治疗')
            : 'HCQ',
      sampleCollection: plan.code === 'V1' ? samplePlanForDisease(patient.diseaseType, patientIndex).join('、') : plan.requiredSamples.join('、'),
      completeness,
      status: visitIndex < 2 || patientIndex % 3 ? '已完成' : '进行中'
    };
  })
);

function followUpSummaryForPatient(patient: PatientRecord, patientIndex: number, visitIndex: number) {
  const efficacyCycle = ['缓解', '稳定', '进展'];
  const followUpOrgans = patient.organs.filter((organ) => organ !== '肺' && organ !== '健康对照');

  if (patient.studyId === 'LZXK-01') {
    const efficacy = efficacyCycle[(patientIndex + visitIndex) % efficacyCycle.length];
    return {
      diseaseStatus: followUpOrgans.length && visitIndex >= 2 ? '转移' : efficacy === '进展' ? '进展' : '稳定',
      symptomsSigns: `咳嗽/胸痛较前稳定，ECOG ${patientIndex % 3}，耐药相关症状继续观察。`,
      imagingLabSummary: '胸部CT提示靶病灶稳定；ctDNA 动态监测与 NGS 结果已同步复核。',
      efficacyAssessment: efficacy,
      metastasisStatus: followUpOrgans.length ? followUpOrgans.join('、') : '未见新增转移',
      adverseEvents: patientIndex % 4 === 0 ? '1级乏力' : '无明显不良事件',
      qualityOfLife: `ECOG ${patientIndex % 3}；日常活动基本可维持。`,
      lostToFollowUpReason: patientIndex % 29 === 0 && visitIndex >= 2 ? '电话未接通，待二次联系' : '-'
    };
  }

  if (patient.diseaseType === 'HC') {
    return {
      diseaseStatus: '无病',
      symptomsSigns: '无明显症状与体征。',
      imagingLabSummary: '常规检验关键指标无明显异常。',
      efficacyAssessment: '未评估',
      metastasisStatus: '-',
      adverseEvents: '无',
      qualityOfLife: '生活质量稳定。',
      lostToFollowUpReason: '-'
    };
  }

  const efficacy = efficacyCycle[(patientIndex + visitIndex + 1) % efficacyCycle.length];
  return {
    diseaseStatus: efficacy === '进展' && patientIndex % 5 === 0 ? '复发' : '稳定',
    symptomsSigns: `神经系统症状${patient.organs.includes('神经系统') ? '仍需观察' : '未见新发'}，疲乏程度可耐受。`,
    imagingLabSummary: '影像/检验关键结论已复核，未见紧急安全风险。',
    efficacyAssessment: efficacy,
    metastasisStatus: '-',
    adverseEvents: patientIndex % 6 === 0 ? '轻度胃肠道反应' : '无',
    qualityOfLife: `EQ-5D 0.${82 + (patientIndex % 12)}；生活质量较前稳定。`,
    lostToFollowUpReason: patientIndex % 31 === 0 && visitIndex >= 2 ? '电话未接通，待二次联系' : '-'
  };
}

export const followUpRecords: FollowUpRecord[] = visits
  .filter((visit) => visit.visitPlanCode !== 'V1')
  .map((visit) => {
    const patientIndex = patientRecords.findIndex((patient) => patient.id === visit.patientId || patient.name === visit.patientName);
    const patient = patientRecords[Math.max(0, patientIndex)];
    const visitIndex = getStudyVisitPlans(visit.studyId ?? patient.studyId).findIndex((plan) => plan.id === visit.visitPlanId);
    const summary = followUpSummaryForPatient(patient, Math.max(0, patientIndex), Math.max(1, visitIndex));
    const followUpMethod: FollowUpRecord['followUpMethod'] = (['门诊', '电话', '线上', '家访'] as const)[
      (Math.max(0, patientIndex) + Math.max(1, visitIndex)) % 4
    ];

    return {
      id: `FUP-${String(Math.max(0, patientIndex) + 1).padStart(3, '0')}-${Math.max(1, visitIndex) + 1}`,
      studyId: visit.studyId,
      patientId: visit.patientId,
      visitId: visit.id,
      patientName: visit.patientName,
      followUpDate: visit.visitDate,
      followUpMethod,
      followedBy: visit.studyId === 'LZXK-01' ? '肺癌 CRC' : '林清妍',
      survivalStatus: '存活',
      recordedAt: `${visit.visitDate}T10:00:00+00:00`,
      ...summary
    };
  });

export const reportRecords: ReportRecord[] = [
  { id: 'RPT-001', name: '患者全景数据包', type: 'PDF', scope: '单患者 / Journey', status: '可导出', updatedAt: '2026-04-27 09:20' },
  { id: 'RPT-002', name: '临床数据完整性报表', type: 'XLSX', scope: 'LGL-1111 全队列', status: '可导出', updatedAt: '2026-04-27 09:10' },
  { id: 'RPT-003', name: '样本采集与送检台账', type: 'CSV', scope: '样本 / 组学检测', status: '可导出', updatedAt: '2026-04-27 08:50' },
  { id: 'RPT-004', name: 'SDTM 数据集草稿', type: 'ZIP', scope: 'DM / LB / VS / SUPP', status: '需复核', updatedAt: '2026-04-26 18:40' },
  { id: 'RPT-005', name: '知情同意归档状态', type: 'PDF', scope: 'Consent Archive', status: '生成中', updatedAt: '2026-04-26 17:30' }
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
  '导出归档'
];

export function getSelectedPatient(selectedPatient?: PatientRecord | null) {
  return selectedPatient ?? patientRecords[0];
}

export function getCompleteness(patient: PatientRecord) {
  return calculateClinicalCompleteness(patient.clinicalData);
}
