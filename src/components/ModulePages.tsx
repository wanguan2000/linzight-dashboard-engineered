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
  type FollowUpRecord,
  type OmicsRecord,
  type ReportRecord,
  type SampleRecord,
  type StudyVisitPlanRecord,
  type VisitRecord
} from '../data/operations';
import type { PatientRecord } from '../data/patientCohort';
import { demoUsers, roleLabels, type AuthenticatedUser, type UserRole } from '../data/auth';
import { useI18n } from '../i18n/I18nProvider';
import {
  applyStudyCrfMigration,
  approveApprovalRequest,
  approveStudyCrfMigration,
  assignStudySiteUser,
  completeApprovalRequest,
  createApprovalRequest,
  createDataQuery,
  createOmicsRecord,
  createSampleRecord,
  createExportJob,
  createStudy,
  createStudyCrfField,
  createStudySite,
  createStudyCrfVersion,
  createStudyVisitPlan,
  createUserAccount,
  deleteStudy,
  downloadExportJob,
  fetchConsentRecords,
  fetchDemoDataset,
  fetchOmicsRecords,
  fetchSamples,
  fetchDataQueries,
  fetchStudyCrfFields,
  fetchStudyCrfMigrations,
  fetchStudyCrfVersions,
  fetchStudyMembers,
  fetchStudySites,
  fetchStudyVisitPlans,
  fetchApprovalRequests,
  fetchAuditLogs,
  filterRecordsByCurrentStudyScope,
  fetchQualityIssues,
  fetchStudies,
  fetchUsers,
  getCurrentScopedStudyId,
  previewStudyCrfMigration,
  recordBelongsToCurrentStudyScope,
  requestConsentResign,
  requestConsentWithdrawal,
  requestStudyCrfMigrationApproval,
  rejectApprovalRequest,
  runQualityChecks,
  saveClinicalCrfEntry,
  saveVisitFollowUpRecord,
  updatePatientClinicalData,
  updateConsentRecord,
  updateDataQuery,
  updateOmicsRecord,
  updateSampleRecord,
  updateGlobalRoleStudyScope,
  updateStudyCrfField,
  updateStudyCrfVersion,
  updateStudy,
  updateUserAccount,
  updateUserAccountStatus,
  upsertStudyMember,
  uploadFileToBackend
} from '../services/api';
import type { ApiApprovalRequest, ApiAuditLog, ApiDataQuery, ApiExportJob, ApiQualityIssue, ApiSiteUser, ApiStudy, ApiStudyMember, ApiStudySite, ApiUser } from '../services/contracts';
import type { CrfMigrationApprovalRecord, CrfMigrationPreview, StudyCrfVersionRecord } from '../services/api';
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
const consentStatusOptions: Array<'全部' | ConsentRecord['status']> = ['全部', '待签署', '已签署', '撤回审批中', '已撤回', '重签审批中', '已重签'];
const consentStatusClass: Record<'全部' | ConsentRecord['status'], string> = {
  全部: 'all',
  待签署: 'pending',
  已签署: 'signed',
  撤回审批中: 'pending',
  已撤回: 'withdrawn',
  重签审批中: 'pending',
  已重签: 'signed'
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

const lungConsentPreviewContent: ConsentPreviewSection[] = [
  {
    title: '肺癌耐药研究概述',
    icon: 'file',
    eyebrow: '真实世界肺癌耐药队列',
    blocks: [
      {
        paragraphs: [
          '本项目《真实世界肺癌耐药研究》为非干预性真实世界研究，聚焦 NSCLC 患者靶向治疗、免疫治疗及耐药后的临床结局。',
          '研究采集临床诊疗过程中已经产生的病史、治疗线数、ECOG、TNM 分期、影像疗效、ctDNA/NGS 检测和随访结局数据。',
          '本研究不会改变受试者既有诊疗方案，研究结果用于队列分析、耐药机制探索、ORR/PFS 相关评估和后续研究设计。'
        ]
      }
    ]
  },
  {
    title: '样本和检测用途',
    icon: 'lab',
    eyebrow: '组织、血液与 ctDNA/NGS',
    blocks: [
      {
        paragraphs: ['受试者的临床信息和剩余样本将用于以下研究分析：'],
        items: [
          '肿瘤组织或胸水样本：用于病理复核、驱动基因和耐药机制分析。',
          '外周血样本：用于 ctDNA 动态监测、治疗前后突变丰度变化和随访风险评估。',
          'NGS panel 检测结果：用于 EGFR、ALK、MET 扩增、组织学转化等耐药机制归因。'
        ]
      }
    ]
  },
  {
    title: '风险与隐私保护',
    icon: 'lock',
    eyebrow: '低风险、匿名化与合规',
    blocks: [
      {
        paragraphs: [
          '本研究主要使用诊疗过程中已采集的信息和剩余样本，不额外增加侵入性操作。',
          '所有研究数据将进行去标识化处理，研究分析和发表不会公开患者姓名、住院号、联系方式或其他可识别身份信息。',
          '如需补充样本或上传外部检测文件，研究团队会在确认授权和样本质量后进行登记、归档和审计留痕。'
        ]
      }
    ]
  },
  {
    title: '知情同意声明',
    icon: 'shield',
    eyebrow: '自愿参加与签署确认',
    blocks: [
      {
        title: '声明确认',
        items: [
          '我已经了解本研究的目的、数据范围、样本用途和隐私保护方式。',
          '我理解本研究不会替代医生对我的临床诊疗决策。',
          '我同意经去标识化后的临床数据、样本信息和组学检测结果用于肺癌耐药真实世界研究。',
          '我知道可以按研究流程申请撤回或重新签署知情同意。'
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

function getConsentPreviewContent(studyId?: string) {
  return studyId === 'LZXK-01' ? lungConsentPreviewContent : consentPreviewContent;
}

function getConsentStudyTitle(studyId?: string) {
  return studyId === 'LZXK-01' ? '真实世界肺癌耐药研究知情同意' : '免疫相关性神经系统疾病多组学解析及机制探索';
}

function statusTone(status: string) {
  if (['完成', '已完成', '已签署', '结果回传', '检测完成', '结果归档', '可导出', '通过', 'Active'].includes(status)) return 'success';
  if (['进行中', '检测中', '数据分析', '文库构建', '生成中', '待确认', '待签署'].includes(status)) return 'warning';
  if (['已撤回', '未通过', '失败/重测', '需复核'].includes(status)) return 'danger';
  return 'info';
}

function StatusPill({ value }: { value: string }) {
  const { t } = useI18n();
  return <span className={`status-pill status-pill--${statusTone(value)}`}>{t(value)}</span>;
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
  const { t } = useI18n();
  const [selectedChoice, setSelectedChoice] = useState('同意');

  return (
    <div className="consent-section-body">
      {section.blocks.map((block, blockIndex) => (
        <article className="consent-section-block" key={`${section.title}-${block.title ?? blockIndex}`}>
          {block.title ? <h4>{t(block.title)}</h4> : null}
          {block.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{t(paragraph)}</p>
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
                  {t(item)}
                </button>
              ))}
            </div>
          ) : null}
          {block.items && block.variant === 'documentActions' ? (
            <div className="consent-document-actions">
              <button type="button" onClick={onPrint}><Icon name="reports" />{t('打印知情')}</button>
              <button type="button" onClick={onUpload}><Icon name="filePlus" />{t('上传知情')}</button>
              <a href={consentPreviewPdfUrl} target="_blank" rel="noreferrer"><Icon name="search" />{t('查看知情')}</a>
            </div>
          ) : null}
          {block.items && block.variant !== 'choice' && block.variant !== 'documentActions' ? (
            <ul className={`consent-section-list consent-section-list--${block.variant ?? 'default'}`}>
              {block.items.map((item) => (
                <li key={item}>
                  {block.variant === 'checklist' ? <Icon name="check" /> : null}
                  <span>{t(item)}</span>
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
  const { t } = useI18n();
  return (
    <article className={`module-kpi module-kpi--${tone}`}>
      <div className="module-kpi__icon">
        <Icon name={icon} />
      </div>
      <div>
        <span>{t(label)}</span>
        <strong>{value}</strong>
        <small>{t(helper)}</small>
      </div>
    </article>
  );
}

function MiniTrend({ label = '近30天趋势' }: { label?: string }) {
  const { t } = useI18n();

  return (
    <div className="module-mini-trend" aria-label={t(label)}>
      <svg viewBox="0 0 360 120" preserveAspectRatio="none">
        <line x1="0" y1="24" x2="360" y2="24" />
        <line x1="0" y1="60" x2="360" y2="60" />
        <line x1="0" y1="96" x2="360" y2="96" />
        <path d="M0 86 C36 78 58 88 92 62 C128 36 162 62 204 44 C248 26 278 40 320 26 C340 20 350 18 360 16 L360 120 L0 120Z" />
        <path d="M0 86 C36 78 58 88 92 62 C128 36 162 62 204 44 C248 26 278 40 320 26 C340 20 350 18 360 16" />
      </svg>
      <div className="module-chart-axis"><span>{t('5月1日')}</span><span>{t('5月15日')}</span><span>{t('5月29日')}</span></div>
    </div>
  );
}

function DetailList({ rows }: { rows: Array<[string, string]> }) {
  const { t } = useI18n();
  return (
    <dl className="module-detail-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{t(label)}</dt>
          <dd>{t(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function SimpleTimeline({ items }: { items: Array<{ label: string; helper: string; done?: boolean }> }) {
  const { t } = useI18n();

  return (
    <div className="simple-timeline">
      {items.map((item) => (
        <div className={item.done === false ? 'simple-timeline__item is-pending' : 'simple-timeline__item'} key={item.label}>
          <span />
          <div>
            <strong>{t(item.label)}</strong>
            <small>{t(item.helper)}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function patientSamples(patient: PatientRecord, sampleRows: SampleRecord[] = samples) {
  return sampleRows.filter((sample) =>
    (sample.patientId && patient.id ? sample.patientId === patient.id : sample.patientName === patient.name) &&
    (!sample.studyId || sample.studyId === patient.studyId)
  );
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
  studyId?: string;
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
  studyId?: string;
  patientName: string;
  hospitalNo: string;
  sampleId: string;
  sampleType: string;
  collectedAt: string;
  note: string;
};

type SampleTestingEditor =
  | { kind: 'sample'; draft: SampleRecord }
  | { kind: 'omics'; draft: OmicsRecord };

function uniqueOptionalStudyIds(records: Array<{ studyId?: string }>) {
  return Array.from(new Set(records.map((record) => record.studyId).filter(Boolean) as string[])).sort();
}

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
      studyId: record.studyId ?? sample?.studyId,
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
        studyId: sample.studyId,
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
    (item) => item.patientName === sample.patientName && item.sampleType === sample.sampleType && item.studyId === sample.studyId
  );
  if (siblingSamples.length <= 1) return baseId;

  const siblingIndex = siblingSamples.findIndex((item) => item.id === sample.id);
  return `${baseId}-${String(siblingIndex + 1).padStart(2, '0')}`;
}

function buildSampleLedgerRows(sampleRows: SampleRecord[]): SampleLedgerRow[] {
  return sampleRows
    .map((sample) => ({
      id: sample.id,
      studyId: sample.studyId,
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

type ClinicalFormSection = {
  title: string;
  items: Array<[string, string]>;
};

const lungClinicalDataGroups = [
  { title: '肺癌研究基本信息', fields: ['研究编号', '研究名称', '病种', '分期', 'TNM分期'] },
  { title: '肺癌治疗与耐药评估', fields: ['ECOG评分', '治疗线数', '当前治疗方案', '驱动基因突变', '耐药机制', 'RECIST评估'] },
  { title: '肺癌组学与疗效终点', fields: ['ctDNA突变丰度', 'PFS（月）', 'ORR评估', '检测项目'] }
];

const lungClinicalFieldAllowList = new Set(lungClinicalDataGroups.flatMap((group) => group.fields));

function formatClinicalValue(value: string | number | undefined) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function buildClinicalSectionsFromPatient(patient: PatientRecord): ClinicalFormSection[] {
  const consumedFields = new Set<string>();
  const groups = patient.studyId === 'LZXK-01' ? lungClinicalDataGroups : clinicalDataGroups;
  const sections = groups
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
    .filter(([field]) => patient.studyId !== 'LZXK-01' || lungClinicalFieldAllowList.has(field))
    .map(([field, value]) => [field, formatClinicalValue(value)] as [string, string]);

  if (otherItems.length) sections.push({ title: '其他已录入字段', items: otherItems });

  return sections.length ? sections : [{ title: '等待 API 数据', items: [['数据源', '等待 FastAPI / SQLite'] as [string, string]] }];
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

function followUpRecordToClinicalVisit(record: FollowUpRecord): VisitRecord {
  const completenessMatch = record.efficacyAssessment.match(/完整度\s*(\d+)%/);
  const completeness = completenessMatch ? Number(completenessMatch[1]) : 0;
  const isLungStudy = record.studyId === 'LZXK-01';
  const status: VisitRecord['status'] = record.diseaseStatus === '进行中'
    ? '进行中'
    : record.diseaseStatus === '已预约'
      ? '已预约'
      : '已完成';

  return {
    id: record.id,
    studyId: record.studyId,
    patientId: record.patientId,
    patientName: record.patientName,
    visit: `随访记录 · ${record.followUpMethod}`,
    visitDate: record.followUpDate,
    visitType: record.followUpMethod,
    sleDai: isLungStudy ? record.efficacyAssessment || 'ECOG / 疗效待录入' : record.symptomsSigns.replace(/^SLEDAI\s*/, '') || '待录入',
    medication: isLungStudy ? record.symptomsSigns || record.adverseEvents || '待录入治疗方案' : record.adverseEvents || '待录入',
    sampleCollection: isLungStudy ? record.imagingLabSummary || 'ctDNA / 影像待录入' : record.imagingLabSummary || '待录入',
    completeness,
    status
  };
}

export function ClinicalDataCapturePage({
  selectedPatient,
  onPatientChange,
  onOpenPatientJourney
}: {
  selectedPatient?: PatientRecord | null;
  onPatientChange?: (patient: PatientRecord) => void;
  onOpenPatientJourney?: (patient: PatientRecord) => void;
}) {
  const { t } = useI18n();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const scopedSelectedPatient = selectedPatient && recordBelongsToCurrentStudyScope(selectedPatient) ? selectedPatient : null;
  const [patients, setPatients] = useState<PatientRecord[]>(scopedSelectedPatient ? [scopedSelectedPatient] : []);
  const [activePatientName, setActivePatientName] = useState(() => scopedSelectedPatient?.name ?? '');
  const [visitRows, setVisitRows] = useState<VisitRecord[]>([]);
  const [sampleRows, setSampleRows] = useState<SampleRecord[]>([]);
  const [newVisitEditId, setNewVisitEditId] = useState<string | null>(null);
  const [newSampleEditId, setNewSampleEditId] = useState<string | null>(null);
  const [clinicalFormSections, setClinicalFormSections] = useState(() => buildClinicalSectionsFromPatient(scopedSelectedPatient ?? emptyClinicalPatient));
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionBackups, setSectionBackups] = useState<Record<string, Array<[string, string]>>>({});
  const [clinicalSaveStatus, setClinicalSaveStatus] = useState('等待保存');

  useEffect(() => {
    let ignore = false;

    void fetchDemoDataset()
      .then((dataset) => {
        if (ignore) return;
        if (dataset.patients.length) setPatients(dataset.patients);
        setSampleRows(dataset.samples);
        setVisitRows([...dataset.visits, ...dataset.followUps.map(followUpRecordToClinicalVisit)]);
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (scopedSelectedPatient) setActivePatientName(scopedSelectedPatient.name);
  }, [scopedSelectedPatient]);

  useEffect(() => {
    if (!scopedSelectedPatient && patients.length && (!activePatientName || !patients.some((record) => record.name === activePatientName))) {
      setActivePatientName(patients[0].name);
    }
  }, [activePatientName, patients, scopedSelectedPatient]);

  useEffect(() => {
    pageRef.current?.scrollTo({ top: 0, left: 0 });
    window.requestAnimationFrame(() => pageRef.current?.scrollTo({ top: 0, left: 0 }));
  }, []);

  const patient = patients.find((record) => record.name === activePatientName) ?? scopedSelectedPatient ?? patients[0] ?? emptyClinicalPatient;
  const clinicalMetricLabel = patient.studyId === 'LZXK-01' ? 'ECOG / 疗效' : 'SLEDAI';
  const displayedClinicalFields = patient.studyId === 'LZXK-01' ? Array.from(lungClinicalFieldAllowList) : clinicalFields;
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

  function getNextClinicalFieldLabel(sectionTitle: string, currentItems: Array<[string, string]>) {
    const groups = patient.studyId === 'LZXK-01' ? lungClinicalDataGroups : clinicalDataGroups;
    const group = groups.find((item) => item.title === sectionTitle);
    const usedFields = new Set(currentItems.map(([label]) => label));
    const nextTemplateField = group?.fields.find((field) => !usedFields.has(field));

    return nextTemplateField ?? `新增记录 ${currentItems.length + 1}`;
  }

  function addClinicalField(sectionTitle: string) {
    const section = clinicalFormSections.find((item) => item.title === sectionTitle);
    if (section) setSectionBackups((backups) => ({ ...backups, [sectionTitle]: section.items.map((item) => [...item] as [string, string]) }));
    setClinicalFormSections((sections) =>
      sections.map((section) =>
        section.title === sectionTitle
          ? { ...section, items: [...section.items, [getNextClinicalFieldLabel(sectionTitle, section.items), ''] as [string, string]] }
          : section
      )
    );
    setEditingSection(sectionTitle);
  }

  function clinicalSectionsToPayload() {
    const payload: PatientRecord['clinicalData'] = { ...patient.clinicalData };
    for (const section of clinicalFormSections) {
      for (const [field, value] of section.items) {
        if (!field.startsWith('新增记录')) payload[field] = value;
      }
    }
    return payload;
  }

  async function saveClinicalForm(status: 'draft' | 'submitted') {
    const payload = clinicalSectionsToPayload();
    const nextPatient = { ...patient, clinicalData: payload };
    setPatients((records) => records.map((record) => (record.name === patient.name ? nextPatient : record)));
    onPatientChange?.(nextPatient);
    setEditingSection(null);
    setClinicalSaveStatus(status === 'draft' ? '草稿保存中...' : '提交中...');

    try {
      if (patient.id) {
        const updatedPatient = await updatePatientClinicalData(nextPatient, payload);
        await saveClinicalCrfEntry(updatedPatient, payload, status);
        setPatients((records) => records.map((record) => (record.id === updatedPatient.id ? { ...record, ...updatedPatient } : record)));
        onPatientChange?.({ ...nextPatient, ...updatedPatient });
        setClinicalSaveStatus(status === 'draft' ? '草稿已保存到后端' : 'CRF 已提交到后端');
      } else {
        setClinicalSaveStatus(status === 'draft' ? '草稿已保存到本地' : 'CRF 已提交到本地');
      }
    } catch {
      setClinicalSaveStatus(status === 'draft' ? '后端不可用，草稿已保存在本页' : '后端不可用，提交已保存在本页');
    }
  }

  function addVisitRow() {
    const nextIndex = visitRows.length + 1;
    const id = `V-NEW-${Date.now()}`;
    const isLungStudy = patient.studyId === 'LZXK-01';
    setVisitRows((rows) => [
      {
        id,
        studyId: patient.studyId,
        patientId: patient.id,
        patientName: patient.name,
        visit: isLungStudy ? `V${nextIndex} 新建疗效随访` : `V${nextIndex} 新建随访`,
        visitDate: '2026-04-28',
        visitType: '随访访视',
        sleDai: isLungStudy ? 'ECOG 1 / 待评估' : '待录入',
        medication: isLungStudy ? '待录入治疗方案' : '待录入',
        sampleCollection: isLungStudy ? 'ctDNA / NGS待确认' : '待录入',
        completeness: 0,
        status: '进行中'
      },
      ...rows
    ]);
    setNewVisitEditId(id);
  }

  async function saveClinicalVisit(record: VisitRecord) {
    const nextRecord = {
      ...record,
      studyId: record.studyId ?? patient.studyId,
      patientId: record.patientId ?? patient.id,
      patientName: record.patientName || patient.name
    };
    setClinicalSaveStatus(`随访 ${nextRecord.visit} 正在同步后端...`);
    try {
      const saved = await saveVisitFollowUpRecord(nextRecord, patient);
      setVisitRows((rows) => rows.map((item) => (item.id === record.id ? saved : item)));
      setClinicalSaveStatus(`随访 ${saved.visit} 已写入 follow_up_records`);
      return saved;
    } catch {
      setClinicalSaveStatus(`后端不可用，随访 ${nextRecord.visit} 已保存在本页`);
      return nextRecord;
    }
  }

  function addSampleRow() {
    const nextIndex = patientSampleRows.length + 1;
    const id = `SPL-NEW-${Date.now()}`;
    setSampleRows((rows) => [
      {
        id,
        studyId: patient.studyId,
        patientId: patient.id,
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

  async function saveClinicalSample(record: SampleRecord) {
    const nextRecord = { ...record, studyId: record.studyId ?? patient.studyId, patientId: record.patientId ?? patient.id };
    setClinicalSaveStatus(`样本 ${nextRecord.id} 正在同步后端...`);
    try {
      const saved = nextRecord.id.startsWith('SPL-NEW-') ? await createSampleRecord(nextRecord) : await updateSampleRecord(nextRecord);
      setSampleRows((rows) => rows.map((item) => (item.id === record.id ? saved : item)));
      setClinicalSaveStatus(`样本 ${saved.id} 已同步后端`);
    } catch {
      setClinicalSaveStatus(`后端不可用，样本 ${nextRecord.id} 已保存在本页`);
    }
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
              <h2>{t('患者数据录入')}</h2>
              <span>
                {patient.studyId === 'LZXK-01'
                  ? t('LZXK-01 肺癌耐药 CRF V1.0 · ECOG / TNM / ctDNA / NGS')
                  : `SLE CRF ${crfTemplateVersion} · ${crfTemplateFieldCount} ${t('字段')}`}
              </span>
            </header>
            <div className="clinical-entry-summary">
              <div className="clinical-entry-summary__icon"><Icon name="patients" size={24} /></div>
              <div className="clinical-entry-metrics">
                <div className="clinical-entry-metric clinical-entry-metric--primary">
                  <span>{t('患者ID')}</span>
                  <strong>{patient.name}</strong>
                </div>
            {[
              ['Study ID', patient.studyId],
              ['住院号', patient.hospitalNo],
              ['疾病类型', patient.diseaseType],
              ['已填字段', `${displayedClinicalFields.filter((field) => patient.clinicalData[field] !== undefined && patient.clinicalData[field] !== '').length} / ${displayedClinicalFields.length}`],
              ['完整度', `${getCompleteness(patient)}%`],
              ['存储格式', patient.clinicalDataFormat === 'jsonb' ? 'SQLite JSONB' : 'SQLite JSON'],
              ['最近更新', 'SQLite 实时']
            ].map(([label, value]) => (
                  <div className="clinical-entry-metric" key={label}>
                    <span>{t(label)}</span>
                    <strong>{t(value)}</strong>
                  </div>
                ))}
              </div>
              <div className="clinical-entry-actions">
                <button className="module-link-button" type="button" onClick={() => void saveClinicalForm('draft')}><Icon name="file" />{t('保存草稿')}</button>
                <button className="module-primary-button" type="button" onClick={() => void saveClinicalForm('submitted')}><Icon name="check" />{t('提交')}</button>
                <button className="module-link-button module-link-button--primary" type="button" onClick={() => onOpenPatientJourney?.(patient)}>
                  <Icon name="activity" />{t('患者旅程')}
                </button>
              </div>
            </div>
            <div className="module-upload-status">
              <Icon name="shield" />
              <span>{t(clinicalSaveStatus)}</span>
            </div>
            <div className="clinical-section-grid">
              {clinicalFormSections.map((section, index) => {
                const isEditing = editingSection === section.title;

                return (
                <article className="clinical-section" key={section.title}>
                  <header className="clinical-section__header">
                    <div>
                      <h3>{index + 1}. {t(section.title)}</h3>
                      <span>{t('最近更新')} {clinicalSectionUpdatedAt[index] ?? '2026-04-27'}</span>
                    </div>
                    <div className="clinical-section__actions">
                      {isEditing ? (
                        <>
                          <button className="module-link-button module-link-button--primary" type="button" onClick={() => setEditingSection(null)}>{t('保存')}</button>
                          <button className="module-link-button" type="button" onClick={() => cancelClinicalSectionEdit(section.title)}>{t('取消')}</button>
                        </>
                      ) : (
                        <button className="module-link-button" type="button" onClick={() => startClinicalSectionEdit(section.title)}>{t('编辑')}</button>
                      )}
                      <button className="module-link-button module-link-button--primary" type="button" onClick={() => addClinicalField(section.title)}>{t('新增')}</button>
                    </div>
                  </header>
                  <div className="clinical-field-table" role="table" aria-label={`${t(section.title)} ${t('字段')}`}>
                    {section.items.map(([label, value], fieldIndex) => (
                      <div className="clinical-field-row" role="row" key={label}>
                        <span role="cell">{t(label)}</span>
                        {isEditing ? (
                          <input
                            aria-label={`${t(section.title)}-${t(label)}`}
                            role="cell"
                            value={value}
                            placeholder={t('待录入')}
                            onChange={(event) => updateClinicalField(section.title, fieldIndex, event.target.value)}
                          />
                        ) : (
                          <strong role="cell">{t(value || '待录入')}</strong>
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
              <h2>{t('多次随访模块')}</h2>
              <button className="module-link-button module-link-button--primary" type="button" onClick={addVisitRow}>{t('新建随访')}</button>
            </header>
            <VisitTable
              records={patientVisitRows}
              onChange={(nextRows) => setVisitRows((rows) => [...rows.filter((record) => record.patientName !== patient.name), ...nextRows])}
              onSave={(record) => saveClinicalVisit(record)}
              metricLabel={clinicalMetricLabel}
              initialEditingId={newVisitEditId}
              onInitialEditingHandled={() => setNewVisitEditId(null)}
            />
          </section>

          <section className="module-card">
            <header className="module-card__header">
              <h2>{t('样本采集模块')}</h2>
              <button className="module-link-button module-link-button--primary" type="button" onClick={addSampleRow}>{t('样本录入')}</button>
            </header>
            <SampleTable
              records={patientSampleRows}
              onChange={(nextRows) => setSampleRows((rows) => [...rows.filter((record) => record.patientName !== patient.name), ...nextRows])}
              onSave={(record) => void saveClinicalSample(record)}
              initialEditingId={newSampleEditId}
              onInitialEditingHandled={() => setNewSampleEditId(null)}
              compact
              useLibraryCode
            />
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
  onSave,
  metricLabel = 'SLEDAI',
  initialEditingId,
  onInitialEditingHandled
}: {
  records: VisitRecord[];
  onChange?: (records: VisitRecord[]) => void;
  onSave?: (record: VisitRecord) => Promise<VisitRecord | void> | VisitRecord | void;
  metricLabel?: string;
  initialEditingId?: string | null;
  onInitialEditingHandled?: () => void;
}) {
  const { t } = useI18n();
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

  async function saveEdit(record: VisitRecord) {
    const saved = await onSave?.(record);
    if (saved) onChange?.(records.map((item) => (item.id === record.id ? saved : item)));
    setEditingId(null);
  }

  return (
    <>
      <div className="module-table-wrap">
        <table className="module-table">
          <thead>
            <tr><th>{t('访视')}</th><th>{t('日期')}</th><th>{t('类型')}</th><th>{t(metricLabel)}</th><th>{t('用药变化')}</th><th>{t('样本采集')}</th><th>{t('完整度')}</th><th>{t('编辑')}</th></tr>
          </thead>
          <tbody>
            {pageRecords.map((record) => {
              const isEditing = editingId === record.id;

              return (
                <tr key={record.id}>
                  <td>{isEditing ? <input className="module-table-input" value={record.visit} onChange={(event) => updateRecord(record.id, { visit: event.target.value })} /> : t(record.visit)}</td>
                  <td>{isEditing ? <input className="module-table-input" type="date" value={record.visitDate} onChange={(event) => updateRecord(record.id, { visitDate: event.target.value })} /> : record.visitDate}</td>
                  <td>{isEditing ? <input className="module-table-input" value={record.visitType} onChange={(event) => updateRecord(record.id, { visitType: event.target.value })} /> : t(record.visitType)}</td>
                  <td>{isEditing ? <input className="module-table-input" value={record.sleDai} onChange={(event) => updateRecord(record.id, { sleDai: event.target.value })} /> : t(record.sleDai)}</td>
                  <td>{isEditing ? <input className="module-table-input" value={record.medication} onChange={(event) => updateRecord(record.id, { medication: event.target.value })} /> : t(record.medication)}</td>
                  <td>{isEditing ? <input className="module-table-input" value={record.sampleCollection} onChange={(event) => updateRecord(record.id, { sampleCollection: event.target.value })} /> : t(record.sampleCollection)}</td>
                  <td>{isEditing ? <input className="module-table-input" type="number" value={record.completeness} onChange={(event) => updateRecord(record.id, { completeness: Number(event.target.value) })} /> : record.completeness ? `${record.completeness}%` : '--'}</td>
                  <td>
                    <div className="module-table-actions">
                      {isEditing ? (
                        <>
                          <button className="module-link-button module-link-button--primary" type="button" onClick={() => void saveEdit(record)}>{t('保存')}</button>
                          <button className="module-link-button" type="button" onClick={() => cancelEdit(record.id)}>{t('取消')}</button>
                        </>
                      ) : (
                        <button className="module-link-button" type="button" onClick={() => startEdit(record)}>{t('编辑')}</button>
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
  onSave,
  initialEditingId,
  onInitialEditingHandled,
  compact = false,
  useLibraryCode = false
}: {
  records: SampleRecord[];
  onChange?: (records: SampleRecord[]) => void;
  onSave?: (record: SampleRecord) => void | Promise<void>;
  initialEditingId?: string | null;
  onInitialEditingHandled?: () => void;
  compact?: boolean;
  useLibraryCode?: boolean;
}) {
  const { t } = useI18n();
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
            <tr><th>{t('样本编号')}</th>{!compact && <th>{t('患者编号')}</th>}<th>{t('样本类型')}</th><th>{t('采集日期')}</th><th>{t('检测项目')}</th><th>{t('状态')}</th><th>{t('编辑')}</th></tr>
          </thead>
          <tbody>
            {pageRecords.map((record) => {
              const isEditing = editingId === record.id;

              return (
                <tr key={record.id}>
                  <td>{isEditing ? <input className="module-table-input" value={record.id} onChange={(event) => updateRecord(record.id, { id: event.target.value })} /> : useLibraryCode ? formatSampleLibraryId(record) : record.id}</td>
                  {!compact && <td>{record.patientName}</td>}
                  <td>{isEditing ? <input className="module-table-input" value={record.sampleType} onChange={(event) => updateRecord(record.id, { sampleType: event.target.value })} /> : t(record.sampleType)}</td>
                  <td>{isEditing ? <input className="module-table-input" type="date" value={record.collectedAt} onChange={(event) => updateRecord(record.id, { collectedAt: event.target.value })} /> : record.collectedAt}</td>
                  <td>{isEditing ? <input className="module-table-input" value={record.linkedOmics.join(' / ')} onChange={(event) => updateRecord(record.id, { linkedOmics: event.target.value.split('/').map((item) => item.trim()).filter(Boolean) })} /> : record.linkedOmics.join(' / ')}</td>
                  <td>
                    {isEditing ? (
                      <select className="module-table-input" value={normalizeSampleStatus(record.status)} onChange={(event) => updateRecord(record.id, { status: event.target.value as SampleRecord['status'] })}>
                        <option value="已采集">{t('已采集')}</option>
                        <option value="检测中">{t('检测中')}</option>
                        <option value="检测完成">{t('检测完成')}</option>
                      </select>
                    ) : (
                      <StatusPill value={normalizeSampleStatus(record.status)} />
                    )}
                  </td>
                  <td>
                    <div className="module-table-actions">
                      {isEditing ? (
                        <>
                          <button className="module-link-button module-link-button--primary" type="button" onClick={() => { setEditingId(null); void onSave?.(record); }}>{t('保存')}</button>
                          <button className="module-link-button" type="button" onClick={() => cancelEdit(record.id)}>{t('取消')}</button>
                        </>
                      ) : (
                        <button className="module-link-button" type="button" onClick={() => startEdit(record)}>{t('编辑')}</button>
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
  const { t } = useI18n();
  const start = total === 0 ? 0 : (page - 1) * clinicalTablePageSize + 1;
  const end = Math.min(page * clinicalTablePageSize, total);

  return (
    <footer className="module-table-footer">
      <span>{t(`显示 ${start} 至 ${end} 条，共 ${total} 条记录`)}</span>
      <div className="module-pagination">
        <button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)}>‹</button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <button className={pageNumber === page ? 'is-active' : undefined} type="button" key={pageNumber} onClick={() => onPageChange(pageNumber)}>{pageNumber}</button>
        ))}
        <button type="button" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>{t('下一页')}</button>
      </div>
    </footer>
  );
}

function OmicsTable({
  records,
  onView,
  onEdit,
  showStudyId = false
}: {
  records: SampleDetectionRow[];
  onView: (record: SampleDetectionRow) => void;
  onEdit: (record: SampleDetectionRow) => void;
  showStudyId?: boolean;
}) {
  const { t } = useI18n();
  const patientRowSpans = records.map((row, index) => {
    if (index > 0 && records[index - 1].studyId === row.studyId && records[index - 1].patientName === row.patientName) return 0;
    let count = 1;
    while (records[index + count]?.studyId === row.studyId && records[index + count]?.patientName === row.patientName) count += 1;
    return count;
  });
  const sampleRowSpans = records.map((row, index) => {
    if (
      index > 0 &&
      records[index - 1].studyId === row.studyId &&
      records[index - 1].patientName === row.patientName &&
      records[index - 1].sampleId === row.sampleId
    ) return 0;
    let count = 1;
    while (
      records[index + count]?.studyId === row.studyId &&
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
            {showStudyId ? <th>{t('Study ID')}</th> : null}
            <th>{t('患者编号')}</th>
            <th>{t('样本编号')}</th>
            <th>{t('样本类型')}</th>
            <th>{t('检测项目')}</th>
            <th>{t('当前状态')}</th>
            <th>{t('送检测时间')}</th>
            <th>QC</th>
            <th>{t('结果文件')}</th>
            <th>{t('操作')}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={record.id}>
              {showStudyId ? <td><span className="status-pill status-pill--info">{record.studyId}</span></td> : null}
              {patientRowSpans[index] > 0 && <td rowSpan={patientRowSpans[index]}>{record.patientName}</td>}
              {sampleRowSpans[index] > 0 && <td rowSpan={sampleRowSpans[index]}>{record.sampleId}</td>}
              <td>{t(record.sampleType)}</td>
              <td>{t(record.assay)}</td>
              <td><StatusPill value={record.status} /></td>
              <td>{record.sentAt}</td>
              <td><StatusPill value={record.qc} /></td>
              <td>{record.resultFile}</td>
              <td>
                <div className="module-table-actions">
                  <button className="module-link-button module-link-button--primary" type="button" onClick={() => onView(record)}>{t('查看')}</button>
                  <button className="module-link-button" type="button" onClick={() => onEdit(record)}>{t('编辑')}</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SampleLedgerTable({
  rows,
  onView,
  onEdit,
  showStudyId = false
}: {
  rows: SampleLedgerRow[];
  onView: (row: SampleLedgerRow) => void;
  onEdit: (row: SampleLedgerRow) => void;
  showStudyId?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="module-table-wrap">
      <table className="module-table module-table--sample-ledger">
        <thead>
          <tr>
            {showStudyId ? <th>{t('Study ID')}</th> : null}
            <th>{t('患者编号')}</th>
            <th>{t('住院号')}</th>
            <th>{t('样本编号')}</th>
            <th>{t('样本类型')}</th>
            <th>{t('采集日期')}</th>
            <th>{t('注释')}</th>
            <th>{t('操作')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {showStudyId ? <td><span className="status-pill status-pill--info">{row.studyId}</span></td> : null}
              <td>{row.patientName}</td>
              <td>{row.hospitalNo}</td>
              <td>{row.sampleId}</td>
              <td>{t(row.sampleType)}</td>
              <td>{row.collectedAt}</td>
              <td>{t(row.note)}</td>
              <td>
                <div className="module-table-actions">
                  <button className="module-link-button" type="button" onClick={() => onEdit(row)}>{t('编辑')}</button>
                  <button className="module-link-button module-link-button--primary" type="button" onClick={() => onView(row)}>{t('查看')}</button>
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
  const { t } = useI18n();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <footer className="module-table-footer">
      <span>{t(`显示 ${start} 至 ${end} 条，共 ${total} 条记录`)}</span>
      <div className="module-pagination">
        <button type="button" disabled={safePage === 1} onClick={() => onPageChange(safePage - 1)}>‹</button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <button className={pageNumber === safePage ? 'is-active' : undefined} type="button" key={pageNumber} onClick={() => onPageChange(pageNumber)}>{pageNumber}</button>
        ))}
        <button type="button" disabled={safePage === totalPages} onClick={() => onPageChange(safePage + 1)}>{t('下一页')}</button>
      </div>
    </footer>
  );
}

function SampleTestingStatTiles({
  items
}: {
  items: Array<{ label: string; value: string | number; helper?: string; icon: IconName }>;
}) {
  const { t } = useI18n();
  return (
    <div className="sample-testing-stat-grid">
      {items.map((item) => (
        <div className="sample-testing-stat" key={item.label}>
          <span className="sample-testing-stat__icon"><Icon name={item.icon} /></span>
          <div>
            <span>{t(item.label)}</span>
            <strong>{item.value}</strong>
            {item.helper && <small>{t(item.helper)}</small>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConsentManagementPage({ currentUser }: { currentUser?: AuthenticatedUser | null } = {}) {
  const { t } = useI18n();
  const initialConsentRecords = filterRecordsByCurrentStudyScope(consentRecords);
  const consentUploadInputRef = useRef<globalThis.HTMLInputElement>(null);
  const emptyConsentRecord: ConsentRecord = {
    id: 'NO-SCOPED-CONSENT',
    studyId: getCurrentScopedStudyId(),
    patientId: '',
    patientName: '-',
    hospitalNo: '-',
    diseaseType: '-',
    status: '待签署',
    signedAt: '-',
    version: consentVersion,
    method: '电子'
  };
  const [selected, setSelected] = useState<ConsentRecord>(initialConsentRecords[0] ?? emptyConsentRecord);
  const [baseRecords, setBaseRecords] = useState<ConsentRecord[]>(initialConsentRecords);
  const [recordOverrides, setRecordOverrides] = useState<Record<string, Partial<ConsentRecord>>>({});
  const [understoodRecords, setUnderstoodRecords] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'全部' | ConsentRecord['status']>('全部');
  const [studyFilter, setStudyFilter] = useState('全部 Study');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeConsentSection, setActiveConsentSection] = useState(0);
  const [consentActionStatus, setConsentActionStatus] = useState('等待知情同意操作');
  const [pendingConsentUploadRecord, setPendingConsentUploadRecord] = useState<ConsentRecord | null>(null);
  const [consentApprovals, setConsentApprovals] = useState<ApiApprovalRequest[]>([]);
  const records = useMemo(() => {
    return baseRecords.map((record) => ({ ...record, ...recordOverrides[record.id] }));
  }, [baseRecords, recordOverrides]);
  const consentStudyOptions = useMemo(() => uniqueOptionalStudyIds(records), [records]);
  const showConsentStudyId = consentStudyOptions.length > 1;
  const studyFilteredRecords = useMemo(
    () => records.filter((record) => studyFilter === '全部 Study' || record.studyId === studyFilter),
    [records, studyFilter]
  );
  const selectedRecord = records.find((record) => record.id === selected.id) ?? records[0] ?? emptyConsentRecord;
  const statusCounts = useMemo(() => {
    return studyFilteredRecords.reduce<Record<'全部' | ConsentRecord['status'], number>>(
      (acc, record) => {
        acc.全部 += 1;
        acc[record.status] += 1;
        return acc;
      },
      { 全部: 0, 待签署: 0, 已签署: 0, 撤回审批中: 0, 已撤回: 0, 重签审批中: 0, 已重签: 0 }
    );
  }, [studyFilteredRecords]);
  const selectedConsentPreviewContent = getConsentPreviewContent(selectedRecord.studyId);
  const visibleConsentApprovals = useMemo(() => {
    const visibleStudyIds = new Set(studyFilteredRecords.map((record) => record.studyId).filter(Boolean));
    return consentApprovals
      .filter((approval) => approval.approval_type.startsWith('econsent_'))
      .filter((approval) => !visibleStudyIds.size || visibleStudyIds.has(approval.study_id))
      .slice(0, 5);
  }, [consentApprovals, studyFilteredRecords]);
  const currentConsentSection = selectedConsentPreviewContent[Math.min(activeConsentSection, selectedConsentPreviewContent.length - 1)]!;
  const selectedUnderstood = understoodRecords[selectedRecord.id] || selectedRecord.status !== '待签署';
  const flowStepIndex = ['已签署', '已重签'].includes(selectedRecord.status)
    ? 3
    : ['已撤回', '撤回审批中', '重签审批中'].includes(selectedRecord.status)
      ? 1
      : selectedUnderstood ? 1 : 0;
  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return studyFilteredRecords
      .filter((record) => statusFilter === '全部' || record.status === statusFilter)
      .filter((record) => {
        if (!normalized) return true;
        return [record.studyId ?? '', record.patientName, record.hospitalNo, record.diseaseType, record.status]
          .some((value) => value.toLowerCase().includes(normalized));
      });
  }, [query, statusFilter, studyFilteredRecords]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / consentPageSize));
  const pageStart = (currentPage - 1) * consentPageSize;
  const paginatedRecords = filteredRecords.slice(pageStart, pageStart + consentPageSize);
  const displayStart = filteredRecords.length ? pageStart + 1 : 0;
  const displayEnd = Math.min(pageStart + consentPageSize, filteredRecords.length);

  const printConsentPdf = () => {
    setUnderstoodRecords((current) => ({ ...current, [selectedRecord.id]: true }));
    const previewWindow = window.open(consentPreviewPdfUrl, '_blank', 'noopener,noreferrer');
    if (previewWindow) {
      setConsentActionStatus('已打开知情同意 PDF 预览；如需纸质归档，请在预览页打印');
    } else {
      setConsentActionStatus('浏览器阻止了 PDF 预览弹窗，已尝试在后台触发打印');
    }
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

  const applyConsentUpdate = async (record: ConsentRecord, payload: Partial<Pick<ConsentRecord, 'status' | 'signedAt' | 'version' | 'method'>>, message: string) => {
    const nextRecord = { ...record, ...payload };
    setRecordOverrides((current) => ({
      ...current,
      [record.id]: {
        status: nextRecord.status,
        signedAt: nextRecord.signedAt,
        version: nextRecord.version,
        method: nextRecord.method
      }
    }));
    setUnderstoodRecords((current) => ({ ...current, [record.id]: true }));
    setSelected(nextRecord);
    setConsentActionStatus(`${message}，同步后端中...`);
    try {
      await updateConsentRecord(record.id, payload);
      setConsentActionStatus(`${message}，已同步后端`);
    } catch {
      setConsentActionStatus(`${message}，后端不可用，已保存在本页`);
    }
  };

  const startConsentUpload = (record: ConsentRecord) => {
    setPendingConsentUploadRecord(record);
    consentUploadInputRef.current?.click();
  };

  const handleConsentUploadFile = async (file: globalThis.File | undefined) => {
    const record = pendingConsentUploadRecord ?? selectedRecord;
    if (!file) {
      setPendingConsentUploadRecord(null);
      return;
    }

    setConsentActionStatus(`知情文件 ${file.name} 正在上传...`);
    try {
      await uploadFileToBackend(file, {
        category: 'consent',
        patientId: record.patientId,
        consentId: record.id,
        isDeidentified: false
      });
      await applyConsentUpdate(
        record,
        { status: '已签署', signedAt: new Date().toISOString().slice(0, 10), method: '电子' },
        `知情文件 ${file.name} 已上传并签署`
      );
    } catch {
      setConsentActionStatus(`知情文件 ${file.name} 上传失败；请确认后端连接和文件权限`);
    } finally {
      setPendingConsentUploadRecord(null);
      if (consentUploadInputRef.current) consentUploadInputRef.current.value = '';
    }
  };

  const signConsent = (record: ConsentRecord) => {
    void applyConsentUpdate(
      record,
      { status: '已签署', signedAt: new Date().toISOString().slice(0, 10), method: '电子' },
      '已完成签署'
    );
  };

  const withdrawConsent = (record: ConsentRecord) => {
    setConsentActionStatus(`正在提交 ${record.patientName} 知情撤回审批...`);
    void requestConsentWithdrawal(record.id, `撤回 ${record.patientName} 知情同意`)
      .then((approval) => {
        setConsentApprovals((rows) => [approval, ...rows.filter((row) => row.id !== approval.id)]);
        setConsentActionStatus(`知情撤回审批已提交：${approval.id}`);
      })
      .catch(() => {
        setConsentActionStatus('知情撤回审批提交失败；后端不可用或当前角色无权限');
      });
  };

  const resignConsent = (record: ConsentRecord) => {
    setConsentActionStatus(`正在提交 ${record.patientName} 知情重签审批...`);
    void requestConsentResign(record.id, `重签 ${record.patientName} 知情同意`)
      .then((approval) => {
        setConsentApprovals((rows) => [approval, ...rows.filter((row) => row.id !== approval.id)]);
        setConsentActionStatus(`知情重签审批已提交：${approval.id}`);
      })
      .catch(() => {
        setConsentActionStatus('知情重签审批提交失败；后端不可用或当前角色无权限');
      });
  };

  const viewConsent = (record: ConsentRecord) => {
    setSelected(record);
    setConsentActionStatus(`正在查看 ${record.patientName} 的知情同意记录`);
  };

  async function refreshConsentApprovals(studyIds = consentStudyOptions.length ? consentStudyOptions : [selectedRecord.studyId ?? 'LGL-1111']) {
    const results = await Promise.allSettled(studyIds.map((studyId) => fetchApprovalRequests(studyId)));
    const approvals = results
      .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
      .filter((approval) => approval.approval_type.startsWith('econsent_'));
    setConsentApprovals((rows) => {
      const next = [...approvals, ...rows];
      return next.filter((approval, index) => next.findIndex((item) => item.id === approval.id) === index);
    });
  }

  async function approveConsentApproval(approval: ApiApprovalRequest) {
    setConsentActionStatus(`eConsent 审批 ${approval.id} 正在批准...`);
    try {
      const approved = await approveApprovalRequest(approval.id, 'Approved from eConsent page.');
      setConsentApprovals((rows) => [approved, ...rows.filter((row) => row.id !== approved.id)]);
      setConsentActionStatus(`eConsent 审批已批准：${approved.id}`);
    } catch {
      setConsentActionStatus('eConsent 审批批准失败；可能是提交人自批或权限不足');
    }
  }

  async function completeConsentApproval(approval: ApiApprovalRequest) {
    setConsentActionStatus(`eConsent 审批 ${approval.id} 正在完成并同步知情状态...`);
    try {
      const completed = await completeApprovalRequest(approval.id, 'Completed from eConsent page.');
      setConsentApprovals((rows) => [completed, ...rows.filter((row) => row.id !== completed.id)]);
      const nextRecords = await fetchConsentRecords();
      if (nextRecords.length) {
        setBaseRecords(nextRecords);
        setRecordOverrides({});
        const refreshedSelected = nextRecords.find((record) => record.id === approval.entity_id) ?? nextRecords[0];
        setSelected(refreshedSelected);
      }
      await refreshConsentApprovals([completed.study_id]);
      setConsentActionStatus(`eConsent 审批已完成并同步状态：${completed.id}`);
    } catch {
      setConsentActionStatus('eConsent 审批完成失败；请确认当前角色具备完成权限');
    }
  }

  const markSelectedUnderstood = () => {
    setUnderstoodRecords((current) => ({ ...current, [selectedRecord.id]: true }));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, studyFilter]);

  useEffect(() => {
    if (studyFilter !== '全部 Study' && !consentStudyOptions.includes(studyFilter)) {
      setStudyFilter('全部 Study');
    }
  }, [consentStudyOptions, studyFilter]);

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
    let ignore = false;
    const studyIds = studyFilter === '全部 Study' ? consentStudyOptions : [studyFilter];
    if (!studyIds.length) return undefined;
    void Promise.allSettled(studyIds.map((studyId) => fetchApprovalRequests(studyId)))
      .then((results) => {
        if (ignore) return;
        const approvals = results
          .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
          .filter((approval) => approval.approval_type.startsWith('econsent_'));
        setConsentApprovals((rows) => {
          const next = [...approvals, ...rows];
          return next.filter((approval, index) => next.findIndex((item) => item.id === approval.id) === index);
        });
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [consentStudyOptions, studyFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setActiveConsentSection(0);
  }, [selectedRecord.studyId]);

  return (
    <div className="content workspace-page">
      <section className="module-card consent-workbench">
        <header className="consent-workbench__header">
          <div>
            <h2><Icon name="file" />{t('知情同意')}</h2>
            <div className="consent-workbench__badges">
              <span>{t('当前版本')} <strong>{consentVersion}</strong></span>
              <span><Icon name="database" />{t('Study ID')} <strong>{selectedRecord.studyId ?? '-'}</strong></span>
              <span className="consent-workbench__badge--patient"><Icon name="patients" />{t('当前患者')} <strong>{selectedRecord.patientName}</strong></span>
              <span className="consent-workbench__badge--hospital"><Icon name="building" />{t('住院号')} <strong>{selectedRecord.hospitalNo}</strong></span>
              <span><Icon name="calendar" />{t('最近更新')} <strong>2026-04-23</strong></span>
              <span className="is-success"><Icon name="shield" />{t('伦理批准')}</span>
            </div>
          </div>
          <button className="consent-study-link" type="button" disabled title={t('研究详情入口当前为展示状态')}>
            <Icon name="building" />
            {t(getConsentStudyTitle(selectedRecord.studyId))}
            <Icon name="chevronRight" />
          </button>
        </header>

        <div className="consent-workbench__main">
          <nav className="consent-preview__nav" aria-label={t('知情同意书章节')}>
            <h3><Icon name="file" />{t('知情同意内容')}</h3>
            {selectedConsentPreviewContent.map((section, index) => (
              <button
                className={index === activeConsentSection ? 'is-active' : undefined}
                type="button"
                key={section.title}
                aria-pressed={index === activeConsentSection}
                onClick={() => setActiveConsentSection(index)}
              >
                <Icon name={section.icon} />
                {t(section.title)}
              </button>
            ))}
          </nav>

          <div className="consent-overview">
            <section className="consent-overview__content">
              <header>
                <Icon name={currentConsentSection.icon} />
                <div>
                  <span>{t(currentConsentSection.eyebrow)}</span>
                  <h3>{t(currentConsentSection.title)}</h3>
                </div>
              </header>
              <ConsentSectionPreview
                section={currentConsentSection}
                onPrint={printConsentPdf}
                onUnderstand={markSelectedUnderstood}
                onUpload={() => startConsentUpload(selectedRecord)}
              />
            </section>

            <aside className="consent-visual-panel">
              <div className="consent-pdf-preview">
                <iframe src={`${consentPreviewPdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} title={t('知情同意书 V1.0 PDF 预览')} />
              </div>
              <button className="consent-print-button" type="button" onClick={printConsentPdf}><Icon name="reports" />{t('预览打印')}</button>
            </aside>
          </div>
        </div>

        <section className="consent-flow">
          <h3>{t('知情同意流程')}</h3>
          {[
            ['1', '阅读知情同意书', '了解研究目的与内容'],
            ['2', '确认理解', '确认已充分理解'],
            ['3', '签署', '完成签署流程'],
            ['4', '归档', '电子归档与留痕']
          ].map(([step, label, helper], index) => (
            <div className={`${index <= flowStepIndex ? 'is-complete' : ''} ${index === flowStepIndex ? 'is-active' : ''}`} key={step}>
              <strong>{step}</strong>
              <span>{t(label)}</span>
              <small>{t(helper)}</small>
            </div>
          ))}
        </section>
        <div className="module-upload-status">
          <Icon name="shield" />
          <span>{t(consentActionStatus)}</span>
        </div>
        <div className="consent-approval-panel">
          <div>
            <strong>{t('eConsent 审批队列')}</strong>
            <span>{t('撤回/重签必须进入 Approval Center 后才会改变知情状态')}</span>
          </div>
          <div className="consent-approval-list">
            {visibleConsentApprovals.length ? visibleConsentApprovals.map((approval) => (
              <div className="consent-approval-row" key={approval.id}>
                <span className="status-pill status-pill--info">{approval.study_id}</span>
                <span>{approval.id}</span>
                <strong>{t(approvalTypeLabel(approval.approval_type))}</strong>
                <span>{approval.entity_id}</span>
                <span>{t('目标状态')}: {String(approval.payload?.requested_status ?? '-')}</span>
                <span className={`status-pill status-pill--${approval.status === 'completed' || approval.status === 'approved' ? 'success' : approval.status === 'rejected' || approval.status === 'cancelled' ? 'danger' : 'warning'}`}>{t(approval.status)}</span>
                <div className="module-table-actions">
                  <button
                    className="module-link-button"
                    type="button"
                    disabled={approval.status !== 'submitted' || approval.submitted_by === currentUser?.id}
                    title={approval.submitted_by === currentUser?.id ? t('Separate reviewer required') : undefined}
                    onClick={() => void approveConsentApproval(approval)}
                  >
                    {t('Approve')}
                  </button>
                  <button
                    className="module-link-button module-link-button--primary"
                    type="button"
                    disabled={approval.status !== 'approved'}
                    onClick={() => void completeConsentApproval(approval)}
                  >
                    {t('完成')}
                  </button>
                </div>
              </div>
            )) : (
              <span className="module-empty-note">{t('暂无 eConsent 审批；点击已签署记录的撤回或已撤回记录的重签可创建。')}</span>
            )}
          </div>
        </div>
        <input
          ref={consentUploadInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          hidden
          onChange={(event) => void handleConsentUploadFile(event.target.files?.[0])}
        />
      </section>

      <section className="module-card module-card--wide">
          <header className="module-card__header">
            <h2>{t('患者知情同意列表')}</h2>
            <div className="workspace-search workspace-search--compact">
              <Icon name="search" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('搜索患者编号或住院号')} />
            </div>
          </header>
          <div className="workspace-filter-row">
            {showConsentStudyId ? (
              <label>
                <span>{t('Study ID')}</span>
                <select value={studyFilter} onChange={(event) => setStudyFilter(event.target.value)}>
                  <option value="全部 Study">{t('全部 Study')}</option>
                  {consentStudyOptions.map((studyId) => <option value={studyId} key={studyId}>{studyId}</option>)}
                </select>
              </label>
            ) : null}
            {consentStatusOptions.map((item) => (
              <button
                className={`consent-status-chip consent-status-chip--${consentStatusClass[item]}${statusFilter === item ? ' is-selected' : ''}`}
                type="button"
                key={item}
                onClick={() => setStatusFilter(item)}
              >
                <span>{t(item)}</span>
                <strong>{statusCounts[item]}</strong>
              </button>
            ))}
          </div>
          <div className="module-table-wrap">
            <table className="module-table">
              <thead><tr>{showConsentStudyId ? <th>{t('Study ID')}</th> : null}<th>{t('患者编号')}</th><th>{t('住院号')}</th><th>{t('疾病类型')}</th><th>{t('当前状态')}</th><th>{t('签署日期')}</th><th>{t('版本')}</th><th>{t('操作')}</th></tr></thead>
              <tbody>
                {paginatedRecords.map((record) => (
                  <tr className={selectedRecord.id === record.id ? 'is-selected' : undefined} key={record.id} onClick={() => setSelected(record)}>
                    {showConsentStudyId ? <td><span className="status-pill status-pill--info">{record.studyId}</span></td> : null}
                    <td>{record.patientName}</td><td>{record.hospitalNo}</td><td>{t(record.diseaseType)}</td><td><StatusPill value={record.status} /></td>
                    <td>{record.signedAt}</td><td>{record.version}</td>
                    <td>
                      <div className="module-table-actions">
                        {record.status === '待签署' ? (
                          <>
                            <button className="module-link-button module-link-button--primary" type="button" onClick={(event) => { event.stopPropagation(); signConsent(record); }}>{t('签署')}</button>
                            <button className="module-link-button" type="button" onClick={(event) => { event.stopPropagation(); startConsentUpload(record); }}>{t('上传')}</button>
                          </>
                        ) : null}
                        {record.status === '已签署' || record.status === '已重签' ? (
                          <>
                            <button className="module-link-button" type="button" onClick={(event) => { event.stopPropagation(); viewConsent(record); }}>{t('查看')}</button>
                            <button className="module-link-button module-link-button--danger" type="button" onClick={(event) => { event.stopPropagation(); withdrawConsent(record); }}>{t('撤回')}</button>
                          </>
                        ) : null}
                        {record.status === '撤回审批中' || record.status === '重签审批中' ? (
                          <>
                            <button className="module-link-button" type="button" onClick={(event) => { event.stopPropagation(); viewConsent(record); }}>{t('查看')}</button>
                            <button className="module-link-button" type="button" disabled title={t('审批完成后状态才会同步刷新')}>{t('审批中')}</button>
                          </>
                        ) : null}
                        {record.status === '已撤回' ? (
                          <>
                            <button className="module-link-button" type="button" onClick={(event) => { event.stopPropagation(); viewConsent(record); }}>{t('查看')}</button>
                            <button className="module-link-button module-link-button--primary" type="button" onClick={(event) => { event.stopPropagation(); resignConsent(record); }}>{t('重签')}</button>
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
            <span>{t(`显示 ${displayStart} 至 ${displayEnd} 条，共 ${filteredRecords.length} 条记录`)}</span>
            <div className="module-pagination">
              <button
                type="button"
                aria-label={t('上一页')}
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
                {t('下一页')}
              </button>
            </div>
          </footer>
      </section>
    </div>
  );
}

export function SampleManagementPage() {
  const { t } = useI18n();
  const [sampleRows, setSampleRows] = useState(filterRecordsByCurrentStudyScope(samples));
  const [sampleActionStatus, setSampleActionStatus] = useState('等待样本操作');
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
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

  async function handleCreateSample() {
    const base = sampleRows[0];
    if (!base) {
      setSampleActionStatus('暂无患者样本上下文，无法新增样本');
      return;
    }

    const now = new Date();
    const localId = `SMP-${String(sampleRows.length + 1).padStart(3, '0')}`;
    const record: SampleRecord = {
      ...base,
      id: localId,
      sampleType: '血液',
      visit: base.visit || 'Baseline',
      collectedAt: now.toISOString().slice(0, 10),
      storage: '待分配',
      status: '已采集',
      linkedOmics: []
    };

    setSampleRows((rows) => [record, ...rows]);
    setEditingSampleId(localId);
    setSampleActionStatus('新增样本已加入列表，正在同步后端...');

    try {
      const created = await createSampleRecord(record);
      setSampleRows((rows) => rows.map((item) => (item.id === localId ? { ...item, ...created } : item)));
      setEditingSampleId(created.id);
      setSampleActionStatus(`新增样本已同步后端：${created.id}`);
    } catch {
      setSampleActionStatus('后端不可用，新增样本已保存在本页');
    }
  }

  async function handleSaveSample(record: SampleRecord) {
    setSampleActionStatus(`样本 ${record.id} 正在同步后端...`);
    try {
      const saved = await updateSampleRecord(record);
      setSampleRows((rows) => rows.map((item) => (item.id === record.id ? { ...item, ...saved } : item)));
      setSampleActionStatus(`样本 ${record.id} 已同步后端`);
    } catch {
      setSampleActionStatus(`后端不可用，样本 ${record.id} 已保存在本页`);
    }
  }

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
            <h2>{t('样本台账')}</h2>
            <button className="module-primary-button" type="button" onClick={() => void handleCreateSample()}><Icon name="filePlus" />{t('新增样本')}</button>
          </header>
          <div className="module-upload-status">
            <Icon name="shield" />
            <span>{t(sampleActionStatus)}</span>
          </div>
          <SampleTable
            records={sampleRows}
            onChange={setSampleRows}
            onSave={(record) => void handleSaveSample(record)}
            initialEditingId={editingSampleId}
            onInitialEditingHandled={() => setEditingSampleId(null)}
          />
        </section>
        <aside className="module-stack">
          <section className="module-card">
            <header className="module-card__header"><h2>{t('样本处理流程')}</h2></header>
            <SimpleTimeline items={[
              { label: '采集登记', helper: '12 个样本完成' },
              { label: '离心 / 分装', helper: '10 个样本完成' },
              { label: '入库定位', helper: 'A1-A4 / C1-C4' },
              { label: '送检交接', helper: '9 个样本已送检' }
            ]} />
          </section>
          <section className="module-card">
            <header className="module-card__header"><h2>{t('存储分布')}</h2></header>
            <DetailList rows={[['-80℃冰箱A', '4 份'], ['-80℃冰箱B', '4 份'], ['液氮罐C', '4 份'], ['病理库R', '1 份']]} />
          </section>
          <section className="module-card">
            <header className="module-card__header"><h2>{t('采集完成率趋势')}</h2><span>{t('本月')}</span></header>
            <MiniTrend label="样本采集完成率趋势" />
          </section>
        </aside>
      </div>
    </div>
  );
}

export function OmicsTestingPage() {
  const { t } = useI18n();
  const initialOmicsRecords = filterRecordsByCurrentStudyScope(omicsRecords);
  const [records, setRecords] = useState(initialOmicsRecords);
  const [selected, setSelected] = useState<OmicsRecord | null>(initialOmicsRecords[0] ?? null);
  const completed = records.filter((record) => record.status === '结果归档').length;
  const selectedRecord = selected ?? records[0];

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
            <h2>{t('多组学检测列表')}</h2>
            <div className="workspace-filter-row">
              {['全部', '进行中', '已完成', '失败/重测', 'WGS', 'TCR/BCR', 'Olink/Simoa', '空间转录组'].map((item) => (
                <button className="chip" type="button" key={item} disabled title={t('该筛选在新版样本及检测页中处理')}>{t(item)}</button>
              ))}
            </div>
          </header>
          <div className="module-table-wrap">
            <table className="module-table">
              <thead><tr><th>{t('检测编号')}</th><th>{t('样本编号')}</th><th>{t('患者编号')}</th><th>{t('样本类型')}</th><th>{t('检测项目')}</th><th>{t('平台')}</th><th>{t('当前状态')}</th><th>QC</th><th>{t('操作')}</th></tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} onClick={() => setSelected(record)}>
                    <td>{record.id}</td><td>{record.sampleId}</td><td>{record.patientName}</td><td>{record.sampleType}</td><td>{record.assay}</td><td>{record.platform}</td>
                    <td><StatusPill value={record.status} /></td><td><StatusPill value={record.qc} /></td><td><button className="module-link-button" type="button" disabled title={t('文件下载需等待结果文件上传')}>{t('文件')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="module-stack">
          <section className="module-card">
            <header className="module-card__header"><h2>{t('当前样本检测详情')}</h2></header>
            {selectedRecord ? (
              <DetailList rows={[
                ['检测编号', selectedRecord.id],
                ['患者编号', selectedRecord.patientName],
                ['样本编号', selectedRecord.sampleId],
                ['样本类型', selectedRecord.sampleType],
                ['检测项目', selectedRecord.assay],
                ['平台', selectedRecord.platform],
                ['批次/Run ID', selectedRecord.runId],
                ['送检日期', selectedRecord.sentAt],
                ['完成日期', selectedRecord.completedAt]
              ]} />
            ) : (
              <p className="module-empty-state">{t('当前 Study 暂无检测记录')}</p>
            )}
          </section>
          <section className="module-card">
            <header className="module-card__header"><h2>{t('检测流程与时间线')}</h2></header>
            {selectedRecord ? (
              <SimpleTimeline items={[
                { label: '样本接收', helper: `${selectedRecord.sentAt} 09:10` },
                { label: '文库构建', helper: '2026-04-21 11:05' },
                { label: '上机测序', helper: '2026-04-22 08:40' },
                { label: '结果归档', helper: selectedRecord.completedAt === '-' ? '待完成' : `${selectedRecord.completedAt} 10:15`, done: selectedRecord.completedAt !== '-' }
              ]} />
            ) : null}
          </section>
        </aside>
      </div>

      <section className="module-card">
        <header className="module-card__header">
          <h2>{t('检测结果概览')}</h2>
          <span>{t('研究用途，不直接用于临床决策')}</span>
        </header>
        <div className="result-overview">
          <div>
            <strong>{t('结果摘要')}</strong>
            <p>{t('检测到免疫相关候选变异位点，建议结合临床表型与其他组学联合解读。')}</p>
            <p>{t('可关联 TCR/BCR、Olink/Simoa、空间转录组结果做多维分析。')}</p>
          </div>
          <div className="dna-visual"><Icon name="dna" size={96} /></div>
          <div className="result-tags">
            {['WGS', 'TCR/BCR', '蛋白组学', '空间转录组'].map((item) => <span key={item}>{t(item)}</span>)}
          </div>
        </div>
      </section>
    </div>
  );
}

export function SampleTestingPage() {
  const { t } = useI18n();
  const [sampleRows, setSampleRows] = useState(filterRecordsByCurrentStudyScope(samples));
  const [records, setRecords] = useState(filterRecordsByCurrentStudyScope(omicsRecords));
  const [studyFilter, setStudyFilter] = useState('全部 Study');
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
  const [sampleTestingEditor, setSampleTestingEditor] = useState<SampleTestingEditor | null>(null);
  const studyOptions = useMemo(() => uniqueOptionalStudyIds([...sampleRows, ...records]), [records, sampleRows]);
  const showStudyId = studyOptions.length > 1;
  const filteredSampleRowsByStudy = useMemo(
    () => sampleRows.filter((sample) => studyFilter === '全部 Study' || sample.studyId === studyFilter),
    [sampleRows, studyFilter]
  );
  const filteredRecordsByStudy = useMemo(
    () => records.filter((record) => studyFilter === '全部 Study' || record.studyId === studyFilter),
    [records, studyFilter]
  );
  const detectionRows = useMemo(() => buildSampleDetectionRows(filteredSampleRowsByStudy, filteredRecordsByStudy), [filteredRecordsByStudy, filteredSampleRowsByStudy]);
  const sampleLedgerRows = useMemo(() => buildSampleLedgerRows(filteredSampleRowsByStudy), [filteredSampleRowsByStudy]);
  const sampleTypeOptions = useMemo(() => ['全部', ...Array.from(new Set(sampleLedgerRows.map((row) => row.sampleType)))], [sampleLedgerRows]);
  const filteredSampleLedgerRows = useMemo(() => {
    const patientQuery = samplePatientQuery.trim().toLowerCase();
    const idQuery = sampleIdQuery.trim().toLowerCase();

    return sampleLedgerRows.filter((row) => {
      if (patientQuery && !row.patientName.toLowerCase().includes(patientQuery) && !row.studyId?.toLowerCase().includes(patientQuery)) return false;
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
      (a.studyId ?? '').localeCompare(b.studyId ?? '') ||
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
      if (patientQuery && !row.patientName.toLowerCase().includes(patientQuery) && !row.studyId?.toLowerCase().includes(patientQuery)) return false;
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
  const isLungSampleContext = studyFilter === 'LZXK-01' || (studyFilter === '全部 Study' && filteredSampleRowsByStudy.length > 0 && filteredSampleRowsByStudy.every((sample) => sample.studyId === 'LZXK-01'));
  const sampleStatItems = useMemo(() => {
    const blood = filteredSampleRowsByStudy.filter((sample) => sample.sampleType === '血液').length;
    const csf = filteredSampleRowsByStudy.filter((sample) => sample.sampleType === 'CSF').length;
    const kidney = filteredSampleRowsByStudy.filter((sample) => sample.sampleType.includes('肾')).length;
    const tissue = filteredSampleRowsByStudy.filter((sample) => sample.sampleType === '组织').length;
    const pleural = filteredSampleRowsByStudy.filter((sample) => sample.sampleType === '胸水').length;

    if (isLungSampleContext) {
      return [
        { label: '已采集样本数', value: filteredSampleRowsByStudy.length, icon: 'sampleBank' as IconName },
        { label: '血液', value: blood, icon: 'sampleTube' as IconName },
        { label: '组织', value: tissue, icon: 'database' as IconName },
        { label: '胸水', value: pleural, icon: 'lab' as IconName }
      ];
    }

    return [
      { label: '已采集样本数', value: filteredSampleRowsByStudy.length, icon: 'sampleBank' as IconName },
      { label: '血液', value: blood, icon: 'sampleTube' as IconName },
      { label: 'CSF', value: csf, icon: 'lab' as IconName },
      { label: '肾', value: kidney, icon: 'database' as IconName }
    ];
  }, [filteredSampleRowsByStudy, isLungSampleContext]);
  const omicsStatItems = useMemo(() => {
    const completedOrArchived = detectionRows.filter((row) => row.status === '检测完成' || row.status === '已归档').length;
    const rnaSeq = detectionRows.filter((row) => row.assay === 'RNA-seq').length;
    const tcrBcr = detectionRows.filter((row) => row.assay === 'TCR/BCR').length;
    const csfRna = detectionRows.filter((row) => row.sampleType === 'CSF' && row.assay === 'RNA-seq').length;
    const scrnaSeq = detectionRows.filter((row) => row.assay === 'scRNA-seq').length;
    const ngsPanel = detectionRows.filter((row) => row.assay === 'NGS panel').length;
    const ctdna = detectionRows.filter((row) => row.assay === 'ctDNA').length;
    const pathology = detectionRows.filter((row) => row.assay === '病理复核').length;

    if (isLungSampleContext) {
      return [
        { label: '检测中', value: running, icon: 'clock' as IconName },
        { label: '检测完成', value: completedOrArchived, icon: 'check' as IconName },
        { label: 'NGS panel', value: ngsPanel, icon: 'dna' as IconName },
        { label: 'ctDNA', value: ctdna, icon: 'shield' as IconName },
        { label: '病理复核', value: pathology, icon: 'lab' as IconName }
      ];
    }

    return [
      { label: '检测中', value: running, icon: 'clock' as IconName },
      { label: '检测完成', value: completedOrArchived, icon: 'check' as IconName },
      { label: 'RNA-seq', value: rnaSeq, icon: 'dna' as IconName },
      { label: 'TCR/BCR', value: tcrBcr, icon: 'shield' as IconName },
      { label: 'CSF/RNA', value: csfRna, icon: 'lab' as IconName },
      { label: 'scRNA-seq', value: scrnaSeq, icon: 'sampleTube' as IconName }
    ];
  }, [detectionRows, isLungSampleContext, running]);
  const omicsStatusOptions: OmicsFilterStatus[] = ['全部', '待检测', '检测中', '检测完成', '已归档'];
  const omicsAssayOptions = useMemo<Array<OmicsRecord['assay']>>(() => {
    const baseOptions: Array<OmicsRecord['assay']> = isLungSampleContext
      ? ['NGS panel', 'ctDNA', '病理复核']
      : ['WGS', 'TCR/BCR', 'Olink/Simoa', '蛋白组', '代谢组'];
    const seen = new Set<OmicsRecord['assay']>(baseOptions);
    for (const record of filteredRecordsByStudy) seen.add(record.assay);
    return Array.from(seen);
  }, [filteredRecordsByStudy, isLungSampleContext]);

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
  }, [sampleDateFrom, sampleDateTo, sampleIdQuery, samplePatientQuery, sampleTypeFilter, studyFilter]);

  useEffect(() => {
    setOmicsPage(1);
  }, [omicsAssayFilter, omicsPatientQuery, omicsSampleQuery, omicsStatusFilter, studyFilter]);

  useEffect(() => {
    if (studyFilter !== '全部 Study' && !studyOptions.includes(studyFilter)) {
      setStudyFilter('全部 Study');
    }
  }, [studyFilter, studyOptions]);

  async function handleResultFileUpload(file: globalThis.File) {
    const linkedSample = filteredSampleRowsByStudy[0] ?? sampleRows[0];
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

  async function handleAddSample() {
    const template = filteredSampleRowsByStudy[0] ?? sampleRows[0];
    if (!template) {
      setUploadStatus('暂无患者样本上下文，无法新增样本');
      return;
    }
    const nextSample: SampleRecord = {
      ...template,
      id: `SPL-NEW-${Date.now()}`,
      sampleType: '血液',
      visit: 'V1 新增采集',
      collectedAt: new Date().toISOString().slice(0, 10),
      storage: '待入库',
      status: '已采集',
      linkedOmics: ['待选择']
    };
    setSampleTestingEditor({ kind: 'sample', draft: nextSample });
    setUploadStatus('请确认患者、访视、样本类型、采集时间、条码和保存位置后保存');
  }

  async function handleEditSample(row: SampleLedgerRow) {
    const target = sampleRows.find((sample) => sample.id === row.id);
    if (!target) return;
    setSampleTestingEditor({ kind: 'sample', draft: { ...target, linkedOmics: [...target.linkedOmics] } });
    setUploadStatus(`正在编辑样本 ${row.sampleId}`);
  }

  function handleViewSample(row: SampleLedgerRow) {
    setSampleIdQuery(row.sampleId);
    setUploadStatus(`已定位样本 ${row.sampleId}`);
  }

  async function handleAddOmics() {
    const sample = filteredSampleRowsByStudy[0] ?? sampleRows[0];
    if (!sample) {
      setUploadStatus('暂无样本上下文，无法新增检测');
      return;
    }
    const nextRecord: OmicsRecord = {
      id: `OMX-NEW-${Date.now()}`,
      studyId: sample.studyId,
      testingProjectId: sample.studyId === 'LZXK-01' ? 'TP-LUNG-RESIST-OMICS' : 'TP-SLE-OMICS',
      patientId: sample.patientId,
      patientName: sample.patientName,
      sampleId: sample.id,
      sampleType: sample.sampleType,
      assay: sample.studyId === 'LZXK-01' ? 'ctDNA' : 'WGS',
      platform: sample.studyId === 'LZXK-01' ? 'NextSeq 2000' : 'NovaSeq 6000',
      runId: `RUN-${Date.now().toString().slice(-6)}`,
      status: '样本接收',
      qc: '待确认',
      sentAt: new Date().toISOString().slice(0, 10),
      completedAt: '-'
    };
    setSampleTestingEditor({ kind: 'omics', draft: nextRecord });
    setUploadStatus('请确认样本编号、检测项目、送检时间、平台、批次和 QC 要求后保存');
  }

  async function handleEditOmics(row: SampleDetectionRow) {
    const target = records.find((record) => record.id === row.id);
    if (target) {
      setSampleTestingEditor({ kind: 'omics', draft: { ...target } });
      setUploadStatus(`正在编辑检测 ${row.id}`);
      return;
    }

    const sample = sampleRows.find((item) =>
      item.studyId === row.studyId &&
      (formatSampleLedgerId(item, sampleRows) === row.sampleId || item.id === row.sampleId)
    );
    if (!sample) return;
    const nextRecord: OmicsRecord = {
      id: `OMX-NEW-${Date.now()}`,
      studyId: sample.studyId,
      testingProjectId: sample.studyId === 'LZXK-01' ? 'TP-LUNG-RESIST-OMICS' : 'TP-SLE-OMICS',
      patientId: sample.patientId,
      patientName: sample.patientName,
      sampleId: sample.id,
      sampleType: sample.sampleType,
      assay: sample.studyId === 'LZXK-01' ? 'ctDNA' : 'WGS',
      platform: sample.studyId === 'LZXK-01' ? 'NextSeq 2000' : 'NovaSeq 6000',
      runId: `RUN-${Date.now().toString().slice(-6)}`,
      status: '样本接收',
      qc: '待确认',
      sentAt: new Date().toISOString().slice(0, 10),
      completedAt: '-'
    };
    setSampleTestingEditor({ kind: 'omics', draft: nextRecord });
    setUploadStatus(`正在为样本 ${row.sampleId} 新建检测`);
  }

  function handleViewOmics(row: SampleDetectionRow) {
    setOmicsSampleQuery(row.sampleId);
    setUploadStatus(`已定位检测 ${row.id}`);
  }

  function patchSampleTestingDraft(patch: Partial<SampleRecord> | Partial<OmicsRecord>) {
    setSampleTestingEditor((editor) => {
      if (!editor) return editor;
      return { ...editor, draft: { ...editor.draft, ...patch } } as SampleTestingEditor;
    });
  }

  async function saveSampleTestingEditor() {
    if (!sampleTestingEditor) return;

    if (sampleTestingEditor.kind === 'sample') {
      const draft = sampleTestingEditor.draft;
      if (!draft.patientId || !draft.patientName || !draft.sampleType || !draft.collectedAt) {
        setUploadStatus('样本表单缺少必填字段');
        return;
      }
      setSampleRows((rows) => (rows.some((row) => row.id === draft.id) ? rows.map((row) => (row.id === draft.id ? draft : row)) : [draft, ...rows]));
      setUploadStatus(`样本 ${draft.id} 正在同步后端...`);
      try {
        const saved = draft.id.startsWith('SPL-NEW-') ? await createSampleRecord(draft) : await updateSampleRecord(draft);
        setSampleRows((rows) => rows.map((row) => (row.id === draft.id ? saved : row)));
        setSampleTestingEditor(null);
        setUploadStatus(`样本 ${saved.id} 已同步后端`);
      } catch {
        setSampleTestingEditor(null);
        setUploadStatus(`后端不可用，样本 ${draft.id} 更新已保存在本页`);
      }
      return;
    }

    const draft = sampleTestingEditor.draft;
    if (!draft.patientId || !draft.sampleId || !draft.assay || !draft.sentAt) {
      setUploadStatus('检测表单缺少必填字段');
      return;
    }
    setRecords((rows) => (rows.some((record) => record.id === draft.id) ? rows.map((record) => (record.id === draft.id ? draft : record)) : [draft, ...rows]));
    setUploadStatus(`检测 ${draft.id} 正在同步后端...`);
    try {
      const saved = draft.id.startsWith('OMX-NEW-') ? await createOmicsRecord(draft) : await updateOmicsRecord(draft);
      setRecords((rows) => rows.map((record) => (record.id === draft.id ? saved : record)));
      setSampleTestingEditor(null);
      setUploadStatus(`检测 ${saved.id} 已同步后端`);
    } catch {
      setSampleTestingEditor(null);
      setUploadStatus(`后端不可用，检测 ${draft.id} 更新已保存在本页`);
    }
  }

  return (
    <div className="content workspace-page">
      <section className="module-kpis">
        <ModuleKpi icon="sampleTube" label="总样本数" value={`${filteredSampleRowsByStudy.length}`} helper="样本台账" />
        <ModuleKpi icon="dna" label="检测项目" value={`${detectionRows.length}`} helper="按项目展开" tone="purple" />
        <ModuleKpi icon="clock" label="检测中" value={`${running}`} helper="待完成检测" tone="orange" />
        <ModuleKpi icon="check" label="检测完成" value={`${completed + archived}`} helper="含结果文件" tone="green" />
      </section>

      <section className="module-card module-card--wide">
        <header className="module-card__header">
          <div>
            <h2>{t('样本台账')}</h2>
            <span>{t('按患者、样本和采集日期维护样本登记')}</span>
          </div>
          <button className="module-primary-button" type="button" onClick={() => void handleAddSample()}><Icon name="filePlus" />{t('新增样本')}</button>
        </header>
        {sampleTestingEditor?.kind === 'sample' ? (
          <section className="sample-testing-editor-card" role="dialog" aria-label={t('样本编辑表单')}>
            <header>
              <div>
                <strong>{t('样本编辑表单')}</strong>
                <span>{sampleTestingEditor.draft.id}</span>
              </div>
              <div className="module-table-actions">
                <button className="module-link-button module-link-button--primary" type="button" onClick={() => void saveSampleTestingEditor()}>{t('保存')}</button>
                <button className="module-link-button" type="button" onClick={() => setSampleTestingEditor(null)}>{t('取消')}</button>
              </div>
            </header>
            <div className="sample-testing-editor-grid">
              <label>
                <span>{t('Study ID')}</span>
                <input value={sampleTestingEditor.draft.studyId ?? '-'} readOnly />
              </label>
              <label>
                <span>{t('条码 / 样本编号')}</span>
                <input value={sampleTestingEditor.draft.id} onChange={(event) => patchSampleTestingDraft({ id: event.target.value })} />
              </label>
              <label>
                <span>{t('患者编号')}</span>
                <input value={sampleTestingEditor.draft.patientName} onChange={(event) => patchSampleTestingDraft({ patientName: event.target.value })} />
              </label>
              <label>
                <span>{t('住院号')}</span>
                <input value={sampleTestingEditor.draft.hospitalNo} onChange={(event) => patchSampleTestingDraft({ hospitalNo: event.target.value })} />
              </label>
              <label>
                <span>{t('样本类型')}</span>
                <select value={sampleTestingEditor.draft.sampleType} onChange={(event) => patchSampleTestingDraft({ sampleType: event.target.value })}>
                  {['血液', 'CSF', '肾', '尿液', '组织', '胸水'].map((item) => <option value={item} key={item}>{t(item)}</option>)}
                </select>
              </label>
              <label>
                <span>{t('访视')}</span>
                <input value={sampleTestingEditor.draft.visit} onChange={(event) => patchSampleTestingDraft({ visit: event.target.value })} />
              </label>
              <label>
                <span>{t('采集日期')}</span>
                <input type="date" value={sampleTestingEditor.draft.collectedAt} onChange={(event) => patchSampleTestingDraft({ collectedAt: event.target.value })} />
              </label>
              <label>
                <span>{t('存储位置')}</span>
                <input value={sampleTestingEditor.draft.storage} onChange={(event) => patchSampleTestingDraft({ storage: event.target.value })} />
              </label>
              <label>
                <span>{t('状态')}</span>
                <select value={sampleTestingEditor.draft.status} onChange={(event) => patchSampleTestingDraft({ status: event.target.value as SampleRecord['status'] })}>
                  {['已采集', '已送检', '检测中', '检测完成', '结果回传', '待处理'].map((item) => <option value={item} key={item}>{t(item)}</option>)}
                </select>
              </label>
              <label className="sample-testing-editor-grid__wide">
                <span>{t('关联检测')}</span>
                <input value={sampleTestingEditor.draft.linkedOmics.join(' / ')} onChange={(event) => patchSampleTestingDraft({ linkedOmics: event.target.value.split('/').map((item) => item.trim()).filter(Boolean) })} />
              </label>
            </div>
          </section>
        ) : null}
        <SampleTestingStatTiles items={sampleStatItems} />
        <div className="sample-testing-filter-bar">
          {showStudyId ? (
            <label>
              <span>{t('Study ID')}</span>
              <select value={studyFilter} onChange={(event) => setStudyFilter(event.target.value)}>
                <option value="全部 Study">{t('全部 Study')}</option>
                {studyOptions.map((studyId) => <option value={studyId} key={studyId}>{studyId}</option>)}
              </select>
            </label>
          ) : null}
          <label>
            <span>{t('患者编号')}</span>
            <input value={samplePatientQuery} onChange={(event) => setSamplePatientQuery(event.target.value)} placeholder={t('搜索患者编号')} />
          </label>
          <label>
            <span>{t('样本编号')}</span>
            <input value={sampleIdQuery} onChange={(event) => setSampleIdQuery(event.target.value)} placeholder={t('搜索样本编号')} />
          </label>
          <label>
            <span>{t('样本类型')}</span>
            <select value={sampleTypeFilter} onChange={(event) => setSampleTypeFilter(event.target.value)}>
              {sampleTypeOptions.map((item) => <option key={item} value={item}>{t(item)}</option>)}
            </select>
          </label>
          <label>
            <span>{t('采集开始')}</span>
            <input type="date" value={sampleDateFrom} onChange={(event) => setSampleDateFrom(event.target.value)} />
          </label>
          <label>
            <span>{t('采集结束')}</span>
            <input type="date" value={sampleDateTo} onChange={(event) => setSampleDateTo(event.target.value)} />
          </label>
        </div>
        <SampleLedgerTable rows={pagedSampleLedgerRows} onView={handleViewSample} onEdit={(row) => void handleEditSample(row)} showStudyId={showStudyId} />
        <ModuleTableFooter page={safeSampleLedgerPage} total={filteredSampleLedgerRows.length} pageSize={sampleLedgerPageSize} onPageChange={setSampleLedgerPage} />
      </section>

      <section className="module-card module-card--wide">
        <header className="module-card__header">
          <div>
            <h2>{t('多组学检测列表')}</h2>
            <span>{t('按检测项目追踪平台、批次、QC 和结果归档')}</span>
          </div>
          <div className="module-header-actions">
            <label className="module-file-button">
              <Icon name="filePlus" />
              {t('上传结果')}
              <input
                type="file"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void handleResultFileUpload(file);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <button className="module-primary-button" type="button" onClick={() => void handleAddOmics()}><Icon name="filePlus" />{t('新增检测')}</button>
          </div>
        </header>
        <div className="module-upload-status">
          <Icon name="shield" />
          <span>{t(uploadStatus)}</span>
        </div>
        {sampleTestingEditor?.kind === 'omics' ? (
          <section className="sample-testing-editor-card" role="dialog" aria-label={t('检测编辑表单')}>
            <header>
              <div>
                <strong>{t('检测编辑表单')}</strong>
                <span>{sampleTestingEditor.draft.id}</span>
              </div>
              <div className="module-table-actions">
                <button className="module-link-button module-link-button--primary" type="button" onClick={() => void saveSampleTestingEditor()}>{t('保存')}</button>
                <button className="module-link-button" type="button" onClick={() => setSampleTestingEditor(null)}>{t('取消')}</button>
              </div>
            </header>
            <div className="sample-testing-editor-grid">
              <label>
                <span>{t('Study ID')}</span>
                <input value={sampleTestingEditor.draft.studyId ?? '-'} readOnly />
              </label>
              <label>
                <span>{t('患者编号')}</span>
                <input value={sampleTestingEditor.draft.patientName} onChange={(event) => patchSampleTestingDraft({ patientName: event.target.value })} />
              </label>
              <label>
                <span>{t('样本编号')}</span>
                <input value={sampleTestingEditor.draft.sampleId} onChange={(event) => patchSampleTestingDraft({ sampleId: event.target.value })} />
              </label>
              <label>
                <span>{t('样本类型')}</span>
                <input value={sampleTestingEditor.draft.sampleType} onChange={(event) => patchSampleTestingDraft({ sampleType: event.target.value })} />
              </label>
              <label>
                <span>{t('检测项目')}</span>
                <select value={sampleTestingEditor.draft.assay} onChange={(event) => patchSampleTestingDraft({ assay: event.target.value as OmicsRecord['assay'] })}>
                  {omicsAssayOptions.map((item) => <option value={item} key={item}>{t(item)}</option>)}
                </select>
              </label>
              <label>
                <span>{t('平台')}</span>
                <input value={sampleTestingEditor.draft.platform} onChange={(event) => patchSampleTestingDraft({ platform: event.target.value })} />
              </label>
              <label>
                <span>{t('批次')}</span>
                <input value={sampleTestingEditor.draft.runId} onChange={(event) => patchSampleTestingDraft({ runId: event.target.value })} />
              </label>
              <label>
                <span>{t('状态')}</span>
                <select value={sampleTestingEditor.draft.status} onChange={(event) => patchSampleTestingDraft({ status: event.target.value as OmicsRecord['status'] })}>
                  {['样本接收', '文库构建', '测序完成', '数据分析', '结果归档'].map((item) => <option value={item} key={item}>{t(item)}</option>)}
                </select>
              </label>
              <label>
                <span>QC</span>
                <select value={sampleTestingEditor.draft.qc} onChange={(event) => patchSampleTestingDraft({ qc: event.target.value as OmicsRecord['qc'] })}>
                  {['待确认', '通过', '未通过'].map((item) => <option value={item} key={item}>{t(item)}</option>)}
                </select>
              </label>
              <label>
                <span>{t('送检测时间')}</span>
                <input type="date" value={sampleTestingEditor.draft.sentAt} onChange={(event) => patchSampleTestingDraft({ sentAt: event.target.value })} />
              </label>
              <label>
                <span>{t('完成日期')}</span>
                <input value={sampleTestingEditor.draft.completedAt} onChange={(event) => patchSampleTestingDraft({ completedAt: event.target.value })} />
              </label>
            </div>
          </section>
        ) : null}
        <SampleTestingStatTiles items={omicsStatItems} />
        <div className="sample-testing-filter-bar sample-testing-filter-bar--omics">
          {showStudyId ? (
            <label>
              <span>{t('Study ID')}</span>
              <select value={studyFilter} onChange={(event) => setStudyFilter(event.target.value)}>
                <option value="全部 Study">{t('全部 Study')}</option>
                {studyOptions.map((studyId) => <option value={studyId} key={studyId}>{studyId}</option>)}
              </select>
            </label>
          ) : null}
          <label>
            <span>{t('患者编号')}</span>
            <input value={omicsPatientQuery} onChange={(event) => setOmicsPatientQuery(event.target.value)} placeholder={t('搜索患者编号')} />
          </label>
          <label>
            <span>{t('样本编号')}</span>
            <input value={omicsSampleQuery} onChange={(event) => setOmicsSampleQuery(event.target.value)} placeholder={t('搜索样本编号')} />
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
                {t(item)}
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
                {t(item)}
              </button>
            ))}
          </div>
        </div>
        <OmicsTable records={pagedDetectionRows} onView={handleViewOmics} onEdit={(row) => void handleEditOmics(row)} showStudyId={showStudyId} />
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
  userId?: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  studyScope: string;
  status: 'Active' | 'Pending' | 'Disabled';
  lastLogin: string;
};

type SystemStudy = ApiStudy & {
  systemAdminCount: number;
};

function userIdForEmail(email: string) {
  return demoUsers.find((user) => user.username === email)?.id;
}

function formatUserStudyScope(user: ApiUser, fallbackStudyId: string) {
  if (user.study_scope?.scopeType === 'all_studies') return '全部 Study';
  const studyIds = user.study_scope?.studyIds ?? [];
  if (studyIds.length) return studyIds.join(' / ');
  return fallbackStudyId;
}

function accountFromStudyMember(member: ApiStudyMember): SystemAccount {
  return {
    userId: member.user_id,
    name: member.display_name,
    email: member.username,
    role: member.study_role,
    roleLabel: roleLabels[member.study_role],
    studyScope: member.study_id,
    status: member.status === 'active' ? 'Active' : member.status === 'disabled' ? 'Disabled' : 'Pending',
    lastLogin: '-'
  };
}

function accountFromApiUser(user: ApiUser, studyId: string): SystemAccount {
  const membership = user.study_memberships?.find((item) => item.study_id === studyId);
  const role = membership?.study_role ?? user.role;
  return {
    userId: user.id,
    name: user.display_name,
    email: user.username,
    role,
    roleLabel: roleLabels[role],
    studyScope: membership?.study_id ?? formatUserStudyScope(user, studyId),
    status: membership?.status === 'disabled' || user.status === 'disabled' ? 'Disabled' : membership?.status === 'active' || user.status === 'active' ? 'Active' : 'Pending',
    lastLogin: '-'
  };
}

function notifyStudiesUpdated() {
  window.dispatchEvent(new window.Event('linzight-studies-updated'));
}

function studyScopeToIds(scope: string, studyIds: string[]) {
  if (scope === '全部 Study') return studyIds;
  return scope
    .split('/')
    .map((item) => item.trim())
    .filter((item) => studyIds.includes(item));
}

function studyMemberStatusFromAccountStatus(status: SystemAccount['status']) {
  if (status === 'Active') return 'active';
  if (status === 'Disabled') return 'disabled';
  return 'pending';
}

function upsertAccountRow(rows: SystemAccount[], account: SystemAccount) {
  const matches = (row: SystemAccount) =>
    row.studyScope === account.studyScope && ((account.userId && row.userId === account.userId) || row.email === account.email);
  const exists = rows.some(matches);
  if (!exists) return [account, ...rows];
  return rows.map((row) => (matches(row) ? { ...row, ...account } : row));
}

type SystemField = {
  studyId: string;
  crfVersionId?: string;
  crfVersion?: string;
  id: string;
  name: string;
  type: 'Text' | 'Number' | 'Dropdown' | 'Boolean';
  module: string;
  updatedAt: string;
  status: '启用' | '草稿' | '停用';
  options: string[];
  required: boolean;
  validationRule: string;
  conditionalLogic: string;
};

type PermissionRow = {
  action: string;
  values: Partial<Record<UserRole, boolean>>;
};

const lungStudyFields: SystemField[] = [
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-001', name: '研究编号', type: 'Text', module: '肺癌研究基本信息', updatedAt: '2026-04-27', status: '启用', options: [], required: true, validationRule: 'required', conditionalLogic: '' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-002', name: '研究名称', type: 'Text', module: '肺癌研究基本信息', updatedAt: '2026-04-27', status: '启用', options: [], required: true, validationRule: 'required', conditionalLogic: '' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-003', name: '病种', type: 'Dropdown', module: '肺癌研究基本信息', updatedAt: '2026-04-27', status: '启用', options: ['NSCLC', 'SCLC', '其他'], required: true, validationRule: 'required', conditionalLogic: '' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-004', name: '分期', type: 'Dropdown', module: '肺癌研究基本信息', updatedAt: '2026-04-27', status: '启用', options: ['I期', 'II期', 'III期', 'IV期'], required: true, validationRule: 'required', conditionalLogic: '' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-005', name: 'TNM分期', type: 'Text', module: '肺癌研究基本信息', updatedAt: '2026-04-27', status: '启用', options: [], required: false, validationRule: 'TNM text', conditionalLogic: '' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-006', name: 'ECOG评分', type: 'Number', module: '肺癌治疗与耐药评估', updatedAt: '2026-04-27', status: '启用', options: [], required: true, validationRule: 'integer 0-5', conditionalLogic: '' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-007', name: '治疗线数', type: 'Number', module: '肺癌治疗与耐药评估', updatedAt: '2026-04-27', status: '启用', options: [], required: true, validationRule: 'integer >= 1', conditionalLogic: '' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-008', name: '当前治疗方案', type: 'Text', module: '肺癌治疗与耐药评估', updatedAt: '2026-04-27', status: '启用', options: [], required: true, validationRule: 'required', conditionalLogic: '' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-009', name: '驱动基因突变', type: 'Dropdown', module: '肺癌治疗与耐药评估', updatedAt: '2026-04-27', status: '启用', options: ['EGFR', 'ALK', 'ROS1', 'MET', 'RET', '其他'], required: true, validationRule: 'required', conditionalLogic: '' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-010', name: '耐药机制', type: 'Dropdown', module: '肺癌治疗与耐药评估', updatedAt: '2026-04-27', status: '启用', options: ['T790M', 'C797S', 'MET扩增', '组织学转化', '未知'], required: true, validationRule: 'required', conditionalLogic: '驱动基因突变 is not empty' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-011', name: 'RECIST评估', type: 'Dropdown', module: '肺癌治疗与耐药评估', updatedAt: '2026-04-27', status: '启用', options: ['CR', 'PR', 'SD', 'PD'], required: false, validationRule: '', conditionalLogic: '' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-012', name: 'ctDNA突变丰度', type: 'Number', module: '肺癌组学与疗效终点', updatedAt: '2026-04-27', status: '启用', options: [], required: false, validationRule: 'percentage 0-100', conditionalLogic: '' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-013', name: 'PFS（月）', type: 'Number', module: '肺癌组学与疗效终点', updatedAt: '2026-04-27', status: '启用', options: [], required: false, validationRule: 'number >= 0', conditionalLogic: '' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-014', name: 'ORR评估', type: 'Dropdown', module: '肺癌组学与疗效终点', updatedAt: '2026-04-27', status: '启用', options: ['CR', 'PR', 'SD', 'PD', 'NE'], required: false, validationRule: '', conditionalLogic: '' },
  { studyId: 'LZXK-01', id: 'LUNG-RESIST-015', name: '检测项目', type: 'Dropdown', module: '肺癌组学与疗效终点', updatedAt: '2026-04-27', status: '启用', options: ['NGS panel', 'ctDNA', 'RNA-seq', '病理复核'], required: false, validationRule: '', conditionalLogic: '' }
];

const systemFields: SystemField[] = [
  ...systemCrfFields.flatMap((field) => [
    { ...field, studyId: 'LGL-1111', options: [], required: false, validationRule: '', conditionalLogic: '' },
    { ...field, id: `NMO-${field.id}`, studyId: 'RWD-NMO-2026', options: [], required: false, validationRule: '', conditionalLogic: '' }
  ]),
  ...lungStudyFields
];
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
const systemFieldTypeOptions: SystemField['type'][] = ['Text', 'Number', 'Dropdown', 'Boolean'];
const systemFieldStatusOptions: SystemField['status'][] = ['启用', '草稿', '停用'];

function schemaTypeFromSystemFieldType(type: SystemField['type']) {
  if (type === 'Number') return 'number';
  if (type === 'Dropdown') return 'select';
  if (type === 'Boolean') return 'boolean';
  return 'text';
}

function schemaFromSystemFields(studyId: string, version: string, fields: SystemField[]) {
  const sections = Array.from(
    fields
      .filter((field) => field.studyId === studyId)
      .reduce((groups, field, index) => {
        const section = groups.get(field.module) ?? { id: field.module.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title: field.module, fields: [] as Array<Record<string, unknown>> };
        section.fields.push({
          id: field.id,
          name: field.name,
          sourceName: field.name,
          sourceColumn: index + 1,
          type: schemaTypeFromSystemFieldType(field.type),
          status: field.status,
          options: field.options,
          required: field.required,
          validationRule: field.validationRule,
          conditionalLogic: field.conditionalLogic
        });
        groups.set(field.module, section);
        return groups;
      }, new Map<string, { id: string; title: string; fields: Array<Record<string, unknown>> }>())
      .values()
  );
  return {
    version,
    name: `${studyId} CRF ${version}`,
    source: 'system-management',
    releasedAt: new Date().toISOString().slice(0, 10),
    fieldCount: fields.filter((field) => field.studyId === studyId).length,
    studyId,
    sections
  };
}

function nextCrfDraftVersion(versions: StudyCrfVersionRecord[]) {
  const numericVersions = versions
    .map((record) => record.version.match(/^V?(\d+)(?:\.(\d+))?/i))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => [Number(match[1]), Number(match[2] ?? '0')] as const)
    .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const [major, minor] = numericVersions[0] ?? [1, 0];
  return `V${major}.${minor + 1}`;
}

const systemStudyOptions: string[] = [];
const fallbackSystemStudies: SystemStudy[] = [];

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function approvalTypeLabel(type: ApiApprovalRequest['approval_type']) {
  if (type === 'econsent_withdrawal') return 'eConsent 撤回';
  if (type === 'econsent_resign') return 'eConsent 重签';
  if (type === 'crf_publish') return 'CRF 发布';
  if (type === 'deidentified_export') return '脱敏导出';
  return '导出';
}

export function SystemManagementPage({ currentUser }: { currentUser?: AuthenticatedUser | null } = {}) {
  const { t } = useI18n();
  const lockedStudyId = getCurrentScopedStudyId();
  const [studyRows, setStudyRows] = useState<SystemStudy[]>(fallbackSystemStudies);
  const allSystemStudyIds = useMemo(() => studyRows.filter((study) => study.status !== 'deleted').map((study) => study.id), [studyRows]);
  const isGlobalManagement = !lockedStudyId;
  const availableSystemStudies = useMemo(() => {
    if (lockedStudyId) return [lockedStudyId];
    const userStudyIds = currentUser?.studyScope?.studyIds;
    if (userStudyIds?.length) return userStudyIds;
    return allSystemStudyIds;
  }, [allSystemStudyIds, currentUser, lockedStudyId]);
  const [selectedSystemStudyId, setSelectedSystemStudyId] = useState(lockedStudyId ?? availableSystemStudies[0] ?? '');
  const scopedStudyId = availableSystemStudies.includes(selectedSystemStudyId) ? selectedSystemStudyId : availableSystemStudies[0] ?? '';
  const [systemQuery, setSystemQuery] = useState('');
  const [accountPage, setAccountPage] = useState(1);
  const [fieldPage, setFieldPage] = useState(1);
  const [accountRows, setAccountRows] = useState<SystemAccount[]>([]);
  const [fieldRows, setFieldRows] = useState<SystemField[]>(systemFields);
  const [fieldEditor, setFieldEditor] = useState<SystemField | null>(null);
  const [crfVersionRows, setCrfVersionRows] = useState<StudyCrfVersionRecord[]>([]);
  const [crfMigrationPreview, setCrfMigrationPreview] = useState<CrfMigrationPreview | null>(null);
  const [crfMigrationRows, setCrfMigrationRows] = useState<CrfMigrationApprovalRecord[]>([]);
  const [approvalRows, setApprovalRows] = useState<ApiApprovalRequest[]>([]);
  const [visitPlanRows, setVisitPlanRows] = useState<StudyVisitPlanRecord[]>(systemVisitPlans);
  const [siteRows, setSiteRows] = useState<ApiStudySite[]>([]);
  const [siteUserRows, setSiteUserRows] = useState<ApiSiteUser[]>([]);
  const [queryRows, setQueryRows] = useState<ApiDataQuery[]>([]);
  const [queryStatusFilter, setQueryStatusFilter] = useState<'all' | ApiDataQuery['status']>('all');
  const [auditRows, setAuditRows] = useState<ApiAuditLog[]>([]);
  const [systemActionStatus, setSystemActionStatus] = useState('等待系统管理操作');
  const normalizedQuery = systemQuery.trim().toLowerCase();
  const visibleAccounts = useMemo(() => {
    const scopedAccounts = scopedStudyId
      ? accountRows.filter((account) => account.studyScope === '全部 Study' || account.studyScope.split('/').map((item) => item.trim()).includes(scopedStudyId))
      : accountRows;
    if (!normalizedQuery) return scopedAccounts;
    return scopedAccounts.filter((account) =>
      [account.name, account.email, account.role, account.roleLabel, account.studyScope, account.status].some((item) => item.toLowerCase().includes(normalizedQuery))
    );
  }, [accountRows, normalizedQuery, scopedStudyId]);

  const visibleFields = useMemo(() => {
    const scopedFields = scopedStudyId ? fieldRows.filter((field) => field.studyId === scopedStudyId) : fieldRows;
    if (!normalizedQuery) return scopedFields;
    return scopedFields.filter((field) =>
      [field.studyId, field.id, field.name, field.type, field.module, field.status].some((item) => item.toLowerCase().includes(normalizedQuery))
    );
  }, [fieldRows, normalizedQuery, scopedStudyId]);

  const visibleVisitPlans = useMemo(() => {
    const scopedPlans = scopedStudyId ? visitPlanRows.filter((plan) => plan.studyId === scopedStudyId) : visitPlanRows;
    if (!normalizedQuery) return scopedPlans;
    return scopedPlans.filter((plan) =>
      [plan.id, plan.studyId, plan.code, plan.name, plan.visitType, plan.status, plan.requiredForms.join('/'), plan.requiredSamples.join('/')].some((item) =>
        item.toLowerCase().includes(normalizedQuery)
      )
    );
  }, [normalizedQuery, scopedStudyId, visitPlanRows]);
  const fieldModuleOptions = useMemo(() => {
    const scopedFields = scopedStudyId ? fieldRows.filter((field) => field.studyId === scopedStudyId) : fieldRows;
    return Array.from(new Set(scopedFields.map((field) => field.module).filter(Boolean))).sort();
  }, [fieldRows, scopedStudyId]);
  const visibleCrfVersions = useMemo(() => {
    const scopedVersions = scopedStudyId ? crfVersionRows.filter((version) => version.studyId === scopedStudyId) : crfVersionRows;
    return scopedVersions.slice(0, 4);
  }, [crfVersionRows, scopedStudyId]);
  const draftCrfVersion = visibleCrfVersions.find((version) => version.status === 'draft');
  const visibleCrfMigrations = useMemo(() => {
    const scopedMigrations = scopedStudyId ? crfMigrationRows.filter((migration) => migration.studyId === scopedStudyId) : crfMigrationRows;
    return scopedMigrations.slice(0, 3);
  }, [crfMigrationRows, scopedStudyId]);
  const activeCrfMigration = visibleCrfMigrations.find((migration) => migration.status === 'pending' || migration.status === 'approved');
  const activeCrfMigrationRequiresSeparateReviewer = Boolean(activeCrfMigration?.requestedBy && activeCrfMigration.requestedBy === currentUser?.id);
  const visibleApprovals = useMemo(
    () => approvalRows.filter((approval) => !scopedStudyId || approval.study_id === scopedStudyId).slice(0, 4),
    [approvalRows, scopedStudyId]
  );
  const approvalCounts = useMemo(() => {
    const scopedApprovals = approvalRows.filter((approval) => !scopedStudyId || approval.study_id === scopedStudyId);
    return {
      submitted: scopedApprovals.filter((approval) => approval.status === 'submitted').length,
      approved: scopedApprovals.filter((approval) => approval.status === 'approved').length,
      econsent: scopedApprovals.filter((approval) => approval.approval_type.startsWith('econsent_')).length
    };
  }, [approvalRows, scopedStudyId]);
  const visibleSites = useMemo(() => {
    const scopedSites = scopedStudyId ? siteRows.filter((site) => site.study_id === scopedStudyId) : siteRows;
    if (!normalizedQuery) return scopedSites;
    return scopedSites.filter((site) =>
      [site.study_id, site.code, site.name, site.status].some((item) => item.toLowerCase().includes(normalizedQuery))
    );
  }, [normalizedQuery, scopedStudyId, siteRows]);
  const visibleQueries = useMemo(() => {
    const scopedQueries = (scopedStudyId ? queryRows.filter((query) => query.study_id === scopedStudyId) : queryRows)
      .filter((query) => queryStatusFilter === 'all' || query.status === queryStatusFilter);
    if (!normalizedQuery) return scopedQueries.slice(0, 6);
    return scopedQueries
      .filter((query) =>
        [query.id, query.study_id, query.patient_id, query.visit_id ?? '', query.form_id, query.field_name, query.title, query.description, query.status, query.assigned_to ?? ''].some((item) =>
          item.toLowerCase().includes(normalizedQuery)
        )
      )
      .slice(0, 6);
  }, [normalizedQuery, queryRows, queryStatusFilter, scopedStudyId]);
  const queryCounts = useMemo(() => {
    const scopedQueries = scopedStudyId ? queryRows.filter((query) => query.study_id === scopedStudyId) : queryRows;
    return {
      open: scopedQueries.filter((query) => query.status === 'open').length,
      answered: scopedQueries.filter((query) => query.status === 'answered').length,
      closed: scopedQueries.filter((query) => query.status === 'closed').length
    };
  }, [queryRows, scopedStudyId]);
  const visibleAuditLogs = useMemo(
    () => auditRows.filter((entry) => !scopedStudyId || entry.study_id === scopedStudyId).filter((entry) => entry.diff?.length).slice(0, 4),
    [auditRows, scopedStudyId]
  );
  const studyRegistryRows = useMemo(() => {
    return studyRows.filter((study) => availableSystemStudies.includes(study.id)).map((study) => {
      const studyId = study.id;
      const accounts = accountRows.filter((account) => account.studyScope === '全部 Study' || account.studyScope.split('/').map((item) => item.trim()).includes(studyId));
      return {
        ...study,
        studyId,
        accountCount: accounts.length,
        globalRoleCount: accounts.filter((account) => account.role.startsWith('LZ_')).length,
        studyRoleCount: accounts.filter((account) => account.role.startsWith('STUDY_')).length,
        systemAdminCount: accounts.filter((account) => account.role === 'STUDY_CONFIG_ADMIN').length
      };
    });
  }, [accountRows, availableSystemStudies, studyRows]);

  useEffect(() => {
    if (!availableSystemStudies.includes(selectedSystemStudyId)) {
      setSelectedSystemStudyId(availableSystemStudies[0] ?? '');
    }
  }, [availableSystemStudies, selectedSystemStudyId]);

  useEffect(() => {
    let ignore = false;
    void fetchStudies()
      .then((studies) => {
        if (ignore) return;
        setStudyRows((rows) =>
          studies.map((study) => ({
            ...study,
            systemAdminCount: rows.find((row) => row.id === study.id)?.systemAdminCount ?? 0
          }))
        );
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!isGlobalManagement && !scopedStudyId) return;
    let ignore = false;
    void fetchUsers(isGlobalManagement ? undefined : scopedStudyId)
      .then((users) => {
        if (ignore) return;
        const accounts = users.flatMap((user) => {
          if (user.study_memberships?.length && user.role.startsWith('STUDY_')) {
            return user.study_memberships.map((membership) => accountFromApiUser(user, membership.study_id));
          }
          return [accountFromApiUser(user, scopedStudyId)];
        });
        setAccountRows(accounts);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [isGlobalManagement, scopedStudyId]);

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

  useEffect(() => {
    if (!scopedStudyId) return;
    let ignore = false;

    if (isGlobalManagement) {
      void fetchStudyMembers(scopedStudyId)
        .then((members) => {
          if (ignore || !members.length) return;
          const memberAccounts = members.map(accountFromStudyMember);
          setAccountRows((rows) => memberAccounts.reduce((nextRows, account) => upsertAccountRow(nextRows, account), rows));
        })
        .catch(() => undefined);
      return () => {
        ignore = true;
      };
    }

    void Promise.allSettled([
      fetchStudyVisitPlans(scopedStudyId),
      fetchStudyMembers(scopedStudyId),
      fetchStudyCrfFields(scopedStudyId),
      fetchStudyCrfVersions(scopedStudyId),
      fetchStudyCrfMigrations(scopedStudyId),
      fetchApprovalRequests(scopedStudyId),
      fetchStudySites(scopedStudyId),
      fetchDataQueries(scopedStudyId),
      fetchAuditLogs(scopedStudyId)
    ])
      .then(([visitPlanResult, memberResult, crfFieldResult, crfVersionResult, crfMigrationResult, approvalResult, siteResult, queryResult, auditResult]) => {
        if (ignore) return;
        if (visitPlanResult.status === 'fulfilled' && visitPlanResult.value.length) {
          setVisitPlanRows((rows) => [
            ...rows.filter((plan) => plan.studyId !== scopedStudyId),
            ...visitPlanResult.value
          ]);
        }
        if (memberResult.status === 'fulfilled' && memberResult.value.length) {
          const memberAccounts = memberResult.value.map(accountFromStudyMember);
          setAccountRows((rows) => memberAccounts.reduce((nextRows, account) => upsertAccountRow(nextRows, account), rows));
        }
        if (crfFieldResult.status === 'fulfilled' && crfFieldResult.value.length) {
          setFieldRows((rows) => [
            ...rows.filter((field) => field.studyId !== scopedStudyId),
            ...crfFieldResult.value
          ]);
        }
        if (crfVersionResult.status === 'fulfilled' && crfVersionResult.value.length) {
          setCrfVersionRows((rows) => [
            ...rows.filter((version) => version.studyId !== scopedStudyId),
            ...crfVersionResult.value
          ]);
        }
        if (crfMigrationResult.status === 'fulfilled' && crfMigrationResult.value.length) {
          setCrfMigrationRows((rows) => [
            ...rows.filter((migration) => migration.studyId !== scopedStudyId),
            ...crfMigrationResult.value
          ]);
        }
        if (approvalResult.status === 'fulfilled') {
          setApprovalRows((rows) => [
            ...rows.filter((approval) => approval.study_id !== scopedStudyId),
            ...approvalResult.value
          ]);
        }
        if (siteResult.status === 'fulfilled') {
          setSiteRows((rows) => [
            ...rows.filter((site) => site.study_id !== scopedStudyId),
            ...siteResult.value
          ]);
        }
        if (queryResult.status === 'fulfilled') {
          setQueryRows((rows) => [
            ...rows.filter((query) => query.study_id !== scopedStudyId),
            ...queryResult.value
          ]);
        }
        if (auditResult.status === 'fulfilled') {
          setAuditRows((rows) => [
            ...rows.filter((entry) => entry.study_id !== scopedStudyId),
            ...auditResult.value
          ]);
        }
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [isGlobalManagement, scopedStudyId]);

  async function createSystemAccount() {
    const index = accountRows.length + 1;
    const studyScope = scopedStudyId;
    if (!studyScope) {
      setSystemActionStatus('请先新建或选择 Study，再创建 Study 用户');
      return;
    }
    const suffix = Date.now().toString().slice(-6);
    const nextAccount: SystemAccount = {
      name: `新账户 ${index}`,
      email: `study-crc-${studyScope.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}@linzight.com`,
      role: 'STUDY_CRC',
      roleLabel: '研究 CRC',
      studyScope,
      status: 'Pending',
      lastLogin: '-'
    };
    setAccountRows((rows) => [nextAccount, ...rows]);
    setAccountPage(1);
    setSystemActionStatus('用户账户正在创建并同步 Study 成员...');
    try {
      const user = await createUserAccount({
        username: nextAccount.email,
        display_name: nextAccount.name,
        role: 'STUDY_CRC',
        password: `LZ${suffix}2026`,
        status: 'active',
        study_id: studyScope,
        member_status: 'pending'
      });
      const savedAccount = accountFromApiUser(user, studyScope);
      setAccountRows((rows) => upsertAccountRow(rows, savedAccount));
      setSystemActionStatus(`用户账户已创建并加入 Study：${savedAccount.email}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无用户创建权限，账户已保存在本页');
    }
  }

  async function createSystemStudy() {
    if (currentUser?.role !== 'LZ_ADMIN') {
      setSystemActionStatus('只有 LZ 系统管理员可以新建 Study');
      return;
    }
    const suffix = Date.now().toString().slice(-4);
    const studyId = `RWD-NEW-${suffix}`;
    setSystemActionStatus(`Study ${studyId} 正在创建...`);
    try {
      const study = await createStudy({
        id: studyId,
        code: studyId,
        name: `新建真实世界研究 ${suffix}`,
        indication: '待配置疾病领域',
        phase: 'RWD',
        status: 'draft',
        owner_org: 'LinZight'
      });
      setStudyRows((rows) => [{ ...study, systemAdminCount: 0 }, ...rows.filter((row) => row.id !== study.id)]);
      setSelectedSystemStudyId(study.id);
      notifyStudiesUpdated();
      setSystemActionStatus(`Study 已创建为草稿：${study.id}。发布前需绑定 CRF、访视计划、知情模板和系统管理员。`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 Study 新建权限');
    }
  }

  async function terminateSystemStudy(studyId: string) {
    setSystemActionStatus(`Study ${studyId} 正在终止，终止后业务写入会被后端拒绝...`);
    try {
      const study = await updateStudy(studyId, { status: 'terminated' });
      setStudyRows((rows) => rows.map((row) => (row.id === study.id ? { ...study, systemAdminCount: row.systemAdminCount } : row)));
      notifyStudiesUpdated();
      setSystemActionStatus(`Study 已终止：${study.id}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 Study 终止权限');
    }
  }

  async function deleteSystemStudy(studyId: string) {
    setSystemActionStatus(`Study ${studyId} 正在删除/归档...`);
    try {
      const study = await deleteStudy(studyId);
      setStudyRows((rows) => rows.map((row) => (row.id === study.id ? { ...study, systemAdminCount: row.systemAdminCount } : row)));
      setSelectedSystemStudyId((current) => (current === study.id ? '' : current));
      notifyStudiesUpdated();
      setSystemActionStatus(`Study 已标记为 deleted：${study.id}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 Study 删除权限');
    }
  }

  async function editSystemAccount(account: SystemAccount) {
    setSystemQuery(account.email);
    const userId = account.userId ?? userIdForEmail(account.email);
    if (!userId) {
      setSystemActionStatus(`已定位账户 ${account.email}，但缺少用户 ID，无法同步修改`);
      return;
    }
    const nextName = account.name.endsWith('（已更新）') ? account.name.replace('（已更新）', '') : `${account.name}（已更新）`;
    setSystemActionStatus(`账户 ${account.email} 正在同步显示名修改...`);
    try {
      const user = await updateUserAccount(userId, { display_name: nextName }, scopedStudyId);
      const savedAccount = accountFromApiUser(user, scopedStudyId ?? account.studyScope);
      setAccountRows((rows) => upsertAccountRow(rows, savedAccount));
      setSystemActionStatus(`账户资料已同步：${savedAccount.email}`);
    } catch {
      setSystemActionStatus(`后端不可用或当前角色无账户资料修改权限，已定位账户 ${account.email}`);
    }
  }

  async function makeStudySystemAdmin(account: SystemAccount) {
    const studyId = scopedStudyId ?? selectedSystemStudyId;
    const userId = account.userId ?? userIdForEmail(account.email);
    if (!studyId || !userId) {
      setSystemActionStatus('缺少 Study 或用户 ID，无法设置 Study 系统管理员');
      return;
    }
    setSystemActionStatus(`正在将 ${account.email} 设置为 ${studyId} 的 Study 系统管理员...`);
    try {
      const member = await upsertStudyMember(studyId, {
        userId,
        studyRole: 'STUDY_CONFIG_ADMIN',
        status: 'active'
      });
      const savedAccount = accountFromStudyMember(member);
      setAccountRows((rows) => upsertAccountRow(rows, savedAccount));
      setSystemActionStatus(`已设置 Study 系统管理员：${savedAccount.email} -> ${studyId}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 Study 成员管理权限');
    }
  }

  async function togglePlatformStudyScope(account: SystemAccount) {
    const studyId = scopedStudyId ?? selectedSystemStudyId;
    const userId = account.userId ?? userIdForEmail(account.email);
    if (!studyId || !userId || !account.role.startsWith('LZ_') || account.role === 'LZ_ADMIN') {
      setSystemActionStatus('只有非 LZ_ADMIN 平台角色可以配置授权 Study 范围');
      return;
    }
    const currentStudyIds = studyScopeToIds(account.studyScope, allSystemStudyIds);
    const nextStudyIds = currentStudyIds.includes(studyId)
      ? currentStudyIds.filter((item) => item !== studyId)
      : [...currentStudyIds, studyId];
    setSystemActionStatus(`正在同步 ${account.email} 的平台角色 Study 授权范围...`);
    try {
      const user = await updateGlobalRoleStudyScope(userId, nextStudyIds);
      const savedAccount = accountFromApiUser(user, studyId);
      setAccountRows((rows) => upsertAccountRow(rows, savedAccount));
      setSystemActionStatus(`授权范围已同步：${savedAccount.email} -> ${savedAccount.studyScope || '无授权 Study'}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无平台角色授权范围管理权限');
    }
  }

  async function toggleSystemAccount(account: SystemAccount) {
    const nextStatus: SystemAccount['status'] = account.status === 'Disabled' ? 'Active' : 'Disabled';
    const userId = account.userId ?? userIdForEmail(account.email);
    if (!userId) {
      setSystemActionStatus('缺少用户 ID，无法同步账户状态');
      return;
    }

    setAccountRows((rows) => rows.map((row) => (row.email === account.email ? { ...row, status: nextStatus } : row)));
    setSystemActionStatus(`账户 ${account.email} 状态正在同步后端...`);
    try {
      let savedAccount: SystemAccount;
      if (currentUser?.role === 'LZ_ADMIN') {
        const updatedUser = await updateUserAccountStatus(userId, { status: nextStatus === 'Disabled' ? 'disabled' : 'active' });
        savedAccount = accountFromApiUser(updatedUser, scopedStudyId ?? account.studyScope);
      } else if (scopedStudyId && account.role.startsWith('STUDY_')) {
        const member = await upsertStudyMember(scopedStudyId, {
          userId,
          studyRole: account.role as ApiStudyMember['study_role'],
          status: studyMemberStatusFromAccountStatus(nextStatus)
        });
        savedAccount = accountFromStudyMember(member);
      } else {
        throw new Error('user status requires LZ_ADMIN');
      }
      setAccountRows((rows) => upsertAccountRow(rows, savedAccount));
      setSystemActionStatus(`账户状态已同步后端：${savedAccount.email}`);
    } catch {
      setSystemActionStatus(`后端不可用或当前角色无用户状态写入权限，账户 ${account.email} 状态已保存在本页`);
    }
  }

  async function createSystemField() {
    const studyId = scopedStudyId ?? 'LGL-1111';
    const nextField: SystemField = {
      studyId,
      id: `LOCAL-FIELD-${Date.now().toString().slice(-6)}`,
      name: '新增字段',
      type: 'Text',
      module: '基本信息',
      updatedAt: new Date().toISOString().slice(0, 10),
      status: '草稿',
      options: [],
      required: false,
      validationRule: '',
      conditionalLogic: ''
    };
    setFieldRows((rows) => [nextField, ...rows]);
    setFieldPage(1);
    setSystemActionStatus('CRF 字段正在同步后端...');
    try {
      const created = await createStudyCrfField(nextField);
      setFieldRows((rows) => rows.map((field) => (field.id === nextField.id && field.studyId === nextField.studyId ? created : field)));
      const audits = await fetchAuditLogs(created.studyId).catch(() => []);
      if (audits.length) {
        setAuditRows((rows) => [
          ...rows.filter((entry) => entry.study_id !== created.studyId),
          ...audits
        ]);
      }
      setSystemActionStatus(`CRF 字段已同步后端：${created.id}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 CRF 配置写入权限，字段已保存在本页');
    }
  }

  function startSystemFieldEdit(field: SystemField) {
    setFieldEditor(field);
    setSystemActionStatus(`正在编辑 CRF 字段 ${field.id}`);
  }

  function patchSystemFieldEditor(patch: Partial<SystemField>) {
    setFieldEditor((current) => (current ? { ...current, ...patch, updatedAt: new Date().toISOString().slice(0, 10) } : current));
  }

  function patchSystemFieldOptions(rawOptions: string) {
    patchSystemFieldEditor({
      options: rawOptions
        .split(/[,\n，、]/)
        .map((option) => option.trim())
        .filter(Boolean)
    });
  }

  async function saveSystemFieldEditor() {
    if (!fieldEditor) return;
    const nextField: SystemField = {
      ...fieldEditor,
      name: fieldEditor.name.trim(),
      module: fieldEditor.module.trim(),
      options: fieldEditor.options.map((option) => option.trim()).filter(Boolean),
      validationRule: fieldEditor.validationRule.trim(),
      conditionalLogic: fieldEditor.conditionalLogic.trim(),
      updatedAt: new Date().toISOString().slice(0, 10)
    };
    if (!nextField.name || !nextField.module) {
      setSystemActionStatus('请填写字段名称和所属模块');
      return;
    }
    setFieldRows((rows) => rows.map((row) => (row.id === nextField.id && row.studyId === nextField.studyId ? nextField : row)));
    setSystemActionStatus(`CRF 字段 ${nextField.id} 正在保存到后端...`);
    try {
      const saved = await updateStudyCrfField(nextField);
      setFieldRows((rows) => rows.map((row) => (row.id === saved.id && row.studyId === saved.studyId ? saved : row)));
      const audits = await fetchAuditLogs(saved.studyId).catch(() => []);
      if (audits.length) {
        setAuditRows((rows) => [
          ...rows.filter((entry) => entry.study_id !== saved.studyId),
          ...audits
        ]);
      }
      setFieldEditor(null);
      setSystemActionStatus(`CRF 字段 ${saved.id} 已保存：${saved.name} / ${saved.type} / ${saved.module} / ${saved.status}`);
    } catch {
      setSystemActionStatus(`后端不可用或当前角色无 CRF 配置写入权限，字段 ${nextField.id} 编辑已保存在本页`);
    }
  }

  async function createCrfDraftVersion() {
    const studyId = scopedStudyId ?? 'LGL-1111';
    const latestVersions = await fetchStudyCrfVersions(studyId).catch(() => crfVersionRows.filter((version) => version.studyId === studyId));
    if (latestVersions.length) {
      setCrfVersionRows((rows) => [
        ...rows.filter((version) => version.studyId !== studyId),
        ...latestVersions
      ]);
    }
    const nextVersion = nextCrfDraftVersion(latestVersions.length ? latestVersions : crfVersionRows.filter((version) => version.studyId === studyId));
    const schema = schemaFromSystemFields(studyId, nextVersion, fieldRows);
    setSystemActionStatus(`CRF 版本 ${nextVersion} 正在创建草稿...`);
    try {
      const created = await createStudyCrfVersion(studyId, {
        version: nextVersion,
        status: 'draft',
        schema,
        changeSummary: 'Draft created from System Management CRF fields.'
      });
      setCrfVersionRows((rows) => [created, ...rows.filter((version) => version.id !== created.id)]);
      setCrfMigrationPreview(null);
      setSystemActionStatus(`CRF 版本草稿已创建：${created.version}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 CRF 版本创建权限');
    }
  }

  async function previewCrfMigration() {
    const studyId = scopedStudyId ?? 'LGL-1111';
    const targetVersion = draftCrfVersion?.version ?? nextCrfDraftVersion(crfVersionRows.filter((version) => version.studyId === studyId));
    const schema = schemaFromSystemFields(studyId, targetVersion, fieldRows);
    setSystemActionStatus('CRF 迁移预览正在生成...');
    try {
      const preview = await previewStudyCrfMigration(studyId, {
        sourceVersionId: visibleCrfVersions.find((version) => version.status === 'published')?.id,
        schema
      });
      setCrfMigrationPreview(preview);
      setSystemActionStatus(`CRF 迁移预览已生成：新增 ${preview.summary.added}，变更 ${preview.summary.changed}，移除 ${preview.summary.removed}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 CRF 迁移预览权限');
    }
  }

  async function requestCrfMigrationApproval() {
    if (!draftCrfVersion) {
      setSystemActionStatus('请先创建 CRF 草稿版本，再提交迁移审批');
      return;
    }
    const sourceVersionId = visibleCrfVersions.find((version) => version.status === 'published')?.id;
    setSystemActionStatus(`CRF 迁移 ${draftCrfVersion.version} 正在提交审批...`);
    try {
      const approval = await requestStudyCrfMigrationApproval(draftCrfVersion.studyId, {
        sourceVersionId,
        targetVersionId: draftCrfVersion.id,
        note: 'Submitted from System Management CRF migration workflow.'
      });
      const approvalCenterItem = await createApprovalRequest({
        study_id: draftCrfVersion.studyId,
        approval_type: 'crf_publish',
        entity_type: 'study_crf_versions',
        entity_id: draftCrfVersion.id,
        payload: { migration_id: approval.id, target_version_id: draftCrfVersion.id },
        comment: 'CRF publish approval submitted from System Management.',
        submit: true
      });
      setCrfMigrationRows((rows) => [approval, ...rows.filter((migration) => migration.id !== approval.id)]);
      setApprovalRows((rows) => [approvalCenterItem, ...rows.filter((row) => row.id !== approvalCenterItem.id)]);
      setCrfMigrationPreview(approval.preview);
      setSystemActionStatus(`CRF 迁移审批已提交：${approval.id}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 CRF 迁移审批提交权限');
    }
  }

  async function approveCrfMigrationRequest(migration: CrfMigrationApprovalRecord) {
    setSystemActionStatus(`CRF 迁移审批 ${migration.id} 正在批准...`);
    try {
      const approved = await approveStudyCrfMigration(migration.studyId, migration.id, 'Approved from System Management.');
      setCrfMigrationRows((rows) => [approved, ...rows.filter((row) => row.id !== approved.id)]);
      setSystemActionStatus(`CRF 迁移已批准：${approved.id}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 CRF 迁移批准权限');
    }
  }

  async function applyCrfMigrationRequest(migration: CrfMigrationApprovalRecord) {
    setSystemActionStatus(`CRF 迁移 ${migration.id} 正在应用并发布目标版本...`);
    try {
      const applied = await applyStudyCrfMigration(migration.studyId, migration.id, 'Applied from System Management.');
      const versions = await fetchStudyCrfVersions(migration.studyId);
      setCrfMigrationRows((rows) => [applied, ...rows.filter((row) => row.id !== applied.id)]);
      setCrfVersionRows((rows) => [
        ...rows.filter((version) => version.studyId !== migration.studyId),
        ...versions
      ]);
      setCrfMigrationPreview(null);
      setSystemActionStatus(`CRF 迁移已应用，目标版本已发布：${applied.targetVersionId}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 CRF 迁移应用权限');
    }
  }

  async function approveGenericApproval(approval: ApiApprovalRequest) {
    setSystemActionStatus(`审批 ${approval.id} 正在批准...`);
    try {
      const approved = await approveApprovalRequest(approval.id, 'Approved from System Management approval center.');
      setApprovalRows((rows) => [approved, ...rows.filter((row) => row.id !== approved.id)]);
      setSystemActionStatus(`审批已批准：${approved.id}`);
    } catch {
      setSystemActionStatus('后端不可用、当前角色无审批权限，或提交人不能自批');
    }
  }

  async function completeGenericApproval(approval: ApiApprovalRequest) {
    setSystemActionStatus(`审批 ${approval.id} 正在完成并应用业务状态...`);
    try {
      const completed = await completeApprovalRequest(approval.id, 'Completed from System Management approval center.');
      setApprovalRows((rows) => [completed, ...rows.filter((row) => row.id !== completed.id)]);
      const [nextApprovals, nextAudits] = await Promise.allSettled([
        fetchApprovalRequests(completed.study_id),
        fetchAuditLogs(completed.study_id)
      ]);
      if (nextApprovals.status === 'fulfilled') {
        setApprovalRows((rows) => [
          ...rows.filter((row) => row.study_id !== completed.study_id),
          ...nextApprovals.value
        ]);
      }
      if (nextAudits.status === 'fulfilled') {
        setAuditRows((rows) => [
          ...rows.filter((row) => row.study_id !== completed.study_id),
          ...nextAudits.value
        ]);
      }
      setSystemActionStatus(`审批已完成：${completed.id}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无审批完成权限');
    }
  }

  async function rejectGenericApproval(approval: ApiApprovalRequest) {
    setSystemActionStatus(`审批 ${approval.id} 正在拒绝...`);
    try {
      const rejected = await rejectApprovalRequest(approval.id, 'Rejected from System Management approval center.');
      setApprovalRows((rows) => [rejected, ...rows.filter((row) => row.id !== rejected.id)]);
      setSystemActionStatus(`审批已拒绝：${rejected.id}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无审批拒绝权限');
    }
  }

  async function publishCrfDraftVersion() {
    if (!draftCrfVersion) {
      setSystemActionStatus('当前没有可发布的 CRF 草稿版本');
      return;
    }
    const schema = schemaFromSystemFields(draftCrfVersion.studyId, draftCrfVersion.version, fieldRows);
    setSystemActionStatus(`CRF 版本 ${draftCrfVersion.version} 正在发布...`);
    try {
      const published = await updateStudyCrfVersion(draftCrfVersion.studyId, draftCrfVersion.id, {
        status: 'published',
        schema,
        changeSummary: 'Published from System Management CRF fields.'
      });
      setCrfVersionRows((rows) =>
        rows.map((version) => {
          if (version.id === published.id) return published;
          if (version.studyId === published.studyId && version.status === 'published') return { ...version, status: 'retired' };
          return version;
        })
      );
      setCrfMigrationPreview(null);
      setSystemActionStatus(`CRF 版本已发布：${published.version}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 CRF 版本发布权限');
    }
  }

  async function createVisitPlan() {
    const studyId = scopedStudyId ?? 'LGL-1111';
    const existingPlans = visitPlanRows.filter((plan) => plan.studyId === studyId);
    const index = existingPlans.length + 1;
    const nextPlan: StudyVisitPlanRecord = {
      id: `LOCAL-VP-${Date.now().toString().slice(-6)}`,
      studyId,
      code: `V${index}`,
      name: `V${index} 新增访视`,
      visitType: '随访访视',
      dayOffset: index * 30,
      windowBeforeDays: 7,
      windowAfterDays: 7,
      requiredForms: ['follow_up'],
      requiredSamples: ['血液'],
      status: 'draft',
      sortOrder: index
    };
    setVisitPlanRows((rows) => [nextPlan, ...rows]);
    setSystemActionStatus('已新增本地访视计划草稿，正在同步后端...');
    try {
      const created = await createStudyVisitPlan(nextPlan);
      setVisitPlanRows((rows) => rows.map((plan) => (plan.id === nextPlan.id ? created : plan)));
      setSystemActionStatus(`访视计划已同步后端：${created.studyId} / ${created.code}`);
    } catch {
      setSystemActionStatus('后端不可用，访视计划草稿已保存在本页');
    }
  }

  async function createSiteConfiguration() {
    const studyId = scopedStudyId ?? 'LGL-1111';
    const existingSites = siteRows.filter((site) => site.study_id === studyId);
    const index = existingSites.length + 1;
    const code = `SITE-${String(index).padStart(2, '0')}`;
    const nextSite: ApiStudySite = {
      id: `LOCAL-SITE-${Date.now().toString().slice(-6)}`,
      study_id: studyId,
      code,
      name: `${t('新增研究中心')} ${index}`,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setSiteRows((rows) => [nextSite, ...rows]);
    setSystemActionStatus('Study site 正在创建并写入后端...');
    try {
      const created = await createStudySite(studyId, {
        code,
        name: nextSite.name,
        status: 'active'
      });
      setSiteRows((rows) => [created, ...rows.filter((site) => site.id !== nextSite.id && !(site.study_id === created.study_id && site.code === created.code))]);
      setSystemActionStatus(`Study site 已同步后端：${created.study_id} / ${created.code}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 Study site 写入权限，中心草稿已保存在本页');
    }
  }

  async function assignCurrentUserToSite(site: ApiStudySite) {
    if (!currentUser?.id) {
      setSystemActionStatus('请先登录真实用户后再分配 site 用户');
      return;
    }
    setSystemActionStatus(`Site 用户分配正在同步后端：${site.code} / ${currentUser.username}`);
    try {
      const assignment = await assignStudySiteUser(site.study_id, site.id, {
        userId: currentUser.id,
        role: currentUser.role,
        status: 'active'
      });
      setSiteUserRows((rows) => [assignment, ...rows.filter((row) => !(row.site_id === assignment.site_id && row.user_id === assignment.user_id))]);
      setSystemActionStatus(`Site 用户分配已写入后端：${site.code} / ${currentUser.username}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 site 用户分配权限');
    }
  }

  async function createSystemDataQuery() {
    const studyId = scopedStudyId ?? 'LGL-1111';
    setSystemActionStatus('Query 正在创建并写入后端...');
    try {
      const dataset = await fetchDemoDataset();
      const patient = dataset.patients.find((record) => record.studyId === studyId);
      if (!patient?.id) {
        setSystemActionStatus('当前 Study 没有可绑定 Query 的患者');
        return;
      }
      const created = await createDataQuery({
        study_id: studyId,
        patient_id: patient.id,
        visit_id: dataset.visits.find((visit) => visit.studyId === studyId && visit.patientId === patient.id)?.id ?? null,
        form_id: 'clinical_capture',
        field_name: studyId === 'LZXK-01' ? 'ECOG评分' : 'SLEDAI评分',
        title: `${t('数据核查 Query')} ${queryRows.filter((query) => query.study_id === studyId).length + 1}`,
        description: 'Please verify the source record and reply with correction status.',
        assigned_to: currentUser?.id ?? null
      });
      setQueryRows((rows) => [created, ...rows.filter((query) => query.id !== created.id)]);
      setSystemActionStatus(`Query 已创建并绑定患者：${created.id} / ${created.patient_id}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 Query 创建权限');
    }
  }

  async function answerSystemDataQuery(query: ApiDataQuery) {
    setSystemActionStatus(`Query ${query.id} 正在回复...`);
    try {
      const answered = await updateDataQuery(query.id, {
        status: 'answered',
        response: 'Verified in source record from System Management.'
      });
      setQueryRows((rows) => [answered, ...rows.filter((row) => row.id !== answered.id)]);
      setSystemActionStatus(`Query 已回复：${answered.id}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 Query 回复权限');
    }
  }

  async function closeSystemDataQuery(query: ApiDataQuery) {
    setSystemActionStatus(`Query ${query.id} 正在关闭...`);
    try {
      const closed = await updateDataQuery(query.id, { status: 'closed' });
      setQueryRows((rows) => [closed, ...rows.filter((row) => row.id !== closed.id)]);
      setSystemActionStatus(`Query 已关闭：${closed.id}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 Query 关闭权限');
    }
  }

  async function reopenSystemDataQuery(query: ApiDataQuery) {
    setSystemActionStatus(`Query ${query.id} 正在重开...`);
    try {
      const reopened = await updateDataQuery(query.id, {
        status: 'open',
        response: query.response || 'Reopened from System Management.'
      });
      setQueryRows((rows) => [reopened, ...rows.filter((row) => row.id !== reopened.id)]);
      setSystemActionStatus(`Query 已重开：${reopened.id}`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无 Query 重开权限');
    }
  }

  return (
    <div className="content workspace-page system-management-page">
      <section className="system-management-hero module-card">
        <div className="system-management-title">
          <span>System Management</span>
          <h2>{t(isGlobalManagement ? 'Study 系统管理' : '系统管理')}</h2>
          <p>{t(isGlobalManagement ? 'LZ 全局层只管理 Study、用户和授权范围，不直接编辑业务数据。' : '管理 Study 成员、平台角色、权限策略和 CRF 版本。')}</p>
        </div>
        <label className="system-study-select">
          <span>Study</span>
          <select
            value={scopedStudyId}
            disabled={Boolean(lockedStudyId) || availableSystemStudies.length <= 1}
            onChange={(event) => setSelectedSystemStudyId(event.target.value)}
          >
            {availableSystemStudies.map((studyId) => (
              <option value={studyId} key={studyId}>{studyId}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="module-card system-overview-card">
        <header className="module-card__header system-overview-header">
          <div>
            <span>Account Overview</span>
            <h2>{t('Account Summary | 账户概览')}</h2>
            <p>{t('当前研究站点账户结构')}</p>
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
                placeholder={isGlobalManagement ? t('Search studies, users, roles, or authorization scopes...') : 'Search users, roles, CRF fields, visit plans, or ask LinZight AI...'}
              />
              <Icon name="microphone" />
            </label>
            <button className="module-primary-button" type="button" onClick={() => void createSystemAccount()}><Icon name="userPlus" />Create Account<br /><span>{t('新增账户')}</span></button>
          </div>
        </header>
        <div className="system-summary-grid">
          <div>
            <span>Total Accounts</span>
            <strong>{accountRows.length}</strong>
          </div>
          <div>
            <span>Global Roles</span>
            <strong>{accountRows.filter((account) => account.role.startsWith('LZ_')).length}</strong>
          </div>
          <div>
            <span>Study Roles</span>
            <strong>{accountRows.filter((account) => account.role.startsWith('STUDY_')).length}</strong>
          </div>
          <div>
            <span>Studies</span>
            <strong>{studyRows.filter((study) => study.status !== 'deleted').length}</strong>
          </div>
        </div>
        <div className="system-global-actions">
          <Icon name="alerts" />
          <span>{isGlobalManagement ? 'LZ Global Layer' : 'Global Actions'}</span>
          <strong>{t(isGlobalManagement ? 'LZ 管理页不是业务租户；业务操作必须进入单个 Study Workspace。' : 'Study 成员、CRF 版本、导出和权限策略变更均进入审计日志。')}</strong>
        </div>
        <div className="module-upload-status">
          <Icon name="shield" />
          <span>{t(systemActionStatus)}</span>
        </div>
      </section>

      {isGlobalManagement ? (
        <section className="module-card system-study-registry-card">
          <header className="module-card__header">
            <div>
              <h2>{t('Study Registry | Study 管理')}</h2>
              <span>{t('维护 Study、用户和授权范围；业务数据在单个 Study Workspace 内处理。')}</span>
            </div>
            <button className="module-primary-button" type="button" onClick={() => void createSystemStudy()}>
              <Icon name="studies" />Create Study<br /><span>{t('新建 Study')}</span>
            </button>
          </header>
          <div className="module-table-wrap">
            <table className="module-table system-study-registry-table">
              <thead>
                <tr>
                  <th>Study ID</th>
                  <th>{t('Study 名称')}</th>
	                  <th>{t('授权账号')}</th>
	                  <th>{t('平台角色')}</th>
	                  <th>{t('研究角色')}</th>
	                  <th>{t('状态')}</th>
	                  <th>{t('系统管理员')}</th>
	                  <th>{t('边界')}</th>
	                  <th>{t('Actions')}</th>
	                </tr>
	              </thead>
	              <tbody>
	                {!studyRegistryRows.length ? (
	                  <tr>
	                    <td colSpan={9}>{t('暂无 Study，请点击新建 Study 创建第一个研究。')}</td>
	                  </tr>
	                ) : null}
	                {studyRegistryRows.map((study) => (
	                  <tr key={study.studyId}>
	                    <td><span className="status-pill status-pill--info">{study.studyId}</span></td>
	                    <td>{t(study.name)}</td>
	                    <td>{study.accountCount}</td>
	                    <td>{study.globalRoleCount}</td>
	                    <td>{study.studyRoleCount}</td>
	                    <td><span className={`status-pill status-pill--${study.status === 'active' ? 'success' : study.status === 'draft' ? 'warning' : 'danger'}`}>{study.status}</span></td>
	                    <td>{study.systemAdminCount}</td>
	                    <td>{t('业务操作进入 Study Workspace')}</td>
	                    <td>
	                      <div className="module-table-actions">
	                        <button className="module-link-button" type="button" onClick={() => setSelectedSystemStudyId(study.studyId)}>{t('Select')}</button>
	                        <button className="module-link-button" type="button" disabled={study.status === 'terminated' || study.status === 'deleted'} onClick={() => void terminateSystemStudy(study.studyId)}>{t('Terminate')}</button>
	                        <button className="module-link-button module-link-button--danger" type="button" disabled={study.status === 'deleted'} onClick={() => void deleteSystemStudy(study.studyId)}>{t('Delete')}</button>
	                      </div>
	                    </td>
	                  </tr>
	                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="system-management-grid">
        <div className="module-stack">
          <section className="module-card">
            <header className="module-card__header">
              <div>
                <h2>{t('User Accounts & Roles List | 用户账户与角色列表')}</h2>
                <span>{t('按角色和状态管理研究团队账号')}</span>
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
                  {pagedAccounts.map((account) => {
                    const canToggleAccount = Boolean(
                      (account.userId ?? userIdForEmail(account.email)) &&
                        (currentUser?.role === 'LZ_ADMIN' || (scopedStudyId && account.role.startsWith('STUDY_')))
                    );
                    return (
                    <tr key={`${account.email}-${account.name}`}>
                      <td>{t(account.name)}</td>
                      <td>{account.email}</td>
                      <td><span className={`system-role-pill system-role-pill--${roleTone[account.role]}`}>{account.role} | {t(account.roleLabel)}</span></td>
                      <td>{t(account.studyScope)}</td>
                      <td><span className={`status-pill status-pill--${systemStatusTone[account.status]}`}>{t(account.status)}</span></td>
                      <td>{account.lastLogin}</td>
                      <td>
                        <div className="module-table-actions">
                          <button className="module-link-button" type="button" onClick={() => editSystemAccount(account)}>{t('Edit')}</button>
	                          <button
	                            className="module-link-button module-link-button--danger"
	                            type="button"
	                            disabled={!canToggleAccount}
	                            title={canToggleAccount ? undefined : t('当前角色没有用户状态写入权限')}
	                            onClick={() => void toggleSystemAccount(account)}
	                          >
	                            {account.status === 'Disabled' ? t('Enable') : t('Disable')}
	                          </button>
	                          <button
	                            className="module-link-button"
	                            type="button"
	                            disabled={!scopedStudyId || !(account.userId ?? userIdForEmail(account.email))}
	                            title={t('设置为当前 Study 的系统管理员')}
	                            onClick={() => void makeStudySystemAdmin(account)}
	                          >
	                            {t('Set Admin')}
	                          </button>
	                          <button
	                            className="module-link-button"
	                            type="button"
	                            disabled={currentUser?.role !== 'LZ_ADMIN' || !account.role.startsWith('LZ_') || account.role === 'LZ_ADMIN'}
	                            title={t('授予或移除当前 Study 的平台角色授权')}
	                            onClick={() => void togglePlatformStudyScope(account)}
	                          >
	                            {t('Scope')}
	                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ModuleTableFooter page={safeAccountPage} total={visibleAccounts.length} pageSize={systemAccountPageSize} onPageChange={setAccountPage} />
          </section>

          {!isGlobalManagement ? (
            <>
          <section className="module-card">
            <header className="module-card__header">
              <div>
                <h2>{t('Field & CRF Configuration | CRF 与字段配置')}</h2>
                <span>{t('维护每个 Study 独立 CRF 字段、类型、版本和所属模块')}</span>
              </div>
              <button className="module-link-button module-link-button--primary" type="button" onClick={() => void createSystemField()}><Icon name="filePlus" />{t('新增字段')}</button>
            </header>
            <div className="system-crf-version-panel">
              <div>
                <span>{t('CRF Version Workflow')}</span>
                <strong>{draftCrfVersion ? `${t('Draft ready')}: ${draftCrfVersion.version}` : t('No draft version')}</strong>
              </div>
              <div className="system-crf-version-list">
                {visibleCrfVersions.map((version, versionIndex) => (
                  <span key={`${version.studyId}-${version.id}-${versionIndex}`} className={`status-pill status-pill--${version.status === 'published' ? 'success' : version.status === 'draft' ? 'warning' : 'info'}`}>
                    {version.version} · {t(version.status)}
                  </span>
                ))}
              </div>
              <div className="system-crf-version-actions">
                <button className="module-link-button" type="button" onClick={() => void previewCrfMigration()}>{t('Preview Migration')}</button>
                <button className="module-link-button" type="button" onClick={() => void createCrfDraftVersion()}>{t('New Draft')}</button>
                <button className="module-link-button" type="button" disabled={!draftCrfVersion} onClick={() => void requestCrfMigrationApproval()}>{t('Request Approval')}</button>
                <button
                  className="module-primary-button"
                  type="button"
                  disabled={!activeCrfMigration || activeCrfMigration.status !== 'approved' || activeCrfMigrationRequiresSeparateReviewer}
                  title={activeCrfMigrationRequiresSeparateReviewer ? t('Separate reviewer required') : undefined}
                  onClick={() => (activeCrfMigration?.status === 'approved' ? void applyCrfMigrationRequest(activeCrfMigration) : void publishCrfDraftVersion())}
                >
                  {t('Apply Approved')}
                </button>
              </div>
            </div>
            <div className="system-crf-approval-panel">
              <div>
                <strong>{t('CRF Migration Approval')}</strong>
                <span>{activeCrfMigration ? `${activeCrfMigration.id} · ${t(activeCrfMigration.status)}` : t('No active migration request')}</span>
                <span>{t('Execution logs are stored for request, approval, and apply steps.')}</span>
              </div>
              <div className="system-crf-approval-list">
                {visibleCrfMigrations.length ? visibleCrfMigrations.map((migration) => {
                  const requiresSeparateReviewer = Boolean(migration.requestedBy && migration.requestedBy === currentUser?.id);
                  return (
                    <div key={migration.id} className="system-crf-approval-row">
                        <span>{migration.id}</span>
                        <strong>{migration.preview.source_version} → {migration.preview.target_version ?? migration.targetVersionId}</strong>
                        <span className={`status-pill status-pill--${migration.status === 'applied' ? 'success' : migration.status === 'approved' ? 'info' : 'warning'}`}>{t(migration.status)}</span>
                        <span>{t('Added')}: {migration.preview.summary.added} / {t('Changed')}: {migration.preview.summary.changed} / {t('Removed')}: {migration.preview.summary.removed}</span>
                        {requiresSeparateReviewer ? <span className="status-pill status-pill--warning">{t('Separate reviewer required')}</span> : null}
                        <div className="system-crf-execution-report">
                          <span>{t('Execution Logs')}: {migration.executionLogs.length}</span>
                          {migration.executionLogs.length ? (
                            <ul>
                              {migration.executionLogs.map((log) => (
                                <li key={log.id}>
                                  <span className={`status-pill status-pill--${log.status === 'applied' || log.status === 'approved' ? 'success' : log.status === 'blocked' ? 'danger' : 'info'}`}>
                                    {t(log.step)} · {t(log.status)}
                                  </span>
                                  <strong>{log.actor_id ?? '-'}</strong>
                                  <time>{log.created_at.slice(0, 16).replace('T', ' ')}</time>
                                  <small>{t(log.message)}</small>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        <div className="module-table-actions">
                          <button
                            className="module-link-button"
                            type="button"
                            disabled={migration.status !== 'pending' || requiresSeparateReviewer}
                            title={requiresSeparateReviewer ? t('Separate reviewer required') : undefined}
                            onClick={() => void approveCrfMigrationRequest(migration)}
                          >
                            {t('Approve')}
                          </button>
                          <button
                            className="module-link-button module-link-button--primary"
                            type="button"
                            disabled={migration.status !== 'approved' || requiresSeparateReviewer}
                            title={requiresSeparateReviewer ? t('Separate reviewer required') : undefined}
                            onClick={() => void applyCrfMigrationRequest(migration)}
                          >
                            {t('Apply')}
                          </button>
                        </div>
                    </div>
                  );
                }) : (
                  <span>{t('No migration approvals yet')}</span>
                )}
              </div>
            </div>
            <div className="system-crf-approval-panel">
              <div>
                <strong>{t('Approval Center')}</strong>
                <span>{t('导出、CRF 发布、eConsent 撤回/重签审批')}</span>
                <span className="status-pill status-pill--warning">{t('待审批')}: {approvalCounts.submitted}</span>
                <span className="status-pill status-pill--info">{t('已批准待完成')}: {approvalCounts.approved}</span>
                <span className="status-pill status-pill--success">eConsent: {approvalCounts.econsent}</span>
              </div>
              <div className="system-crf-approval-list">
                {visibleApprovals.length ? visibleApprovals.map((approval) => (
                  <div key={approval.id} className="system-crf-approval-row">
                    <span><strong>{t('Study ID')}</strong> {approval.study_id}</span>
                    <span>{approval.id}</span>
                    <strong>{t(approvalTypeLabel(approval.approval_type))} · {approval.entity_id || '-'}</strong>
                    <span className={`status-pill status-pill--${approval.status === 'completed' || approval.status === 'approved' ? 'success' : approval.status === 'rejected' || approval.status === 'cancelled' ? 'danger' : 'warning'}`}>
                      {t(approval.status)}
                    </span>
                    <span>{t(approval.comment || 'No approval comment')}</span>
                    {approval.payload?.patient_id ? <span>{t('患者编号')}: {String(approval.payload.patient_id)}</span> : null}
                    {approval.payload?.requested_status ? <span>{t('目标状态')}: {String(approval.payload.requested_status)}</span> : null}
                    <span>{t('Actions')}: {approval.actions?.length ?? 0}</span>
                    <div className="module-table-actions">
                      <button
                        className="module-link-button"
                        type="button"
                        disabled={approval.status !== 'submitted' || approval.submitted_by === currentUser?.id}
                        title={approval.submitted_by === currentUser?.id ? t('Separate reviewer required') : undefined}
                        onClick={() => void approveGenericApproval(approval)}
                      >
                        {t('Approve')}
                      </button>
                      <button
                        className="module-link-button module-link-button--danger"
                        type="button"
                        disabled={approval.status !== 'submitted'}
                        onClick={() => void rejectGenericApproval(approval)}
                      >
                        {t('Reject')}
                      </button>
                      <button
                        className="module-link-button module-link-button--primary"
                        type="button"
                        disabled={approval.status !== 'approved'}
                        onClick={() => void completeGenericApproval(approval)}
                      >
                        {t('完成')}
                      </button>
                    </div>
                  </div>
                )) : (
                  <span>{t('No approvals yet')}</span>
                )}
              </div>
            </div>
            <div className="system-crf-approval-panel">
              <div>
                <strong>{t('Audit Diff | 审计变更明细')}</strong>
                <span>{t('展示字段路径、修改前值和修改后值')}</span>
              </div>
              <div className="system-crf-approval-list">
                {visibleAuditLogs.length ? visibleAuditLogs.map((entry) => (
                  <div key={entry.id} className="system-audit-diff-row">
                    <div>
                      <strong>{entry.action} · {entry.entity_type}</strong>
                      <span>{entry.entity_id} / {entry.actor_role ?? '-'}</span>
                      <time>{entry.created_at.slice(0, 16).replace('T', ' ')}</time>
                    </div>
                    <ul>
                      {entry.diff.slice(0, 3).map((change, index) => (
                        <li key={`${entry.id}-${change.field}-${index}`}>
                          <span>{change.field}</span>
                          <small>{formatAuditValue(change.before)}</small>
                          <strong>→</strong>
                          <small>{formatAuditValue(change.after)}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                )) : (
                  <span>{t('暂无审计 diff')}</span>
                )}
              </div>
            </div>
            {crfMigrationPreview ? (
              <div className="system-crf-migration-preview">
                <div className="system-crf-migration-summary">
                  <strong>{t('Migration Preview')}</strong>
                  <span>{t('Added')}: {crfMigrationPreview.summary.added}</span>
                  <span>{t('Changed')}: {crfMigrationPreview.summary.changed}</span>
                  <span>{t('Removed')}: {crfMigrationPreview.summary.removed}</span>
                  <span>{t('Unchanged')}: {crfMigrationPreview.summary.unchanged}</span>
                </div>
                <div className="system-crf-migration-details">
                  <strong>{t('变更明细')}</strong>
                  {[crfMigrationPreview.added, crfMigrationPreview.changed, crfMigrationPreview.removed].every((items) => items.length === 0) ? (
                    <span>{t('无字段级差异')}</span>
                  ) : null}
                  {crfMigrationPreview.added.slice(0, 3).map((field) => (
                    <span key={`added-${field.id}`}>{t('新增字段项')}: {field.id} · {t(field.name)}</span>
                  ))}
                  {crfMigrationPreview.changed.slice(0, 3).map((field) => (
                    <span key={`changed-${field.id}`}>{t('变更字段项')}: {field.id} · {field.changes.map((change) => t(change)).join(', ')}</span>
                  ))}
                  {crfMigrationPreview.removed.slice(0, 3).map((field) => (
                    <span key={`removed-${field.id}`}>{t('移除字段项')}: {field.id} · {t(field.name)}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {fieldEditor ? (
              <div className="system-field-editor">
                <div className="system-field-editor__title">
                  <span>{t('Edit CRF Field')}</span>
                  <strong>{fieldEditor.id}</strong>
                </div>
                <label>
                  <span>{t('Field Name')}</span>
                  <input value={fieldEditor.name} onChange={(event) => patchSystemFieldEditor({ name: event.target.value })} />
                </label>
                <label>
                  <span>{t('Type')}</span>
                  <select value={fieldEditor.type} onChange={(event) => patchSystemFieldEditor({ type: event.target.value as SystemField['type'] })}>
                    {systemFieldTypeOptions.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label>
                  <span>{t('CRF Module')}</span>
                  <input list="system-field-module-options" value={fieldEditor.module} onChange={(event) => patchSystemFieldEditor({ module: event.target.value })} />
                  <datalist id="system-field-module-options">
                    {fieldModuleOptions.map((module) => <option key={module} value={module} />)}
                  </datalist>
                </label>
                <label>
                  <span>{t('Status')}</span>
                  <select value={fieldEditor.status} onChange={(event) => patchSystemFieldEditor({ status: event.target.value as SystemField['status'] })}>
                    {systemFieldStatusOptions.map((status) => <option key={status} value={status}>{t(status)}</option>)}
                  </select>
                </label>
                <label>
                  <span>{t('Required')}</span>
                  <select value={fieldEditor.required ? 'true' : 'false'} onChange={(event) => patchSystemFieldEditor({ required: event.target.value === 'true' })}>
                    <option value="true">{t('Required')}</option>
                    <option value="false">{t('Optional')}</option>
                  </select>
                </label>
                <label>
                  <span>{t('Options')}</span>
                  <input value={fieldEditor.options.join(', ')} onChange={(event) => patchSystemFieldOptions(event.target.value)} placeholder={t('Comma-separated options')} />
                </label>
                <label>
                  <span>{t('Validation')}</span>
                  <input value={fieldEditor.validationRule} onChange={(event) => patchSystemFieldEditor({ validationRule: event.target.value })} placeholder="e.g. integer >= 0" />
                </label>
                <label>
                  <span>{t('Conditional Logic')}</span>
                  <input value={fieldEditor.conditionalLogic} onChange={(event) => patchSystemFieldEditor({ conditionalLogic: event.target.value })} placeholder="e.g. field == value" />
                </label>
                <div className="system-field-editor__actions">
                  <button className="module-link-button" type="button" onClick={() => setFieldEditor(null)}>{t('Cancel')}</button>
                  <button className="module-primary-button" type="button" onClick={() => void saveSystemFieldEditor()}>{t('Save')}</button>
                </div>
              </div>
            ) : null}
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
                  {pagedFields.map((field, fieldIndex) => (
                    <tr key={`${field.studyId}-${field.id}-${fieldIndex}`}>
                      <td>{field.id}</td>
                      <td>{t(field.name)}</td>
                      <td>{t(field.type)}</td>
                      <td>{t(field.module)}</td>
                      <td><span className={field.status === '启用' ? 'status-pill status-pill--success' : field.status === '草稿' ? 'status-pill status-pill--warning' : 'status-pill status-pill--danger'}>{t(field.status)}</span></td>
                      <td>{field.updatedAt}</td>
                      <td>
                        <div className="module-table-actions">
                          <button className="module-link-button" type="button" onClick={() => startSystemFieldEdit(field)}>Edit</button>
                          <button className="module-link-button" type="button" onClick={() => setSystemActionStatus(`字段 ${field.id} 详情：${field.module} / ${field.type}`)}><Icon name="chevronDown" /></button>
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
                <h2>{t('Visit Plan Configuration | 访视计划配置')}</h2>
                <span>{t('按 Study 配置访视时间窗、必填 CRF 表单和样本要求')}</span>
              </div>
              <button className="module-link-button module-link-button--primary" type="button" onClick={() => void createVisitPlan()}><Icon name="filePlus" />{t('新增访视')}</button>
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
                      <td>{t(plan.name)}</td>
                      <td>D{plan.dayOffset}</td>
                      <td>-{plan.windowBeforeDays} / +{plan.windowAfterDays} {t('天')}</td>
                      <td>{plan.requiredForms.join(', ')}</td>
                      <td>{plan.requiredSamples.map((sample) => t(sample)).join(' / ') || '-'}</td>
                      <td><span className={plan.status === 'active' ? 'status-pill status-pill--success' : plan.status === 'draft' ? 'status-pill status-pill--warning' : 'status-pill status-pill--danger'}>{t(plan.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
            </>
          ) : null}
        </div>

        <div className="module-stack">
          <section className="module-card system-permission-card">
            <header className="module-card__header">
              <div>
                <h2>{t('Permission Strategy Matrix | 权限策略矩阵')}</h2>
                <span>{t('平台级角色跨 Study；研究级角色只在所属 Study 内生效')}</span>
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
                      <td>{t(row.action)}</td>
                      {permissionColumns.map((column) => (
                        <td key={column.key}>
                          <label className="system-permission-check">
                            <input type="checkbox" checked={Boolean(row.values[column.key])} readOnly aria-label={`${t(row.action)}-${column.key}`} />
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

          {!isGlobalManagement ? (
            <>
          <section className="module-card system-query-card">
            <header className="module-card__header">
              <div>
                <h2>{t('Query Management | Query 管理')}</h2>
                <span>{t('创建、指派、回复和关闭 Query，绑定 subject / visit / form。')}</span>
              </div>
              <button className="module-link-button module-link-button--primary" type="button" onClick={() => void createSystemDataQuery()}>
                <Icon name="filePlus" />{t('新增 Query')}
              </button>
            </header>
            <div className="system-query-summary">
              <span className="status-pill status-pill--warning">{t('Open')}: {queryCounts.open}</span>
              <span className="status-pill status-pill--info">{t('Answered')}: {queryCounts.answered}</span>
              <span className="status-pill status-pill--success">{t('Closed')}: {queryCounts.closed}</span>
              <small>{t('字段名由当前 Study CRF 校验，跨 Study 患者/访视会被后端拒绝。')}</small>
            </div>
            <div className="system-query-summary" aria-label={t('Query 筛选')}>
              {(['all', 'open', 'answered', 'closed', 'cancelled'] as Array<'all' | ApiDataQuery['status']>).map((statusValue) => (
                <button
                  className={`module-link-button${queryStatusFilter === statusValue ? ' module-link-button--primary' : ''}`}
                  key={statusValue}
                  type="button"
                  onClick={() => setQueryStatusFilter(statusValue)}
                >
                  {t(statusValue === 'all' ? '全部 Query' : statusValue)}
                </button>
              ))}
            </div>
            <div className="module-table-wrap">
              <table className="module-table system-query-table">
                <thead>
                  <tr>
                    <th>Study</th>
                    <th>Query</th>
                    <th>Subject</th>
                    <th>Form / Field</th>
                    <th>Assignee</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleQueries.length ? visibleQueries.map((query) => (
                    <tr key={query.id}>
                      <td>
                        <span className="status-pill status-pill--info">{query.study_id}</span>
                      </td>
                      <td>
                        <strong>{query.id}</strong>
                        <span>{t(query.title)}</span>
                        {query.description ? <small>{t(query.description)}</small> : null}
                        {query.response ? <small className="system-query-response">{t('回复')}: {t(query.response)}</small> : null}
                      </td>
                      <td>{query.patient_id}</td>
                      <td>{query.form_id || '-'} / {query.field_name || '-'}</td>
                      <td>{query.assigned_to ?? '-'}</td>
                      <td><span className={`status-pill status-pill--${query.status === 'closed' ? 'success' : query.status === 'answered' ? 'info' : query.status === 'cancelled' ? 'danger' : 'warning'}`}>{t(query.status)}</span></td>
                      <td>{query.updated_at.slice(0, 10)}</td>
                      <td>
                        <div className="module-table-actions">
                          <button className="module-link-button" type="button" disabled={query.status === 'closed' || query.status === 'cancelled'} title={query.status === 'closed' || query.status === 'cancelled' ? t('已关闭或取消的 Query 需要先重开') : undefined} onClick={() => void answerSystemDataQuery(query)}>{t('回复')}</button>
                          <button className="module-link-button module-link-button--danger" type="button" disabled={query.status === 'closed' || query.status === 'cancelled'} title={query.status === 'closed' || query.status === 'cancelled' ? t('当前状态不可关闭') : undefined} onClick={() => void closeSystemDataQuery(query)}>{t('关闭')}</button>
                          {query.status === 'closed' || query.status === 'cancelled' ? (
                            <button className="module-link-button module-link-button--primary" type="button" onClick={() => void reopenSystemDataQuery(query)}>{t('重开')}</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8}>{t('暂无 Query')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="module-card system-site-card">
            <header className="module-card__header">
              <div>
                <h2>{t('Site Configuration | 多中心配置')}</h2>
                <span>{t('维护 Study site、site user assignment 和 study-site 隔离。')}</span>
              </div>
              <button className="module-link-button module-link-button--primary" type="button" onClick={() => void createSiteConfiguration()}>
                <Icon name="filePlus" />{t('新增中心')}
              </button>
            </header>
            <div className="module-table-wrap">
              <table className="module-table system-site-table">
                <thead>
                  <tr>
                    <th>Study</th>
                    <th>Site Code</th>
                    <th>Site Name</th>
                    <th>Status</th>
                    <th>Assignments</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSites.length ? visibleSites.map((site) => {
                    const currentAssignment = siteUserRows.find((row) => row.site_id === site.id && row.user_id === currentUser?.id);
                    return (
                      <tr key={site.id}>
                        <td>{site.study_id}</td>
                        <td>{site.code}</td>
                        <td>{t(site.name)}</td>
                        <td><span className={`status-pill status-pill--${site.status === 'active' ? 'success' : 'danger'}`}>{t(site.status)}</span></td>
                        <td>{currentAssignment ? `${currentAssignment.user_id} · ${t(currentAssignment.status)}` : '-'}</td>
                        <td>
                          <div className="module-table-actions">
                            <button
                              className="module-link-button"
                              type="button"
                              disabled={Boolean(currentAssignment)}
                              onClick={() => void assignCurrentUserToSite(site)}
                            >
                              {t('指派当前用户')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6}>{t('暂无中心')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const exportWriteRoles = new Set<UserRole>(['LZ_ADMIN', 'LZ_CRC', 'LZ_DATA_MANAGER', 'STUDY_DATA_MANAGER']);
const qualityWriteRoles = new Set<UserRole>(['LZ_ADMIN', 'LZ_CRC', 'LZ_DATA_MANAGER', 'STUDY_DATA_MANAGER']);

function canCreateExports(user?: { role: UserRole } | null) {
  return Boolean(user && exportWriteRoles.has(user.role));
}

function canRunQualityValidation(user?: { role: UserRole } | null) {
  return Boolean(user && qualityWriteRoles.has(user.role));
}

function exportStudyOptionsForUser(user?: AuthenticatedUser | null) {
  const scopedStudyId = getCurrentScopedStudyId();
  if (scopedStudyId) return [scopedStudyId];
  if (user?.studyScope?.scopeType === 'all_studies') return systemStudyOptions;
  return user?.studyScope?.studyIds?.length ? user.studyScope.studyIds : [getCurrentScopedStudyId() ?? 'LGL-1111'];
}

export function ReportsPage({ currentUser }: { currentUser?: AuthenticatedUser | null } = {}) {
  const { t } = useI18n();
  const exportStudyOptions = useMemo(() => exportStudyOptionsForUser(currentUser), [currentUser]);
  const [selectedStudyId, setSelectedStudyId] = useState(exportStudyOptions[0] ?? 'LGL-1111');
  const [exportStatus, setExportStatus] = useState('等待导出任务');
  const [qualityStatus, setQualityStatus] = useState('等待数据校验');
  const [exportJobs, setExportJobs] = useState<Record<string, ApiExportJob>>({});
  const [qualityIssues, setQualityIssues] = useState<ApiQualityIssue[]>([]);
  const [qualityQueryMap, setQualityQueryMap] = useState<Record<string, ApiDataQuery>>({});
  const exportEnabled = canCreateExports(currentUser);
  const qualityEnabled = canRunQualityValidation(currentUser);
  const visitWindowIssues = useMemo(
    () => qualityIssues.filter((issue) => issue.source_table === 'visits' && issue.field_name === 'visit_date'),
    [qualityIssues]
  );
  const openCriticalIssues = useMemo(
    () => qualityIssues.filter((issue) => issue.status === 'open' && issue.severity === 'critical').length,
    [qualityIssues]
  );
  const displayedQualityIssues = useMemo(
    () => [
      ...visitWindowIssues,
      ...qualityIssues.filter((issue) => !(issue.source_table === 'visits' && issue.field_name === 'visit_date'))
    ].slice(0, 5),
    [qualityIssues, visitWindowIssues]
  );

  useEffect(() => {
    if (!exportStudyOptions.includes(selectedStudyId)) {
      setSelectedStudyId(exportStudyOptions[0] ?? 'LGL-1111');
    }
  }, [exportStudyOptions, selectedStudyId]);

  useEffect(() => {
    let ignore = false;
    void fetchQualityIssues(selectedStudyId)
      .then((issues) => {
        if (!ignore) setQualityIssues(issues);
      })
      .catch(() => {
        if (!ignore) setQualityIssues([]);
      });
    return () => {
      ignore = true;
    };
  }, [selectedStudyId]);

  async function handleCreateExport(record: ReportRecord) {
    if (!exportEnabled) {
      setExportStatus('当前角色没有导出写入权限，请切换到数据管理员或 CRC');
      return;
    }
    setExportStatus(`${record.name} / ${selectedStudyId} 生成中...`);
    try {
      const job = await createExportJob(record.type.toLowerCase(), selectedStudyId);
      setExportJobs((jobs) => ({ ...jobs, [record.id]: job }));
      setExportStatus(`${record.name} 已生成：${job.study_id} / ${job.id}`);
    } catch {
      setExportStatus('导出失败：请确认已登录且当前角色具备导出权限');
    }
  }

  async function handleDownloadExport(record: ReportRecord) {
    const job = exportJobs[record.id];
    if (!job) return;
    setExportStatus(`${record.name} 下载中...`);
    try {
      await downloadExportJob(job);
      setExportStatus(`${record.name} 已开始下载：${job.id}`);
    } catch {
      setExportStatus('下载失败：请确认导出文件仍可访问');
    }
  }

  async function handleRunQualityChecks() {
    if (!qualityEnabled) {
      setQualityStatus('当前角色没有数据校验写入权限，请切换到数据管理员或 CRC');
      return;
    }
    setQualityStatus('数据校验运行中...');
    try {
      const result = await runQualityChecks(selectedStudyId);
      setQualityStatus(`校验完成：${selectedStudyId} 发现 ${result.created} 条待处理问题`);
      const issues = await fetchQualityIssues(selectedStudyId);
      setQualityIssues(issues);
    } catch {
      setQualityStatus('校验失败：请确认当前角色具备质控权限');
    }
  }

  async function handleCreateQueryFromIssue(issue: ApiQualityIssue) {
    if (!qualityEnabled) {
      setQualityStatus('当前角色没有 Query 创建权限，请切换到数据管理员或 CRC');
      return;
    }
    setQualityStatus(`正在从质控问题创建 Query：${issue.patient_id} / ${issue.field_name}`);
    try {
      const created = await createDataQuery({
        study_id: issue.study_id,
        patient_id: issue.patient_id,
        visit_id: issue.source_table === 'visits' ? issue.source_id : null,
        form_id: issue.source_table,
        field_name: issue.field_name.replace(/^clinical_data\./, ''),
        title: `质控 Query：${issue.field_name}`,
        description: issue.message,
        assigned_to: currentUser?.id ?? null
      });
      setQualityQueryMap((rows) => ({ ...rows, [issue.id]: created }));
      setQualityStatus(`Query 已创建：${created.id} / ${created.patient_id} / ${created.field_name}`);
    } catch {
      setQualityStatus('Query 创建失败：字段不属于当前 CRF、跨 Study，或当前角色无权限');
    }
  }

  return (
    <div className="content workspace-page">
      <section className="module-kpis">
        <ModuleKpi icon="reports" label={t('可导出报表')} value="4" helper="PDF / XLSX / CSV / ZIP" />
        <ModuleKpi icon="database" label={t('数据库记录')} value="32" helper={t('患者、样本、组学检测')} tone="green" />
        <ModuleKpi icon="shield" label={t('审计轨迹')} value="18" helper={t('含知情同意与数据修改')} tone="purple" />
        <ModuleKpi icon="clock" label={t('待复核')} value="1" helper={t('SDTM 数据集草稿')} tone="orange" />
      </section>

      <div className="report-grid">
        {reportRecords.map((record) => (
          <ReportCard
            record={record}
            exportJob={exportJobs[record.id]}
            exportEnabled={exportEnabled}
            selectedStudyId={selectedStudyId}
            key={record.id}
            onDownload={handleDownloadExport}
            onExport={handleCreateExport}
          />
        ))}
      </div>

      <section className="module-card">
        <header className="module-card__header">
          <div>
            <h2>{t('数据导出流水线')}</h2>
            <span>{t('用于 Demo 后端 API 联调')}</span>
          </div>
          <div className="module-header-actions">
            <label className="module-select-inline">
              <span>{t('Study ID')}</span>
              <select value={selectedStudyId} onChange={(event) => setSelectedStudyId(event.target.value)}>
                {exportStudyOptions.map((studyId) => <option value={studyId} key={studyId}>{studyId}</option>)}
              </select>
            </label>
            <button
              className="module-link-button module-link-button--primary"
              type="button"
              disabled={!qualityEnabled}
              title={qualityEnabled ? undefined : t('当前角色没有数据校验写入权限')}
              onClick={handleRunQualityChecks}
            ><Icon name="check" />{t('运行校验')}</button>
          </div>
        </header>
        <div className="module-upload-status">
          <Icon name="reports" />
          <span>{t(exportStatus)}</span>
        </div>
        <div className="module-upload-status">
          <Icon name="shield" />
          <span>{t(qualityStatus)}</span>
        </div>
        <div className="quality-insight-grid">
          <div className="quality-insight-card">
            <span>{t('开放问题')}</span>
            <strong>{qualityIssues.filter((issue) => issue.status === 'open').length}</strong>
            <small>{t('来自 data_quality_issues')}</small>
          </div>
          <div className="quality-insight-card quality-insight-card--warning">
            <span>{t('访视窗口预警')}</span>
            <strong>{visitWindowIssues.length}</strong>
            <small>{t('基于 Study visit plan')}</small>
          </div>
          <div className="quality-insight-card quality-insight-card--danger">
            <span>{t('严重问题')}</span>
            <strong>{openCriticalIssues}</strong>
            <small>{t('需优先处理')}</small>
          </div>
        </div>
        <div className="quality-issue-list">
          {displayedQualityIssues.map((issue) => (
            <div className="quality-issue-row" key={issue.id}>
              <span className={`status-pill status-pill--${issue.severity === 'critical' ? 'danger' : issue.severity === 'warning' ? 'warning' : 'info'}`}>{t(issue.severity)}</span>
              <strong>{issue.patient_id}</strong>
              <span>{issue.source_table}.{issue.field_name}</span>
              <small>{t(issue.message)}</small>
              <button
                className="module-link-button module-link-button--primary"
                type="button"
                disabled={Boolean(qualityQueryMap[issue.id])}
                onClick={() => void handleCreateQueryFromIssue(issue)}
              >
                {qualityQueryMap[issue.id] ? `${t('已创建')} ${qualityQueryMap[issue.id].id}` : t('创建 Query')}
              </button>
            </div>
          ))}
          {!qualityIssues.length ? <span className="module-empty-note">{t('暂无质控问题；可点击运行校验刷新。')}</span> : null}
        </div>
        <div className="pipeline-grid">
          {['患者主数据', '临床 CRF', '样本台账', '多组学结果', '知情同意审计', '数据包归档'].map((item, index) => (
            <div className="pipeline-step" key={item}>
              <span>{index + 1}</span>
              <strong>{t(item)}</strong>
              <small>{t(index < 4 ? '可导出' : '待复核')}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReportCard({
  record,
  exportJob,
  exportEnabled,
  selectedStudyId,
  onDownload,
  onExport
}: {
  record: ReportRecord;
  exportJob?: ApiExportJob;
  exportEnabled: boolean;
  selectedStudyId: string;
  onDownload: (record: ReportRecord) => void;
  onExport: (record: ReportRecord) => void;
}) {
  const { t } = useI18n();
  return (
    <article className="module-card report-card">
      <Icon name="reports" />
      <div>
        <strong>{t(record.name)}</strong>
        <p>{t(record.scope)}</p>
      </div>
      <DetailList rows={[[t('Study ID'), exportJob?.study_id ?? selectedStudyId], [t('格式'), record.type], [t('状态'), t(exportJob?.status ?? record.status)], [t('更新时间'), record.updatedAt]]} />
      <div className="module-header-actions">
        <button
          className="module-primary-button"
          type="button"
          disabled={!exportEnabled}
          title={exportEnabled ? undefined : t('当前角色没有导出写入权限')}
          onClick={() => onExport(record)}
        ><Icon name="file" />{t('导出')}</button>
        <button className="module-link-button module-link-button--primary" type="button" disabled={!exportJob || exportJob.status !== 'ready'} onClick={() => onDownload(record)}>
          <Icon name="file" />{t('下载')}
        </button>
      </div>
    </article>
  );
}

export function HomeDashboardExtras() {
  const { t } = useI18n();

  return (
    <section className="module-card">
      <header className="module-card__header"><h2>{t('快捷操作')}</h2></header>
      <div className="quick-action-strip">
        {quickActions.map((action) => (
          <button type="button" key={action.label} disabled title={t('快捷操作已在顶部工作台接入')}>
            <Icon name={action.icon} />
            <span>{t(action.label)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
