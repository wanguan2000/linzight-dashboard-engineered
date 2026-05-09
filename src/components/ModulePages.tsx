import { useEffect, useMemo, useRef, useState } from 'react';
import { quickActions } from '../data/dashboard';
import { clinicalDataGroups, clinicalFields, crfTemplateFieldCount, crfTemplateVersion, systemCrfFields } from '../data/crfTemplate';
import {
  consentRecords,
  formatSampleLibraryId,
  getCompleteness,
  omicsRecords,
  reportRecords,
  samples,
  studyVisitPlans,
  type ConsentRecord,
  type OmicsRecord,
  type ReportRecord,
  type SampleRecord,
  type StudyVisitPlanRecord,
  type VisitRecord
} from '../data/operations';
import type { PatientRecord } from '../data/patientCohort';
import type { UserRole } from '../data/auth';
import {
  createExportJob,
  fetchConsentRecords,
  fetchDemoDataset,
  fetchOmicsRecords,
  fetchSamples,
  filterRecordsByCurrentStudyScope,
  runQualityChecks,
  updateConsentRecord,
  uploadFileToBackend
} from '../services/api';
import type { IconName } from '../types';
import { Icon } from './Icon';
import { PatientListModule } from './PatientCohortPage';
import { PatientJourneyDemoPage } from './PatientJourneyDemoPage';

const consentPageSize = 6;
const sampleLedgerPageSize = 6;
const omicsTestingPageSize = 6;
const systemAccountPageSize = 5;
const systemFieldPageSize = 5;
const consentVersion = 'V1.0';
const consentPreviewPdfUrl = './consent-v1.0.pdf';
const consentStatusOptions: Array<'全部' | ConsentRecord['status']> = ['全部', '待签署', '已签署', '已撤回'];
const consentStatusClass: Record<'全部' | ConsentRecord['status'], string> = {
  全部: 'all',
  待签署: 'pending',
  已签署: 'signed',
  已撤回: 'withdrawn'
};

type ConsentPreviewBlock = {
  title?: string;
  paragraphs?: string[];
  items?: string[];
  variant?: 'default' | 'checklist' | 'fields' | 'choice' | 'documentActions';
};

type ConsentPreviewSection = {
  title: string;
  icon: IconName;
  eyebrow: string;
  blocks: ConsentPreviewBlock[];
};

const consentPreviewContent: ConsentPreviewSection[] = [
  {
    title: '研究项目概述',
    icon: 'file',
    eyebrow: '项目性质与研究目标',
    blocks: [
      {
        paragraphs: [
          '本项目《免疫相关性神经系统疾病的多组学解析及机制探索》是由上海交通大学医学院附属仁济医院主持开展的非干预性临床研究。',
          '研究聚焦于神经精神性系统性红斑狼疮（NPSLE）、多发性硬化（MS）及视神经脊髓炎谱系疾病（NMOSD）等免疫相关性神经系统疾病。',
          '本研究旨在通过多组学技术，包括全基因组测序、TCR/BCR 免疫组库测序、超敏蛋白组学及空间转录组学，解析疾病发病机制，发现具有诊断和预后价值的生物标志物，并实现基于分子机制的疾病精准分型，为未来精准化治疗提供科学依据。',
          '本研究属于纯观察性研究，研究人员不会对受试者的临床诊疗方案作出任何干预或更改。所有研究性检测均在临床诊疗所需样本采集的基础上进行。研究结果仅用于科学研究目的，不直接用于指导个人临床治疗。研究所得数据将经匿名化处理，由仁济医院研究团队进行多组学联合分析。'
        ]
      }
    ]
  },
  {
    title: '样本和信息用途',
    icon: 'lab',
    eyebrow: '研究性检测与样本保存',
    blocks: [
      {
        paragraphs: ['受试者的信息和样本将用于以下研究性检测与分析：'],
        items: [
          '全基因组测序（WGS）：用于检测免疫相关易感基因位点。',
          'TCR/BCR 免疫组库测序：用于分析外周血及脑脊液中 T 细胞和 B 细胞克隆扩增情况。',
          '超敏蛋白组学检测（Olink/Simoa）：用于检测血清及脑脊液中神经损伤标志物，如 NfL、GFAP，炎症因子如 CXCL13，以及自身抗体谱。',
          '空间转录组学分析：适用于有肾穿刺活检组织的 SLE 患者。'
        ]
      },
      {
        paragraphs: [
          '受试者的信息和剩余样本将由仁济医院研究团队长期保存，未来可能用于免疫相关性神经系统疾病机制、诊断标志物及治疗靶点的相关研究。',
          '在样本和信息保存期间，如受试者明确提出样本和/或信息销毁申请，研究团队将按照仁济医院相关规程进行处理。',
          '研究团队可能在研究期间对受试者进行定期随访，采集并更新临床信息，包括疾病活动评分、影像学及认知评估等，以了解疾病进展情况。',
          '研究团队不会对受试者的个人信息和样本进行买卖、基因编辑等违反法律法规、伦理道德和国家利益的活动。'
        ]
      }
    ]
  },
  {
    title: '可能的风险',
    icon: 'alerts',
    eyebrow: '低风险与采样说明',
    blocks: [
      {
        paragraphs: ['参与本研究对受试者的风险极低。'],
        items: [
          '血液样本：研究所需血液采集将与临床诊疗常规抽血同步进行，通常需要额外提供 10-20 ml 血液，可能引起轻微疼痛或淤青，属于常规静脉采血的正常风险范围。',
          '脑脊液样本：适用于临床已决定行腰椎穿刺检查的患者。研究仅使用临床操作中剩余的脑脊液样本，不额外增加穿刺次数，不带来额外风险。',
          '肾穿刺组织：适用于临床已决定行肾穿刺活检的 SLE 患者。研究仅在充分保证病理诊断所需样本后，使用剩余组织，不增加额外创伤。'
        ]
      },
      {
        paragraphs: [
          '所有样本采集均不影响受试者的临床诊疗结果，也不额外增加健康风险。',
          '如发现样本质量不符合研究要求，研究人员会与受试者沟通是否愿意配合重新采集，但受试者有权拒绝。'
        ]
      }
    ]
  },
  {
    title: '预期获益',
    icon: 'check',
    eyebrow: '直接获益与长期价值',
    blocks: [
      {
        paragraphs: [
          '参与本研究不会为受试者提供额外的经济补偿，受试者也不会直接从本研究结果中获得经济利益。',
          '由于本研究属于探索性研究，受试者个人目前极有可能不会因研究结果而获得直接的医疗获益。',
          '但本研究成果未来有望为免疫相关性神经系统疾病患者的精准诊断与治疗提供科学依据。从长远来看，可能使受试者及更多同类疾病患者受益。',
          '研究结果若衍生任何知识产权或商业利益，所有权益将归属仁济医院及相关研究机构，与参与者个人无关。'
        ]
      }
    ]
  },
  {
    title: '技术的局限性',
    icon: 'dna',
    eyebrow: '前沿技术与探索性结论',
    blocks: [
      {
        paragraphs: [
          '本研究采用的多组学技术处于科学前沿，但仍存在一定局限性。',
          '依据现有医学研究水平，部分基因变异、蛋白标志物或免疫克隆特征可能无法被当前技术全面检出，相关发现的临床意义有待进一步验证。',
          '此外，本研究为探索性研究，所得结论属于初步科学发现，尚不能直接转化为临床诊疗建议。'
        ]
      }
    ]
  },
  {
    title: '隐私保护',
    icon: 'lock',
    eyebrow: '匿名化、保密与合规',
    blocks: [
      {
        paragraphs: [
          '仁济医院将在法律规定的范围内严格保护受试者的个人隐私。',
          '受试者的样本和信息将被匿名化编码处理，研究人员无法通过编码直接获得可辨识身份的个人资料。',
          '研究所得数据可能以匿名形式在学术期刊或学术会议上公开发表，但不会公布受试者患者编号或任何可辨识身份的个人资料。',
          '受试者的遗传信息及其他个人健康信息将被严格保密，任何可识别个人身份的信息都不会被擅自转交给其他未授权第三方机构或个人。',
          '数据的存储、传输和使用均遵循国家相关法律法规，包括《中华人民共和国个人信息保护法》及《人类遗传资源管理条例》的相关要求。'
        ]
      }
    ]
  },
  {
    title: '退出研究',
    icon: 'chevronRight',
    eyebrow: '自愿退出与咨询渠道',
    blocks: [
      {
        paragraphs: [
          '受试者有权在任何时候无需说明理由地退出本研究。',
          '退出研究不会影响受试者在仁济医院接受的正常临床诊疗服务。',
          '如果受试者对本研究项目有任何问题或疑虑，可以随时联系临床协调员（CRC）或仁济医院研究团队负责人，研究团队将及时答复相关问题。'
        ]
      }
    ]
  },
  {
    title: '知情同意声明',
    icon: 'shield',
    eyebrow: '声明确认与签署信息',
    blocks: [
      {
        title: '声明确认',
        items: [
          '我已经阅读并理解了本知情同意书的全部内容。',
          '我有机会提问，而且所有问题均已得到解答。',
          '我理解参加本项目完全是自愿的。',
          '我清楚签署以后如还有疑问，可以随时联系仁济医院研究团队的临床协调员或负责人。',
          '我知道签名并不意味可以免去任何费用、应尽责的事项。',
          '我的样本和/或信息在移除可识别个人身份信息后，可能用于免疫相关性神经系统疾病发病机制、诊断标志物及治疗靶点相关研究，并可能在学术期刊或学术会议上发表。'
        ],
        variant: 'checklist'
      },
      {
        title: '选择项',
        items: ['同意', '不同意'],
        variant: 'choice'
      },
      {
        title: '签署信息',
        items: ['打印知情', '上传知情', '查看知情'],
        variant: 'documentActions'
      }
    ]
  }
];

function statusTone(status: string) {
  if (['完成', '已完成', '已签署', '结果回传', '检测完成', '结果归档', '可导出', '通过', 'Active'].includes(status)) return 'success';
  if (['进行中', '检测中', '数据分析', '文库构建', '生成中', '待确认', '待签署'].includes(status)) return 'warning';
  if (['已撤回', '未通过', '失败/重测', '需复核'].includes(status)) return 'danger';
  return 'info';
}

