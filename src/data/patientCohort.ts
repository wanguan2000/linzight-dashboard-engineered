export type DiseaseType = 'NPSLE' | 'Non-NPSLE' | 'MS' | 'NMOSD' | 'HC';
export type SampleType = '血液' | 'CSF' | '肾';
export type OmicsStatus = '样本采集' | '进行中' | '完成';

export interface SampleCollection {
  type: SampleType;
  count: number;
}

export interface PatientRecord {
  id?: string;
  studyId: 'LGL-1111';
  name: string;
  hospitalNo: string;
  sex: '男' | '女';
  age: number;
  diseaseType: DiseaseType;
  organs: string[];
  samples: SampleCollection[];
  omicsStatus: OmicsStatus;
  note: string;
  clinicalData: Record<string, string | number>;
}

export const clinicalFields = [
  '患者编号',
  '性别',
  '年龄',
  '身高（cm）',
  '体重（Kg）',
  '病程（发病-使用CD20时）',
  '住院号',
  '出院诊断',
  '受累脏器',
  'SLEDAI评分',
  'RSLEDAI',
  'LN病理分型（如有）',
  'AI',
  'CI',
  'PGA评分',
  'MP mg/d',
  '免疫抑制剂1',
  '免疫制剂2',
  '其他合并用药',
  '体温',
  '神经系统症状',
  '关节肿胀',
  '关节疼痛',
  '皮疹',
  '口腔溃疡',
  '脱发',
  '其他',
  'WBC',
  'N绝对值10^9/L',
  '淋巴绝对值',
  '单核绝对值',
  'HB(g/L)',
  'PLT(^10*9/L)',
  'TB（g/L）',
  'ALB(g/l)',
  'ALT(U/L)',
  'AST(U/L)',
  'LDH(U/L)',
  'AKP U/L',
  '总胆红素 umol/L',
  'EPI-GFR（mmol/l*min）',
  'Cr（ummol/l)',
  'BUN(mg/l)',
  'UA',
  '甘油三酯',
  '胆固醇',
  '24小时尿蛋白 g/24h',
  '尿白细胞/Hp',
  '尿红细胞/Hp',
  'CRP(mg/l)',
  'ESR(mm)',
  '总补体CH50 （U/mL)',
  'C1抑制剂 (g/l)',
  'C3(g/l)',
  'C4(g/l)',
  'IgG(g/l)',
  'IgA(g/l)',
  'IgM(g/l)',
  'ANA1:80为阳性（1-yes，0-none）',
  '滴度',
  '核型',
  'ENA1',
  'ENA2',
  'ENA3',
  'ds-DNA（ELISA）',
  'ds-DNA(放免法iu/ml)',
  '其他阳性抗体',
  '淋巴细胞绝对值 *10^9',
  'B淋巴细胞绝对值',
  'T淋巴细胞绝对值',
  'Th淋巴细胞绝对值',
  'Ts淋巴细胞绝对值',
  '自然杀伤细胞绝对值',
  'CD20细胞百分比%',
  '外周血浆细胞检测%',
  '胸膜炎',
  '心包炎',
  '肺动脉高压',
  '其他异常结果'
];

function makeClinicalData(completeness: number, seed: Record<string, string | number>) {
  const filledCount = Math.round((clinicalFields.length * completeness) / 100);
  const data: Record<string, string | number> = {};

  clinicalFields.slice(0, filledCount).forEach((field) => {
    data[field] = seed[field] ?? '已录入';
  });

  Object.entries(seed).forEach(([key, value]) => {
    data[key] = value;
  });

  return data;
}

function createPatient(
  name: string,
  hospitalNo: string,
  sex: '男' | '女',
  age: number,
  diseaseType: DiseaseType,
  organs: string[],
  samples: SampleCollection[],
  omicsStatus: OmicsStatus,
  completeness: number,
  note: string
): PatientRecord {
  return {
    studyId: 'LGL-1111',
    name,
    hospitalNo,
    sex,
    age,
    diseaseType,
    organs,
    samples,
    omicsStatus,
    note,
    clinicalData: makeClinicalData(completeness, {
      患者编号: name,
      性别: sex,
      年龄: age,
      住院号: hospitalNo,
      出院诊断: diseaseType,
      受累脏器: organs.join('、')
    })
  };
}

