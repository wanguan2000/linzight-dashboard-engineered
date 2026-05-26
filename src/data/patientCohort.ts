import { clinicalFields, crfFieldDefaults, crfTemplateVersion } from './crfTemplate';
import { defaultDiseaseTypes } from './globalConfig';

export type DiseaseType = string;
export type SampleType = string;
export type OmicsStatus = '未采集' | '样本采集' | '进行中' | '完成';

export interface SampleCollection {
  type: SampleType;
  count: number;
}

export interface PatientRecord {
  id?: string;
  studyId: string;
  patientNumber?: string;
  patientName?: string;
  patientNameInitials?: string;
  name: string;
  hospitalNo: string;
  sex: '男' | '女' | 'unknown';
  age: number | null;
  birthDate?: string | null;
  diseaseType: DiseaseType;
  organs: string[];
  samples: SampleCollection[];
  omicsStatus: OmicsStatus;
  note: string;
  clinicalData: Record<string, string | number | null>;
  clinicalDataVersion?: string;
  clinicalDataFormat?: 'jsonb' | 'json' | 'legacy';
  studyName?: string;
  status?: string;
  createdAt?: string;
  lastUpdated?: string;
}

export { clinicalFields } from './crfTemplate';

export const diseases: DiseaseType[] = defaultDiseaseTypes.slice(0, 5);
export const lungResistanceDiseases: DiseaseType[] = defaultDiseaseTypes.slice(5);
export const lzxkStudyId = 'LZXK-01';

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

export function inferBirthDateFromAge(age: number | null, referenceDate = new Date()) {
  if (age === null || !Number.isFinite(age) || age < 0 || age > 120) return '';
  return `${referenceDate.getFullYear() - Math.floor(age)}-01-01`;
}