function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill status-pill--${statusTone(value)}`}>{value}</span>;
}

function ConsentSectionPreview({
  section,
  onPrint,
  onUnderstand,
  onUpload
}: {
  section: ConsentPreviewSection;
  onPrint: () => void;
  onUnderstand: () => void;
  onUpload: () => void;
}) {
  const [selectedChoice, setSelectedChoice] = useState('同意');

  return (
    <div className="consent-section-body">
      {section.blocks.map((block, blockIndex) => (
        <article className="consent-section-block" key={`${section.title}-${block.title ?? blockIndex}`}>
          {block.title ? <h4>{block.title}</h4> : null}
          {block.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {block.items && block.variant === 'choice' ? (
            <div className="consent-choice-buttons">
              {block.items.map((item) => (
                <button
                  className={selectedChoice === item ? 'is-selected' : undefined}
                  type="button"
                  key={item}
                  aria-pressed={selectedChoice === item}
                  onClick={() => {
                    setSelectedChoice(item);
                    if (item === '同意') onUnderstand();
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          {block.items && block.variant === 'documentActions' ? (
            <div className="consent-document-actions">
              <button type="button" onClick={onPrint}><Icon name="reports" />打印知情</button>
              <button type="button" onClick={onUpload}><Icon name="filePlus" />上传知情</button>
              <a href={consentPreviewPdfUrl} target="_blank" rel="noreferrer"><Icon name="search" />查看知情</a>
            </div>
          ) : null}
          {block.items && block.variant !== 'choice' && block.variant !== 'documentActions' ? (
            <ul className={`consent-section-list consent-section-list--${block.variant ?? 'default'}`}>
              {block.items.map((item) => (
                <li key={item}>
                  {block.variant === 'checklist' ? <Icon name="check" /> : null}
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ModuleKpi({
  icon,
  label,
  value,
  helper,
  tone = 'blue'
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  value: string;
  helper: string;
  tone?: 'blue' | 'green' | 'orange' | 'purple';
}) {
  return (
    <article className={`module-kpi module-kpi--${tone}`}>
      <div className="module-kpi__icon">
        <Icon name={icon} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}

function MiniTrend({ label = '近30天趋势' }: { label?: string }) {
  return (
    <div className="module-mini-trend" aria-label={label}>
      <svg viewBox="0 0 360 120" preserveAspectRatio="none">
        <line x1="0" y1="24" x2="360" y2="24" />
        <line x1="0" y1="60" x2="360" y2="60" />
        <line x1="0" y1="96" x2="360" y2="96" />
        <path d="M0 86 C36 78 58 88 92 62 C128 36 162 62 204 44 C248 26 278 40 320 26 C340 20 350 18 360 16 L360 120 L0 120Z" />
        <path d="M0 86 C36 78 58 88 92 62 C128 36 162 62 204 44 C248 26 278 40 320 26 C340 20 350 18 360 16" />
      </svg>
      <div className="module-chart-axis"><span>5月1日</span><span>5月15日</span><span>5月29日</span></div>
    </div>
  );
}

function DetailList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="module-detail-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SimpleTimeline({ items }: { items: Array<{ label: string; helper: string; done?: boolean }> }) {
  return (
    <div className="simple-timeline">
      {items.map((item) => (
        <div className={item.done === false ? 'simple-timeline__item is-pending' : 'simple-timeline__item'} key={item.label}>
          <span />
          <div>
            <strong>{item.label}</strong>
            <small>{item.helper}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function patientSamples(patient: PatientRecord, sampleRows: SampleRecord[] = samples) {
  return sampleRows.filter((sample) => sample.patientName === patient.name);
}

function normalizeSampleStatus(status: SampleRecord['status']): '已采集' | '检测中' | '检测完成' {
  if (status === '检测中' || status === '已送检') return '检测中';
  if (status === '结果回传' || status === '检测完成') return '检测完成';
  return '已采集';
}

type OmicsDisplayStatus = '待检测' | '检测中' | '检测完成' | '已归档';
type OmicsDisplayQc = '待检' | '未通过' | '已通过';
type OmicsFilterStatus = '全部' | OmicsDisplayStatus;

type SampleDetectionRow = {
  id: string;
  patientName: string;
  sampleId: string;
  sampleType: string;
  collectedAt: string;
  sentAt: string;
  assay: string;
  status: OmicsDisplayStatus;
  qc: OmicsDisplayQc;
  resultFile: string;
};

type SampleLedgerRow = {
  id: string;
  patientName: string;
  hospitalNo: string;
  sampleId: string;
  sampleType: string;
  collectedAt: string;
  note: string;
};

function normalizeOmicsDisplayStatus(status?: OmicsRecord['status'], sampleStatus?: SampleRecord['status']): OmicsDisplayStatus {
  if (status === '结果归档') return '已归档';
  if (sampleStatus === '结果回传') return '已归档';
  if (sampleStatus === '检测完成') return '检测完成';
  if (status === '测序完成' || status === '数据分析') return '检测完成';
  if (status === '样本接收' || status === '文库构建' || sampleStatus === '检测中' || sampleStatus === '已送检') return '检测中';
  return '待检测';
}

function normalizeOmicsDisplayQc(qc?: OmicsRecord['qc']): OmicsDisplayQc {
  if (qc === '通过') return '已通过';
  if (qc === '未通过') return '未通过';
  return '待检';
}

function buildSampleDetectionRows(sampleRows: SampleRecord[], omicsRows: OmicsRecord[]): SampleDetectionRow[] {
  const rowsFromOmics = omicsRows.map((record) => {
    const sample = sampleRows.find((item) => item.id === record.sampleId);
    const sampleId = sample ? formatSampleLedgerId(sample, sampleRows) : record.sampleId;
    const status = normalizeOmicsDisplayStatus(record.status, sample?.status);

    return {
      id: record.id,
      patientName: record.patientName,
      sampleId,
      sampleType: sample?.sampleType ?? record.sampleType,
      collectedAt: sample?.collectedAt ?? record.sentAt,
      sentAt: record.sentAt,
      assay: record.assay,
      status,
      qc: normalizeOmicsDisplayQc(record.qc),
      resultFile: status === '检测完成' || status === '已归档' ? `${sampleId}-${record.assay}-result.pdf` : '-'
    };
  });

  const omicsSampleIds = new Set(omicsRows.map((record) => record.sampleId));
  const rowsFromSamples = sampleRows
    .filter((sample) => !omicsSampleIds.has(sample.id))
    .flatMap((sample) => {
      const assays = sample.linkedOmics.length ? sample.linkedOmics : ['待指定'];
      const status = normalizeOmicsDisplayStatus(undefined, sample.status);
      const sampleId = formatSampleLedgerId(sample, sampleRows);

      return assays.map((assay, index) => ({
        id: `${sample.id}-${index}`,
        patientName: sample.patientName,
        sampleId,
        sampleType: sample.sampleType,
        collectedAt: sample.collectedAt,
        sentAt: sample.collectedAt,
        assay,
        status,
        qc: '待检' as OmicsDisplayQc,
        resultFile: status === '检测完成' ? `${sampleId}-${assay}-result.pdf` : '-'
      }));
    });

  return [...rowsFromOmics, ...rowsFromSamples].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
}

function formatSampleLedgerId(sample: SampleRecord, sampleRows: SampleRecord[]) {
  const baseId = formatSampleLibraryId(sample);
  const siblingSamples = sampleRows.filter(
    (item) => item.patientName === sample.patientName && item.sampleType === sample.sampleType
  );
  if (siblingSamples.length <= 1) return baseId;

  const siblingIndex = siblingSamples.findIndex((item) => item.id === sample.id);
  return `${baseId}-${String(siblingIndex + 1).padStart(2, '0')}`;
}

function buildSampleLedgerRows(sampleRows: SampleRecord[]): SampleLedgerRow[] {
  return sampleRows
    .map((sample) => ({
      id: sample.id,
      patientName: sample.patientName,
      hospitalNo: sample.hospitalNo,
      sampleId: formatSampleLedgerId(sample, sampleRows),
      sampleType: sample.sampleType,
      collectedAt: sample.collectedAt,
      note: `${sample.visit}；${sample.linkedOmics.length ? `关联 ${sample.linkedOmics.join(' / ')}` : '待指定检测'}`
    }))
    .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
}

const clinicalSectionUpdatedAt = ['2026-04-27', '2026-04-27', '2026-04-26', '2026-04-26', '2026-04-25', '2026-04-25', '2026-04-24', '2026-04-24'];

function formatClinicalValue(value: string | number | undefined) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function buildClinicalSectionsFromPatient(patient: PatientRecord) {
  const consumedFields = new Set<string>();
  const sections = clinicalDataGroups
    .map((group) => {
      const items = group.fields
        .filter((field) => field in patient.clinicalData)
        .map((field) => {
          consumedFields.add(field);
          return [field, formatClinicalValue(patient.clinicalData[field])] as [string, string];
        });
      return { title: group.title, items };
    })
    .filter((section) => section.items.length);

  const otherItems = Object.entries(patient.clinicalData)
    .filter(([field]) => field !== '数据完整度' && !consumedFields.has(field))
    .map(([field, value]) => [field, formatClinicalValue(value)] as [string, string]);

  if (otherItems.length) sections.push({ title: '其他已录入字段', items: otherItems });

  return sections.length ? sections : [{ title: '等待 API 数据', items: [['数据源', '等待 FastAPI / SQLite']] }];
}

const emptyClinicalPatient: PatientRecord = {
  studyId: 'LGL-1111',
  name: '等待 API',
  hospitalNo: '-',
  sex: '男',
  age: 0,
  diseaseType: 'NPSLE',
  organs: [],
  samples: [],
  omicsStatus: '样本采集',
  note: '等待 FastAPI / SQLite',
  clinicalData: {}
};

export function ClinicalDataCapturePage({
  selectedPatient,
  onPatientChange,
  onOpenPatientJourney
}: {
  selectedPatient?: PatientRecord | null;
  onPatientChange?: (patient: PatientRecord) => void;
  onOpenPatientJourney?: (patient: PatientRecord) => void;
}) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [patients, setPatients] = useState<PatientRecord[]>(selectedPatient ? [selectedPatient] : []);
  const [activePatientName, setActivePatientName] = useState(() => selectedPatient?.name ?? '');
  const [visitRows, setVisitRows] = useState<VisitRecord[]>([]);
  const [sampleRows, setSampleRows] = useState<SampleRecord[]>([]);
  const [newVisitEditId, setNewVisitEditId] = useState<string | null>(null);
  const [newSampleEditId, setNewSampleEditId] = useState<string | null>(null);
  const [clinicalFormSections, setClinicalFormSections] = useState(() => buildClinicalSectionsFromPatient(selectedPatient ?? emptyClinicalPatient));
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionBackups, setSectionBackups] = useState<Record<string, Array<[string, string]>>>({});

  useEffect(() => {
    let ignore = false;

    void fetchDemoDataset()
      .then((dataset) => {
        if (ignore) return;
        if (dataset.patients.length) setPatients(dataset.patients);
        setSampleRows(dataset.samples);
        setVisitRows(dataset.visits);
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (selectedPatient) setActivePatientName(selectedPatient.name);
  }, [selectedPatient]);

  useEffect(() => {
    if (!selectedPatient && patients.length && (!activePatientName || !patients.some((record) => record.name === activePatientName))) {
      setActivePatientName(patients[0].name);
    }
  }, [activePatientName, patients, selectedPatient]);

  useEffect(() => {
    pageRef.current?.scrollTo({ top: 0, left: 0 });
    window.requestAnimationFrame(() => pageRef.current?.scrollTo({ top: 0, left: 0 }));
  }, []);

  const patient = patients.find((record) => record.name === activePatientName) ?? selectedPatient ?? patients[0] ?? emptyClinicalPatient;
  const patientVisitRows = useMemo(() => visitRows.filter((record) => record.patientName === patient.name), [patient.name, visitRows]);
  const patientSampleRows = useMemo(() => patientSamples(patient, sampleRows), [patient, sampleRows]);

  useEffect(() => {
    if (patient.id) onPatientChange?.(patient);
  }, [onPatientChange, patient]);

  function selectClinicalPatient(record: PatientRecord) {
    setActivePatientName(record.name);
    onPatientChange?.(record);
  }

  useEffect(() => {
    setClinicalFormSections(buildClinicalSectionsFromPatient(patient));
    setEditingSection(null);
  }, [patient]);

  function startClinicalSectionEdit(sectionTitle: string) {
    const section = clinicalFormSections.find((item) => item.title === sectionTitle);
    if (section) setSectionBackups((backups) => ({ ...backups, [sectionTitle]: section.items.map((item) => [...item] as [string, string]) }));
    setEditingSection(sectionTitle);
  }

  function cancelClinicalSectionEdit(sectionTitle: string) {
    const backup = sectionBackups[sectionTitle];
    if (backup) {
      setClinicalFormSections((sections) =>
        sections.map((section) => (section.title === sectionTitle ? { ...section, items: backup.map((item) => [...item] as [string, string]) } : section))
      );
    }
    setEditingSection(null);
  }

  function updateClinicalField(sectionTitle: string, fieldIndex: number, nextValue: string) {
    setClinicalFormSections((sections) =>
      sections.map((section) => {
        if (section.title !== sectionTitle) return section;

        return {
          ...section,
          items: section.items.map((item, index) => (index === fieldIndex ? [item[0], nextValue] : item))
        };
      })
    );
  }

  function addClinicalField(sectionTitle: string) {
    const section = clinicalFormSections.find((item) => item.title === sectionTitle);
    if (section) setSectionBackups((backups) => ({ ...backups, [sectionTitle]: section.items.map((item) => [...item] as [string, string]) }));
    setClinicalFormSections((sections) =>
      sections.map((section) =>
        section.title === sectionTitle
          ? { ...section, items: [...section.items, [`记录日期${section.items.length + 1}`, '2026-04-28'], [`新增字段${section.items.length + 2}`, '待录入']] }
          : section
      )
    );
    setEditingSection(sectionTitle);
  }

  function addVisitRow() {
    const nextIndex = visitRows.length + 1;
    const id = `V-NEW-${Date.now()}`;
    setVisitRows((rows) => [
      {
        id,
        patientName: patient.name,
        visit: `V${nextIndex} 新建随访`,
        visitDate: '2026-04-28',
        visitType: '随访访视',
        sleDai: '待录入',
        medication: '待录入',
        sampleCollection: '待录入',
        completeness: 0,
        status: '进行中'
      },
      ...rows
    ]);
    setNewVisitEditId(id);
  }

  function addSampleRow() {
    const nextIndex = patientSampleRows.length + 1;
    const id = `SPL-NEW-${Date.now()}`;
    setSampleRows((rows) => [
      {
        id,
        patientName: patient.name,
        hospitalNo: patient.hospitalNo,
        sampleType: '血液',
        visit: `V${nextIndex} 新建采集`,
        collectedAt: '2026-04-28',
        storage: '待入库',
        status: '已采集',
        linkedOmics: ['待选择']
      },
      ...rows
    ]);
    setNewSampleEditId(id);
  }

  return (
    <div className="content workspace-page clinical-capture-page" ref={pageRef}>
      <PatientListModule
        className="clinical-queue-card"
        patients={patients}
        activePatientName={patient.name}
        onViewPatient={selectClinicalPatient}
        onEditPatient={selectClinicalPatient}
      />

      <div className="module-layout module-layout--clinical">
        <div className="module-stack">
          <section className="module-card module-card--wide">
            <header className="module-card__header">
              <h2>患者数据录入</h2>
              <span>SLE CRF {crfTemplateVersion} · {crfTemplateFieldCount} 字段</span>
            </header>
            <div className="clinical-entry-summary">
              <div className="clinical-entry-summary__icon"><Icon name="patients" size={24} /></div>
              <div className="clinical-entry-metrics">
                <div className="clinical-entry-metric clinical-entry-metric--primary">
                  <span>患者ID</span>
                  <strong>{patient.name}</strong>
                </div>
            {[
              ['住院号', patient.hospitalNo],
              ['疾病类型', patient.diseaseType],
              ['已填字段', `${clinicalFields.filter((field) => patient.clinicalData[field] !== undefined && patient.clinicalData[field] !== '').length} / ${clinicalFields.length}`],
              ['完整度', `${getCompleteness(patient)}%`],
              ['存储格式', patient.clinicalDataFormat === 'jsonb' ? 'SQLite JSONB' : 'SQLite JSON'],
              ['最近更新', 'SQLite 实时']
            ].map(([label, value]) => (
                  <div className="clinical-entry-metric" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="clinical-entry-actions">
                <button className="module-link-button" type="button"><Icon name="file" />保存草稿</button>
                <button className="module-primary-button" type="button"><Icon name="check" />提交</button>
                <button className="module-link-button module-link-button--primary" type="button" onClick={() => onOpenPatientJourney?.(patient)}>
                  <Icon name="activity" />患者旅程
                </button>
              </div>
            </div>
            <div className="clinical-section-grid">
              {clinicalFormSections.map((section, index) => {
                const isEditing = editingSection === section.title;

                return (
                <article className="clinical-section" key={section.title}>
                  <header className="clinical-section__header">
                    <div>
                      <h3>{index + 1}. {section.title}</h3>
                      <span>最近更新 {clinicalSectionUpdatedAt[index] ?? '2026-04-27'}</span>
                    </div>
                    <div className="clinical-section__actions">
                      {isEditing ? (
                        <>
                          <button className="module-link-button module-link-button--primary" type="button" onClick={() => setEditingSection(null)}>保存</button>
                          <button className="module-link-button" type="button" onClick={() => cancelClinicalSectionEdit(section.title)}>取消</button>
                        </>
                      ) : (
                        <button className="module-link-button" type="button" onClick={() => startClinicalSectionEdit(section.title)}>编辑</button>
                      )}
                      <button className="module-link-button module-link-button--primary" type="button" onClick={() => addClinicalField(section.title)}>新增</button>
                    </div>
                  </header>
                  <div className="clinical-field-table" role="table" aria-label={`${section.title}字段`}>
                    {section.items.map(([label, value], fieldIndex) => (
                      <div className="clinical-field-row" role="row" key={label}>
                        <span role="cell">{label}</span>
                        {isEditing ? (
                          <input
                            aria-label={`${section.title}-${label}`}
                            role="cell"
                            value={value}
                            onChange={(event) => updateClinicalField(section.title, fieldIndex, event.target.value)}
                          />
                        ) : (
                          <strong role="cell">{value}</strong>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
                );
              })}
            </div>
          </section>

          <section className="module-card">
            <header className="module-card__header">
              <h2>多次随访模块</h2>
              <button className="module-link-button module-link-button--primary" type="button" onClick={addVisitRow}>新建随访</button>
            </header>
            <VisitTable records={patientVisitRows} onChange={(nextRows) => setVisitRows((rows) => [...rows.filter((record) => record.patientName !== patient.name), ...nextRows])} initialEditingId={newVisitEditId} onInitialEditingHandled={() => setNewVisitEditId(null)} />
          </section>

          <section className="module-card">
            <header className="module-card__header">
              <h2>样本采集模块</h2>
              <button className="module-link-button module-link-button--primary" type="button" onClick={addSampleRow}>样本录入</button>
            </header>
            <SampleTable records={patientSampleRows} onChange={(nextRows) => setSampleRows((rows) => [...rows.filter((record) => record.patientName !== patient.name), ...nextRows])} initialEditingId={newSampleEditId} onInitialEditingHandled={() => setNewSampleEditId(null)} compact useLibraryCode />
          </section>
        </div>
      </div>
    </div>
  );
}

const clinicalTablePageSize = 5;

function VisitTable({
  records,
  onChange,
  initialEditingId,
  onInitialEditingHandled
}: {
  records: VisitRecord[];
  onChange?: (records: VisitRecord[]) => void;
  initialEditingId?: string | null;
  onInitialEditingHandled?: () => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBackups, setEditBackups] = useState<Record<string, VisitRecord>>({});
  const sortedRecords = useMemo(() => [...records].sort((a, b) => b.visitDate.localeCompare(a.visitDate)), [records]);
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / clinicalTablePageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * clinicalTablePageSize;
  const pageRecords = sortedRecords.slice(pageStart, pageStart + clinicalTablePageSize);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!initialEditingId) return;
    const target = records.find((record) => record.id === initialEditingId);
    if (!target) return;

    setCurrentPage(1);
    setEditBackups((backups) => ({ ...backups, [target.id]: { ...target } }));
    setEditingId(target.id);
    onInitialEditingHandled?.();
  }, [initialEditingId, onInitialEditingHandled, records]);

  function updateRecord(id: string, patch: Partial<VisitRecord>) {
    onChange?.(records.map((record) => (record.id === id ? { ...record, ...patch } : record)));
  }

  function startEdit(record: VisitRecord) {
    setEditBackups((backups) => ({ ...backups, [record.id]: { ...record } }));
    setEditingId(record.id);
  }

  function cancelEdit(id: string) {
    const backup = editBackups[id];
    if (backup) onChange?.(records.map((record) => (record.id === id ? backup : record)));
    setEditingId(null);
  }

  return (
    <>
      <div className="module-table-wrap">
        <table className="module-table">
          <thead>
            <tr><th>访视</th><th>日期</th><th>类型</th><th>SLEDAI</th><th>用药变化</th><th>样本采集</th><th>完整度</th><th>编辑</th></tr>
          </thead>
          <tbody>
            {pageRecords.map((record) => {
              const isEditing = editingId === record.id;

              return (
                <tr key={record.id}>
                  <td>{isEditing ? <input className="module-table-input" value={record.visit} onChange={(event) => updateRecord(record.id, { visit: event.target.value })} /> : record.visit}</td>
                  <td>{isEditing ? <input className="module-table-input" type="date" value={record.visitDate} onChange={(event) => updateRecord(record.id, { visitDate: event.target.value })} /> : record.visitDate}</td>
                  <td>{isEditing ? <input className="module-table-input" value={record.visitType} onChange={(event) => updateRecord(record.id, { visitType: event.target.value })} /> : record.visitType}</td>
                  <td>{isEditing ? <input className="module-table-input" value={record.sleDai} onChange={(event) => updateRecord(record.id, { sleDai: event.target.value })} /> : record.sleDai}</td>
                  <td>{isEditing ? <input className="module-table-input" value={record.medication} onChange={(event) => updateRecord(record.id, { medication: event.target.value })} /> : record.medication}</td>
                  <td>{isEditing ? <input className="module-table-input" value={record.sampleCollection} onChange={(event) => updateRecord(record.id, { sampleCollection: event.target.value })} /> : record.sampleCollection}</td>
                  <td>{isEditing ? <input className="module-table-input" type="number" value={record.completeness} onChange={(event) => updateRecord(record.id, { completeness: Number(event.target.value) })} /> : record.completeness ? `${record.completeness}%` : '--'}</td>
                  <td>
                    <div className="module-table-actions">
                      {isEditing ? (
                        <>
                          <button className="module-link-button module-link-button--primary" type="button" onClick={() => setEditingId(null)}>保存</button>
                          <button className="module-link-button" type="button" onClick={() => cancelEdit(record.id)}>取消</button>
                        </>
                      ) : (
                        <button className="module-link-button" type="button" onClick={() => startEdit(record)}>编辑</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ClinicalTableFooter page={safePage} total={sortedRecords.length} totalPages={totalPages} onPageChange={setCurrentPage} />
    </>
  );
}

function SampleTable({
  records,
  onChange,
  initialEditingId,
  onInitialEditingHandled,
  compact = false,
  useLibraryCode = false
}: {
  records: SampleRecord[];
  onChange?: (records: SampleRecord[]) => void;
  initialEditingId?: string | null;
  onInitialEditingHandled?: () => void;
  compact?: boolean;
  useLibraryCode?: boolean;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBackups, setEditBackups] = useState<Record<string, SampleRecord>>({});
  const sortedRecords = useMemo(() => [...records].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt)), [records]);
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / clinicalTablePageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * clinicalTablePageSize;
  const pageRecords = sortedRecords.slice(pageStart, pageStart + clinicalTablePageSize);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!initialEditingId) return;
    const target = records.find((record) => record.id === initialEditingId);
    if (!target) return;

    setCurrentPage(1);
    setEditBackups((backups) => ({ ...backups, [target.id]: { ...target } }));
    setEditingId(target.id);
    onInitialEditingHandled?.();
  }, [initialEditingId, onInitialEditingHandled, records]);

  function updateRecord(id: string, patch: Partial<SampleRecord>) {
    onChange?.(records.map((record) => (record.id === id ? { ...record, ...patch } : record)));
  }

  function startEdit(record: SampleRecord) {
    setEditBackups((backups) => ({ ...backups, [record.id]: { ...record } }));
    setEditingId(record.id);
  }

  function cancelEdit(id: string) {
    const backup = editBackups[id];
    if (backup) onChange?.(records.map((record) => (record.id === id ? backup : record)));
    setEditingId(null);
  }

  return (
    <>
      <div className="module-table-wrap">
        <table className="module-table">
          <thead>
            <tr><th>样本编号</th>{!compact && <th>患者编号</th>}<th>样本类型</th><th>采集日期</th><th>检测项目</th><th>状态</th><th>编辑</th></tr>
          </thead>
          <tbody>
            {pageRecords.map((record) => {
              const isEditing = editingId === record.id;

              return (
                <tr key={record.id}>
                  <td>{isEditing ? <input className="module-table-input" value={record.id} onChange={(event) => updateRecord(record.id, { id: event.target.value })} /> : useLibraryCode ? formatSampleLibraryId(record) : record.id}</td>
                  {!compact && <td>{record.patientName}</td>}
                  <td>{isEditing ? <input className="module-table-input" value={record.sampleType} onChange={(event) => updateRecord(record.id, { sampleType: event.target.value })} /> : record.sampleType}</td>
                  <td>{isEditing ? <input className="module-table-input" type="date" value={record.collectedAt} onChange={(event) => updateRecord(record.id, { collectedAt: event.target.value })} /> : record.collectedAt}</td>
                  <td>{isEditing ? <input className="module-table-input" value={record.linkedOmics.join(' / ')} onChange={(event) => updateRecord(record.id, { linkedOmics: event.target.value.split('/').map((item) => item.trim()).filter(Boolean) })} /> : record.linkedOmics.join(' / ')}</td>
                  <td>
                    {isEditing ? (
                      <select className="module-table-input" value={normalizeSampleStatus(record.status)} onChange={(event) => updateRecord(record.id, { status: event.target.value as SampleRecord['status'] })}>
                        <option value="已采集">已采集</option>
                        <option value="检测中">检测中</option>
                        <option value="检测完成">检测完成</option>
                      </select>
                    ) : (
                      <StatusPill value={normalizeSampleStatus(record.status)} />
                    )}
                  </td>
                  <td>
                    <div className="module-table-actions">
                      {isEditing ? (
                        <>
                          <button className="module-link-button module-link-button--primary" type="button" onClick={() => setEditingId(null)}>保存</button>
                          <button className="module-link-button" type="button" onClick={() => cancelEdit(record.id)}>取消</button>
                        </>
                      ) : (
                        <button className="module-link-button" type="button" onClick={() => startEdit(record)}>编辑</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ClinicalTableFooter page={safePage} total={sortedRecords.length} totalPages={totalPages} onPageChange={setCurrentPage} />
    </>
  );
}

function ClinicalTableFooter({
  page,
  total,
  totalPages,
  onPageChange
}: {
  page: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * clinicalTablePageSize + 1;
  const end = Math.min(page * clinicalTablePageSize, total);

  return (
    <footer className="module-table-footer">
      <span>显示 {start} 至 {end} 条，共 {total} 条记录</span>
      <div className="module-pagination">
        <button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)}>‹</button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <button className={pageNumber === page ? 'is-active' : undefined} type="button" key={pageNumber} onClick={() => onPageChange(pageNumber)}>{pageNumber}</button>
        ))}
        <button type="button" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>下一页</button>
      </div>
    </footer>
  );
}

function OmicsTable({ records }: { records: SampleDetectionRow[] }) {
  const patientRowSpans = records.map((row, index) => {
    if (index > 0 && records[index - 1].patientName === row.patientName) return 0;
    let count = 1;
    while (records[index + count]?.patientName === row.patientName) count += 1;
    return count;
  });
  const sampleRowSpans = records.map((row, index) => {
    if (
      index > 0 &&
      records[index - 1].patientName === row.patientName &&
      records[index - 1].sampleId === row.sampleId
    ) return 0;
    let count = 1;
    while (
      records[index + count]?.patientName === row.patientName &&
      records[index + count]?.sampleId === row.sampleId
    ) count += 1;
    return count;
  });

  return (
    <div className="module-table-wrap">
      <table className="module-table module-table--omics">
        <thead>
          <tr>
            <th>患者编号</th>
            <th>样本编号</th>
            <th>样本类型</th>
            <th>检测项目</th>
            <th>当前状态</th>
            <th>送检测时间</th>
            <th>QC</th>
            <th>结果文件</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={record.id}>
              {patientRowSpans[index] > 0 && <td rowSpan={patientRowSpans[index]}>{record.patientName}</td>}
              {sampleRowSpans[index] > 0 && <td rowSpan={sampleRowSpans[index]}>{record.sampleId}</td>}
              <td>{record.sampleType}</td>
              <td>{record.assay}</td>
              <td><StatusPill value={record.status} /></td>
              <td>{record.sentAt}</td>
              <td><StatusPill value={record.qc} /></td>
              <td>{record.resultFile}</td>
              <td>
                <div className="module-table-actions">
                  <button className="module-link-button module-link-button--primary" type="button">查看</button>
                  <button className="module-link-button" type="button">编辑</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SampleLedgerTable({ rows }: { rows: SampleLedgerRow[] }) {
  return (
    <div className="module-table-wrap">
      <table className="module-table module-table--sample-ledger">
        <thead>
          <tr>
            <th>患者编号</th>
            <th>住院号</th>
            <th>样本编号</th>
            <th>样本类型</th>
            <th>采集日期</th>
            <th>注释</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.patientName}</td>
              <td>{row.hospitalNo}</td>
              <td>{row.sampleId}</td>
              <td>{row.sampleType}</td>
              <td>{row.collectedAt}</td>
              <td>{row.note}</td>
              <td>
                <div className="module-table-actions">
                  <button className="module-link-button" type="button">编辑</button>
                  <button className="module-link-button module-link-button--primary" type="button">查看</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModuleTableFooter({
  page,
  total,
  pageSize,
  onPageChange
}: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <footer className="module-table-footer">
      <span>显示 {start} 至 {end} 条，共 {total} 条记录</span>
      <div className="module-pagination">
        <button type="button" disabled={safePage === 1} onClick={() => onPageChange(safePage - 1)}>‹</button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <button className={pageNumber === safePage ? 'is-active' : undefined} type="button" key={pageNumber} onClick={() => onPageChange(pageNumber)}>{pageNumber}</button>
        ))}
        <button type="button" disabled={safePage === totalPages} onClick={() => onPageChange(safePage + 1)}>下一页</button>
      </div>
    </footer>
  );
}

function SampleTestingStatTiles({
  items
}: {
  items: Array<{ label: string; value: string | number; helper?: string; icon: IconName }>;
}) {
  return (
    <div className="sample-testing-stat-grid">
      {items.map((item) => (
        <div className="sample-testing-stat" key={item.label}>
          <span className="sample-testing-stat__icon"><Icon name={item.icon} /></span>
          <div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.helper && <small>{item.helper}</small>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConsentManagementPage() {
  const initialConsentRecords = filterRecordsByCurrentStudyScope(consentRecords);
  const [selected, setSelected] = useState<ConsentRecord>(initialConsentRecords[0] ?? consentRecords[0]);
  const [baseRecords, setBaseRecords] = useState<ConsentRecord[]>(initialConsentRecords);
  const [recordOverrides, setRecordOverrides] = useState<Record<string, Partial<ConsentRecord>>>({});
  const [understoodRecords, setUnderstoodRecords] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'全部' | ConsentRecord['status']>('全部');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeConsentSection, setActiveConsentSection] = useState(0);
  const records = useMemo(() => {
    return baseRecords.map((record) => ({ ...record, ...recordOverrides[record.id] }));
  }, [baseRecords, recordOverrides]);
  const selectedRecord = records.find((record) => record.id === selected.id) ?? records[0] ?? consentRecords[0];
  const statusCounts = useMemo(() => {
    return records.reduce<Record<'全部' | ConsentRecord['status'], number>>(
      (acc, record) => {
        acc.全部 += 1;
        acc[record.status] += 1;
        return acc;
      },
      { 全部: 0, 待签署: 0, 已签署: 0, 已撤回: 0 }
    );
  }, [records]);
  const currentConsentSection = consentPreviewContent[activeConsentSection];
  const selectedUnderstood = understoodRecords[selectedRecord.id] || selectedRecord.status !== '待签署';
  const flowStepIndex = selectedRecord.status === '已签署' ? 3 : selectedRecord.status === '已撤回' ? 1 : selectedUnderstood ? 1 : 0;
  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return records
      .filter((record) => statusFilter === '全部' || record.status === statusFilter)
      .filter((record) => {
        if (!normalized) return true;
        return [record.patientName, record.hospitalNo, record.diseaseType, record.status]
          .some((value) => value.toLowerCase().includes(normalized));
      });
  }, [query, records, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / consentPageSize));
  const pageStart = (currentPage - 1) * consentPageSize;
  const paginatedRecords = filteredRecords.slice(pageStart, pageStart + consentPageSize);
  const displayStart = filteredRecords.length ? pageStart + 1 : 0;
  const displayEnd = Math.min(pageStart + consentPageSize, filteredRecords.length);

  const printConsentPdf = () => {
    setUnderstoodRecords((current) => ({ ...current, [selectedRecord.id]: true }));
    const printFrame = document.createElement('iframe');
    printFrame.src = consentPreviewPdfUrl;
    printFrame.title = '打印知情同意书';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.onload = () => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => printFrame.remove(), 1000);
    };
    document.body.appendChild(printFrame);
  };

  const markUploaded = (record: ConsentRecord) => {
    const nextRecord = { ...record, status: '已签署' as const, signedAt: new Date().toISOString().slice(0, 10), method: '电子' as const };
    setRecordOverrides((current) => ({
      ...current,
      [record.id]: {
        status: nextRecord.status,
        signedAt: nextRecord.signedAt,
        method: nextRecord.method
      }
    }));
    setUnderstoodRecords((current) => ({ ...current, [record.id]: true }));
    setSelected(nextRecord);
    void updateConsentRecord(record.id, {
      status: nextRecord.status,
      signedAt: nextRecord.signedAt,
      method: nextRecord.method
    }).catch(() => undefined);
  };

  const markSelectedUnderstood = () => {
    setUnderstoodRecords((current) => ({ ...current, [selectedRecord.id]: true }));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter]);

  useEffect(() => {
    let ignore = false;

    void fetchConsentRecords()
      .then((nextRecords) => {
        if (ignore || !nextRecords.length) return;
        setBaseRecords(nextRecords);
        setRecordOverrides({});
        setSelected(nextRecords[0]);
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="content workspace-page">
      <section className="module-card consent-workbench">
        <header className="consent-workbench__header">
          <div>
            <h2><Icon name="file" />知情同意</h2>
            <div className="consent-workbench__badges">
              <span>当前版本 <strong>{consentVersion}</strong></span>
              <span className="consent-workbench__badge--patient"><Icon name="patients" />当前患者 <strong>{selectedRecord.patientName}</strong></span>
              <span className="consent-workbench__badge--hospital"><Icon name="building" />住院号 <strong>{selectedRecord.hospitalNo}</strong></span>
              <span><Icon name="calendar" />最近更新 <strong>2026-04-23</strong></span>
              <span className="is-success"><Icon name="shield" />伦理批准</span>
            </div>
          </div>
          <button className="consent-study-link" type="button">
            <Icon name="building" />
            免疫相关性神经系统疾病多组学解析及机制探索
            <Icon name="chevronRight" />
          </button>
        </header>

        <div className="consent-workbench__main">
          <nav className="consent-preview__nav" aria-label="知情同意书章节">
            <h3><Icon name="file" />知情同意内容</h3>
            {consentPreviewContent.map((section, index) => (
              <button
                className={index === activeConsentSection ? 'is-active' : undefined}
                type="button"
                key={section.title}
                aria-pressed={index === activeConsentSection}
                onClick={() => setActiveConsentSection(index)}
              >
                <Icon name={section.icon} />
                {section.title}
              </button>
            ))}
          </nav>

          <div className="consent-overview">
            <section className="consent-overview__content">
              <header>
                <Icon name={currentConsentSection.icon} />
                <div>
                  <span>{currentConsentSection.eyebrow}</span>
                  <h3>{currentConsentSection.title}</h3>
                </div>
              </header>
              <ConsentSectionPreview
                section={currentConsentSection}
                onPrint={printConsentPdf}
                onUnderstand={markSelectedUnderstood}
                onUpload={() => markUploaded(selectedRecord)}
              />
            </section>

            <aside className="consent-visual-panel">
              <div className="consent-pdf-preview">
                <iframe src={`${consentPreviewPdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} title="知情同意书 V1.0 PDF 预览" />
              </div>
              <button className="consent-print-button" type="button" onClick={printConsentPdf}><Icon name="reports" />预览打印</button>
            </aside>
          </div>
        </div>

        <section className="consent-flow">
          <h3>知情同意流程</h3>
          {[
            ['1', '阅读知情同意书', '了解研究目的与内容'],
            ['2', '确认理解', '确认已充分理解'],
            ['3', '签署', '完成签署流程'],
            ['4', '归档', '电子归档与留痕']
          ].map(([step, label, helper], index) => (
            <div className={`${index <= flowStepIndex ? 'is-complete' : ''} ${index === flowStepIndex ? 'is-active' : ''}`} key={step}>
              <strong>{step}</strong>
              <span>{label}</span>
              <small>{helper}</small>
            </div>
          ))}
        </section>
      </section>

      <section className="module-card module-card--wide">
          <header className="module-card__header">
            <h2>患者知情同意列表</h2>
            <div className="workspace-search workspace-search--compact">
              <Icon name="search" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索患者编号或住院号" />
            </div>
          </header>
          <div className="workspace-filter-row">
            {consentStatusOptions.map((item) => (
              <button
                className={`consent-status-chip consent-status-chip--${consentStatusClass[item]}${statusFilter === item ? ' is-selected' : ''}`}
                type="button"
                key={item}
                onClick={() => setStatusFilter(item)}
              >
                <span>{item}</span>
                <strong>{statusCounts[item]}</strong>
              </button>
            ))}
          </div>
          <div className="module-table-wrap">
            <table className="module-table">
              <thead><tr><th>患者编号</th><th>住院号</th><th>疾病类型</th><th>当前状态</th><th>签署日期</th><th>版本</th><th>操作</th></tr></thead>
              <tbody>
                {paginatedRecords.map((record) => (
                  <tr className={selectedRecord.id === record.id ? 'is-selected' : undefined} key={record.id} onClick={() => setSelected(record)}>
                    <td>{record.patientName}</td><td>{record.hospitalNo}</td><td>{record.diseaseType}</td><td><StatusPill value={record.status} /></td>
                    <td>{record.signedAt}</td><td>{record.version}</td>
                    <td>
                      <div className="module-table-actions">
                        {record.status === '待签署' ? (
                          <>
                            <button className="module-link-button module-link-button--primary" type="button" onClick={(event) => event.stopPropagation()}>签署</button>
                            <button className="module-link-button" type="button" onClick={(event) => { event.stopPropagation(); markUploaded(record); }}>上传</button>
                          </>
                        ) : null}
                        {record.status === '已签署' ? (
                          <>
                            <button className="module-link-button" type="button" onClick={(event) => event.stopPropagation()}>查看</button>
                            <button className="module-link-button module-link-button--danger" type="button" onClick={(event) => event.stopPropagation()}>撤回</button>
                          </>
                        ) : null}
                        {record.status === '已撤回' ? (
                          <>
                            <button className="module-link-button" type="button" onClick={(event) => event.stopPropagation()}>查看</button>
                            <button className="module-link-button module-link-button--primary" type="button" onClick={(event) => event.stopPropagation()}>重签</button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="module-table-footer">
            <span>显示 {displayStart} 至 {displayEnd} 条，共 {filteredRecords.length} 条记录</span>
            <div className="module-pagination">
              <button
                type="button"
                aria-label="上一页"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, index) => {
                const page = index + 1;
                return (
                  <button
                    className={currentPage === page ? 'is-active' : undefined}
                    type="button"
                    key={page}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                下一页
              </button>
            </div>
          </footer>
      </section>
    </div>
  );
}

export function SampleManagementPage() {
  const [sampleRows, setSampleRows] = useState(filterRecordsByCurrentStudyScope(samples));
  const sampleTypeCounts = useMemo(() => {
    return sampleRows.reduce<Record<string, number>>((acc, sample) => {
      acc[sample.sampleType] = (acc[sample.sampleType] ?? 0) + 1;
      return acc;
    }, {});
  }, [sampleRows]);

  useEffect(() => {
    let ignore = false;

    void fetchSamples()
      .then((records) => {
        if (!ignore && records.length) setSampleRows(records);
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="content workspace-page">
      <section className="module-kpis">
        <ModuleKpi icon="blood" label="血液样本" value={`${sampleTypeCounts.血液 ?? 0}`} helper="来自样本台账" />
        <ModuleKpi icon="csf" label="CSF 样本" value={`${sampleTypeCounts.CSF ?? 0}`} helper="来自样本台账" tone="green" />
        <ModuleKpi icon="kidney" label="肾组织样本" value={`${sampleTypeCounts.肾 ?? 0}`} helper="来自样本台账" tone="purple" />
        <ModuleKpi icon="sampleBank" label="总样本数" value={`${sampleRows.length}`} helper="FastAPI / SQLite" tone="orange" />
      </section>

      <div className="module-layout">
        <section className="module-card module-card--wide">
          <header className="module-card__header">
            <h2>样本台账</h2>
            <button className="module-primary-button" type="button"><Icon name="filePlus" />新增样本</button>
          </header>
          <SampleTable records={sampleRows} />
        </section>
        <aside className="module-stack">
          <section className="module-card">
            <header className="module-card__header"><h2>样本处理流程</h2></header>
            <SimpleTimeline items={[
              { label: '采集登记', helper: '12 个样本完成' },
              { label: '离心 / 分装', helper: '10 个样本完成' },
              { label: '入库定位', helper: 'A1-A4 / C1-C4' },
              { label: '送检交接', helper: '9 个样本已送检' }
            ]} />
          </section>
          <section className="module-card">
            <header className="module-card__header"><h2>存储分布</h2></header>
            <DetailList rows={[['-80℃冰箱A', '4 份'], ['-80℃冰箱B', '4 份'], ['液氮罐C', '4 份'], ['病理库R', '1 份']]} />
          </section>
          <section className="module-card">
            <header className="module-card__header"><h2>采集完成率趋势</h2><span>本月</span></header>
            <MiniTrend label="样本采集完成率趋势" />
          </section>
        </aside>
      </div>
    </div>
  );
}

export function OmicsTestingPage() {
  const initialOmicsRecords = filterRecordsByCurrentStudyScope(omicsRecords);
  const [records, setRecords] = useState(initialOmicsRecords);
  const [selected, setSelected] = useState<OmicsRecord>(initialOmicsRecords[0] ?? omicsRecords[0]);
  const completed = records.filter((record) => record.status === '结果归档').length;

  useEffect(() => {
    let ignore = false;

    void fetchOmicsRecords()
      .then((nextRecords) => {
        if (!ignore && nextRecords.length) {
          setRecords(nextRecords);
          setSelected(nextRecords[0]);
        }
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="content workspace-page">
      <section className="module-kpis">
        <ModuleKpi icon="dna" label="送检样本" value={`${records.length}`} helper="FastAPI / SQLite" />
        <ModuleKpi icon="clock" label="检测进行中" value={`${records.length - completed}`} helper="待归档检测" tone="orange" />
        <ModuleKpi icon="check" label="已完成检测" value={`${completed}`} helper="本 Demo 已归档" tone="green" />
        <ModuleKpi icon="shield" label="QC 通过率" value="94.6%" helper="较上月 ↑ 3.1%" tone="purple" />
      </section>

      <div className="module-layout">
        <section className="module-card module-card--wide">
          <header className="module-card__header">
            <h2>多组学检测列表</h2>
            <div className="workspace-filter-row">
              {['全部', '进行中', '已完成', '失败/重测', 'WGS', 'TCR/BCR', 'Olink/Simoa', '空间转录组'].map((item) => <button className="chip" type="button" key={item}>{item}</button>)}
            </div>
          </header>
          <div className="module-table-wrap">
            <table className="module-table">
              <thead><tr><th>检测编号</th><th>样本编号</th><th>患者编号</th><th>样本类型</th><th>检测项目</th><th>平台</th><th>当前状态</th><th>QC</th><th>操作</th></tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} onClick={() => setSelected(record)}>
                    <td>{record.id}</td><td>{record.sampleId}</td><td>{record.patientName}</td><td>{record.sampleType}</td><td>{record.assay}</td><td>{record.platform}</td>
                    <td><StatusPill value={record.status} /></td><td><StatusPill value={record.qc} /></td><td><button className="module-link-button" type="button">文件</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="module-stack">
          <section className="module-card">
            <header className="module-card__header"><h2>当前样本检测详情</h2></header>
            <DetailList rows={[
              ['检测编号', selected.id],
              ['患者编号', selected.patientName],
              ['样本编号', selected.sampleId],
              ['样本类型', selected.sampleType],
              ['检测项目', selected.assay],
              ['平台', selected.platform],
              ['批次/Run ID', selected.runId],
              ['送检日期', selected.sentAt],
              ['完成日期', selected.completedAt]
            ]} />
          </section>
          <section className="module-card">
            <header className="module-card__header"><h2>检测流程与时间线</h2></header>
            <SimpleTimeline items={[
              { label: '样本接收', helper: `${selected.sentAt} 09:10` },
              { label: '文库构建', helper: '2026-04-21 11:05' },
              { label: '上机测序', helper: '2026-04-22 08:40' },
              { label: '结果归档', helper: selected.completedAt === '-' ? '待完成' : `${selected.completedAt} 10:15`, done: selected.completedAt !== '-' }
            ]} />
          </section>
        </aside>
      </div>

      <section className="module-card">
        <header className="module-card__header">
          <h2>检测结果概览</h2>
          <span>研究用途，不直接用于临床决策</span>
        </header>
        <div className="result-overview">
          <div>
            <strong>结果摘要</strong>
            <p>检测到免疫相关候选变异位点，建议结合临床表型与其他组学联合解读。</p>
            <p>可关联 TCR/BCR、Olink/Simoa、空间转录组结果做多维分析。</p>
          </div>
          <div className="dna-visual"><Icon name="dna" size={96} /></div>
          <div className="result-tags">
            {['WGS', 'TCR/BCR', '蛋白组学', '空间转录组'].map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
      </section>
    </div>
  );
}

export function SampleTestingPage() {
  const [sampleRows, setSampleRows] = useState(filterRecordsByCurrentStudyScope(samples));
  const [records, setRecords] = useState(filterRecordsByCurrentStudyScope(omicsRecords));
  const [samplePatientQuery, setSamplePatientQuery] = useState('');
  const [sampleIdQuery, setSampleIdQuery] = useState('');
  const [sampleTypeFilter, setSampleTypeFilter] = useState('全部');
  const [sampleDateFrom, setSampleDateFrom] = useState('');
  const [sampleDateTo, setSampleDateTo] = useState('');
  const [sampleLedgerPage, setSampleLedgerPage] = useState(1);
  const [omicsStatusFilter, setOmicsStatusFilter] = useState<OmicsFilterStatus>('全部');
  const [omicsAssayFilter, setOmicsAssayFilter] = useState('全部');
  const [omicsPatientQuery, setOmicsPatientQuery] = useState('');
  const [omicsSampleQuery, setOmicsSampleQuery] = useState('');
  const [omicsPage, setOmicsPage] = useState(1);
  const [uploadStatus, setUploadStatus] = useState('未上传文件');
  const detectionRows = useMemo(() => buildSampleDetectionRows(sampleRows, records), [sampleRows, records]);
  const sampleLedgerRows = useMemo(() => buildSampleLedgerRows(sampleRows), [sampleRows]);
  const sampleTypeOptions = useMemo(() => ['全部', ...Array.from(new Set(sampleLedgerRows.map((row) => row.sampleType)))], [sampleLedgerRows]);
  const filteredSampleLedgerRows = useMemo(() => {
    const patientQuery = samplePatientQuery.trim().toLowerCase();
    const idQuery = sampleIdQuery.trim().toLowerCase();

    return sampleLedgerRows.filter((row) => {
      if (patientQuery && !row.patientName.toLowerCase().includes(patientQuery)) return false;
      if (idQuery && !row.sampleId.toLowerCase().includes(idQuery)) return false;
      if (sampleTypeFilter !== '全部' && row.sampleType !== sampleTypeFilter) return false;
      if (sampleDateFrom && row.collectedAt < sampleDateFrom) return false;
      if (sampleDateTo && row.collectedAt > sampleDateTo) return false;
      return true;
    });
  }, [sampleDateFrom, sampleDateTo, sampleIdQuery, sampleLedgerRows, samplePatientQuery, sampleTypeFilter]);
  const sampleLedgerTotalPages = Math.max(1, Math.ceil(filteredSampleLedgerRows.length / sampleLedgerPageSize));
  const safeSampleLedgerPage = Math.min(sampleLedgerPage, sampleLedgerTotalPages);
  const pagedSampleLedgerRows = filteredSampleLedgerRows.slice(
    (safeSampleLedgerPage - 1) * sampleLedgerPageSize,
    safeSampleLedgerPage * sampleLedgerPageSize
  );
  const sortedDetectionRows = useMemo(() => {
    return [...detectionRows].sort((a, b) =>
      a.patientName.localeCompare(b.patientName) ||
      a.sampleId.localeCompare(b.sampleId) ||
      a.assay.localeCompare(b.assay)
    );
  }, [detectionRows]);
  const filteredDetectionRows = useMemo(() => {
    const patientQuery = omicsPatientQuery.trim().toLowerCase();
    const sampleQuery = omicsSampleQuery.trim().toLowerCase();

    return sortedDetectionRows.filter((row) => {
      if (omicsStatusFilter !== '全部' && row.status !== omicsStatusFilter) return false;
      if (omicsAssayFilter !== '全部' && row.assay !== omicsAssayFilter) return false;
      if (patientQuery && !row.patientName.toLowerCase().includes(patientQuery)) return false;
      if (sampleQuery && !row.sampleId.toLowerCase().includes(sampleQuery)) return false;
      return true;
    });
  }, [omicsAssayFilter, omicsPatientQuery, omicsSampleQuery, omicsStatusFilter, sortedDetectionRows]);
  const omicsTotalPages = Math.max(1, Math.ceil(filteredDetectionRows.length / omicsTestingPageSize));
  const safeOmicsPage = Math.min(omicsPage, omicsTotalPages);
  const pagedDetectionRows = filteredDetectionRows.slice(
    (safeOmicsPage - 1) * omicsTestingPageSize,
    safeOmicsPage * omicsTestingPageSize
  );
  const completed = detectionRows.filter((row) => row.status === '检测完成').length;
  const running = detectionRows.filter((row) => row.status === '检测中').length;
  const archived = detectionRows.filter((row) => row.status === '已归档').length;
  const sampleStatItems = useMemo(() => {
    const blood = sampleRows.filter((sample) => sample.sampleType === '血液').length;
    const csf = sampleRows.filter((sample) => sample.sampleType === 'CSF').length;
    const kidney = sampleRows.filter((sample) => sample.sampleType.includes('肾')).length;

    return [
      { label: '已采集样本数', value: sampleRows.length, icon: 'sampleBank' as IconName },
      { label: '血液', value: blood, icon: 'sampleTube' as IconName },
      { label: 'CSF', value: csf, icon: 'lab' as IconName },
      { label: '肾', value: kidney, icon: 'database' as IconName }
    ];
  }, [sampleRows]);
  const omicsStatItems = useMemo(() => {
    const completedOrArchived = detectionRows.filter((row) => row.status === '检测完成' || row.status === '已归档').length;
    const rnaSeq = detectionRows.filter((row) => row.assay === 'RNA-seq').length;
    const tcrBcr = detectionRows.filter((row) => row.assay === 'TCR/BCR').length;
    const csfRna = detectionRows.filter((row) => row.sampleType === 'CSF' && row.assay === 'RNA-seq').length;
    const scrnaSeq = detectionRows.filter((row) => row.assay === 'scRNA-seq').length;

    return [
      { label: '检测中', value: running, icon: 'clock' as IconName },
      { label: '检测完成', value: completedOrArchived, icon: 'check' as IconName },
      { label: 'RNA-seq', value: rnaSeq, icon: 'dna' as IconName },
      { label: 'TCR/BCR', value: tcrBcr, icon: 'shield' as IconName },
      { label: 'CSF/RNA', value: csfRna, icon: 'lab' as IconName },
      { label: 'scRNA-seq', value: scrnaSeq, icon: 'sampleTube' as IconName }
    ];
  }, [detectionRows, running]);
  const omicsStatusOptions: OmicsFilterStatus[] = ['全部', '待检测', '检测中', '检测完成', '已归档'];
  const omicsAssayOptions = ['WGS', 'TCR/BCR', 'Olink/Simoa', 'scRNA-seq'];

  useEffect(() => {
    let ignore = false;

    void Promise.all([fetchSamples(), fetchOmicsRecords()])
      .then(([nextSamples, nextRecords]) => {
        if (ignore) return;
        if (nextSamples.length) setSampleRows(nextSamples);
        if (nextRecords.length) setRecords(nextRecords);
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setSampleLedgerPage(1);
  }, [sampleDateFrom, sampleDateTo, sampleIdQuery, samplePatientQuery, sampleTypeFilter]);

  useEffect(() => {
    setOmicsPage(1);
  }, [omicsAssayFilter, omicsPatientQuery, omicsSampleQuery, omicsStatusFilter]);

  async function handleResultFileUpload(file: globalThis.File) {
    const linkedSample = sampleRows[0];
    setUploadStatus('上传中...');
    try {
      const uploaded = await uploadFileToBackend(file, {
        category: 'omics_result',
        patientId: linkedSample?.patientId,
        sampleId: linkedSample?.id,
        isDeidentified: true
      });
      setUploadStatus(`已上传 ${uploaded.original_filename}，去标识化已确认`);
    } catch {
      setUploadStatus('上传失败：请确认已登录且后端 API 可用');
    }
  }

  return (
    <div className="content workspace-page">
      <section className="module-kpis">
        <ModuleKpi icon="sampleTube" label="总样本数" value={`${sampleRows.length}`} helper="样本台账" />
        <ModuleKpi icon="dna" label="检测项目" value={`${detectionRows.length}`} helper="按项目展开" tone="purple" />
        <ModuleKpi icon="clock" label="检测中" value={`${running}`} helper="待完成检测" tone="orange" />
        <ModuleKpi icon="check" label="检测完成" value={`${completed + archived}`} helper="含结果文件" tone="green" />
      </section>

      <section className="module-card module-card--wide">
        <header className="module-card__header">
          <div>
            <h2>样本台账</h2>
            <span>按患者、样本和采集日期维护样本登记</span>
          </div>
          <button className="module-primary-button" type="button"><Icon name="filePlus" />新增样本</button>
        </header>
        <SampleTestingStatTiles items={sampleStatItems} />
        <div className="sample-testing-filter-bar">
          <label>
            <span>患者编号</span>
            <input value={samplePatientQuery} onChange={(event) => setSamplePatientQuery(event.target.value)} placeholder="搜索患者编号" />
          </label>
          <label>
            <span>样本编号</span>
            <input value={sampleIdQuery} onChange={(event) => setSampleIdQuery(event.target.value)} placeholder="搜索样本编号" />
          </label>
          <label>
            <span>样本类型</span>
            <select value={sampleTypeFilter} onChange={(event) => setSampleTypeFilter(event.target.value)}>
              {sampleTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>采集开始</span>
            <input type="date" value={sampleDateFrom} onChange={(event) => setSampleDateFrom(event.target.value)} />
          </label>
          <label>
            <span>采集结束</span>
            <input type="date" value={sampleDateTo} onChange={(event) => setSampleDateTo(event.target.value)} />
          </label>
        </div>
        <SampleLedgerTable rows={pagedSampleLedgerRows} />
        <ModuleTableFooter page={safeSampleLedgerPage} total={filteredSampleLedgerRows.length} pageSize={sampleLedgerPageSize} onPageChange={setSampleLedgerPage} />
      </section>

      <section className="module-card module-card--wide">
        <header className="module-card__header">
          <div>
            <h2>多组学检测列表</h2>
            <span>按检测项目追踪平台、批次、QC 和结果归档</span>
          </div>
          <div className="module-header-actions">
            <label className="module-file-button">
              <Icon name="filePlus" />
              上传结果
              <input
                type="file"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void handleResultFileUpload(file);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <button className="module-primary-button" type="button"><Icon name="filePlus" />新增检测</button>
          </div>
        </header>
        <div className="module-upload-status">
          <Icon name="shield" />
          <span>{uploadStatus}</span>
        </div>
        <SampleTestingStatTiles items={omicsStatItems} />
        <div className="sample-testing-filter-bar sample-testing-filter-bar--omics">
          <label>
            <span>患者编号</span>
            <input value={omicsPatientQuery} onChange={(event) => setOmicsPatientQuery(event.target.value)} placeholder="搜索患者编号" />
          </label>
          <label>
            <span>样本编号</span>
            <input value={omicsSampleQuery} onChange={(event) => setOmicsSampleQuery(event.target.value)} placeholder="搜索样本编号" />
          </label>
          <div className="workspace-filter-row">
            {omicsStatusOptions.map((item) => (
              <button
                className={omicsStatusFilter === item && omicsAssayFilter === '全部' ? 'chip is-selected' : 'chip'}
                type="button"
                key={item}
                onClick={() => {
                  setOmicsStatusFilter(item);
                  setOmicsAssayFilter('全部');
                }}
              >
                {item}
              </button>
            ))}
            {omicsAssayOptions.map((item) => (
              <button
                className={omicsAssayFilter === item ? 'chip is-selected' : 'chip'}
                type="button"
                key={item}
                onClick={() => {
                  setOmicsAssayFilter(item);
                  setOmicsStatusFilter('全部');
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <OmicsTable records={pagedDetectionRows} />
        <ModuleTableFooter page={safeOmicsPage} total={filteredDetectionRows.length} pageSize={omicsTestingPageSize} onPageChange={setOmicsPage} />
      </section>
    </div>
  );
}

export function PatientJourneyPage({
  selectedPatient,
  onPatientChange
}: {
  selectedPatient?: PatientRecord | null;
  onPatientChange?: (patient: PatientRecord) => void;
}) {
  return <PatientJourneyDemoPage selectedPatient={selectedPatient} onPatientChange={onPatientChange} />;
}

type SystemAccount = {
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  studyScope: string;
  status: 'Active' | 'Pending' | 'Disabled';
  lastLogin: string;
};

type SystemField = {
  id: string;
  name: string;
  type: string;
  module: string;
  updatedAt: string;
  status: '启用' | '草稿' | '停用';
};

type PermissionRow = {
  action: string;
  values: Partial<Record<UserRole, boolean>>;
};

const systemAccounts: SystemAccount[] = [
  { name: '系统管理员', email: 'admin@demo.linzight', role: 'LZ_ADMIN', roleLabel: 'LZ 系统管理员', studyScope: '全部 Study', status: 'Active', lastLogin: '2026-05-07' },
  { name: '中央 CRC', email: 'lz-crc@demo.linzight', role: 'LZ_CRC', roleLabel: 'LZ CRC / 中央 CRC', studyScope: 'LGL-1111 / RWD-NMO-2026 / LZXK-01', status: 'Active', lastLogin: '2026-05-07' },
  { name: 'CRF 管理员', email: 'crf-admin@demo.linzight', role: 'LZ_CRF_ADMIN', roleLabel: 'LZ CRF 管理员', studyScope: 'LGL-1111 / RWD-NMO-2026 / LZXK-01', status: 'Active', lastLogin: '2026-05-06' },
  { name: '平台数据管理员', email: 'lz-dm@demo.linzight', role: 'LZ_DATA_MANAGER', roleLabel: 'LZ 数据管理员', studyScope: 'RWD-NMO-2026', status: 'Active', lastLogin: '2026-05-06' },
  { name: '约翰·伦格', email: 'pi@demo.linzight', role: 'STUDY_PI', roleLabel: '研究 PI / 医生', studyScope: 'LGL-1111', status: 'Active', lastLogin: '2026-05-07' },
  { name: '林清妍', email: 'crc@demo.linzight', role: 'STUDY_CRC', roleLabel: '研究 CRC', studyScope: 'LGL-1111', status: 'Active', lastLogin: '2026-05-07' },
  { name: '顾明远', email: 'config@demo.linzight', role: 'STUDY_CONFIG_ADMIN', roleLabel: '研究配置管理员', studyScope: 'LGL-1111 / RWD-NMO-2026', status: 'Active', lastLogin: '2026-05-06' },
  { name: '陈序', email: 'dm@demo.linzight', role: 'STUDY_DATA_MANAGER', roleLabel: '研究数据管理员', studyScope: 'LGL-1111', status: 'Active', lastLogin: '2026-05-06' },
  { name: '平台审计员', email: 'auditor@demo.linzight', role: 'LZ_AUDITOR', roleLabel: 'LZ 平台审计员', studyScope: '授权 Study', status: 'Pending', lastLogin: '2026-05-05' },
  { name: '肺癌 PI', email: 'lung-pi@demo.linzight', role: 'STUDY_PI', roleLabel: '研究 PI / 医生', studyScope: 'LZXK-01', status: 'Active', lastLogin: '2026-05-07' },
  { name: '肺癌 CRC', email: 'lung-crc@demo.linzight', role: 'STUDY_CRC', roleLabel: '研究 CRC', studyScope: 'LZXK-01', status: 'Active', lastLogin: '2026-05-07' },
  { name: '肺癌配置管理员', email: 'lung-config@demo.linzight', role: 'STUDY_CONFIG_ADMIN', roleLabel: '研究配置管理员', studyScope: 'LZXK-01', status: 'Active', lastLogin: '2026-05-07' },
  { name: '肺癌数据管理员', email: 'lung-dm@demo.linzight', role: 'STUDY_DATA_MANAGER', roleLabel: '研究数据管理员', studyScope: 'LZXK-01', status: 'Active', lastLogin: '2026-05-07' }
];

const systemFields: SystemField[] = systemCrfFields;
const systemVisitPlans: StudyVisitPlanRecord[] = studyVisitPlans;

const permissionRows: PermissionRow[] = [
  { action: '跨 Study 访问 / Cross-study scope', values: { LZ_ADMIN: true, LZ_CRC: true, LZ_CRF_ADMIN: true, LZ_DATA_MANAGER: true, LZ_AUDITOR: true } },
  { action: '新建研究 / Create Study', values: { LZ_ADMIN: true } },
  { action: '研究成员管理 / Study Members', values: { LZ_ADMIN: true, STUDY_CONFIG_ADMIN: true } },
  { action: '患者查看 / View Patients', values: { LZ_ADMIN: true, LZ_CRC: true, LZ_DATA_MANAGER: true, LZ_AUDITOR: true, STUDY_PI: true, STUDY_CRC: true, STUDY_DATA_MANAGER: true } },
  { action: '患者与 CRF 录入 / Enter Patient & CRF Data', values: { LZ_ADMIN: true, LZ_CRC: true, STUDY_CRC: true } },
  { action: 'Study CRF 配置 / Study CRF Config', values: { LZ_ADMIN: true, LZ_CRF_ADMIN: true, STUDY_CONFIG_ADMIN: true } },
  { action: '访视计划配置 / Study Visit Plan Config', values: { LZ_ADMIN: true, LZ_CRF_ADMIN: true, STUDY_CONFIG_ADMIN: true } },
  { action: 'CRF 版本发布 / Publish CRF Version', values: { LZ_ADMIN: true, LZ_CRF_ADMIN: true, STUDY_CONFIG_ADMIN: true } },
  { action: 'Query 与质控 / Query & QC', values: { LZ_ADMIN: true, LZ_CRC: true, LZ_DATA_MANAGER: true, STUDY_DATA_MANAGER: true } },
  { action: '数据冻结与锁定 / Freeze & Lock', values: { LZ_ADMIN: true, LZ_DATA_MANAGER: true, STUDY_DATA_MANAGER: true } },
  { action: '导出与分析 / Export & Analytics', values: { LZ_ADMIN: true, LZ_DATA_MANAGER: true, STUDY_PI: true, STUDY_DATA_MANAGER: true } },
  { action: '审计日志 / Audit Logs', values: { LZ_ADMIN: true, LZ_AUDITOR: true, LZ_DATA_MANAGER: true, STUDY_CONFIG_ADMIN: true, STUDY_DATA_MANAGER: true } }
];

const permissionColumns: Array<{ key: UserRole; label: string }> = [
  { key: 'LZ_ADMIN', label: 'LZ Admin' },
  { key: 'LZ_CRC', label: 'LZ CRC' },
  { key: 'LZ_CRF_ADMIN', label: 'CRF Admin' },
  { key: 'LZ_DATA_MANAGER', label: 'LZ DM' },
  { key: 'STUDY_PI', label: 'Study PI' },
  { key: 'STUDY_CRC', label: 'Study CRC' },
  { key: 'STUDY_CONFIG_ADMIN', label: 'Config Admin' },
  { key: 'STUDY_DATA_MANAGER', label: 'Study DM' }
];

const roleTone: Record<UserRole, string> = {
  LZ_ADMIN: 'admin',
  LZ_CRC: 'success',
  LZ_CRF_ADMIN: 'admin',
  LZ_DATA_MANAGER: 'info',
  LZ_AUDITOR: 'info',
  STUDY_PI: 'info',
  STUDY_CRC: 'success',
  STUDY_CONFIG_ADMIN: 'admin',
  STUDY_DATA_MANAGER: 'info'
};

const systemStatusTone: Record<SystemAccount['status'], 'success' | 'warning' | 'danger'> = {
  Active: 'success',
  Pending: 'warning',
  Disabled: 'danger'
};

export function SystemManagementPage() {
  const [systemQuery, setSystemQuery] = useState('');
  const [accountPage, setAccountPage] = useState(1);
  const [fieldPage, setFieldPage] = useState(1);
  const normalizedQuery = systemQuery.trim().toLowerCase();
  const visibleAccounts = useMemo(() => {
    if (!normalizedQuery) return systemAccounts;
    return systemAccounts.filter((account) =>
      [account.name, account.email, account.role, account.roleLabel, account.studyScope, account.status].some((item) => item.toLowerCase().includes(normalizedQuery))
    );
  }, [normalizedQuery]);

  const visibleFields = useMemo(() => {
    if (!normalizedQuery) return systemFields;
    return systemFields.filter((field) =>
      [field.id, field.name, field.type, field.module, field.status].some((item) => item.toLowerCase().includes(normalizedQuery))
    );
  }, [normalizedQuery]);

  const visibleVisitPlans = useMemo(() => {
    if (!normalizedQuery) return systemVisitPlans;
    return systemVisitPlans.filter((plan) =>
      [plan.id, plan.studyId, plan.code, plan.name, plan.visitType, plan.status, plan.requiredForms.join('/'), plan.requiredSamples.join('/')].some((item) =>
        item.toLowerCase().includes(normalizedQuery)
      )
    );
  }, [normalizedQuery]);

  const accountTotalPages = Math.max(1, Math.ceil(visibleAccounts.length / systemAccountPageSize));
  const safeAccountPage = Math.min(accountPage, accountTotalPages);
  const pagedAccounts = visibleAccounts.slice(
    (safeAccountPage - 1) * systemAccountPageSize,
    safeAccountPage * systemAccountPageSize
  );
  const fieldTotalPages = Math.max(1, Math.ceil(visibleFields.length / systemFieldPageSize));
  const safeFieldPage = Math.min(fieldPage, fieldTotalPages);
  const pagedFields = visibleFields.slice(
    (safeFieldPage - 1) * systemFieldPageSize,
    safeFieldPage * systemFieldPageSize
  );

  return (
    <div className="content workspace-page system-management-page">
      <section className="system-management-hero module-card">
        <div className="system-management-title">
          <span>System Management</span>
          <h2>系统管理</h2>
          <p>Manage Study-scoped accounts, global roles, permission policies, and CRF versions. 管理 Study 成员、平台角色、权限策略和 CRF 版本。</p>
        </div>
        <label className="system-study-select">
          <span>Study</span>
          <select defaultValue="LGL-1111">
            <option>LGL-1111</option>
            <option>RWD-NMO-2026</option>
            <option>LZXK-01</option>
            <option>全部 Study</option>
          </select>
        </label>
      </section>

      <section className="module-card system-overview-card">
        <header className="module-card__header system-overview-header">
          <div>
            <span>Account Overview</span>
            <h2>Account Summary | 账户概览</h2>
            <p>当前研究站点账户结构</p>
          </div>
          <div className="system-overview-actions">
            <label className="system-search-box">
              <Icon name="search" />
              <input
                value={systemQuery}
                onChange={(event) => {
                  setSystemQuery(event.target.value);
                  setAccountPage(1);
                  setFieldPage(1);
                }}
                placeholder="Search users, roles, CRF fields, visit plans, or ask LinZight AI..."
              />
              <Icon name="microphone" />
            </label>
            <button className="module-primary-button" type="button"><Icon name="userPlus" />Create Account<br /><span>新增账户</span></button>
          </div>
        </header>
        <div className="system-summary-grid">
          <div>
            <span>Total Accounts</span>
            <strong>{systemAccounts.length}</strong>
            <small>Demo</small>
          </div>
          <div>
            <span>Global Roles</span>
            <strong>{systemAccounts.filter((account) => account.role.startsWith('LZ_')).length}</strong>
          </div>
          <div>
            <span>Study Roles</span>
            <strong>{systemAccounts.filter((account) => account.role.startsWith('STUDY_')).length}</strong>
          </div>
          <div>
            <span>Studies</span>
            <strong>3</strong>
          </div>
        </div>
        <div className="system-global-actions">
          <Icon name="alerts" />
          <span>Global Actions</span>
          <strong>Study 成员、CRF 版本、导出和权限策略变更均进入审计日志。</strong>
        </div>
      </section>

      <div className="system-management-grid">
        <div className="module-stack">
          <section className="module-card">
            <header className="module-card__header">
              <div>
                <h2>User Accounts & Roles List | 用户账户与角色列表</h2>
                <span>按角色和状态管理研究团队账号</span>
              </div>
            </header>
            <div className="module-table-wrap">
              <table className="module-table system-account-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Assigned Role</th>
                    <th>Study Scope</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAccounts.map((account) => (
                    <tr key={`${account.email}-${account.name}`}>
                      <td>{account.name}</td>
                      <td>{account.email}</td>
                      <td><span className={`system-role-pill system-role-pill--${roleTone[account.role]}`}>{account.role} | {account.roleLabel}</span></td>
                      <td>{account.studyScope}</td>
                      <td><span className={`status-pill status-pill--${systemStatusTone[account.status]}`}>{account.status}</span></td>
                      <td>{account.lastLogin}</td>
                      <td>
                        <div className="module-table-actions">
                          <button className="module-link-button" type="button">Edit</button>
                          <button className="module-link-button module-link-button--danger" type="button">{account.status === 'Disabled' ? 'Enable' : 'Disable'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ModuleTableFooter page={safeAccountPage} total={visibleAccounts.length} pageSize={systemAccountPageSize} onPageChange={setAccountPage} />
          </section>

          <section className="module-card">
            <header className="module-card__header">
              <div>
                <h2>Field & CRF Configuration | CRF 与字段配置</h2>
                <span>维护每个 Study 独立 CRF 字段、类型、版本和所属模块</span>
              </div>
              <button className="module-link-button module-link-button--primary" type="button"><Icon name="filePlus" />新增字段</button>
            </header>
            <div className="module-table-wrap">
              <table className="module-table system-field-table">
                <thead>
                  <tr>
                    <th>Field ID</th>
                    <th>Field Name</th>
                    <th>Type</th>
                    <th>CRF Module</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedFields.map((field) => (
                    <tr key={field.id}>
                      <td>{field.id}</td>
                      <td>{field.name}</td>
                      <td>{field.type}</td>
                      <td>{field.module}</td>
                      <td><span className={field.status === '启用' ? 'status-pill status-pill--success' : field.status === '草稿' ? 'status-pill status-pill--warning' : 'status-pill status-pill--danger'}>{field.status}</span></td>
                      <td>{field.updatedAt}</td>
                      <td>
                        <div className="module-table-actions">
                          <button className="module-link-button" type="button">Edit</button>
                          <button className="module-link-button" type="button"><Icon name="chevronDown" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ModuleTableFooter page={safeFieldPage} total={visibleFields.length} pageSize={systemFieldPageSize} onPageChange={setFieldPage} />
          </section>

          <section className="module-card">
            <header className="module-card__header">
              <div>
                <h2>Visit Plan Configuration | 访视计划配置</h2>
                <span>按 Study 配置访视时间窗、必填 CRF 表单和样本要求</span>
              </div>
              <button className="module-link-button module-link-button--primary" type="button"><Icon name="filePlus" />新增访视</button>
            </header>
            <div className="module-table-wrap">
              <table className="module-table system-visit-plan-table">
                <thead>
                  <tr>
                    <th>Study</th>
                    <th>Code</th>
                    <th>Visit Plan</th>
                    <th>Day</th>
                    <th>Window</th>
                    <th>CRF Forms</th>
                    <th>Samples</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleVisitPlans.map((plan) => (
                    <tr key={plan.id}>
                      <td>{plan.studyId}</td>
                      <td>{plan.code}</td>
                      <td>{plan.name}</td>
                      <td>D{plan.dayOffset}</td>
                      <td>-{plan.windowBeforeDays} / +{plan.windowAfterDays} 天</td>
                      <td>{plan.requiredForms.join(', ')}</td>
                      <td>{plan.requiredSamples.join('、') || '-'}</td>
                      <td><span className={plan.status === 'active' ? 'status-pill status-pill--success' : plan.status === 'draft' ? 'status-pill status-pill--warning' : 'status-pill status-pill--danger'}>{plan.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="module-stack">
          <section className="module-card system-permission-card">
            <header className="module-card__header">
              <div>
                <h2>Permission Strategy Matrix | 权限策略矩阵</h2>
                <span>平台级角色跨 Study；研究级角色只在所属 Study 内生效</span>
              </div>
            </header>
            <div className="module-table-wrap system-permission-wrap">
              <table className="module-table system-permission-table">
                <thead>
                  <tr>
                    <th>Permission</th>
                    {permissionColumns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permissionRows.map((row) => (
                    <tr key={row.action}>
                      <td>{row.action}</td>
                      {permissionColumns.map((column) => (
                        <td key={column.key}>
                          <label className="system-permission-check">
                            <input type="checkbox" checked={Boolean(row.values[column.key])} readOnly aria-label={`${row.action}-${column.key}`} />
                            <span />
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const [exportStatus, setExportStatus] = useState('等待导出任务');
  const [qualityStatus, setQualityStatus] = useState('等待数据校验');

  async function handleCreateExport(record: ReportRecord) {
    setExportStatus(`${record.name} 生成中...`);
    try {
      const job = await createExportJob(record.type.toLowerCase());
      setExportStatus(`${record.name} 已生成：${job.id}`);
    } catch {
      setExportStatus('导出失败：请确认已登录且当前角色具备导出权限');
    }
  }

  async function handleRunQualityChecks() {
    setQualityStatus('数据校验运行中...');
    try {
      const result = await runQualityChecks();
      setQualityStatus(`校验完成：发现 ${result.created} 条待处理问题`);
    } catch {
      setQualityStatus('校验失败：请确认当前角色具备质控权限');
    }
  }

  return (
    <div className="content workspace-page">
      <section className="module-kpis">
        <ModuleKpi icon="reports" label="可导出报表" value="4" helper="PDF / XLSX / CSV / ZIP" />
        <ModuleKpi icon="database" label="数据库记录" value="32" helper="患者、样本、组学检测" tone="green" />
        <ModuleKpi icon="shield" label="审计轨迹" value="18" helper="含知情同意与数据修改" tone="purple" />
        <ModuleKpi icon="clock" label="待复核" value="1" helper="SDTM 数据集草稿" tone="orange" />
      </section>

      <div className="report-grid">
        {reportRecords.map((record) => <ReportCard record={record} key={record.id} onExport={handleCreateExport} />)}
      </div>

      <section className="module-card">
        <header className="module-card__header">
          <div>
            <h2>数据导出流水线</h2>
            <span>用于 Demo 后端 API 联调</span>
          </div>
          <button className="module-link-button module-link-button--primary" type="button" onClick={handleRunQualityChecks}><Icon name="check" />运行校验</button>
        </header>
        <div className="module-upload-status">
          <Icon name="reports" />
          <span>{exportStatus}</span>
        </div>
        <div className="module-upload-status">
          <Icon name="shield" />
          <span>{qualityStatus}</span>
        </div>
        <div className="pipeline-grid">
          {['患者主数据', '临床 CRF', '样本台账', '多组学结果', '知情同意审计', '数据包归档'].map((item, index) => (
            <div className="pipeline-step" key={item}>
              <span>{index + 1}</span>
              <strong>{item}</strong>
              <small>{index < 4 ? '可导出' : '待复核'}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReportCard({ record, onExport }: { record: ReportRecord; onExport: (record: ReportRecord) => void }) {
  return (
    <article className="module-card report-card">
      <Icon name="reports" />
      <div>
        <strong>{record.name}</strong>
        <p>{record.scope}</p>
      </div>
      <DetailList rows={[['格式', record.type], ['状态', record.status], ['更新时间', record.updatedAt]]} />
      <button className="module-primary-button" type="button" onClick={() => onExport(record)}><Icon name="file" />导出</button>
    </article>
  );
}

export function HomeDashboardExtras() {
  return (
    <section className="module-card">
      <header className="module-card__header"><h2>快捷操作</h2></header>
      <div className="quick-action-strip">
        {quickActions.map((action) => (
          <button type="button" key={action.label}>
            <Icon name={action.icon} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