export function calculateClinicalCompleteness(clinicalData: Record<string, string | number>) {
  const explicitCompleteness = clinicalData['数据完整度'];
  if (typeof explicitCompleteness === 'number') return Math.round(explicitCompleteness);
  if (typeof explicitCompleteness === 'string' && explicitCompleteness.trim()) {
    const parsed = Number.parseFloat(explicitCompleteness);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }

  const filled = clinicalFields.filter((field) => {
    const value = clinicalData[field];
    return value !== undefined && value !== null && value !== '';
  }).length;

  return Math.round((filled / clinicalFields.length) * 100);
}

export const patientRecords: PatientRecord[] = [
  createPatient('LQH-023', '23018456', '女', 23, 'NPSLE', ['皮肤', '肾'], [{ type: '血液', count: 2 }, { type: 'CSF', count: 1 }], '完成', 96, '近期采血，下次随访风险低'),
  createPatient('WYM-184', '24002391', '男', 31, 'Non-NPSLE', ['皮肤'], [{ type: '血液', count: 1 }], '进行中', 76, '临床数据待补录'),
  createPatient('ZXR-512', '22091734', '女', 42, 'NMOSD', ['神经系统'], [{ type: 'CSF', count: 2 }], '完成', 100, '脑脊液样本已完成检测'),
  createPatient('CJY-308', '21056288', '男', 56, 'MS', ['神经系统'], [{ type: '血液', count: 1 }, { type: 'CSF', count: 1 }], '完成', 94, '下次随访需评估神经症状'),
  createPatient('LYT-447', '23047322', '女', 29, 'NPSLE', ['皮肤', '神经系统'], [{ type: '血液', count: 2 }], '进行中', 82, '近期采血，等待多组学结果'),
  createPatient('HQN-065', '24011873', '男', 38, 'Non-NPSLE', ['肾'], [{ type: 'CSF', count: 1 }, { type: '肾', count: 1 }], '完成', 89, '肾样本已入库'),
  createPatient('QML-731', '21083451', '女', 47, 'NPSLE', ['皮肤', '肾'], [{ type: '血液', count: 1 }, { type: 'CSF', count: 1 }], '完成', 97, '数据完整，建议进入分析队列'),
  createPatient('SYF-209', '22030467', '男', 33, 'HC', ['皮肤'], [{ type: '血液', count: 1 }], '样本采集', 68, '待补充体格检查与生化结果'),
  createPatient('ZYW-912', '23099812', '女', 61, 'NMOSD', ['神经系统', '肾'], [{ type: 'CSF', count: 1 }], '完成', 93, '随访风险中等'),
  createPatient('GCH-156', '24026619', '男', 27, 'HC', ['皮肤'], [{ type: '血液', count: 1 }], '进行中', 72, '样本送检中'),
  createPatient('TYR-684', '21049276', '女', 35, 'NPSLE', ['肾', '神经系统'], [{ type: '血液', count: 2 }, { type: '肾', count: 1 }], '完成', 91, '肾活检样本已归档'),
  createPatient('MPX-417', '22068105', '男', 44, 'MS', ['神经系统'], [{ type: 'CSF', count: 1 }], '进行中', 84, '等待蛋白组结果回传'),
  createPatient('DHL-530', '23015762', '女', 52, 'Non-NPSLE', ['皮肤', '肾'], [{ type: '血液', count: 1 }], '完成', 88, '免疫指标复核完成'),
  createPatient('BQS-271', '24073018', '男', 19, 'HC', ['皮肤'], [{ type: '血液', count: 1 }], '样本采集', 64, '健康对照采样待确认'),
  createPatient('NCL-809', '21093644', '女', 58, 'NMOSD', ['神经系统'], [{ type: 'CSF', count: 2 }, { type: '血液', count: 1 }], '完成', 95, '影像资料已同步'),
  createPatient('FJW-362', '22074590', '男', 63, 'NPSLE', ['肾'], [{ type: '血液', count: 1 }, { type: '肾', count: 1 }], '进行中', 81, '需补录尿检记录'),
  createPatient('YKH-904', '23062047', '女', 40, 'MS', ['神经系统'], [{ type: 'CSF', count: 1 }], '完成', 92, '随访窗口期正常'),
  createPatient('RZT-118', '24058133', '男', 25, 'HC', ['皮肤'], [{ type: '血液', count: 1 }], '完成', 86, '健康对照质控通过'),
  createPatient('XWP-755', '21037584', '女', 49, 'NPSLE', ['皮肤', '神经系统'], [{ type: '血液', count: 2 }], '进行中', 79, '等待随访量表补充'),
  createPatient('KMD-642', '22084621', '男', 54, 'Non-NPSLE', ['肾'], [{ type: '血液', count: 1 }, { type: '肾', count: 1 }], '完成', 90, '病理分型已确认'),
  createPatient('VQA-290', '23071596', '女', 32, 'NMOSD', ['神经系统'], [{ type: 'CSF', count: 1 }, { type: '血液', count: 1 }], '样本采集', 74, '待采集第二管血样'),
  createPatient('PLS-583', '24040728', '男', 37, 'NPSLE', ['皮肤'], [{ type: '血液', count: 1 }], '完成', 87, '皮疹照片已上传'),
  createPatient('EJN-046', '21052913', '女', 66, 'MS', ['神经系统'], [{ type: 'CSF', count: 2 }], '进行中', 83, '复查脑脊液计划中'),
  createPatient('HVB-319', '22019850', '男', 30, 'HC', ['皮肤'], [{ type: '血液', count: 1 }], '完成', 85, '样本运输记录完整'),
  createPatient('SGL-774', '23086405', '女', 45, 'Non-NPSLE', ['皮肤', '肾'], [{ type: '血液', count: 2 }, { type: '肾', count: 1 }], '完成', 98, '核心字段均已审核'),
  createPatient('CWN-928', '24061270', '男', 57, 'NMOSD', ['神经系统'], [{ type: 'CSF', count: 1 }], '样本采集', 70, '待完善既往治疗史'),
  createPatient('AMF-105', '21024837', '女', 22, 'NPSLE', ['皮肤'], [{ type: '血液', count: 1 }], '进行中', 77, '初筛后等待入组确认'),
  createPatient('JTD-691', '22093486', '男', 41, 'MS', ['神经系统'], [{ type: '血液', count: 1 }, { type: 'CSF', count: 1 }], '完成', 94, '组学数据已进入分析'),
  createPatient('OLN-237', '23050614', '女', 60, 'Non-NPSLE', ['肾'], [{ type: '肾', count: 1 }], '完成', 92, '肾组织样本已入库'),
  createPatient('PXY-850', '24037192', '男', 34, 'HC', ['皮肤'], [{ type: '血液', count: 1 }], '进行中', 73, '待完成基线问卷')
];