export function calculateAgeFromBirthDate(birthDate?: string | null, referenceDate = new Date()) {
  const match = birthDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const birthDay = Number(match[3]);
  if (!birthYear || birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) return null;

  let age = referenceDate.getFullYear() - birthYear;
  const currentMonth = referenceDate.getMonth() + 1;
  const currentDay = referenceDate.getDate();
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

export function normalizeBirthDate(value?: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${match[1]}-${padDatePart(Number(match[2]))}-${padDatePart(Number(match[3]))}`;
}

export function patientDerivedAge(patient: Pick<PatientRecord, 'age' | 'birthDate'>) {
  return calculateAgeFromBirthDate(patient.birthDate) ?? patient.age;
}

const patientPrefixes = ['LQH', 'WYM', 'ZXR', 'CJY', 'LYT', 'HQN', 'QML', 'SYF', 'ZYW', 'GCH'];

const medicationByDisease: Record<string, string[]> = {
  NPSLE: ['CD20', 'MMF', 'IVIG'],
  'Non-NPSLE': ['HCQ', 'MMF', ''],
  MS: ['激素冲击', 'DMT', ''],
  NMOSD: ['CD20', 'AZA', ''],
  HC: ['无', '', ''],
  NSCLC: ['含铂双药', 'PD-1', '抗血管生成'],
  LUAD: ['奥希替尼', '培美曲塞', '贝伐珠单抗'],
  LUSC: ['紫杉醇', '卡铂', 'PD-1'],
  'EGFR-TKI耐药': ['奥希替尼', 'MET抑制剂', '局部放疗'],
  ALK耐药: ['阿来替尼', '洛拉替尼', '局部放疗']
};

function isLungResistanceDisease(disease: DiseaseType) {
  return lungResistanceDiseases.includes(disease);
}

export function patientCode(index: number) {
  const prefixes = index >= 50 ? ['LZXK', 'LCAD', 'LUSC', 'EGFR', 'ALKR'] : patientPrefixes;
  return `${prefixes[index % prefixes.length]}-${index + 101}`;
}

export function organsForDisease(disease: DiseaseType, index: number) {
  if (isLungResistanceDisease(disease)) {
    const patterns = [
      ['肺', '纵隔淋巴结'],
      ['肺', '胸膜'],
      ['肺', '骨'],
      ['肺', '脑'],
      ['肺', '肝']
    ];
    return patterns[index % patterns.length];
  }
  if (disease === 'NPSLE') return index % 2 ? ['神经系统', '皮肤'] : ['神经系统', '肾'];
  if (disease === 'Non-NPSLE') return index % 3 ? ['皮肤', '肾'] : ['肾'];
  if (disease === 'MS' || disease === 'NMOSD') return ['神经系统'];
  return ['健康对照'];
}

export function samplePlanForDisease(disease: DiseaseType, index: number): SampleType[] {
  if (isLungResistanceDisease(disease)) {
    if ((disease === 'EGFR-TKI耐药' || disease === 'ALK耐药') && index % 2 === 0) return ['血液', '组织', '胸水'];
    return ['血液', '组织'];
  }
  if (disease === 'HC') return ['血液'];
  if (disease === 'MS' || disease === 'NMOSD') return index % 2 ? ['血液', 'CSF'] : ['CSF'];
  if (disease === 'NPSLE') return index % 4 === 0 ? ['血液', 'CSF', '肾'] : ['血液', 'CSF'];
  return index % 3 === 0 ? ['血液', '肾'] : ['血液'];
}

function diseaseActivityFor(disease: DiseaseType) {
  if (isLungResistanceDisease(disease)) return 0;
  if (disease === 'NPSLE') return 12;
  if (disease === 'MS' || disease === 'NMOSD') return 7;
  if (disease === 'Non-NPSLE') return 4;
  return 0;
}

function numericValue(field: string, index: number, fallback: number) {
  const example = Number.parseFloat(crfFieldDefaults[field] ?? '');
  const base = Number.isFinite(example) ? example : fallback;
  return Number((base + ((index % 5) - 2) * 0.07).toFixed(2));
}

function lungResistanceClinicalData(index: number, disease: DiseaseType): Record<string, string | number | null> {
  if (!isLungResistanceDisease(disease)) return {};
  const driverGene: Record<string, string> = {
    NSCLC: 'EGFR exon19del',
    LUAD: 'EGFR L858R',
    LUSC: 'FGFR1 amplification',
    'EGFR-TKI耐药': 'EGFR T790M / C797S',
    ALK耐药: 'ALK G1202R'
  };
  const treatment: Record<string, string> = {
    NSCLC: '含铂双药 + 免疫治疗',
    LUAD: '奥希替尼一线治疗',
    LUSC: '紫杉醇 + 卡铂 + PD-1',
    'EGFR-TKI耐药': '三代 EGFR-TKI 后耐药评估',
    ALK耐药: '二代 ALK-TKI 后耐药评估'
  };
  const resistance: Record<string, string> = {
    NSCLC: '待复核',
    LUAD: 'MET 扩增疑似',
    LUSC: 'PIK3CA 通路激活',
    'EGFR-TKI耐药': 'T790M / C797S 或旁路激活',
    ALK耐药: 'ALK 二级突变或旁路激活'
  };

  return {
    研究编号: lzxkStudyId,
    研究名称: '真实世界肺癌耐药研究',
    病种: disease,
    分期: ['IIIB', 'IVA', 'IVB'][index % 3],
    TNM分期: ['T2N2M0', 'T3N2M1a', 'T4N3M1b'][index % 3],
    ECOG评分: index % 3,
    治疗线数: 1 + (index % 4),
    当前治疗方案: treatment[disease] ?? '待录入',
    驱动基因突变: driverGene[disease] ?? '待录入',
    耐药机制: resistance[disease] ?? '待复核',
    RECIST评估: ['SD', 'PR', 'PD', 'NE'][index % 4],
    'PFS（月）': Number((6.5 + (index % 9) * 1.4).toFixed(1)),
    ctDNA突变丰度: `${Number((0.8 + (index % 7) * 1.3).toFixed(1))}%`,
    ORR评估: ['SD', 'PR', 'PD', 'NE'][index % 4],
    检测项目: 'NGS 520基因 panel + ctDNA 动态监测'
  };
}

function generatedClinicalValue(
  field: string,
  index: number,
  name: string,
  hospitalNo: string,
  sex: '男' | '女' | 'unknown',
  age: number | null,
  disease: DiseaseType,
  organs: string[]
): string | number | null {
  const activity = diseaseActivityFor(disease);
  const [primaryMedication, secondaryMedication, otherMedication] = medicationByDisease[disease] ?? ['待录入', '', ''];
  const numericAge = age ?? 0;

  switch (field) {
    case '姓名':
      return name;
    case '性别':
      return sex;
    case '年龄':
      return age;
    case '身高（cm）':
      return sex === '女' ? 156 + (index % 9) : 166 + (index % 10);
    case '体重（Kg）':
      return sex === '女' ? 48 + (index % 13) : 60 + (index % 15);
    case '病程（发病-使用CD20时）':
      if (disease === 'HC') return 0;
      return isLungResistanceDisease(disease) ? 6 + (index * 2) % 36 : 8 + (index * 3) % 48;
    case '住院号':
      return hospitalNo;
    case '出院诊断':
      return disease;
    case '受累脏器':
      return organs.join('、');
    case 'SLEDAI评分':
      return activity;
    case 'RSLEDAI':
      return Math.max(0, activity - 6);
    case 'LN病理分型（如有）':
      if (isLungResistanceDisease(disease)) return '-';
      return organs.includes('肾') ? ['II', 'III', 'IV', 'V'][index % 4] : '-';
    case 'AI':
      if (isLungResistanceDisease(disease)) return '-';
      return organs.includes('肾') ? 4 + (index % 6) : '-';
    case 'CI':
      if (isLungResistanceDisease(disease)) return '-';
      return organs.includes('肾') ? index % 4 : '-';
    case 'PGA评分':
      return disease === 'HC' ? 0 : Number(((isLungResistanceDisease(disease) ? 1.0 : 0.8) + (index % 5) * 0.3).toFixed(1));
    case 'MP mg/d':
      return disease === 'HC' || isLungResistanceDisease(disease) ? 0 : [10, 20, 40, 80, 240][index % 5];
    case '免疫抑制剂1':
      return primaryMedication;
    case '免疫制剂2':
      return secondaryMedication || '-';
    case '免疫制剂2（第2项）':
      return disease === 'NPSLE' && index % 4 === 0 ? 'CTX' : '-';
    case '其他合并用药':
      return otherMedication || '-';
    case '体温':
      return Number((36.4 + (index % 4) * 0.2).toFixed(1));
    case '神经系统症状':
      return organs.includes('神经系统') ? '有' : '无';
    case '关节肿胀':
    case '关节疼痛':
    case '皮疹':
    case '口腔溃疡':
    case '脱发':
      return disease === 'HC' ? '无' : index % 3 === 0 ? '有' : '无';
    case '其他':
      return disease === 'HC' ? '无' : '疲乏';
    case 'ANA1:80为阳性（1-yes，0-none）':
      return disease === 'HC' || isLungResistanceDisease(disease) ? 0 : 1;
    case '滴度':
      return disease === 'HC' || isLungResistanceDisease(disease) ? '-' : [80, 160, 320, 640][index % 4];
    case '核型':
      return disease === 'HC' || isLungResistanceDisease(disease) ? '-' : ['均质型', '颗粒型', '核仁型'][index % 3];
    case 'ENA1':
      return disease === 'HC' || isLungResistanceDisease(disease) ? '-' : ['Sm', 'SSA', 'Ro-52'][index % 3];
    case 'ENA2':
      return disease === 'HC' || isLungResistanceDisease(disease) ? '-' : ['Ro-52', 'SSB', '0'][index % 3];
    case 'ENA3':
      return disease === 'HC' || isLungResistanceDisease(disease) ? '-' : ['0', 'RNP', ''][index % 3] || '-';
    case '其他阳性抗体':
      return disease === 'HC' || isLungResistanceDisease(disease) ? '-' : index % 2 ? '抗磷脂抗体' : '-';
    case '胸膜炎':
    case '心包炎':
    case '肺动脉高压':
      if (isLungResistanceDisease(disease) && field === '胸膜炎') return organs.includes('胸膜') ? '有' : '无';
      return disease === 'HC' ? '无' : index % 6 === 0 ? '有' : '无';
    case '其他异常结果':
      return disease === 'HC' ? '无' : isLungResistanceDisease(disease) ? '肺部影像与耐药机制待复核' : index % 4 === 0 ? '影像异常待复核' : '无';
    default:
      if (field.includes('DNA')) return disease === 'HC' ? 0 : numericValue(field, index, isLungResistanceDisease(disease) ? 35 : 60);
      if (field.includes('WBC')) return numericValue(field, index, 6.4);
      if (field.includes('HB')) return 105 + (numericAge % 28);
      if (field.includes('PLT')) return 180 + (numericAge % 12) * 18;
      if (field.includes('C3')) return numericValue(field, index, 0.72);
      if (field.includes('C4')) return numericValue(field, index, 0.18);
      if (field.includes('Ig')) return numericValue(field, index, 7.6);
      if (field.includes('尿') || field.includes('Cr') || field.includes('BUN') || field.includes('UA')) return numericValue(field, index, 1.2);
      if (field.includes('CD') || field.includes('淋巴') || field.includes('自然杀伤')) return numericValue(field, index, 12);
      return crfFieldDefaults[field] ?? '已录入';
  }
}

function makeClinicalData(
  completeness: number,
  seed: Record<string, string | number | null>,
  context: {
    index: number;
    name: string;
    hospitalNo: string;
    sex: '男' | '女' | 'unknown';
    age: number | null;
    disease: DiseaseType;
    organs: string[];
  }
) {
  const filledCount = Math.round((clinicalFields.length * completeness) / 100);
  const data: Record<string, string | number | null> = {};

  clinicalFields.slice(0, filledCount).forEach((field) => {
    data[field] =
      seed[field] ??
      generatedClinicalValue(field, context.index, context.name, context.hospitalNo, context.sex, context.age, context.disease, context.organs);
  });

  Object.entries(seed).forEach(([key, value]) => {
    data[key] = value;
  });

  data.CRF版本 = crfTemplateVersion;
  data.数据完整度 = completeness;

  return data;
}

function studyContextForIndex(index: number) {
  if (index >= 50) {
    return {
      studyId: lzxkStudyId,
      diseaseType: lungResistanceDiseases[(index - 50) % lungResistanceDiseases.length],
      crfVersion: 'V1.0'
    };
  }
  return {
    studyId: index < 36 ? 'LGL-1111' : 'RWD-NMO-2026',
    diseaseType: diseases[index % diseases.length],
    crfVersion: crfTemplateVersion
  };
}

function createPatient(index: number): PatientRecord {
  const { studyId, diseaseType, crfVersion } = studyContextForIndex(index);
  const name = patientCode(index);
  const hospitalNo = `${23000000 + index * 137}`;
  const sex = index % 2 === 0 ? '女' : '男';
  const age = 19 + (index * 7) % 48;
  const birthDate = inferBirthDateFromAge(age);
  const organs = organsForDisease(diseaseType, index);
  const completeness = 68 + (index * 7) % 33;
  const sampleTypes = samplePlanForDisease(diseaseType, index);
  const samples = sampleTypes.reduce<SampleCollection[]>((acc, type) => {
    const existing = acc.find((sample) => sample.type === type);
    if (existing) existing.count += 1;
    else acc.push({ type, count: 1 });
    return acc;
  }, []);
  const omicsStatus: OmicsStatus = index % 4 === 0 ? '进行中' : index % 5 === 0 ? '样本采集' : '完成';
  const note = isLungResistanceDisease(diseaseType)
    ? `真实世界肺癌耐药研究随访中，耐药机制与组学检测已生成，完整度 ${completeness}%`
    : diseaseType === 'HC'
      ? '健康对照质控通过'
      : `${diseaseType} 队列随访中，完整度 ${completeness}%`;

  const sharedClinicalSeed = {
    姓名: name,
    性别: sex,
    年龄: age,
    出生日期: birthDate,
    住院号: hospitalNo,
    出院诊断: diseaseType,
    受累脏器: organs.join('、')
  };
  const clinicalData = isLungResistanceDisease(diseaseType)
    ? {
        ...sharedClinicalSeed,
        ...lungResistanceClinicalData(index, diseaseType),
        CRF版本: crfVersion,
        数据完整度: completeness
      }
    : makeClinicalData(
        completeness,
        sharedClinicalSeed,
        { index, name, hospitalNo, sex, age, disease: diseaseType, organs }
      );
  clinicalData.CRF版本 = crfVersion;

  return {
    id: `PAT-${String(index + 1).padStart(3, '0')}`,
    studyId,
    name,
    hospitalNo,
    sex,
    age,
    birthDate,
    diseaseType,
    organs,
    samples,
    omicsStatus,
    note,
    clinicalDataVersion: crfVersion,
    clinicalDataFormat: 'jsonb',
    clinicalData
  };
}

export function calculateClinicalCompleteness(clinicalData: Record<string, string | number | null>) {
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

export const patientRecords: PatientRecord[] = Array.from({ length: 70 }, (_, index) => createPatient(index));

export const cohortStats = [
  { label: '总患者数', value: '70', delta: 'Demo', helper: '本地 seed 患者', icon: 'patients' as const },
  { label: 'NPSLE', value: '10', delta: '20.0%', helper: '占总数 20.0%', icon: 'check' as const },
  { label: 'NMOSD / MS', value: '20', delta: '40.0%', helper: '占总数 40.0%', icon: 'dna' as const },
  { label: '肺癌耐药', value: '20', delta: '28.6%', helper: 'LZXK-01', icon: 'dna' as const },
  { label: '数据完整性', value: '83.7%', delta: 'V0.1', helper: 'SLE CRF V0.1', icon: 'check' as const, progress: 83.7 }
];

export const diseaseDistribution = [
  { label: 'NPSLE', value: 10, percent: '14.3%' },
  { label: 'Non-NPSLE', value: 10, percent: '14.3%' },
  { label: 'NMOSD', value: 10, percent: '14.3%' },
  { label: 'MS', value: 10, percent: '14.3%' },
  { label: 'HC', value: 10, percent: '14.3%' },
  { label: '肺癌耐药', value: 20, percent: '28.6%' }
];

export const sampleSummary = [
  { label: '血液', value: '60', helper: '85.7%' },
  { label: 'CSF', value: '30', helper: '60.0%' },
  { label: '肾', value: '6', helper: '12.0%' },
  { label: '组织', value: '20', helper: '28.6%' },
  { label: '胸水', value: '4', helper: '5.7%' },
  { label: '总样本数', value: '120', helper: '70 名患者' }
];