export const cohortStats = [
  { label: '总患者数', value: '1,248', delta: '12.6%', helper: '较近 30 天', icon: 'patients' as const },
  { label: 'NPSLE', value: '532', delta: '8.4%', helper: '占总数 42.7%', icon: 'check' as const },
  { label: 'NMOSD / MS', value: '386', delta: '10.1%', helper: '占总数 30.9%', icon: 'dna' as const },
  { label: 'HC', value: '330', delta: '6.7%', helper: '占总数 26.4%', icon: 'userPlus' as const },
  { label: '数据完整性', value: '88.6%', delta: '5.3%', helper: '较近 30 天', icon: 'check' as const, progress: 88.6 }
];

export const diseaseDistribution = [
  { label: 'NPSLE', value: 532, percent: '42.7%' },
  { label: 'Non-NPSLE', value: 198, percent: '15.9%' },
  { label: 'NMOSD', value: 148, percent: '11.9%' },
  { label: 'MS', value: 238, percent: '19.1%' },
  { label: 'HC', value: 132, percent: '10.6%' }
];

export const sampleSummary = [
  { label: '血液', value: '1,102', helper: '88.3%' },
  { label: 'CSF', value: '786', helper: '62.5%' },
  { label: '肾', value: '256', helper: '20.5%' },
  { label: '总样本数', value: '1,348', helper: '—' }
];
