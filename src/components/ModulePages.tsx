import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { quickActions } from '../data/dashboard';
import { clinicalDataGroups, clinicalFields, crfTemplateFieldCount, crfTemplateVersion } from '../data/crfTemplate';
import {
  formatSampleLibraryId,
  getCompleteness,
  type ConsentRecord,
  type FollowUpRecord,
  type OmicsRecord,
  type ReportRecord,
  type SampleRecord,
  type StudyVisitPlanRecord,
  type VisitRecord
} from '../data/operations';
import type { PatientRecord } from '../data/patientCohort';
import {
  defaultDetectionTypes,
  defaultDiseaseTypes,
  defaultQuantityUnits,
  defaultSampleTypes,
  getGlobalDetectionTypes,
  getGlobalDiseaseTypes,
  getGlobalQuantityUnits,
  getGlobalSampleTypes,
  globalConfigChangedEvent,
  saveGlobalDetectionTypes,
  saveGlobalDiseaseTypes,
  saveGlobalQuantityUnits,
  saveGlobalSampleTypes
} from '../data/globalConfig';
import { demoUsers, roleLabels, type AuthenticatedUser, type StudyRole, type UserRole } from '../data/auth';
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
  deleteUserAccount,
  deleteStudy,
  downloadExportJob,
  downloadOperationLogsCsv,
  fetchConsentRecords,
  fetchFileMetadata,
  fetchGlobalConfiguration,
  fetchWorkspaceDataset,
  fetchOmicsRecords,
  fetchSamples,
  fetchDataQueries,
  fetchOperationLogs,
  fetchStudyCrfFields,
  fetchStudyCrfMigrations,
  fetchStudyCrfVersions,
  fetchStudyConfiguration,
  fetchStudyFileMetadata,
  fetchStudyMembers,
  fetchStudySites,
  fetchStudyVisitPlans,
  fetchApprovalRequests,
  fetchPermissionMatrix,
  fetchQualityIssues,
  fetchStudies,
  fetchUsers,
  getCurrentScopedStudyId,
  isPermissionError,
  openFileFromBackend,
  previewStudyCrfMigration,
  recordBelongsToCurrentStudyScope,
  requestStudyCrfMigrationApproval,
  rejectApprovalRequest,
  runQualityChecks,
  saveClinicalCrfEntry,
  saveVisitFollowUpRecord,
  updatePatientClinicalData,
  updateConsentRecord,
  updateDataQuery,
  updateGlobalConfiguration,
  updateOmicsRecord,
  updateSampleRecord,
  updateGlobalRoleStudyScope,
  updateStudyConfiguration,
  updateStudyCrfField,
  updateStudyCrfVersion,
  updateStudy,
  updateUserAccount,
  updateUserAccountStatus,
  upsertStudyMember,
  uploadFileToBackend,
  workspaceDataChangedEvent
} from '../services/api';
import type { ApiApprovalRequest, ApiDataQuery, ApiExportJob, ApiFileMetadata, ApiOperationLog, ApiPermissionMatrixRow, ApiQualityIssue, ApiSiteUser, ApiStudy, ApiStudyConfiguration, ApiStudyMember, ApiStudySite, ApiUser } from '../services/contracts';
import type { CrfMigrationApprovalRecord, CrfMigrationPreview, StudyCrfVersionRecord } from '../services/api';
import type { IconName } from '../types';
import { Icon } from './Icon';
import { PatientListModule } from './PatientCohortPage';
import { PatientJourneyPage as PatientJourneyWorkspacePage } from './PatientJourneyPage';

const consentPageSize = 6;
const sampleLedgerPageSize = 6;
const omicsTestingPageSize = 6;
const sampleTestingPatientPickerPageSize = 6;
const systemAccountPageSize = 5;
const systemFieldPageSize = 5;
const consentVersion = 'V1.0';
const consentStatusOptions: Array<'全部' | ConsentRecord['status']> = ['全部', '待签署', '已签署', '已撤回'];
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
          '如需补充样本或上传外部检测文件，研究团队会在确认授权和样本质量后进行登记和归档。'
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

const consentTemplateCatalog = [
  {
    id: 'lung-cancer-rwd-consent-v1.0',
    title: '真实世界肺癌耐药研究知情同意',
    label: '真实世界肺癌耐药研究知情同意 v1.0',
    description: '适用于肺癌、NSCLC、靶向/免疫治疗及耐药真实世界研究。',
    sections: lungConsentPreviewContent
  },
  {
    id: 'immune-neurology-consent-v20260423',
    title: '免疫相关性神经系统疾病多组学解析及机制探索',
    label: '免疫相关性神经系统疾病知情同意 v20260423',
    description: '适用于 NPSLE、MS、NMOSD 等免疫相关性神经系统疾病多组学研究。',
    sections: consentPreviewContent
  }
] as const;

const customConsentTemplateOption = 'custom';

function consentTemplateCatalogItem(templateId?: string) {
  const normalized = templateId?.trim();
  if (!normalized) return undefined;
  return consentTemplateCatalog.find((item) => item.id === normalized);
}

function isLungConsentConfiguration(studyId?: string, configuration?: ApiStudyConfiguration, ...context: Array<string | undefined>) {
  const marker = [
    studyId,
    configuration?.disease_area,
    configuration?.consent_template,
    configuration?.active_crf_version_id,
    configuration?.testing_profile?.testing_project_id,
    ...context
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return ['lzxk', 'lung', 'nsclc', 'luad', 'lusc', 'egfr', 'alk', '肺癌', '耐药'].some((item) => marker.includes(item));
}

function isImmuneNeurologyConsentConfiguration(studyId?: string, configuration?: ApiStudyConfiguration, ...context: Array<string | undefined>) {
  const marker = [
    studyId,
    configuration?.disease_area,
    configuration?.consent_template,
    configuration?.active_crf_version_id,
    ...context
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return ['npsle', 'nmosd', 'ms', 'sle', 'immune', 'neurology', '免疫', '神经', '红斑狼疮', '多发性硬化', '视神经脊髓炎'].some((item) =>
    marker.includes(item)
  );
}

function configuredConsentContent(studyId?: string, configuration?: ApiStudyConfiguration, ...context: Array<string | undefined>): ConsentPreviewSection[] {
  if (isLungConsentConfiguration(studyId, configuration, ...context)) return lungConsentPreviewContent;
  if (isImmuneNeurologyConsentConfiguration(studyId, configuration, ...context)) return consentPreviewContent;
  const template = configuration?.consent_template?.trim();
  if (!template) return consentPreviewContent;
  return [
    {
      title: '知情同意模板配置',
      icon: 'file',
      eyebrow: '当前 Study 配置总表',
      blocks: [
        {
          paragraphs: [
            `当前 Study 已绑定知情同意模板：${template}`,
            `疾病领域：${configuration?.disease_area || '未配置'}`,
            '请在 Study 系统管理中维护当前 Study 的知情同意模板编号或说明；知情同意页会按该配置展示模板信息，并与患者签署记录保持同一 Study 范围。'
          ]
        }
      ]
    },
    consentPreviewContent[7]
  ];
}

function getConsentStudyTitle(studyId?: string, configuration?: ApiStudyConfiguration, ...context: Array<string | undefined>) {
  if (isLungConsentConfiguration(studyId, configuration, ...context)) return '真实世界肺癌耐药研究知情同意';
  if (isImmuneNeurologyConsentConfiguration(studyId, configuration, ...context)) return '免疫相关性神经系统疾病多组学解析及机制探索';
  return configuration?.consent_template || '当前 Study 知情同意模板';
}

function inferConsentTemplateId(studyId?: string, configuration?: ApiStudyConfiguration, ...context: Array<string | undefined>) {
  const explicitTemplate = configuration?.consent_template?.trim();
  if (explicitTemplate) return explicitTemplate;
  if (isLungConsentConfiguration(studyId, configuration, ...context)) return 'lung-cancer-rwd-consent-v1.0';
  if (isImmuneNeurologyConsentConfiguration(studyId, configuration, ...context)) return 'immune-neurology-consent-v20260423';
  return '';
}

function escapeConsentHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function consentPrintableHtml(title: string, sections: ConsentPreviewSection[]) {
  const sectionHtml = sections.map((section) => {
    const blockHtml = section.blocks.map((block) => {
      const titleHtml = block.title ? `<h3>${escapeConsentHtml(block.title)}</h3>` : '';
      const paragraphs = (block.paragraphs ?? []).map((paragraph) => `<p>${escapeConsentHtml(paragraph)}</p>`).join('');
      const items = block.items?.length
        ? `<ul>${block.items.map((item) => `<li>${escapeConsentHtml(item)}</li>`).join('')}</ul>`
        : '';
      return `<section>${titleHtml}${paragraphs}${items}</section>`;
    }).join('');
    return `<article><h2>${escapeConsentHtml(section.title)}</h2>${blockHtml}</article>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeConsentHtml(title)}</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:40px;color:#17223b;line-height:1.7}
    h1{text-align:center;margin-bottom:32px} h2{margin-top:28px;border-bottom:1px solid #d8e2f0;padding-bottom:8px}
    h3{margin-bottom:8px} article{page-break-inside:avoid} li{margin:6px 0}
  </style></head><body><h1>${escapeConsentHtml(title)}</h1>${sectionHtml}</body></html>`;
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
              <button type="button" onClick={onPrint}><Icon name="search" />{t('查看知情')}</button>
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

function normalizeSampleStatus(status: string): '已采集' | '检测中' | '检测完成' {
  if (status === '检测中' || status === '已送检') return '检测中';
  if (status === '结果回传' || status === '检测完成') return '检测完成';
  return '已采集';
}

type OmicsDisplayStatus = '待检测' | '检测中' | '检测完成' | '已归档';
type OmicsDisplayQc = '待检' | '未通过' | '已通过';
type OmicsFilterStatus = '全部' | OmicsDisplayStatus;
type DateSortDirection = 'desc' | 'asc';

type SampleDetectionRow = {
  id: string;
  omicsId?: string;
  studyId?: string;
  patientName: string;
  hospitalNo: string;
  sampleId: string;
  sampleIds: string[];
  sampleType: string;
  collectedAt: string;
  sentAt: string;
  assay: string;
  vendor: string;
  usageSummary: string;
  status: OmicsDisplayStatus;
  qc: OmicsDisplayQc;
  resultFileId?: string;
  resultFileLabel: string;
  resultFileStatus: string;
};

type SampleLedgerRow = {
  id: string;
  studyId?: string;
  patientName: string;
  hospitalNo: string;
  sampleId: string;
  sampleType: string;
  collectedAt: string;
  storage: string;
  remainingQuantity: string;
  linkedOmics: string;
  note: string;
};

type SampleTestingEditor =
  | { kind: 'sample'; draft: SampleRecord; isNew: boolean }
  | { kind: 'omics'; draft: OmicsRecord };

type SampleTestingFlow =
  | { kind: 'sample'; step: 'patient'; query: string; page: number }
  | { kind: 'omics'; step: 'patient'; query: string; page: number }
  | { kind: 'omics'; step: 'samples'; patientId: string; selectedSampleIds: string[] };

function uniqueOptionalStudyIds(records: Array<{ studyId?: string }>) {
  return Array.from(new Set(records.map((record) => record.studyId).filter(Boolean) as string[])).sort();
}

function formatDateOnly(value?: string) {
  if (!value || value === '-') return value ?? '-';
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? value;
}

function patientMatchesSample(patient: PatientRecord, sample: SampleRecord) {
  if (patient.id && sample.patientId) return patient.id === sample.patientId;
  return patient.name === sample.patientName && (!sample.studyId || sample.studyId === patient.studyId);
}

function patientSearchHaystack(patient: PatientRecord) {
  return [
    patientDisplayNumber(patient),
    patient.id,
    patient.studyId,
    patient.studyName,
    patient.patientNumber,
    patient.patientName,
    patient.patientNameInitials,
    patient.name,
    patient.hospitalNo,
    patient.diseaseType
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function patientDisplayNumber(patient: PatientRecord) {
  return patient.patientNumber || patient.name || patient.id || '-';
}

function normalizeOmicsDisplayStatus(status?: OmicsRecord['status'], sampleStatus?: SampleRecord['status']): OmicsDisplayStatus {
  if (status === '结果归档') return '已归档';
  if (sampleStatus === '结果回传') return '已归档';
  if (status === '测序完成' || status === '数据分析') return '检测完成';
  if (status === '样本接收' || status === '文库构建' || sampleStatus === '检测中' || sampleStatus === '已送检') return '检测中';
  return '待检测';
}

function normalizeOmicsDisplayQc(qc?: OmicsRecord['qc']): OmicsDisplayQc {
  if (qc === '通过') return '已通过';
  if (qc === '未通过') return '未通过';
  return '待检';
}

function resultFileDisplay(record: OmicsRecord, filesById: Map<string, ApiFileMetadata>) {
  if (!record.resultFileId) {
    return { resultFileId: undefined, resultFileLabel: '-', resultFileStatus: '未上传' };
  }
  const file = filesById.get(record.resultFileId);
  if (!file) {
    return { resultFileId: record.resultFileId, resultFileLabel: record.resultFileId, resultFileStatus: '文件元数据未加载' };
  }
  const scanStatus = file.scan_status ? `扫描:${file.scan_status}` : '扫描:未知';
  const archiveStatus = file.archive_status ? `归档:${file.archive_status}` : '归档:active';
  return {
    resultFileId: record.resultFileId,
    resultFileLabel: file.original_filename,
    resultFileStatus: `${scanStatus} · ${archiveStatus}`
  };
}

function sampleQuantityLabel(sample: SampleRecord) {
  const remaining = sample.remainingQuantity || '-';
  const unit = sample.quantityUnit || '';
  return `${remaining}${unit}`;
}

function omicsUsageSummary(record: OmicsRecord) {
  const sampleIds = record.sampleIds?.length ? record.sampleIds : [record.sampleId];
  return sampleIds
    .map((sampleId) => {
      const usage = record.sampleUsage?.[sampleId];
      const unit = usage?.unit ?? '';
      const sent = usage?.usedQuantity ? `${usage.usedQuantity}${unit}` : '未填';
      const returned = usage?.returnedQuantity ? ` / 返还 ${usage.returnedQuantity}${unit}` : '';
      return `${sampleId}: 送样 ${sent}${returned}`;
    })
    .join(' / ');
}

function normalizeLinkedOmicsLabel(label: string) {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function buildSampleDetectionRows(sampleRows: SampleRecord[], omicsRows: OmicsRecord[], fileRows: ApiFileMetadata[] = []): SampleDetectionRow[] {
  const filesById = new Map(fileRows.map((file) => [file.id, file]));
  const representedOmicsBySample = new Map<string, Set<string>>();
  const representedSampleIds = new Set<string>();

  for (const record of omicsRows) {
    const sampleIds = (record.sampleIds?.length ? record.sampleIds : [record.sampleId]).filter(Boolean);
    for (const sampleId of sampleIds) {
      representedSampleIds.add(sampleId);
      const labels = representedOmicsBySample.get(sampleId) ?? new Set<string>();
      labels.add(record.assay);
      labels.add(`${record.assay} (${record.id})`);
      representedOmicsBySample.set(sampleId, labels);
    }
  }

  const rowsFromOmics = omicsRows.map((record) => {
    const linkedSamples = (record.sampleIds?.length ? record.sampleIds : [record.sampleId])
      .map((sampleId) => sampleRows.find((item) => item.id === sampleId))
      .filter(Boolean) as SampleRecord[];
    const sample = linkedSamples[0] ?? sampleRows.find((item) => item.id === record.sampleId);
    const sampleIds = linkedSamples.length ? linkedSamples.map(formatSampleLedgerId) : [record.sampleId];
    const sampleId = sampleIds.join(' / ');
    const status = normalizeOmicsDisplayStatus(record.status, sample?.status);
    const resultFile = resultFileDisplay(record, filesById);

    return {
      id: record.id,
      omicsId: record.id,
      studyId: record.studyId ?? sample?.studyId,
      patientName: record.patientName,
      hospitalNo: Array.from(new Set(linkedSamples.map((item) => item.hospitalNo).filter(Boolean))).join(' / ') || sample?.hospitalNo || '-',
      sampleId,
      sampleIds,
      sampleType: linkedSamples.length > 1 ? linkedSamples.map((item) => item.sampleType).join(' / ') : sample?.sampleType ?? record.sampleType,
      collectedAt: formatDateOnly(sample?.collectedAt ?? record.sentAt),
      sentAt: formatDateOnly(record.sentAt),
      assay: record.assay,
      vendor: record.vendor,
      usageSummary: omicsUsageSummary(record),
      status,
      qc: normalizeOmicsDisplayQc(record.qc),
      ...resultFile
    };
  });

  const rowsFromSamples = sampleRows
    .flatMap((sample) => {
      const representedLabels = representedOmicsBySample.get(sample.id) ?? new Set<string>();
      const unmatchedLinkedOmics = sample.linkedOmics.filter((assay) => {
        if (!assay || assay === '待选择' || assay === '待指定') return false;
        return !representedLabels.has(assay) && !representedLabels.has(normalizeLinkedOmicsLabel(assay));
      });
      const assays = unmatchedLinkedOmics.length ? unmatchedLinkedOmics : representedSampleIds.has(sample.id) ? [] : ['待指定'];
      const status = normalizeOmicsDisplayStatus(undefined, sample.status);
      const sampleId = formatSampleLedgerId(sample);

      return assays.map((assay, index) => ({
        id: `${sample.id}-${index}`,
        omicsId: undefined,
        studyId: sample.studyId,
        patientName: sample.patientName,
        hospitalNo: sample.hospitalNo || '-',
        sampleId,
        sampleIds: [sampleId],
        sampleType: sample.sampleType,
        collectedAt: formatDateOnly(sample.collectedAt),
        sentAt: formatDateOnly(sample.collectedAt),
        assay,
        vendor: '-',
        usageSummary: '-',
        status,
        qc: '待检' as OmicsDisplayQc,
        resultFileLabel: '-',
        resultFileStatus: '未创建检测'
      }));
    });

  return [...rowsFromOmics, ...rowsFromSamples].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
}

function formatSampleLedgerId(sample: SampleRecord) {
  return sample.id;
}

function buildSampleLedgerRows(sampleRows: SampleRecord[]): SampleLedgerRow[] {
  return sampleRows
    .map((sample) => ({
      id: sample.id,
      studyId: sample.studyId,
      patientName: sample.patientName,
      hospitalNo: sample.hospitalNo,
      sampleId: formatSampleLedgerId(sample),
      sampleType: sample.sampleType,
      collectedAt: formatDateOnly(sample.collectedAt),
	      storage: sample.storage,
	      remainingQuantity: sampleQuantityLabel(sample),
	      linkedOmics: sample.linkedOmics.length ? sample.linkedOmics.join(' / ') : '待指定检测',
	      note: sample.note || sample.visit
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

function formatClinicalValue(value: string | number | null | undefined) {
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

  return sections.length ? sections : [{ title: '等待 API 数据', items: [['数据源', '等待 PostgreSQL API'] as [string, string]] }];
}

const emptyClinicalPatient: PatientRecord = {
  studyId: '',
  name: '等待 API',
  hospitalNo: '-',
  sex: '男',
  age: 0,
  diseaseType: 'NPSLE',
  organs: [],
  samples: [],
  omicsStatus: '样本采集',
  note: '等待 PostgreSQL API',
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
  const [newVisitEditId, setNewVisitEditId] = useState<string | null>(null);
  const [clinicalFormSections, setClinicalFormSections] = useState(() => buildClinicalSectionsFromPatient(scopedSelectedPatient ?? emptyClinicalPatient));
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionBackups, setSectionBackups] = useState<Record<string, Array<[string, string]>>>({});
  const [clinicalSaveStatus, setClinicalSaveStatus] = useState('等待保存');

  const refreshClinicalWorkspaceData = useCallback(async () => {
    try {
      const dataset = await fetchWorkspaceDataset();
      setPatients(dataset.patients);
      setVisitRows([...dataset.visits, ...dataset.followUps.map(followUpRecordToClinicalVisit)]);
    } catch {
      // Keep the current editable state if a background refresh fails.
    }
  }, []);

  useEffect(() => {
    void refreshClinicalWorkspaceData();
  }, [refreshClinicalWorkspaceData]);

  useEffect(() => {
    const refresh = () => void refreshClinicalWorkspaceData();
    window.addEventListener(workspaceDataChangedEvent, refresh);
    return () => window.removeEventListener(workspaceDataChangedEvent, refresh);
  }, [refreshClinicalWorkspaceData]);

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
  const patientVisitRows = useMemo(
    () => visitRows.filter((record) => (patient.id ? record.patientId === patient.id : record.patientName === patient.name)),
    [patient.id, patient.name, visitRows]
  );

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
    setClinicalSaveStatus(status === 'draft' ? '草稿保存中...' : '提交中...');

    try {
      if (patient.id) {
        const updatedPatient = await updatePatientClinicalData(nextPatient, payload);
        await saveClinicalCrfEntry(updatedPatient, payload, status);
        setPatients((records) => records.map((record) => (record.id === updatedPatient.id ? { ...record, ...updatedPatient } : record)));
        onPatientChange?.({ ...nextPatient, ...updatedPatient });
        setEditingSection(null);
        setClinicalSaveStatus(status === 'draft' ? '草稿已保存到后端' : 'CRF 已提交到后端');
      } else {
        setClinicalSaveStatus('保存失败：请先选择后端患者记录');
      }
    } catch {
      setClinicalSaveStatus(status === 'draft' ? '保存失败：后端未接受 CRF 草稿' : '提交失败：后端未接受 CRF');
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
      setClinicalSaveStatus(`保存失败：随访 ${nextRecord.visit} 未写入后端`);
      return record;
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
              ['存储格式', patient.clinicalDataFormat === 'jsonb' ? 'PostgreSQL JSONB' : 'PostgreSQL JSON'],
              ['最近更新', 'PostgreSQL API']
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
              onChange={(nextRows) =>
                setVisitRows((rows) => [
                  ...rows.filter((record) => (patient.id ? record.patientId !== patient.id : record.patientName !== patient.name)),
                  ...nextRows
                ])
              }
              onSave={(record) => saveClinicalVisit(record)}
              metricLabel={clinicalMetricLabel}
              initialEditingId={newVisitEditId}
              onInitialEditingHandled={() => setNewVisitEditId(null)}
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
                  <td>{isEditing ? <input className="module-table-input" value={record.id} readOnly /> : useLibraryCode ? formatSampleLibraryId(record) : record.id}</td>
                  {!compact && <td>{record.patientName}</td>}
                  <td>{isEditing ? <input className="module-table-input" value={record.sampleType} onChange={(event) => updateRecord(record.id, { sampleType: event.target.value })} /> : t(record.sampleType)}</td>
                  <td>{isEditing ? <input className="module-table-input" type="date" value={formatDateOnly(record.collectedAt)} onChange={(event) => updateRecord(record.id, { collectedAt: event.target.value })} /> : formatDateOnly(record.collectedAt)}</td>
                  <td>{isEditing ? <input className="module-table-input" value={record.linkedOmics.join(' / ')} onChange={(event) => updateRecord(record.id, { linkedOmics: event.target.value.split('/').map((item) => item.trim()).filter(Boolean) })} /> : record.linkedOmics.join(' / ')}</td>
                  <td>
                    {isEditing ? (
                      <select className="module-table-input" value={record.status} onChange={(event) => updateRecord(record.id, { status: event.target.value as SampleRecord['status'] })}>
                        <option value="已采集">{t('已采集')}</option>
                        <option value="已送检">{t('已送检')}</option>
                        <option value="检测中">{t('检测中')}</option>
                        <option value="结果回传">{t('结果回传')}</option>
                        <option value="待处理">{t('待处理')}</option>
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
  onUpload,
  onOpenFile,
  showStudyId = false
}: {
  records: SampleDetectionRow[];
  onView: (record: SampleDetectionRow) => void;
  onEdit: (record: SampleDetectionRow) => void;
  onUpload: (record: SampleDetectionRow) => void;
  onOpenFile: (record: SampleDetectionRow) => void;
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
            <th>{t('供应商')}</th>
            <th>{t('使用量')}</th>
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
              <td>{t(record.vendor || '-')}</td>
              <td>{t(record.usageSummary)}</td>
              <td><StatusPill value={record.status} /></td>
              <td>{formatDateOnly(record.sentAt)}</td>
              <td><StatusPill value={record.qc} /></td>
              <td>
                <div className="module-file-cell">
                  <span>{record.resultFileLabel}</span>
                  <small>{t(record.resultFileStatus)}</small>
                  {record.resultFileId ? (
                    <button className="module-file-cell__action" type="button" onClick={() => onOpenFile(record)}>
                      {t('查看文件')}
                    </button>
                  ) : null}
                </div>
              </td>
              <td>
                <div className="module-table-actions">
                  <button className="module-link-button module-link-button--primary" type="button" onClick={() => onView(record)}>{t('查看')}</button>
                  <button className="module-link-button" type="button" onClick={() => onEdit(record)}>{t('编辑')}</button>
                  <button
                    className="module-link-button"
                    type="button"
                    disabled={!record.omicsId}
                    title={!record.omicsId ? t('请先创建检测项目后上传结果') : undefined}
                    onClick={() => onUpload(record)}
                  >
                    {t('上传结果')}
                  </button>
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
            <th>{t('存储位置')}</th>
            <th>{t('剩余量')}</th>
            <th>{t('已做检测')}</th>
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
              <td>{t(row.storage)}</td>
              <td>{t(row.remainingQuantity)}</td>
              <td>{t(row.linkedOmics)}</td>
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

function consentRecordMatchesPatient(record: ConsentRecord, patient: PatientRecord) {
  if (patient.id) return record.patientId === patient.id;
  return record.studyId === patient.studyId && (record.patientName === patient.name || record.hospitalNo === patient.hospitalNo);
}

function pendingConsentRecordForPatient(patient: PatientRecord): ConsentRecord {
  return {
    id: `PENDING-CONSENT-${patient.id || patient.studyId || 'STUDY'}-${patient.name}`,
    studyId: patient.studyId,
    patientId: patient.id,
    patientName: patient.name,
    hospitalNo: patient.hospitalNo,
    diseaseType: patient.diseaseType,
    status: '待签署',
    signedAt: '-',
    version: consentVersion,
    method: '-'
  };
}

function findConsentRecordForPatient(records: ConsentRecord[], patient?: PatientRecord | null) {
  if (!patient) return undefined;
  return records.find((record) => consentRecordMatchesPatient(record, patient));
}

export function ConsentManagementPage({
  selectedPatient
}: {
  currentUser?: AuthenticatedUser | null;
  selectedPatient?: PatientRecord | null;
} = {}) {
  const { t } = useI18n();
  const scopedSelectedPatient = selectedPatient && recordBelongsToCurrentStudyScope(selectedPatient) ? selectedPatient : null;
  const currentConsentStudyId = getCurrentScopedStudyId();
  const consentUploadInputRef = useRef<globalThis.HTMLInputElement>(null);
  const emptyConsentRecord = useMemo<ConsentRecord>(() => ({
    id: 'NO-SCOPED-CONSENT',
    studyId: currentConsentStudyId,
    patientId: '',
    patientName: '-',
    hospitalNo: '-',
    diseaseType: '-',
    status: '待签署',
    signedAt: '-',
    version: consentVersion,
    method: '电子'
  }), [currentConsentStudyId]);
  const [selected, setSelected] = useState<ConsentRecord>(() => scopedSelectedPatient ? pendingConsentRecordForPatient(scopedSelectedPatient) : emptyConsentRecord);
  const [baseRecords, setBaseRecords] = useState<ConsentRecord[]>([]);
  const [recordOverrides, setRecordOverrides] = useState<Record<string, Partial<ConsentRecord>>>({});
  const [understoodRecords, setUnderstoodRecords] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'全部' | ConsentRecord['status']>('全部');
  const [studyFilter, setStudyFilter] = useState('全部 Study');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeConsentSection, setActiveConsentSection] = useState(0);
  const [consentActionStatus, setConsentActionStatus] = useState('等待知情同意操作');
  const [pendingConsentUploadRecord, setPendingConsentUploadRecord] = useState<ConsentRecord | null>(null);
  const [consentFileRows, setConsentFileRows] = useState<ApiFileMetadata[]>([]);
  const [consentConfigurationsByStudy, setConsentConfigurationsByStudy] = useState<Record<string, ApiStudyConfiguration>>({});
  const [consentStudiesById, setConsentStudiesById] = useState<Record<string, ApiStudy>>({});
  const records = useMemo(() => {
    const mergedRecords = baseRecords.map((record) => ({ ...record, ...recordOverrides[record.id] }));
    if (scopedSelectedPatient && !findConsentRecordForPatient(mergedRecords, scopedSelectedPatient)) {
      return [pendingConsentRecordForPatient(scopedSelectedPatient), ...mergedRecords];
    }
    return mergedRecords;
  }, [baseRecords, recordOverrides, scopedSelectedPatient]);
  const consentStudyOptions = useMemo(() => uniqueOptionalStudyIds(records), [records]);
  const showConsentStudyId = consentStudyOptions.length > 1;
  const studyFilteredRecords = useMemo(
    () => records.filter((record) => studyFilter === '全部 Study' || record.studyId === studyFilter),
    [records, studyFilter]
  );
  const selectedRecord =
    findConsentRecordForPatient(records, scopedSelectedPatient) ??
    records.find((record) => record.id === selected.id) ??
    records[0] ??
    (scopedSelectedPatient ? pendingConsentRecordForPatient(scopedSelectedPatient) : emptyConsentRecord);
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
  const selectedStudyConfiguration = selectedRecord.studyId ? consentConfigurationsByStudy[selectedRecord.studyId] : undefined;
  const selectedConsentStudy = selectedRecord.studyId ? consentStudiesById[selectedRecord.studyId] : undefined;
  const selectedConsentPreviewContent = configuredConsentContent(
    selectedRecord.studyId,
    selectedStudyConfiguration,
    selectedRecord.diseaseType,
    selectedConsentStudy?.indication,
    selectedConsentStudy?.name
  );
  const selectedConsentTemplate = selectedStudyConfiguration?.consent_template;
  const selectedConsentStudyTitle = getConsentStudyTitle(
    selectedRecord.studyId,
    selectedStudyConfiguration,
    selectedRecord.diseaseType,
    selectedConsentStudy?.indication,
    selectedConsentStudy?.name
  );
  const latestConsentFilesByRecordId = useMemo(() => {
    const sortedFiles = [...consentFileRows]
      .filter((file) => file.category === 'consent')
      .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    const byRecordId = new Map<string, ApiFileMetadata>();
    for (const file of sortedFiles) {
      if (file.consent_id && !byRecordId.has(file.consent_id)) byRecordId.set(file.consent_id, file);
    }
    return byRecordId;
  }, [consentFileRows]);
  const selectedConsentFile = selectedRecord.id ? latestConsentFilesByRecordId.get(selectedRecord.id) : undefined;
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

  const consentTemplateContextForRecord = (record: ConsentRecord) => {
    const studyConfiguration = record.studyId ? consentConfigurationsByStudy[record.studyId] : undefined;
    const study = record.studyId ? consentStudiesById[record.studyId] : undefined;
    return {
      content: configuredConsentContent(record.studyId, studyConfiguration, record.diseaseType, study?.indication, study?.name),
      title: getConsentStudyTitle(record.studyId, studyConfiguration, record.diseaseType, study?.indication, study?.name)
    };
  };

  const printConsentPdf = (record = selectedRecord) => {
    const { content, title } = consentTemplateContextForRecord(record);
    setSelected(record);
    setUnderstoodRecords((current) => ({ ...current, [record.id]: true }));
    const previewWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (previewWindow) {
      previewWindow.document.open();
      previewWindow.document.write(consentPrintableHtml(title, content));
      previewWindow.document.close();
      previewWindow.focus();
      previewWindow.print();
      setConsentActionStatus('已打开当前 Study 知情同意模板预览；如需纸质归档，请在预览页打印');
    } else {
      setConsentActionStatus('浏览器阻止了知情同意预览弹窗，请允许弹窗后重试');
    }
  };

  const applyConsentUpdate = async (record: ConsentRecord, payload: Partial<Pick<ConsentRecord, 'status' | 'signedAt' | 'version' | 'method'>>, message: string) => {
    const nextRecord = { ...record, ...payload };
    setConsentActionStatus(`${message}，同步后端中...`);
    try {
      await updateConsentRecord(record.id, payload);
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
      setConsentActionStatus(`${message}，已同步后端`);
    } catch {
      setConsentActionStatus(`${message}失败：后端未接受知情同意变更`);
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
      const uploaded = await uploadFileToBackend(file, {
        category: 'consent',
        patientId: record.patientId,
        consentId: record.id,
        isDeidentified: false
      });
      setConsentFileRows((rows) => [uploaded, ...rows.filter((row) => row.id !== uploaded.id)]);
      await applyConsentUpdate(
        record,
        { status: '已签署', signedAt: new Date().toISOString().slice(0, 10), method: '纸质' },
        `知情文件 ${file.name} 已上传并归档`
      );
    } catch {
      setConsentActionStatus(`知情文件 ${file.name} 上传失败；请确认后端连接和文件权限`);
    } finally {
      setPendingConsentUploadRecord(null);
      if (consentUploadInputRef.current) consentUploadInputRef.current.value = '';
    }
  };

  const withdrawConsent = (record: ConsentRecord) => {
    void applyConsentUpdate(record, { status: '已撤回' }, '已标记知情同意撤回');
  };

  async function openConsentFile(record: ConsentRecord) {
    const file = latestConsentFilesByRecordId.get(record.id);
    if (!file) {
      setSelected(record);
      setConsentActionStatus(`患者 ${record.patientName} 暂无已上传知情文件`);
      return;
    }
    setSelected(record);
    setConsentActionStatus(`正在打开 ${record.patientName} 的已上传知情文件：${file.original_filename}`);
    try {
      await openFileFromBackend(file);
      setConsentActionStatus(`已打开 ${record.patientName} 的已上传知情文件：${file.original_filename}`);
    } catch {
      setConsentActionStatus('已上传知情文件打开失败；请确认后端连接、文件权限和扫描状态');
    }
  }

  const markSelectedUnderstood = () => {
    setUnderstoodRecords((current) => ({ ...current, [selectedRecord.id]: true }));
  };

  const refreshConsentRecordsForPage = useCallback(async () => {
    try {
      const nextRecords = await fetchConsentRecords();
      setBaseRecords(nextRecords);
      setRecordOverrides({});
      setSelected(findConsentRecordForPatient(nextRecords, scopedSelectedPatient) ?? nextRecords[0] ?? (scopedSelectedPatient ? pendingConsentRecordForPatient(scopedSelectedPatient) : emptyConsentRecord));
    } catch {
      // Preserve current rows during transient background refresh failures.
    }
  }, [emptyConsentRecord, scopedSelectedPatient]);

  const refreshConsentFilesForPage = useCallback(async () => {
    try {
      const files = await fetchFileMetadata();
      setConsentFileRows(files.filter((file) => file.category === 'consent'));
    } catch {
      // Preserve current file metadata during transient background refresh failures.
    }
  }, []);

  const refreshConsentConfigurationsForPage = useCallback(async (studyIds: string[]) => {
    const uniqueStudyIds = Array.from(new Set(studyIds.filter(Boolean)));
    if (!uniqueStudyIds.length) return;
    const results = await Promise.allSettled(uniqueStudyIds.map((studyId) => fetchStudyConfiguration(studyId)));
    setConsentConfigurationsByStudy((configurations) => {
      const next = { ...configurations };
      for (const result of results) {
        if (result.status === 'fulfilled') next[result.value.study_id] = result.value;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, studyFilter]);

  useEffect(() => {
    if (studyFilter !== '全部 Study' && !consentStudyOptions.includes(studyFilter)) {
      setStudyFilter('全部 Study');
    }
  }, [consentStudyOptions, studyFilter]);

  useEffect(() => {
    if (!scopedSelectedPatient) return;
    const matched = findConsentRecordForPatient(records, scopedSelectedPatient) ?? pendingConsentRecordForPatient(scopedSelectedPatient);
    setSelected(matched);
    if (matched.studyId) setStudyFilter(matched.studyId);
  }, [records, scopedSelectedPatient]);

  useEffect(() => {
    void refreshConsentRecordsForPage();
    void refreshConsentFilesForPage();
  }, [refreshConsentFilesForPage, refreshConsentRecordsForPage]);

  useEffect(() => {
    let ignore = false;
    void fetchStudies()
      .then((studies) => {
        if (ignore) return;
        setConsentStudiesById(Object.fromEntries(studies.map((study) => [study.id, study])));
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      void refreshConsentRecordsForPage();
      void refreshConsentFilesForPage();
      const studyIds = consentStudyOptions.length ? consentStudyOptions : selectedRecord.studyId ? [selectedRecord.studyId] : [];
      void refreshConsentConfigurationsForPage(studyIds);
      void fetchStudies()
        .then((studies) => setConsentStudiesById(Object.fromEntries(studies.map((study) => [study.id, study]))))
        .catch(() => undefined);
    };
    window.addEventListener(workspaceDataChangedEvent, refresh);
    return () => window.removeEventListener(workspaceDataChangedEvent, refresh);
  }, [consentStudyOptions, refreshConsentConfigurationsForPage, refreshConsentFilesForPage, refreshConsentRecordsForPage, selectedRecord.studyId]);

  useEffect(() => {
    const studyIds = consentStudyOptions.filter((studyId) => !consentConfigurationsByStudy[studyId]);
    if (!studyIds.length) return undefined;
    let ignore = false;

    void Promise.allSettled(studyIds.map((studyId) => fetchStudyConfiguration(studyId)))
      .then((results) => {
        if (ignore) return;
        setConsentConfigurationsByStudy((configurations) => {
          const next = { ...configurations };
          for (const result of results) {
            if (result.status === 'fulfilled') next[result.value.study_id] = result.value;
          }
          return next;
        });
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [consentConfigurationsByStudy, consentStudyOptions]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setActiveConsentSection(0);
  }, [selectedConsentTemplate, selectedRecord.studyId]);

  return (
    <div className="content workspace-page">
      <section className="module-card consent-workbench">
        <header className="consent-workbench__header">
          <div>
            <h2><Icon name="file" />{t('知情同意')}</h2>
            <div className="consent-workbench__badges">
              <span>{t('当前模板')} <strong>{selectedConsentTemplate ?? consentVersion}</strong></span>
              <span><Icon name="database" />{t('Study ID')} <strong>{selectedRecord.studyId ?? '-'}</strong></span>
              <span className="consent-workbench__badge--patient"><Icon name="patients" />{t('当前患者')} <strong>{selectedRecord.patientName}</strong></span>
              <span className="consent-workbench__badge--hospital"><Icon name="building" />{t('住院号')} <strong>{selectedRecord.hospitalNo}</strong></span>
              <span><Icon name="calendar" />{t('最近更新')} <strong>2026-04-23</strong></span>
              <span><Icon name="file" />{t('已上传文件')} <strong>{selectedConsentFile?.original_filename ?? '-'}</strong></span>
              <span className="is-success"><Icon name="shield" />{t('伦理批准')}</span>
            </div>
          </div>
          <button className="consent-study-link" type="button" disabled title={t('研究详情入口当前为展示状态')}>
            <Icon name="building" />
            {t(selectedConsentStudyTitle)}
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
                onPrint={() => printConsentPdf(selectedRecord)}
                onUnderstand={markSelectedUnderstood}
                onUpload={() => startConsentUpload(selectedRecord)}
              />
            </section>

            <aside className="consent-visual-panel">
              <div className="consent-pdf-preview">
                <div className="consent-paper-preview">
                  <h3>{t(selectedConsentStudyTitle)}</h3>
                  <span>{t('模板')}: {selectedConsentTemplate ?? consentVersion}</span>
                  {selectedConsentPreviewContent.slice(0, 3).map((section) => (
                    <article key={section.title}>
                      <strong>{t(section.title)}</strong>
                      {section.blocks[0]?.paragraphs?.slice(0, 2).map((paragraph) => (
                        <p key={paragraph}>{t(paragraph)}</p>
                      ))}
                      {section.blocks[0]?.items?.slice(0, 3).map((item) => (
                        <p key={item}>{t(item)}</p>
                      ))}
                    </article>
                  ))}
                </div>
              </div>
              <button className="consent-print-button" type="button" onClick={() => printConsentPdf(selectedRecord)}><Icon name="reports" />{t('预览打印')}</button>
            </aside>
          </div>
        </div>

        <section className="consent-flow">
          <h3>{t('知情同意流程')}</h3>
          {[
            ['1', '阅读知情同意书', '了解研究目的与内容'],
            ['2', '确认理解', '确认已充分理解'],
            ['3', '线下签署', '打印后完成纸质签署'],
            ['4', '上传归档', '上传已签署文件并归档留痕']
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
                    {(() => {
                      const uploadedFile = latestConsentFilesByRecordId.get(record.id);
                      return (
                        <>
                    {showConsentStudyId ? <td><span className="status-pill status-pill--info">{record.studyId}</span></td> : null}
                    <td>{record.patientName}</td><td>{record.hospitalNo}</td><td>{t(record.diseaseType)}</td><td><StatusPill value={record.status} /></td>
                    <td>{record.signedAt}</td><td>{record.version}</td>
                    <td>
                      <div className="module-table-actions">
                        <button className="module-link-button" type="button" onClick={(event) => { event.stopPropagation(); printConsentPdf(record); }}>{t('打印模板')}</button>
                        {record.status === '待签署' ? (
                          <button className="module-link-button module-link-button--primary" type="button" onClick={(event) => { event.stopPropagation(); startConsentUpload(record); }}>{t('上传已签署文件')}</button>
                        ) : null}
                        {record.status === '已签署' || record.status === '已重签' ? (
                          <>
                            <button className="module-link-button" type="button" disabled={!uploadedFile} title={uploadedFile ? uploadedFile.original_filename : t('暂无已上传知情文件')} onClick={(event) => { event.stopPropagation(); void openConsentFile(record); }}>{t('查看已上传文件')}</button>
                            <button className="module-link-button module-link-button--danger" type="button" onClick={(event) => { event.stopPropagation(); withdrawConsent(record); }}>{t('标记撤回')}</button>
                          </>
                        ) : null}
                        {record.status === '撤回审批中' || record.status === '重签审批中' ? (
                          <button className="module-link-button" type="button" disabled title={t('该状态来自历史审批流程，本版患者知情同意页不处理审批。')}>{t('审批中')}</button>
                        ) : null}
                        {record.status === '已撤回' ? (
                          <button className="module-link-button" type="button" disabled={!uploadedFile} title={uploadedFile ? uploadedFile.original_filename : t('暂无已上传知情文件')} onClick={(event) => { event.stopPropagation(); void openConsentFile(record); }}>{t('查看已上传文件')}</button>
                        ) : null}
                      </div>
                    </td>
                        </>
                      );
                    })()}
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
  const [sampleRows, setSampleRows] = useState<SampleRecord[]>([]);
  const [sampleActionStatus, setSampleActionStatus] = useState('等待样本操作');
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const sampleTypeCounts = useMemo(() => {
    return sampleRows.reduce<Record<string, number>>((acc, sample) => {
      acc[sample.sampleType] = (acc[sample.sampleType] ?? 0) + 1;
      return acc;
    }, {});
  }, [sampleRows]);

  const refreshSampleRows = useCallback(async () => {
    try {
      setSampleRows(await fetchSamples());
    } catch {
      // Keep the currently visible ledger if a background refresh fails.
    }
  }, []);

  useEffect(() => {
    void refreshSampleRows();
  }, [refreshSampleRows]);

  useEffect(() => {
    const refresh = () => void refreshSampleRows();
    window.addEventListener(workspaceDataChangedEvent, refresh);
    return () => window.removeEventListener(workspaceDataChangedEvent, refresh);
  }, [refreshSampleRows]);

  async function handleCreateSample() {
    const base = sampleRows[0];
    if (!base) {
      setSampleActionStatus('暂无患者样本上下文，无法新增样本');
      return;
    }

    const now = new Date();
    const record: SampleRecord = {
      ...base,
      id: '',
      sampleType: '血液',
      visit: base.visit || 'Baseline',
      collectedAt: now.toISOString().slice(0, 10),
      storage: '待分配',
      status: '已采集',
      linkedOmics: []
    };

    setEditingSampleId(null);
    setSampleActionStatus('新增样本正在同步后端...');

    try {
      const created = await createSampleRecord(record);
      setSampleRows((rows) => [created, ...rows.filter((item) => item.id !== created.id)]);
      setEditingSampleId(created.id);
      setSampleActionStatus(`新增样本已同步后端：${created.id}`);
    } catch {
      setSampleActionStatus('保存失败：新增样本未写入后端');
    }
  }

  async function handleSaveSample(record: SampleRecord) {
    setSampleActionStatus(`样本 ${record.id} 正在同步后端...`);
    try {
      const saved = await updateSampleRecord(record);
      setSampleRows((rows) => rows.map((item) => (item.id === record.id ? { ...item, ...saved } : item)));
      setSampleActionStatus(`样本 ${record.id} 已同步后端`);
    } catch {
      setSampleActionStatus(`保存失败：样本 ${record.id} 未写入后端`);
    }
  }

  return (
    <div className="content workspace-page">
      <section className="module-kpis">
        <ModuleKpi icon="blood" label="血液样本" value={`${sampleTypeCounts.血液 ?? 0}`} helper="来自样本台账" />
        <ModuleKpi icon="csf" label="CSF 样本" value={`${sampleTypeCounts.CSF ?? 0}`} helper="来自样本台账" tone="green" />
        <ModuleKpi icon="kidney" label="肾组织样本" value={`${sampleTypeCounts.肾 ?? 0}`} helper="来自样本台账" tone="purple" />
        <ModuleKpi icon="sampleBank" label="总样本数" value={`${sampleRows.length}`} helper="PostgreSQL API" tone="orange" />
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
  const [records, setRecords] = useState<OmicsRecord[]>([]);
  const [selected, setSelected] = useState<OmicsRecord | null>(null);
  const completed = records.filter((record) => record.status === '结果归档').length;
  const selectedRecord = selected ?? records[0];

  const refreshOmicsRows = useCallback(async () => {
    try {
      const nextRecords = await fetchOmicsRecords();
      setRecords(nextRecords);
      setSelected((current) => nextRecords.find((record) => record.id === current?.id) ?? nextRecords[0] ?? null);
    } catch {
      // Keep the current testing list during transient refresh failures.
    }
  }, []);

  useEffect(() => {
    void refreshOmicsRows();
  }, [refreshOmicsRows]);

  useEffect(() => {
    const refresh = () => void refreshOmicsRows();
    window.addEventListener(workspaceDataChangedEvent, refresh);
    return () => window.removeEventListener(workspaceDataChangedEvent, refresh);
  }, [refreshOmicsRows]);

  return (
    <div className="content workspace-page">
      <section className="module-kpis">
        <ModuleKpi icon="dna" label="送检样本" value={`${records.length}`} helper="PostgreSQL API" />
        <ModuleKpi icon="clock" label="检测进行中" value={`${records.length - completed}`} helper="待归档检测" tone="orange" />
        <ModuleKpi icon="check" label="已完成检测" value={`${completed}`} helper="已归档检测" tone="green" />
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
              <thead><tr><th>{t('检测编号')}</th><th>{t('样本编号')}</th><th>{t('患者编号')}</th><th>{t('样本类型')}</th><th>{t('检测项目')}</th><th>{t('供应商')}</th><th>{t('平台')}</th><th>{t('当前状态')}</th><th>QC</th><th>{t('操作')}</th></tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} onClick={() => setSelected(record)}>
                    <td>{record.id}</td><td>{record.sampleId}</td><td>{record.patientName}</td><td>{t(record.sampleType)}</td><td>{t(record.assay)}</td><td>{t(record.vendor || '-')}</td><td>{t(record.platform)}</td>
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
                ['供应商', selectedRecord.vendor || '-'],
                ['平台', selectedRecord.platform],
                ['批次/Run ID', selectedRecord.runId],
                ['送检日期', formatDateOnly(selectedRecord.sentAt)],
                ['完成日期', formatDateOnly(selectedRecord.completedAt)]
              ]} />
            ) : (
              <p className="module-empty-state">{t('当前 Study 暂无检测记录')}</p>
            )}
          </section>
          <section className="module-card">
            <header className="module-card__header"><h2>{t('检测流程与时间线')}</h2></header>
            {selectedRecord ? (
              <SimpleTimeline items={[
                { label: '样本接收', helper: `${formatDateOnly(selectedRecord.sentAt)} 09:10` },
                { label: '文库构建', helper: '2026-04-21 11:05' },
                { label: '上机测序', helper: '2026-04-22 08:40' },
                { label: '结果归档', helper: selectedRecord.completedAt === '-' ? '待完成' : `${formatDateOnly(selectedRecord.completedAt)} 10:15`, done: selectedRecord.completedAt !== '-' }
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

export function SampleTestingPage({
  selectedPatient,
  availablePatients = [],
  embedded = false,
  createSampleRequest = 0,
  createOmicsRequest = 0
}: {
  selectedPatient?: PatientRecord | null;
  availablePatients?: PatientRecord[];
  embedded?: boolean;
  createSampleRequest?: number;
  createOmicsRequest?: number;
} = {}) {
  const { t } = useI18n();
  const [patientRows, setPatientRows] = useState<PatientRecord[]>([]);
  const [sampleRows, setSampleRows] = useState<SampleRecord[]>([]);
  const [records, setRecords] = useState<OmicsRecord[]>([]);
  const [fileRows, setFileRows] = useState<ApiFileMetadata[]>([]);
  const [studyFilter, setStudyFilter] = useState('全部 Study');
  const [sampleSearchQuery, setSampleSearchQuery] = useState('');
  const [sampleTypeFilter, setSampleTypeFilter] = useState('全部');
  const [sampleLinkedOmicsFilter, setSampleLinkedOmicsFilter] = useState('全部');
  const [sampleDateFrom, setSampleDateFrom] = useState('');
  const [sampleDateTo, setSampleDateTo] = useState('');
  const [sampleDateSort, setSampleDateSort] = useState<DateSortDirection>('desc');
  const [sampleLedgerPage, setSampleLedgerPage] = useState(1);
  const [omicsStatusFilter, setOmicsStatusFilter] = useState<OmicsFilterStatus>('全部');
  const [omicsAssayFilter, setOmicsAssayFilter] = useState('全部');
  const [omicsSampleTypeFilter, setOmicsSampleTypeFilter] = useState('全部');
  const [omicsVendorFilter, setOmicsVendorFilter] = useState('全部');
  const [omicsSentAtFrom, setOmicsSentAtFrom] = useState('');
  const [omicsSentAtTo, setOmicsSentAtTo] = useState('');
  const [omicsSentAtSort, setOmicsSentAtSort] = useState<DateSortDirection>('desc');
  const [omicsQcFilter, setOmicsQcFilter] = useState('全部');
  const [omicsSearchQuery, setOmicsSearchQuery] = useState('');
  const [omicsPage, setOmicsPage] = useState(1);
  const [uploadStatus, setUploadStatus] = useState('未上传文件');
  const [sampleTestingEditor, setSampleTestingEditor] = useState<SampleTestingEditor | null>(null);
  const [sampleTestingFlow, setSampleTestingFlow] = useState<SampleTestingFlow | null>(null);
  const [selectedUploadOmicsId, setSelectedUploadOmicsId] = useState<string | null>(null);
  const resultUploadInputRef = useRef<globalThis.HTMLInputElement>(null);
  const lastCreateSampleRequestRef = useRef(0);
  const lastCreateOmicsRequestRef = useRef(0);
  const [sampleDataLoadStatus, setSampleDataLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [configuredSampleTypes, setConfiguredSampleTypes] = useState(getGlobalSampleTypes);
  const [configuredDetectionTypes, setConfiguredDetectionTypes] = useState(getGlobalDetectionTypes);
  const [configuredQuantityUnits, setConfiguredQuantityUnits] = useState(getGlobalQuantityUnits);
  const studyOptions = useMemo(() => uniqueOptionalStudyIds([...patientRows, ...sampleRows, ...records]), [patientRows, records, sampleRows]);
  const showStudyId = studyOptions.length > 1;
  const selectablePatients = useMemo(() => {
    const byKey = new Map<string, PatientRecord>();
    for (const patient of [...patientRows, ...availablePatients, ...(selectedPatient ? [selectedPatient] : [])]) {
      const key = patient.id ?? `${patient.studyId}:${patient.name}:${patient.hospitalNo}`;
      byKey.set(key, patient);
    }
    return Array.from(byKey.values());
  }, [availablePatients, patientRows, selectedPatient]);
  const sampleWritablePatients = useMemo(
    () => selectablePatients.filter((patient) => studyFilter === '全部 Study' || patient.studyId === studyFilter),
    [selectablePatients, studyFilter]
  );
  const filteredSampleRowsByStudy = useMemo(
    () => sampleRows.filter((sample) => studyFilter === '全部 Study' || sample.studyId === studyFilter),
    [sampleRows, studyFilter]
  );
  const filteredRecordsByStudy = useMemo(
    () => records.filter((record) => studyFilter === '全部 Study' || record.studyId === studyFilter),
    [records, studyFilter]
  );
  const detectionRows = useMemo(
    () => buildSampleDetectionRows(filteredSampleRowsByStudy, filteredRecordsByStudy, fileRows),
    [fileRows, filteredRecordsByStudy, filteredSampleRowsByStudy]
  );
  const sampleLedgerRows = useMemo(() => buildSampleLedgerRows(filteredSampleRowsByStudy), [filteredSampleRowsByStudy]);
  const sampleTypeOptions = useMemo(
    () => ['全部', ...Array.from(new Set([...configuredSampleTypes, ...sampleLedgerRows.map((row) => row.sampleType)]))],
    [configuredSampleTypes, sampleLedgerRows]
  );
  const sampleLinkedOmicsOptions = useMemo(
    () => ['全部', ...Array.from(new Set(sampleLedgerRows.map((row) => row.linkedOmics || '待指定检测')))],
    [sampleLedgerRows]
  );
  const filteredSampleLedgerRows = useMemo(() => {
    const query = sampleSearchQuery.trim().toLowerCase();

    return sampleLedgerRows
      .filter((row) => {
      if (
        query &&
        !row.patientName.toLowerCase().includes(query) &&
        !row.hospitalNo.toLowerCase().includes(query) &&
        !row.sampleId.toLowerCase().includes(query) &&
        !row.studyId?.toLowerCase().includes(query)
      ) return false;
      if (sampleTypeFilter !== '全部' && row.sampleType !== sampleTypeFilter) return false;
      if (sampleLinkedOmicsFilter !== '全部' && row.linkedOmics !== sampleLinkedOmicsFilter) return false;
      if (sampleDateFrom && row.collectedAt < sampleDateFrom) return false;
      if (sampleDateTo && row.collectedAt > sampleDateTo) return false;
      return true;
    })
      .sort((a, b) => sampleDateSort === 'asc' ? a.collectedAt.localeCompare(b.collectedAt) : b.collectedAt.localeCompare(a.collectedAt));
  }, [sampleDateFrom, sampleDateSort, sampleDateTo, sampleLedgerRows, sampleLinkedOmicsFilter, sampleSearchQuery, sampleTypeFilter]);
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
  const omicsSampleTypeFilterOptions = useMemo(
    () => ['全部', ...Array.from(new Set(sortedDetectionRows.map((row) => row.sampleType).filter(Boolean)))],
    [sortedDetectionRows]
  );
  const omicsVendorFilterOptions = useMemo(
    () => ['全部', ...Array.from(new Set(sortedDetectionRows.map((row) => row.vendor || '-')))],
    [sortedDetectionRows]
  );
  const omicsQcFilterOptions = useMemo(
    () => ['全部', ...Array.from(new Set(sortedDetectionRows.map((row) => row.qc)))],
    [sortedDetectionRows]
  );
  const filteredDetectionRows = useMemo(() => {
    const query = omicsSearchQuery.trim().toLowerCase();

    return sortedDetectionRows
      .filter((row) => {
      const sentAt = formatDateOnly(row.sentAt);
      if (omicsSampleTypeFilter !== '全部' && row.sampleType !== omicsSampleTypeFilter) return false;
      if (omicsStatusFilter !== '全部' && row.status !== omicsStatusFilter) return false;
      if (omicsAssayFilter !== '全部' && row.assay !== omicsAssayFilter) return false;
      if (omicsVendorFilter !== '全部' && (row.vendor || '-') !== omicsVendorFilter) return false;
      if (omicsSentAtFrom && sentAt < omicsSentAtFrom) return false;
      if (omicsSentAtTo && sentAt > omicsSentAtTo) return false;
      if (omicsQcFilter !== '全部' && row.qc !== omicsQcFilter) return false;
      if (
        query &&
        !row.patientName.toLowerCase().includes(query) &&
        !row.hospitalNo.toLowerCase().includes(query) &&
        !row.sampleId.toLowerCase().includes(query) &&
        !row.studyId?.toLowerCase().includes(query)
      ) return false;
      return true;
    })
      .sort((a, b) => omicsSentAtSort === 'asc' ? formatDateOnly(a.sentAt).localeCompare(formatDateOnly(b.sentAt)) : formatDateOnly(b.sentAt).localeCompare(formatDateOnly(a.sentAt)));
  }, [omicsAssayFilter, omicsQcFilter, omicsSampleTypeFilter, omicsSearchQuery, omicsSentAtFrom, omicsSentAtSort, omicsSentAtTo, omicsStatusFilter, omicsVendorFilter, sortedDetectionRows]);
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
    const seen = new Set<OmicsRecord['assay']>(configuredDetectionTypes);
    for (const record of filteredRecordsByStudy) seen.add(record.assay);
    return Array.from(seen);
  }, [configuredDetectionTypes, filteredRecordsByStudy]);
  const quantityUnitOptions = useMemo(() => {
    const seen = new Set(configuredQuantityUnits);
    for (const sample of sampleRows) {
      if (sample.quantityUnit) seen.add(sample.quantityUnit);
    }
    return Array.from(seen).filter(Boolean);
  }, [configuredQuantityUnits, sampleRows]);
  const sampleAddUnavailableMessage = '暂无患者上下文，无法新增样本；请先在患者队列创建患者';
  const sampleDataLoadingMessage = '正在读取患者、样本和检测数据...';
  const sampleDataLoadErrorMessage = '无法读取后端患者数据；请重新登录或检查后端 API';
  const noPatientInScopeMessage = '当前授权范围暂无患者；请先在患者队列创建患者';
  const omicsAddUnavailableMessage = '暂无样本上下文，无法新增检测；请先新增样本';
  const sampleSectionStatus =
    sampleDataLoadStatus === 'loading'
      ? sampleDataLoadingMessage
      : sampleDataLoadStatus === 'error'
        ? sampleDataLoadErrorMessage
        : sampleWritablePatients.length
          ? uploadStatus
          : noPatientInScopeMessage;
  const canAddSample = sampleDataLoadStatus === 'ready' && sampleWritablePatients.length > 0;
  const canAddOmics = sampleDataLoadStatus === 'ready' && sampleWritablePatients.length > 0;
  const omicsEditorSampleOptions = useMemo(() => {
    if (sampleTestingEditor?.kind !== 'omics') return [];
    const draft = sampleTestingEditor.draft;
    return sampleRows.filter((sample) =>
      (draft.patientId ? sample.patientId === draft.patientId : sample.patientName === draft.patientName) &&
      (studyFilter === '全部 Study' || sample.studyId === studyFilter)
    );
  }, [sampleRows, sampleTestingEditor, studyFilter]);
  const flowPatientQuery = sampleTestingFlow?.step === 'patient' ? sampleTestingFlow.query : '';
  const patientSampleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const patient of sampleWritablePatients) {
      const key = patient.id ?? `${patient.studyId}:${patient.name}`;
      counts.set(key, filteredSampleRowsByStudy.filter((sample) => patientMatchesSample(patient, sample)).length);
    }
    return counts;
  }, [filteredSampleRowsByStudy, sampleWritablePatients]);
  const patientPickerRows = useMemo(() => {
    const query = flowPatientQuery.trim().toLowerCase();
    return sampleWritablePatients
      .filter((patient) => !query || patientSearchHaystack(patient).includes(query))
      .sort((a, b) => (b.lastUpdated ?? '').localeCompare(a.lastUpdated ?? '') || patientDisplayNumber(a).localeCompare(patientDisplayNumber(b)));
  }, [flowPatientQuery, sampleWritablePatients]);
  const patientPickerTotalPages = Math.max(1, Math.ceil(patientPickerRows.length / sampleTestingPatientPickerPageSize));
  const patientPickerPage = sampleTestingFlow?.step === 'patient' ? Math.min(sampleTestingFlow.page, patientPickerTotalPages) : 1;
  const pagedPatientPickerRows = patientPickerRows.slice(
    (patientPickerPage - 1) * sampleTestingPatientPickerPageSize,
    patientPickerPage * sampleTestingPatientPickerPageSize
  );
  const samplePickerPatient = useMemo(() => {
    if (sampleTestingFlow?.kind !== 'omics' || sampleTestingFlow.step !== 'samples') return undefined;
    return patientRows.find((patient) => patient.id === sampleTestingFlow.patientId);
  }, [patientRows, sampleTestingFlow]);
  const samplePickerRows = useMemo(() => {
    if (!samplePickerPatient) return [];
    return filteredSampleRowsByStudy.filter((sample) => patientMatchesSample(samplePickerPatient, sample));
  }, [filteredSampleRowsByStudy, samplePickerPatient]);
  const flowSelectedSampleIds = sampleTestingFlow?.kind === 'omics' && sampleTestingFlow.step === 'samples' ? sampleTestingFlow.selectedSampleIds : [];

  const refreshSampleTestingData = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setSampleDataLoadStatus('loading');
      setUploadStatus(sampleDataLoadingMessage);
    }
    try {
      const dataset = await fetchWorkspaceDataset();
      setPatientRows(dataset.patients);
      setSampleRows(dataset.samples);
      setRecords(dataset.omics);
      setSampleDataLoadStatus('ready');
      setUploadStatus(dataset.patients.length ? '已读取患者、样本和检测数据' : noPatientInScopeMessage);
      const nextFiles = await fetchFileMetadata().catch(() => [] as ApiFileMetadata[]);
      setFileRows(nextFiles);
    } catch (error) {
      setPatientRows([]);
      setSampleRows([]);
      setRecords([]);
      setFileRows([]);
      setSampleDataLoadStatus('error');
      setUploadStatus(isPermissionError(error) ? '后端登录已失效，请重新登录后再新增样本' : sampleDataLoadErrorMessage);
    }
  }, [noPatientInScopeMessage, sampleDataLoadErrorMessage, sampleDataLoadingMessage]);

  useEffect(() => {
    void refreshSampleTestingData();
  }, [refreshSampleTestingData]);

  useEffect(() => {
    const refresh = () => void refreshSampleTestingData({ silent: true });
    window.addEventListener(workspaceDataChangedEvent, refresh);
    return () => window.removeEventListener(workspaceDataChangedEvent, refresh);
  }, [refreshSampleTestingData]);

  useEffect(() => {
    const refreshAll = () => {
      setConfiguredSampleTypes(getGlobalSampleTypes());
      setConfiguredDetectionTypes(getGlobalDetectionTypes());
      setConfiguredQuantityUnits(getGlobalQuantityUnits());
    };
    window.addEventListener(globalConfigChangedEvent, refreshAll);
    return () => window.removeEventListener(globalConfigChangedEvent, refreshAll);
  }, []);

  useEffect(() => {
    let ignore = false;
    void fetchGlobalConfiguration()
      .then((config) => {
        if (ignore) return;
        setConfiguredSampleTypes(config.sampleTypes);
        setConfiguredDetectionTypes(config.detectionTypes);
        setConfiguredQuantityUnits(config.quantityUnits);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedPatient) return;
    if (selectedPatient.studyId && studyOptions.includes(selectedPatient.studyId)) setStudyFilter(selectedPatient.studyId);
    setSampleSearchQuery(selectedPatient.name);
    setSampleTypeFilter('全部');
    setSampleLinkedOmicsFilter('全部');
    setSampleDateFrom('');
    setSampleDateTo('');
    setSampleDateSort('desc');
    setOmicsSearchQuery(selectedPatient.name);
    setOmicsStatusFilter('全部');
    setOmicsAssayFilter('全部');
    setOmicsSampleTypeFilter('全部');
    setOmicsVendorFilter('全部');
    setOmicsSentAtFrom('');
    setOmicsSentAtTo('');
    setOmicsSentAtSort('desc');
    setOmicsQcFilter('全部');
  }, [selectedPatient, studyOptions]);

  useEffect(() => {
    setSampleLedgerPage(1);
  }, [sampleDateFrom, sampleDateSort, sampleDateTo, sampleLinkedOmicsFilter, sampleSearchQuery, sampleTypeFilter, studyFilter]);

  useEffect(() => {
    setOmicsPage(1);
  }, [omicsAssayFilter, omicsQcFilter, omicsSampleTypeFilter, omicsSearchQuery, omicsSentAtFrom, omicsSentAtSort, omicsSentAtTo, omicsStatusFilter, omicsVendorFilter, studyFilter]);

  useEffect(() => {
    if (studyFilter !== '全部 Study' && !studyOptions.includes(studyFilter)) {
      setStudyFilter('全部 Study');
    }
  }, [studyFilter, studyOptions]);

  function startResultFileUpload(row?: SampleDetectionRow) {
    const targetOmicsId = row?.omicsId ?? selectedUploadOmicsId;
    const target = targetOmicsId ? records.find((record) => record.id === targetOmicsId) : undefined;
    if (!target) {
      setSelectedUploadOmicsId(null);
      setUploadStatus(row ? '该行尚未创建检测项目；请先保存检测项目后再上传结果' : '请先在多组学检测列表中选择具体检测项目，再上传结果');
      return;
    }
    setSelectedUploadOmicsId(target.id);
    setUploadStatus(`已选择检测 ${target.id}，请选择结果文件上传`);
    resultUploadInputRef.current?.click();
  }

  async function handleResultFileUpload(file: globalThis.File) {
    const linkedOmicsRecord = selectedUploadOmicsId ? records.find((record) => record.id === selectedUploadOmicsId) : undefined;
    const linkedSample = linkedOmicsRecord ? sampleRows.find((sample) => sample.id === linkedOmicsRecord.sampleId) : undefined;
    if (!linkedOmicsRecord) {
      setUploadStatus('未选择检测项目，无法上传结果文件');
      return;
    }
    setUploadStatus('上传中...');
    try {
      const uploaded = await uploadFileToBackend(file, {
        category: 'omics_result',
        patientId: linkedOmicsRecord.patientId ?? linkedSample?.patientId,
        sampleId: linkedOmicsRecord.sampleId,
        omicsId: linkedOmicsRecord.id,
        isDeidentified: true
      });
      setRecords((rows) => rows.map((record) => (record.id === linkedOmicsRecord.id ? { ...record, resultFileId: uploaded.id } : record)));
      setFileRows((rows) => [uploaded, ...rows.filter((row) => row.id !== uploaded.id)]);
      setSelectedUploadOmicsId(linkedOmicsRecord.id);
      setUploadStatus(`已上传 ${uploaded.original_filename}，已关联检测 ${linkedOmicsRecord.id}`);
    } catch {
      setUploadStatus('上传失败：请确认已登录且后端 API 可用');
    }
  }

  async function handleOpenResultFile(row: SampleDetectionRow) {
    if (!row.resultFileId) {
      setUploadStatus('当前检测暂无结果文件可查看');
      return;
    }
    const file = fileRows.find((item) => item.id === row.resultFileId) ?? {
      id: row.resultFileId,
      original_filename: row.resultFileLabel
    };
    setUploadStatus(`正在打开结果文件 ${file.original_filename}...`);
    try {
      await openFileFromBackend(file);
      setUploadStatus(`已打开结果文件 ${file.original_filename}`);
    } catch {
      setUploadStatus('结果文件打开失败：请确认文件未归档、扫描状态为 clean 且当前账号有权限');
    }
  }

  function scopedSelectedPatient() {
    return selectedPatient?.id && (studyFilter === '全部 Study' || selectedPatient.studyId === studyFilter) ? selectedPatient : undefined;
  }

  const defaultSampleDraftForPatient = useCallback((targetPatient: PatientRecord, sampleId: string): SampleRecord => {
    const firstConfiguredSampleType = configuredSampleTypes[0] ?? '血液';
    return {
      id: sampleId,
      studyId: targetPatient.studyId,
      patientId: targetPatient.id,
      patientName: targetPatient.name,
      hospitalNo: targetPatient.hospitalNo,
      sampleType: firstConfiguredSampleType,
      visit: 'V1 新增采集',
      collectedAt: new Date().toISOString().slice(0, 10),
      storage: '待入库',
      initialQuantity: '',
      remainingQuantity: '',
      quantityUnit: '',
      status: '已采集',
      note: '',
      linkedOmics: []
    };
  }, [configuredSampleTypes]);

  const selectPatientForSample = useCallback((targetPatient: PatientRecord) => {
    if (!targetPatient.id) return;
    setSampleTestingEditor((editor) => {
      if (editor?.kind === 'sample') {
        return {
          kind: 'sample',
          isNew: editor.isNew,
          draft: {
            ...editor.draft,
            studyId: targetPatient.studyId,
            patientId: targetPatient.id,
            patientName: targetPatient.name,
            hospitalNo: targetPatient.hospitalNo
          }
        };
      }
      return { kind: 'sample', isNew: true, draft: defaultSampleDraftForPatient(targetPatient, '') };
    });
    setSampleTestingFlow(null);
    setUploadStatus('请确认样本类型、采集时间和保存位置后保存；样本编号保存后自动生成');
  }, [defaultSampleDraftForPatient]);

  useEffect(() => {
    if (!createSampleRequest || createSampleRequest === lastCreateSampleRequestRef.current || !selectedPatient) return;
    if (sampleDataLoadStatus !== 'ready') return;
    lastCreateSampleRequestRef.current = createSampleRequest;
    if (selectedPatient.studyId && studyOptions.includes(selectedPatient.studyId)) setStudyFilter(selectedPatient.studyId);
    selectPatientForSample(selectedPatient);
  }, [createSampleRequest, sampleDataLoadStatus, selectedPatient, selectPatientForSample, studyOptions]);

  async function handleAddSample() {
    if (!sampleWritablePatients.length) {
      setUploadStatus(sampleDataLoadStatus === 'error' ? sampleDataLoadErrorMessage : sampleAddUnavailableMessage);
      setSampleTestingEditor(null);
      return;
    }
    const targetPatient = scopedSelectedPatient();
    if (targetPatient) {
      selectPatientForSample(targetPatient);
      return;
    }
    setSampleTestingEditor(null);
    setSampleTestingFlow({ kind: 'sample', step: 'patient', query: '', page: 1 });
    setUploadStatus('请先选择患者后新增样本');
  }

  async function handleEditSample(row: SampleLedgerRow) {
    const target = sampleRows.find((sample) => sample.id === row.id);
    if (!target) return;
    setSampleTestingEditor({ kind: 'sample', isNew: false, draft: { ...target, collectedAt: formatDateOnly(target.collectedAt), linkedOmics: [...target.linkedOmics] } });
    setUploadStatus(`正在编辑样本 ${row.sampleId}`);
  }

  function handleViewSample(row: SampleLedgerRow) {
    setSampleSearchQuery(row.sampleId);
    setUploadStatus(`已定位样本 ${row.sampleId}`);
  }

  const startOmicsSampleSelection = useCallback((targetPatient: PatientRecord) => {
    if (!targetPatient.id) return;
    setSampleTestingEditor(null);
    setSampleTestingFlow({ kind: 'omics', step: 'samples', patientId: targetPatient.id, selectedSampleIds: [] });
    setUploadStatus('请选择该患者本次检测使用的样本');
  }, []);

  useEffect(() => {
    if (!createOmicsRequest || createOmicsRequest === lastCreateOmicsRequestRef.current || !selectedPatient) return;
    if (sampleDataLoadStatus !== 'ready') return;
    lastCreateOmicsRequestRef.current = createOmicsRequest;
    if (selectedPatient.studyId && studyOptions.includes(selectedPatient.studyId)) setStudyFilter(selectedPatient.studyId);
    startOmicsSampleSelection(selectedPatient);
  }, [createOmicsRequest, sampleDataLoadStatus, selectedPatient, startOmicsSampleSelection, studyOptions]);

  async function handleAddOmics() {
    if (!sampleWritablePatients.length) {
      setUploadStatus(omicsAddUnavailableMessage);
      setSampleTestingEditor(null);
      return;
    }
    const targetPatient = scopedSelectedPatient();
    if (targetPatient) {
      startOmicsSampleSelection(targetPatient);
      return;
    }
    setSampleTestingEditor(null);
    setSampleTestingFlow({ kind: 'omics', step: 'patient', query: '', page: 1 });
    setUploadStatus('请先选择患者后新增检测');
  }

  function openOmicsEditorForSamples(selectedSamples: SampleRecord[]) {
    const sample = selectedSamples[0];
    if (!sample) return;
    const sampleIds = selectedSamples.map((item) => item.id);
    const sampleUsage = Object.fromEntries(
      selectedSamples.map((item, index) => [
        item.id,
        { usedQuantity: '', returnedQuantity: '', unit: item.quantityUnit ?? '', role: index === 0 ? '主样本' : '辅助样本' }
      ])
    );
    const nextRecord: OmicsRecord = {
      id: `OMX-NEW-${Date.now()}`,
      studyId: sample.studyId,
      testingProjectId: sample.studyId === 'LZXK-01' ? 'TP-LUNG-RESIST-OMICS' : 'TP-SLE-OMICS',
      patientId: sample.patientId,
      patientName: sample.patientName,
      sampleId: sample.id,
      sampleIds,
      sampleUsage,
      sampleType: selectedSamples.length > 1 ? selectedSamples.map((item) => item.sampleType).join(' / ') : sample.sampleType,
      assay: configuredDetectionTypes[0] ?? (sample.studyId === 'LZXK-01' ? 'ctDNA' : 'WGS'),
      vendor: '',
      platform: sample.studyId === 'LZXK-01' ? 'NextSeq 2000' : 'NovaSeq 6000',
      runId: `RUN-${Date.now().toString().slice(-6)}`,
      status: '样本接收',
      qc: '待确认',
      resultFileId: undefined,
      sentAt: new Date().toISOString().slice(0, 10),
      completedAt: '-'
    };
    setSampleTestingEditor({ kind: 'omics', draft: nextRecord });
    setSampleTestingFlow(null);
    setUploadStatus('请确认样本编号、检测项目、送检时间、平台、批次和 QC 要求后保存');
  }

  async function handleEditOmics(row: SampleDetectionRow) {
    const target = records.find((record) => record.id === row.id);
    if (target) {
      setSampleTestingEditor({
        kind: 'omics',
        draft: {
          ...target,
          sentAt: formatDateOnly(target.sentAt),
          completedAt: formatDateOnly(target.completedAt),
          sampleIds: [...(target.sampleIds ?? [target.sampleId])],
          sampleUsage: { ...(target.sampleUsage ?? {}) }
        }
      });
      setSelectedUploadOmicsId(target.id);
      setUploadStatus(`正在编辑检测 ${row.id}`);
      return;
    }

    const sample = sampleRows.find((item) =>
      item.studyId === row.studyId &&
      (formatSampleLedgerId(item) === row.sampleId || item.id === row.sampleId)
    );
    if (!sample) return;
    const nextRecord: OmicsRecord = {
      id: `OMX-NEW-${Date.now()}`,
      studyId: sample.studyId,
      testingProjectId: sample.studyId === 'LZXK-01' ? 'TP-LUNG-RESIST-OMICS' : 'TP-SLE-OMICS',
      patientId: sample.patientId,
      patientName: sample.patientName,
      sampleId: sample.id,
      sampleIds: [sample.id],
      sampleUsage: {
        [sample.id]: { usedQuantity: '', returnedQuantity: '', unit: sample.quantityUnit ?? '', role: '主样本' }
      },
      sampleType: sample.sampleType,
      assay: configuredDetectionTypes[0] ?? (sample.studyId === 'LZXK-01' ? 'ctDNA' : 'WGS'),
      vendor: '',
      platform: sample.studyId === 'LZXK-01' ? 'NextSeq 2000' : 'NovaSeq 6000',
      runId: `RUN-${Date.now().toString().slice(-6)}`,
      status: '样本接收',
      qc: '待确认',
      resultFileId: undefined,
      sentAt: new Date().toISOString().slice(0, 10),
      completedAt: '-'
    };
    setSampleTestingEditor({ kind: 'omics', draft: nextRecord });
    setUploadStatus(`正在为样本 ${row.sampleId} 新建检测`);
  }

  function handleViewOmics(row: SampleDetectionRow) {
    setOmicsSearchQuery(row.sampleId);
    const target = row.omicsId ? records.find((record) => record.id === row.omicsId) : undefined;
    setSelectedUploadOmicsId(target?.id ?? null);
    setUploadStatus(target ? `已定位检测 ${target.id}，上传结果将关联该检测` : `已定位样本 ${row.sampleId}，请先创建检测后上传结果`);
  }

  function updateFlowPatientQuery(query: string) {
    setSampleTestingFlow((flow) => (flow?.step === 'patient' ? { ...flow, query, page: 1 } : flow));
  }

  function updateFlowPatientPage(page: number) {
    setSampleTestingFlow((flow) => (flow?.step === 'patient' ? { ...flow, page: Math.max(1, Math.min(page, patientPickerTotalPages)) } : flow));
  }

  function handleFlowPatientSelect(patient: PatientRecord) {
    if (sampleTestingFlow?.kind === 'sample') {
      selectPatientForSample(patient);
      return;
    }
    startOmicsSampleSelection(patient);
  }

  function toggleFlowSample(sampleId: string, checked: boolean) {
    setSampleTestingFlow((flow) => {
      if (!flow || flow.kind !== 'omics' || flow.step !== 'samples') return flow;
      const nextIds = checked
        ? Array.from(new Set([...flow.selectedSampleIds, sampleId]))
        : flow.selectedSampleIds.filter((item) => item !== sampleId);
      return { ...flow, selectedSampleIds: nextIds };
    });
  }

  function continueOmicsFlow() {
    if (!samplePickerPatient) return;
    const selectedSamples = flowSelectedSampleIds.map((sampleId) => sampleRows.find((sample) => sample.id === sampleId)).filter(Boolean) as SampleRecord[];
    openOmicsEditorForSamples(selectedSamples);
  }

  function setOmicsDraftSampleIds(nextIds: string[]) {
    const uniqueIds = Array.from(new Set(nextIds));
    setSampleTestingEditor((editor) => {
      if (!editor || editor.kind !== 'omics') return editor;
      const selectedSamples = uniqueIds.map((sampleId) => sampleRows.find((sample) => sample.id === sampleId)).filter(Boolean) as SampleRecord[];
      const nextUsage = { ...(editor.draft.sampleUsage ?? {}) };
      for (const sample of selectedSamples) {
        if (!nextUsage[sample.id]) {
          nextUsage[sample.id] = { usedQuantity: '', returnedQuantity: '', unit: sample.quantityUnit ?? '', role: selectedSamples[0]?.id === sample.id ? '主样本' : '辅助样本' };
        }
      }
      const firstSample = selectedSamples[0];
      return {
        ...editor,
        draft: {
          ...editor.draft,
          sampleId: firstSample?.id ?? '',
          sampleIds: uniqueIds,
          sampleType: selectedSamples.length > 1 ? selectedSamples.map((sample) => sample.sampleType).join(' / ') : firstSample?.sampleType ?? editor.draft.sampleType,
          sampleUsage: nextUsage
        }
      };
    });
  }

  function patchOmicsDraftSampleUsage(sampleId: string, patch: { usedQuantity?: string; returnedQuantity?: string; unit?: string; role?: string }) {
    setSampleTestingEditor((editor) => {
      if (!editor || editor.kind !== 'omics') return editor;
      return {
        ...editor,
        draft: {
          ...editor.draft,
          sampleUsage: {
            ...(editor.draft.sampleUsage ?? {}),
            [sampleId]: {
              ...(editor.draft.sampleUsage?.[sampleId] ?? {}),
              ...patch
            }
          }
        }
      };
    });
  }

  async function syncSamplesWithOmics(saved: OmicsRecord) {
    const assayLabel = `${saved.assay} (${saved.id})`;
    const selectedIds = saved.sampleIds?.length ? saved.sampleIds : [saved.sampleId];
    const updatedSamples: SampleRecord[] = [];
    await Promise.all(
      selectedIds.map(async (sampleId) => {
        const sample = sampleRows.find((row) => row.id === sampleId);
        if (!sample || sample.linkedOmics.includes(assayLabel)) return;
        try {
          const updated = await updateSampleRecord({ ...sample, linkedOmics: [...sample.linkedOmics.filter((item) => item !== '待选择'), assayLabel] });
          updatedSamples.push(updated);
        } catch {
          updatedSamples.push({ ...sample, linkedOmics: [...sample.linkedOmics.filter((item) => item !== '待选择'), assayLabel] });
        }
      })
    );
    if (updatedSamples.length) {
      setSampleRows((rows) => rows.map((row) => updatedSamples.find((sample) => sample.id === row.id) ?? row));
    }
  }

  function patchSampleTestingDraft(patch: Partial<SampleRecord> | Partial<OmicsRecord>) {
    setSampleTestingEditor((editor) => {
      if (!editor) return editor;
      if (editor.kind === 'sample') {
        return {
          ...editor,
          draft: {
            ...editor.draft,
            ...(patch as Partial<SampleRecord>)
          }
        };
      }
      return { ...editor, draft: { ...editor.draft, ...(patch as Partial<OmicsRecord>) } };
    });
  }

  async function saveSampleTestingEditor() {
    if (!sampleTestingEditor) return;

    if (sampleTestingEditor.kind === 'sample') {
      const draft = sampleTestingEditor.draft;
      const sampleId = draft.id.trim();
      if ((!sampleTestingEditor.isNew && !sampleId) || !draft.patientId || !draft.patientName || !draft.sampleType || !draft.collectedAt) {
        setUploadStatus('样本表单缺少必填字段：患者、样本类型和采集日期为必填项');
        return;
      }
      const normalizedDraft = {
        ...draft,
        id: sampleTestingEditor.isNew ? '' : sampleId,
        initialQuantity: draft.initialQuantity?.trim() ?? '',
        remainingQuantity: draft.remainingQuantity?.trim() ?? ''
      };
      const savingLabel = sampleTestingEditor.isNew ? '新样本' : normalizedDraft.id;
      setUploadStatus(`样本 ${savingLabel} 正在同步后端...`);
      try {
        const saved = sampleTestingEditor.isNew ? await createSampleRecord(normalizedDraft) : await updateSampleRecord(normalizedDraft);
        setSampleRows((rows) => (rows.some((row) => row.id === saved.id) ? rows.map((row) => (row.id === saved.id ? saved : row)) : [saved, ...rows]));
        setSampleTestingEditor(null);
        setUploadStatus(`样本 ${saved.id} 已同步后端`);
      } catch {
        setUploadStatus(`保存失败：样本 ${savingLabel} 未写入后端`);
      }
      return;
    }

    const draft = sampleTestingEditor.draft;
    const draftSampleIds = draft.sampleIds?.length ? draft.sampleIds : draft.sampleId ? [draft.sampleId] : [];
    if (!draft.patientId || draftSampleIds.length === 0 || !draft.assay || !draft.sentAt) {
      setUploadStatus('检测表单缺少必填字段');
      return;
    }
    setUploadStatus(`检测 ${draft.id} 正在同步后端...`);
    try {
      const normalizedDraft = { ...draft, sampleId: draftSampleIds[0], sampleIds: draftSampleIds };
      const saved = draft.id.startsWith('OMX-NEW-') ? await createOmicsRecord(normalizedDraft) : await updateOmicsRecord(normalizedDraft);
      await syncSamplesWithOmics(saved);
      setRecords((rows) => (rows.some((record) => record.id === draft.id) ? rows.map((record) => (record.id === draft.id ? saved : record)) : [saved, ...rows]));
      setSampleTestingEditor(null);
      setSelectedUploadOmicsId(saved.id);
      setUploadStatus(`检测 ${saved.id} 已同步后端`);
    } catch {
      setUploadStatus(`保存失败：检测 ${draft.id} 未写入后端`);
    }
  }

  const compactEmbeddedSummary = embedded && Boolean(selectedPatient);
  const compactSummaryItems = [
    { label: '样本', value: filteredSampleRowsByStudy.length },
    { label: '检测', value: detectionRows.length },
    { label: '检测中', value: running },
    { label: '完成', value: completed + archived }
  ];
  const sampleTestingOverviewItems: Array<{
    icon: IconName;
    label: string;
    value: number;
    helper: string;
    tone: 'blue' | 'purple' | 'orange' | 'green';
  }> = [
    { icon: 'sampleTube', label: '总样本数', value: filteredSampleRowsByStudy.length, helper: '样本台账', tone: 'blue' },
    { icon: 'dna', label: '检测项目', value: detectionRows.length, helper: '按项目展开', tone: 'purple' },
    { icon: 'clock', label: '检测中', value: running, helper: '待完成检测', tone: 'orange' },
    { icon: 'check', label: '检测完成', value: completed + archived, helper: '含结果文件', tone: 'green' }
  ];

  return (
    <div className={embedded ? 'sample-testing-embedded' : 'content workspace-page'}>
      {compactEmbeddedSummary ? (
        <div className="sample-testing-compact-summary">
          <div className="sample-testing-compact-summary__patient">
            <strong>{selectedPatient?.name}</strong>
            <span>{selectedPatient?.studyId ?? '-'} · {t('住院号')} {selectedPatient?.hospitalNo || '-'}</span>
          </div>
          <div className="sample-testing-compact-summary__metrics">
            {compactSummaryItems.map((item) => (
              <span key={item.label}>
                <small>{t(item.label)}</small>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <section className="sample-testing-overview">
          <header className="sample-testing-overview__header">
            <span className="sample-testing-overview__avatar" aria-hidden="true">
              <Icon name="patients" />
            </span>
            <div>
              <strong>{selectedPatient ? `${t('当前患者')}：${selectedPatient.name}` : t('默认显示全部患者')}</strong>
              <p>
                {selectedPatient
                  ? `${selectedPatient.studyId ?? '-'} · ${t('住院号')} ${selectedPatient.hospitalNo || '-'}`
                  : t('点击患者列表中的样本查看后，将自动定位到该患者的样本和检测。')}
              </p>
            </div>
          </header>
          <div className="sample-testing-overview__metrics">
            {sampleTestingOverviewItems.map((item) => (
              <article className={`sample-testing-overview__metric sample-testing-overview__metric--${item.tone}`} key={item.label}>
                <span className="sample-testing-overview__metric-icon" aria-hidden="true">
                  <Icon name={item.icon} />
                </span>
                <div>
                  <span>{t(item.label)}</span>
                  <strong>{item.value}</strong>
                  <small>{t(item.helper)}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="module-card module-card--wide">
        <header className="module-card__header sample-testing-card-header">
          <div>
            <h2>{t('样本台账')}</h2>
            <span>{t('按患者、样本和采集日期维护样本登记')}</span>
          </div>
          <div className="module-header-actions">
            <div className="sample-testing-title-filters">
              {showStudyId ? (
                <select aria-label={t('Study ID')} value={studyFilter} onChange={(event) => setStudyFilter(event.target.value)}>
                  <option value="全部 Study">{t('全部 Study')}</option>
                  {studyOptions.map((studyId) => <option value={studyId} key={studyId}>{studyId}</option>)}
                </select>
              ) : null}
              <input
                aria-label={t('患者编号 / 住院号 / 样本编号')}
                value={sampleSearchQuery}
                onChange={(event) => setSampleSearchQuery(event.target.value)}
                placeholder={t('患者编号 / 住院号 / 样本编号')}
              />
              <select aria-label={t('样本类型')} value={sampleTypeFilter} onChange={(event) => setSampleTypeFilter(event.target.value)}>
                {sampleTypeOptions.map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
              <select aria-label={t('已做检测')} value={sampleLinkedOmicsFilter} onChange={(event) => setSampleLinkedOmicsFilter(event.target.value)}>
                {sampleLinkedOmicsOptions.map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
              <div className="sample-testing-date-range" aria-label={t('采集日期范围')}>
                <input type="date" title={t('采集开始')} value={sampleDateFrom} onChange={(event) => setSampleDateFrom(event.target.value)} />
                <input type="date" title={t('采集结束')} value={sampleDateTo} onChange={(event) => setSampleDateTo(event.target.value)} />
              </div>
              <select aria-label={t('采集日期排序')} value={sampleDateSort} onChange={(event) => setSampleDateSort(event.target.value as DateSortDirection)}>
                <option value="desc">{t('新到旧')}</option>
                <option value="asc">{t('旧到新')}</option>
              </select>
            </div>
            {!canAddSample ? <span className="module-action-hint">{t(sampleSectionStatus)}</span> : null}
            <button
              className="module-primary-button"
              type="button"
              disabled={!canAddSample}
              title={!canAddSample ? t(sampleSectionStatus) : undefined}
              onClick={() => void handleAddSample()}
            >
              <Icon name="filePlus" />{t('新增样本')}
            </button>
          </div>
        </header>
        <div className="module-upload-status">
          <Icon name="shield" />
          <span>{t(sampleSectionStatus)}</span>
        </div>
        {sampleTestingFlow?.kind === 'sample' && sampleTestingFlow.step === 'patient' ? (
          <section className="sample-testing-flow-card" aria-label={t('选择患者')}>
            <header>
              <div>
                <strong>{t('选择患者后新增样本')}</strong>
                <span>{t('支持按患者编号、姓名、住院号或 Study 搜索')}</span>
              </div>
              <button className="module-link-button" type="button" onClick={() => setSampleTestingFlow(null)}>{t('取消')}</button>
            </header>
            <label className="sample-testing-patient-search">
              <Icon name="search" />
              <input value={flowPatientQuery} onChange={(event) => updateFlowPatientQuery(event.target.value)} placeholder={t('搜索患者编号、姓名、住院号或 Study')} />
            </label>
            <div className="sample-testing-patient-list">
              {pagedPatientPickerRows.map((patient) => {
                const patientKey = patient.id ?? `${patient.studyId}:${patient.name}`;
                return (
                  <button className="sample-testing-patient-option" type="button" key={patientKey} disabled={!patient.id} onClick={() => handleFlowPatientSelect(patient)}>
                    <span>
                      <strong>{patientDisplayNumber(patient)}</strong>
                      <small>{patient.name} · {t('住院号')} {patient.hospitalNo || '-'}</small>
                    </span>
                    <span>
                      <strong>{patient.studyId}</strong>
                      <small>{patient.studyName || patient.diseaseType}</small>
                    </span>
                    <span>
                      <strong>{patientSampleCounts.get(patientKey) ?? 0}</strong>
                      <small>{t('已有样本数')}</small>
                    </span>
                  </button>
                );
              })}
              {!pagedPatientPickerRows.length ? <div className="sample-testing-empty-state">{t('未找到匹配患者')}</div> : null}
            </div>
            <footer className="sample-testing-flow-footer">
              <span>{t('共')} {patientPickerRows.length} {t('名患者')}</span>
              <div className="module-pagination">
                <button type="button" disabled={patientPickerPage <= 1} onClick={() => updateFlowPatientPage(patientPickerPage - 1)}>{t('上一页')}</button>
                <span>{patientPickerPage} / {patientPickerTotalPages}</span>
                <button type="button" disabled={patientPickerPage >= patientPickerTotalPages} onClick={() => updateFlowPatientPage(patientPickerPage + 1)}>{t('下一页')}</button>
              </div>
            </footer>
          </section>
        ) : null}
        {sampleTestingEditor?.kind === 'sample' ? (
          <section className="sample-testing-editor-card" role="dialog" aria-label={t('样本编辑表单')}>
            <header>
              <div>
                <strong>{t('样本编辑表单')}</strong>
                <span>{sampleTestingEditor.draft.id || t('保存后自动生成')}</span>
              </div>
              <div className="module-table-actions">
                <button className="module-link-button module-link-button--primary" type="button" onClick={() => void saveSampleTestingEditor()}>{t('保存')}</button>
                <button className="module-link-button" type="button" onClick={() => setSampleTestingEditor(null)}>{t('取消')}</button>
              </div>
            </header>
            <div className="sample-testing-editor-patient">
              <div>
                <span>{t('已选择患者')}</span>
                <strong>{sampleTestingEditor.draft.patientName} · {sampleTestingEditor.draft.studyId ?? '-'}</strong>
                <small>{t('住院号')} {sampleTestingEditor.draft.hospitalNo || '-'}</small>
              </div>
              <button className="module-link-button" type="button" onClick={() => setSampleTestingFlow({ kind: 'sample', step: 'patient', query: sampleTestingEditor.draft.patientName, page: 1 })}>{t('更换患者')}</button>
            </div>
            <div className="sample-testing-editor-grid">
              <label>
                <span>{t('条码 / 样本编号')}</span>
                <input value={sampleTestingEditor.isNew ? t('保存后自动生成') : sampleTestingEditor.draft.id} readOnly />
              </label>
              <label>
                <span>{t('样本类型')}</span>
                <select value={sampleTestingEditor.draft.sampleType} onChange={(event) => patchSampleTestingDraft({ sampleType: event.target.value })}>
                  {Array.from(new Set([...configuredSampleTypes, sampleTestingEditor.draft.sampleType])).map((item) => <option value={item} key={item}>{t(item)}</option>)}
                </select>
              </label>
              <label>
                <span>{t('访视')}</span>
                <input value={sampleTestingEditor.draft.visit} onChange={(event) => patchSampleTestingDraft({ visit: event.target.value })} />
              </label>
              <label>
                <span>{t('采集日期')}</span>
                <input type="date" value={formatDateOnly(sampleTestingEditor.draft.collectedAt)} onChange={(event) => patchSampleTestingDraft({ collectedAt: event.target.value })} />
              </label>
              <label>
                <span>{t('存储位置')}</span>
                <input value={sampleTestingEditor.draft.storage} onChange={(event) => patchSampleTestingDraft({ storage: event.target.value })} />
              </label>
              <label>
                <span>{t('初始量')}</span>
                <input value={sampleTestingEditor.draft.initialQuantity ?? ''} onChange={(event) => patchSampleTestingDraft({ initialQuantity: event.target.value })} />
              </label>
              <label>
                <span>{t('剩余量')}</span>
                <input value={sampleTestingEditor.draft.remainingQuantity || sampleTestingEditor.draft.initialQuantity || ''} readOnly title={t('剩余量由初始量减送样量加返还量自动计算')} />
              </label>
              <label>
                <span>{t('单位')}</span>
                <select value={sampleTestingEditor.draft.quantityUnit ?? ''} onChange={(event) => patchSampleTestingDraft({ quantityUnit: event.target.value })}>
                  <option value="">{t('未选择')}</option>
                  {Array.from(new Set([...quantityUnitOptions, sampleTestingEditor.draft.quantityUnit ?? ''].filter(Boolean))).map((item) => <option value={item} key={item}>{t(item)}</option>)}
                </select>
              </label>
              <label>
                <span>{t('注释')}</span>
                <input value={sampleTestingEditor.draft.note ?? ''} onChange={(event) => patchSampleTestingDraft({ note: event.target.value })} />
              </label>
              <label>
                <span>{t('状态')}</span>
                <select value={sampleTestingEditor.draft.status} onChange={(event) => patchSampleTestingDraft({ status: event.target.value as SampleRecord['status'] })}>
                  {['已采集', '已送检', '检测中', '结果回传', '待处理'].map((item) => <option value={item} key={item}>{t(item)}</option>)}
                </select>
              </label>
              <label className="sample-testing-editor-grid__wide">
                <span>{t('关联检测')}</span>
                <select
                  value={sampleTestingEditor.draft.linkedOmics.find((item) => item && item !== '待选择' && item !== '待指定') ?? ''}
                  onChange={(event) => patchSampleTestingDraft({ linkedOmics: event.target.value ? [event.target.value] : [] })}
                >
                  <option value="">{t('未选择')}</option>
                  {Array.from(new Set([...configuredDetectionTypes, ...sampleTestingEditor.draft.linkedOmics].filter((item) => item && item !== '待选择' && item !== '待指定'))).map((item) => <option value={item} key={item}>{t(item)}</option>)}
                </select>
              </label>
            </div>
          </section>
        ) : null}
        <SampleTestingStatTiles items={sampleStatItems} />
        <SampleLedgerTable rows={pagedSampleLedgerRows} onView={handleViewSample} onEdit={(row) => void handleEditSample(row)} showStudyId={showStudyId} />
        <ModuleTableFooter page={safeSampleLedgerPage} total={filteredSampleLedgerRows.length} pageSize={sampleLedgerPageSize} onPageChange={setSampleLedgerPage} />
      </section>

      <section className="module-card module-card--wide">
        <header className="module-card__header sample-testing-card-header">
          <div>
            <h2>{t('多组学检测列表')}</h2>
            <span>{t('按检测项目追踪平台、批次、QC 和结果归档')}</span>
          </div>
          <div className="module-header-actions">
            <div className="sample-testing-title-filters sample-testing-title-filters--omics">
              {showStudyId ? (
                <select aria-label={t('Study ID')} value={studyFilter} onChange={(event) => setStudyFilter(event.target.value)}>
                  <option value="全部 Study">{t('全部 Study')}</option>
                  {studyOptions.map((studyId) => <option value={studyId} key={studyId}>{studyId}</option>)}
                </select>
              ) : null}
              <input
                aria-label={t('患者编号 / 住院号 / 样本编号')}
                value={omicsSearchQuery}
                onChange={(event) => setOmicsSearchQuery(event.target.value)}
                placeholder={t('患者编号 / 住院号 / 样本编号')}
              />
              <select aria-label={t('样本类型')} value={omicsSampleTypeFilter} onChange={(event) => setOmicsSampleTypeFilter(event.target.value)}>
                {omicsSampleTypeFilterOptions.map((item) => <option value={item} key={item}>{t(item)}</option>)}
              </select>
              <select aria-label={t('检测项目')} value={omicsAssayFilter} onChange={(event) => setOmicsAssayFilter(event.target.value)}>
                <option value="全部">{t('全部')}</option>
                {omicsAssayOptions.map((item) => <option value={item} key={item}>{t(item)}</option>)}
              </select>
              <select aria-label={t('供应商')} value={omicsVendorFilter} onChange={(event) => setOmicsVendorFilter(event.target.value)}>
                {omicsVendorFilterOptions.map((item) => <option value={item} key={item}>{item === '全部' ? t(item) : item}</option>)}
              </select>
              <select aria-label={t('当前状态')} value={omicsStatusFilter} onChange={(event) => setOmicsStatusFilter(event.target.value as OmicsFilterStatus)}>
                {omicsStatusOptions.map((item) => <option value={item} key={item}>{t(item)}</option>)}
              </select>
              <select aria-label="QC" value={omicsQcFilter} onChange={(event) => setOmicsQcFilter(event.target.value)}>
                {omicsQcFilterOptions.map((item) => <option value={item} key={item}>{t(item)}</option>)}
              </select>
              <div className="sample-testing-date-range" aria-label={t('送检日期范围')}>
                <input type="date" title={t('送检开始')} value={omicsSentAtFrom} onChange={(event) => setOmicsSentAtFrom(event.target.value)} />
                <input type="date" title={t('送检结束')} value={omicsSentAtTo} onChange={(event) => setOmicsSentAtTo(event.target.value)} />
              </div>
              <select aria-label={t('送检测时间排序')} value={omicsSentAtSort} onChange={(event) => setOmicsSentAtSort(event.target.value as DateSortDirection)}>
                <option value="desc">{t('新到旧')}</option>
                <option value="asc">{t('旧到新')}</option>
              </select>
            </div>
            <input
              ref={resultUploadInputRef}
              className="module-hidden-file-input"
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void handleResultFileUpload(file);
                event.currentTarget.value = '';
              }}
            />
            {!canAddOmics ? <span className="module-action-hint">{t(noPatientInScopeMessage)}</span> : null}
            <button
              className="module-primary-button"
              type="button"
              disabled={!canAddOmics}
              title={!canAddOmics ? t(noPatientInScopeMessage) : undefined}
              onClick={() => void handleAddOmics()}
            >
              <Icon name="filePlus" />{t('新增检测')}
            </button>
          </div>
        </header>
        <div className="module-upload-status">
          <Icon name="shield" />
          <span>{t(uploadStatus)}</span>
        </div>
        {sampleTestingFlow?.kind === 'omics' && sampleTestingFlow.step === 'patient' ? (
          <section className="sample-testing-flow-card" aria-label={t('选择患者')}>
            <header>
              <div>
                <strong>{t('选择患者后新增检测')}</strong>
                <span>{t('先确定患者，再选择该患者名下样本')}</span>
              </div>
              <button className="module-link-button" type="button" onClick={() => setSampleTestingFlow(null)}>{t('取消')}</button>
            </header>
            <label className="sample-testing-patient-search">
              <Icon name="search" />
              <input value={flowPatientQuery} onChange={(event) => updateFlowPatientQuery(event.target.value)} placeholder={t('搜索患者编号、姓名、住院号或 Study')} />
            </label>
            <div className="sample-testing-patient-list">
              {pagedPatientPickerRows.map((patient) => {
                const patientKey = patient.id ?? `${patient.studyId}:${patient.name}`;
                return (
                  <button className="sample-testing-patient-option" type="button" key={patientKey} disabled={!patient.id} onClick={() => handleFlowPatientSelect(patient)}>
                    <span>
                      <strong>{patientDisplayNumber(patient)}</strong>
                      <small>{patient.name} · {t('住院号')} {patient.hospitalNo || '-'}</small>
                    </span>
                    <span>
                      <strong>{patient.studyId}</strong>
                      <small>{patient.studyName || patient.diseaseType}</small>
                    </span>
                    <span>
                      <strong>{patientSampleCounts.get(patientKey) ?? 0}</strong>
                      <small>{t('已有样本数')}</small>
                    </span>
                  </button>
                );
              })}
              {!pagedPatientPickerRows.length ? <div className="sample-testing-empty-state">{t('未找到匹配患者')}</div> : null}
            </div>
            <footer className="sample-testing-flow-footer">
              <span>{t('共')} {patientPickerRows.length} {t('名患者')}</span>
              <div className="module-pagination">
                <button type="button" disabled={patientPickerPage <= 1} onClick={() => updateFlowPatientPage(patientPickerPage - 1)}>{t('上一页')}</button>
                <span>{patientPickerPage} / {patientPickerTotalPages}</span>
                <button type="button" disabled={patientPickerPage >= patientPickerTotalPages} onClick={() => updateFlowPatientPage(patientPickerPage + 1)}>{t('下一页')}</button>
              </div>
            </footer>
          </section>
        ) : null}
        {sampleTestingFlow?.kind === 'omics' && sampleTestingFlow.step === 'samples' && samplePickerPatient ? (
          <section className="sample-testing-flow-card" aria-label={t('选择样本')}>
            <header>
              <div>
                <strong>{t('选择样本后新增检测')}</strong>
                <span>{samplePickerPatient.name} · {samplePickerPatient.studyId} · {t('住院号')} {samplePickerPatient.hospitalNo || '-'}</span>
              </div>
              <div className="module-table-actions">
                <button className="module-link-button" type="button" onClick={() => setSampleTestingFlow({ kind: 'omics', step: 'patient', query: samplePickerPatient.name, page: 1 })}>{t('更换患者')}</button>
                <button className="module-link-button" type="button" onClick={() => setSampleTestingFlow(null)}>{t('取消')}</button>
              </div>
            </header>
            {samplePickerRows.length ? (
              <div className="sample-testing-sample-select-list">
                {samplePickerRows.map((sample) => (
                  <label className="sample-testing-sample-select-row" key={sample.id}>
                    <input type="checkbox" checked={flowSelectedSampleIds.includes(sample.id)} onChange={(event) => toggleFlowSample(sample.id, event.target.checked)} />
                    <span>
                      <strong>{formatSampleLedgerId(sample)}</strong>
                      <small>{t(sample.sampleType)} · {formatDateOnly(sample.collectedAt)} · {sample.storage}</small>
                    </span>
                    <span>
                      <strong>{sampleQuantityLabel(sample)}</strong>
                      <small>{t('剩余量')}</small>
                    </span>
                    <span>
                      <strong>{sample.linkedOmics.length ? sample.linkedOmics.join(' / ') : t('待指定检测')}</strong>
                      <small>{t('已做检测')}</small>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="sample-testing-empty-state sample-testing-empty-state--action">
                <span>{t('该患者暂无样本，请先新增样本')}</span>
                <button className="module-link-button module-link-button--primary" type="button" onClick={() => selectPatientForSample(samplePickerPatient)}>{t('去新增样本')}</button>
              </div>
            )}
            {samplePickerRows.length ? (
              <footer className="sample-testing-flow-footer">
                <span>{t('已选择')} {flowSelectedSampleIds.length} {t('个样本')}</span>
                <button className="module-link-button module-link-button--primary" type="button" disabled={!flowSelectedSampleIds.length} onClick={continueOmicsFlow}>{t('下一步填写检测')}</button>
              </footer>
            ) : null}
          </section>
        ) : null}
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
            <div className="sample-testing-editor-patient">
              <div>
                <span>{t('已选择患者')}</span>
                <strong>{sampleTestingEditor.draft.patientName} · {sampleTestingEditor.draft.studyId ?? '-'}</strong>
                <small>{t('本次检测样本')} {(sampleTestingEditor.draft.sampleIds?.length ? sampleTestingEditor.draft.sampleIds : [sampleTestingEditor.draft.sampleId]).join(' / ')}</small>
              </div>
              <button
                className="module-link-button"
                type="button"
                onClick={() => setSampleTestingFlow({ kind: 'omics', step: 'patient', query: sampleTestingEditor.draft.patientName, page: 1 })}
              >
                {t('更换患者')}
              </button>
            </div>
            <div className="sample-testing-editor-grid">
              <label>
                <span>{t('Study ID')}</span>
                <input value={sampleTestingEditor.draft.studyId ?? '-'} readOnly />
              </label>
              <div className="sample-testing-sample-picker sample-testing-editor-grid__wide">
                <span>{t('选择样本')}</span>
                <div className="sample-testing-sample-picker__list">
                  {omicsEditorSampleOptions.map((sample) => {
                    const selectedIds = sampleTestingEditor.draft.sampleIds?.length ? sampleTestingEditor.draft.sampleIds : [sampleTestingEditor.draft.sampleId];
                    const isChecked = selectedIds.includes(sample.id);
                    const usage = sampleTestingEditor.draft.sampleUsage?.[sample.id] ?? {};
                    return (
                      <div className="sample-testing-sample-picker__row" key={sample.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(event) => {
                              const nextIds = event.target.checked ? [...selectedIds, sample.id] : selectedIds.filter((sampleId) => sampleId !== sample.id);
                              setOmicsDraftSampleIds(nextIds);
                            }}
                          />
                          <span>{formatSampleLedgerId(sample)} · {t(sample.sampleType)} · {t('剩余量')} {sampleQuantityLabel(sample)} · {sample.storage}</span>
                        </label>
                        {isChecked ? (
                          <div className="sample-testing-sample-picker__usage">
                            <input value={usage.usedQuantity ?? ''} onChange={(event) => patchOmicsDraftSampleUsage(sample.id, { usedQuantity: event.target.value })} placeholder={t('送样量')} />
                            <input value={usage.returnedQuantity ?? ''} onChange={(event) => patchOmicsDraftSampleUsage(sample.id, { returnedQuantity: event.target.value })} placeholder={t('返还量')} />
                            <select value={usage.unit ?? sample.quantityUnit ?? ''} onChange={(event) => patchOmicsDraftSampleUsage(sample.id, { unit: event.target.value })} aria-label={t('单位')}>
                              <option value="">{t('未选择')}</option>
                              {Array.from(new Set([...quantityUnitOptions, usage.unit ?? '', sample.quantityUnit ?? ''].filter(Boolean))).map((item) => <option value={item} key={item}>{t(item)}</option>)}
                            </select>
                            <input value={usage.role ?? ''} onChange={(event) => patchOmicsDraftSampleUsage(sample.id, { role: event.target.value })} placeholder={t('用途')} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
              <label>
                <span>{t('样本类型')}</span>
                <input value={sampleTestingEditor.draft.sampleType} readOnly />
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
                <span>{t('供应商')}</span>
                <input value={sampleTestingEditor.draft.vendor} onChange={(event) => patchSampleTestingDraft({ vendor: event.target.value })} />
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
                <input type="date" value={formatDateOnly(sampleTestingEditor.draft.sentAt)} onChange={(event) => patchSampleTestingDraft({ sentAt: event.target.value })} />
              </label>
              <label>
                <span>{t('完成日期')}</span>
                <input
                  type="date"
                  value={sampleTestingEditor.draft.completedAt === '-' ? '' : formatDateOnly(sampleTestingEditor.draft.completedAt)}
                  onChange={(event) => patchSampleTestingDraft({ completedAt: event.target.value || '-' })}
                />
              </label>
              <label>
                <span>{t('结果文件')}</span>
                <input value={sampleTestingEditor.draft.resultFileId ?? ''} onChange={(event) => patchSampleTestingDraft({ resultFileId: event.target.value || undefined })} />
              </label>
            </div>
          </section>
        ) : null}
        <SampleTestingStatTiles items={omicsStatItems} />
        <OmicsTable
          records={pagedDetectionRows}
          onView={handleViewOmics}
          onEdit={(row) => void handleEditOmics(row)}
          onUpload={startResultFileUpload}
          onOpenFile={(row) => void handleOpenResultFile(row)}
          showStudyId={showStudyId}
        />
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
  return <PatientJourneyWorkspacePage selectedPatient={selectedPatient} onPatientChange={onPatientChange} />;
}

type SystemAccount = {
  userId?: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  studyScope: string;
  assignedRoles?: Array<{ role: UserRole; roleLabel: string; studyScope: string }>;
  studyScopes?: string[];
  status: 'Active' | 'Pending' | 'Disabled' | 'Deleted';
  lastLogin: string;
};

type SystemStudy = ApiStudy & {
  systemAdminCount: number;
};

type StudyCreateDraft = {
  id: string;
  code: string;
  name: string;
  indication: string;
  phase: string;
  status: ApiStudy['status'];
  owner_org: string;
  leading_pi_info: string;
  system_admin: string;
};

type StudyDraftMode = 'create' | 'edit';

type AccountCreateDraft = {
  displayName: string;
  username: string;
  role: UserRole;
  password: string;
  status: 'active' | 'disabled';
  studyId: string;
  platformStudyScopeIds: string[];
  memberStatus: 'active' | 'pending' | 'disabled';
};

type AccountStudyBindingDraft = {
  studyId: string;
  role: StudyRole;
  status: 'active' | 'pending' | 'disabled';
};

type AccountEditDraft = {
  userId?: string;
  originalEmail: string;
  displayName: string;
  accountRole: UserRole;
  platformStudyScopeIds: string[];
  studyBindings: AccountStudyBindingDraft[];
  originalStudyBindings: AccountStudyBindingDraft[];
  status: SystemAccount['status'];
  password: string;
};

type AccountPasswordDraft = {
  userId: string;
  email: string;
  displayName: string;
  password: string;
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

function formatLastLogin(value?: string | null) {
  if (!value) return '-';
  const normalized = value.replace('T', ' ').replace(/\+00:00$/, 'Z');
  return normalized.slice(0, 16);
}

function formatStudyCode(value?: string | null) {
  const number = Number.parseInt(String(value ?? '').trim(), 10);
  if (Number.isFinite(number) && number >= 1 && number <= 99) return number.toString().padStart(2, '0');
  return '--';
}

function nextStudyCode(studies: Array<Pick<ApiStudy, 'code'>>) {
  const usedCodes = new Set(studies.map((study) => formatStudyCode(study.code)).filter((code) => code !== '--'));
  for (let number = 1; number <= 99; number += 1) {
    const code = number.toString().padStart(2, '0');
    if (!usedCodes.has(code)) return code;
  }
  return '';
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
    lastLogin: formatLastLogin(member.last_login_at)
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
    status: user.status === 'deleted'
      ? 'Deleted'
      : membership?.status === 'disabled' || user.status === 'disabled'
        ? 'Disabled'
        : membership?.status === 'active' || user.status === 'active'
          ? 'Active'
          : 'Pending',
    lastLogin: formatLastLogin(user.last_login_at)
  };
}

function accountRowsFromApiUser(user: ApiUser, fallbackStudyId: string): SystemAccount[] {
  const membershipAccounts = (user.study_memberships ?? []).map((membership) => accountFromApiUser(user, membership.study_id));
  if (user.role.startsWith('LZ_') || !membershipAccounts.length) {
    return [accountFromApiUser(user, fallbackStudyId), ...membershipAccounts];
  }
  return membershipAccounts;
}

function accountScopeTokens(account: SystemAccount, allStudyIds: string[]) {
  if (account.studyScope === '全部 Study') return ['全部 Study'];
  const ids = studyScopeToIds(account.studyScope, allStudyIds);
  return ids.length ? ids : account.studyScope.split('/').map((item) => item.trim()).filter(Boolean);
}

function mergeAccountStatus(statuses: SystemAccount['status'][]): SystemAccount['status'] {
  if (statuses.includes('Active')) return 'Active';
  if (statuses.includes('Pending')) return 'Pending';
  if (statuses.includes('Disabled')) return 'Disabled';
  if (statuses.includes('Deleted')) return 'Deleted';
  return 'Disabled';
}

function groupSystemAccounts(accounts: SystemAccount[], allStudyIds: string[]): SystemAccount[] {
  const groups = new Map<string, SystemAccount[]>();
  accounts.forEach((account) => {
    const key = account.userId || account.email;
    groups.set(key, [...(groups.get(key) ?? []), account]);
  });

  return Array.from(groups.values()).map((items) => {
    const primary = items.find((item) => item.role.startsWith('LZ_')) ?? items[0];
    const assignedRoles = items
      .map((item) => ({ role: item.role, roleLabel: item.roleLabel, studyScope: item.studyScope }))
      .filter((item, index, rows) => rows.findIndex((row) => row.role === item.role) === index);
    const hasAllStudies = items.some((item) => item.studyScope === '全部 Study');
    const studyScopes = hasAllStudies
      ? ['全部 Study']
      : Array.from(new Set(items.flatMap((item) => accountScopeTokens(item, allStudyIds)))).sort();

	    const loginValues = items.map((item) => item.lastLogin).filter((item) => item !== '-').sort();
	    return {
	      ...primary,
	      assignedRoles,
	      studyScopes,
	      status: mergeAccountStatus(items.map((item) => item.status)),
	      lastLogin: loginValues[loginValues.length - 1] ?? '-'
	    };
	  });
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

function studyMemberStatusFromAccountStatus(status: SystemAccount['status']): AccountStudyBindingDraft['status'] {
  if (status === 'Active') return 'active';
  if (status === 'Disabled') return 'disabled';
  return 'pending';
}

function userStatusFromAccountStatus(status: SystemAccount['status']) {
  return status === 'Disabled' ? 'disabled' : 'active';
}

function upsertAccountRow(rows: SystemAccount[], account: SystemAccount) {
  const matches = (row: SystemAccount) =>
    row.studyScope === account.studyScope && ((account.userId && row.userId === account.userId) || row.email === account.email);
  const exists = rows.some(matches);
  if (!exists) return [account, ...rows];
  return rows.map((row) => (matches(row) ? { ...row, ...account } : row));
}

function replaceAccountRowsForUser(rows: SystemAccount[], originalEmail: string, accounts: SystemAccount[]) {
  const userId = accounts.find((account) => account.userId)?.userId;
  const matches = (row: SystemAccount) => (userId && row.userId === userId) || row.email === originalEmail;
  return [...accounts, ...rows.filter((row) => !matches(row))];
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

const permissionColumns: Array<{ key: UserRole; label: string }> = [
  { key: 'LZ_ADMIN', label: 'LZ Admin' },
  { key: 'LZ_CRC', label: 'LZ CRC' },
  { key: 'LZ_DATA_MANAGER', label: 'LZ DM' },
  { key: 'STUDY_PI', label: 'Study PI' },
  { key: 'STUDY_CRC', label: 'Study CRC' },
  { key: 'STUDY_CONFIG_ADMIN', label: 'Study Admin' },
  { key: 'STUDY_DATA_MANAGER', label: 'Study DM' }
];

const editableAccountRoles = permissionColumns.map((column) => column.key);
const studyPermissionColumns = permissionColumns.filter((column) => column.key.startsWith('STUDY_'));

function permissionRowsFromMatrix(matrixRows: ApiPermissionMatrixRow[]): PermissionRow[] {
  return matrixRows.map((row) => ({
    action: `${row.module} / ${row.operation}`,
    values: row.allowed_roles.reduce<PermissionRow['values']>((values, role) => {
      if (editableAccountRoles.includes(role as UserRole)) values[role as UserRole] = true;
      return values;
    }, {})
  }));
}

function permissionValues(...roles: UserRole[]): PermissionRow['values'] {
  return roles.reduce<PermissionRow['values']>((values, role) => {
    values[role] = true;
    return values;
  }, {});
}

const allVisiblePermissionRoles = permissionColumns.map((column) => column.key);
const crcWriteRoles: UserRole[] = ['LZ_ADMIN', 'LZ_CRC', 'STUDY_CRC', 'STUDY_CONFIG_ADMIN'];
const dataManagerWriteRoles: UserRole[] = ['LZ_ADMIN', 'LZ_DATA_MANAGER', 'STUDY_CONFIG_ADMIN', 'STUDY_DATA_MANAGER'];
const fallbackPermissionMatrixRows: PermissionRow[] = [
  { action: 'Study Configuration / Read Study configuration', values: permissionValues(...allVisiblePermissionRoles) },
  { action: 'Study Configuration / Update current Study configuration', values: permissionValues('LZ_ADMIN', 'STUDY_CONFIG_ADMIN') },
  { action: 'LZ System Management / Create, update, terminate, or delete Studies', values: permissionValues('LZ_ADMIN') },
  { action: 'Account and Study Members / Read users and Study members', values: permissionValues('LZ_ADMIN', 'LZ_CRC', 'LZ_DATA_MANAGER', 'LZ_AUDITOR', 'STUDY_PI', 'STUDY_CRC', 'STUDY_CONFIG_ADMIN', 'STUDY_DATA_MANAGER') },
  { action: 'Account and Study Members / Create or update users and Study members', values: permissionValues('LZ_ADMIN', 'STUDY_CONFIG_ADMIN') },
  { action: 'Patient Cohort / Read patient records', values: permissionValues(...allVisiblePermissionRoles) },
  { action: 'Patient Cohort / Create or update patient records', values: permissionValues(...crcWriteRoles) },
  { action: 'Clinical Data Capture / Read CRF and visits', values: permissionValues(...allVisiblePermissionRoles) },
  { action: 'Clinical Data Capture / Write CRF entries', values: permissionValues(...crcWriteRoles) },
  { action: 'Clinical Data Capture / Write follow-up records', values: permissionValues(...crcWriteRoles) },
  { action: 'System Management / Configure CRF versions, fields, visit plans, and sites', values: permissionValues('LZ_ADMIN', 'STUDY_CONFIG_ADMIN') },
  { action: 'Informed Consent / Read consent records', values: permissionValues(...allVisiblePermissionRoles) },
  { action: 'Informed Consent / Update consent records and request withdrawal or re-sign', values: permissionValues(...crcWriteRoles) },
  { action: 'Samples and Testing / Write samples', values: permissionValues(...crcWriteRoles) },
  { action: 'Samples and Testing / Write omics records', values: permissionValues(...crcWriteRoles) },
  { action: 'Files / Upload, download, and archive files', values: permissionValues(...crcWriteRoles) },
  { action: 'Data Management / Run quality checks and create Query', values: permissionValues(...dataManagerWriteRoles, 'LZ_CRC') },
  { action: 'Data Management / Export and download data', values: permissionValues(...dataManagerWriteRoles) },
  { action: 'Approval Center / Create, approve, reject, cancel, and complete approvals', values: permissionValues(...dataManagerWriteRoles) }
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

const systemStatusTone: Record<SystemAccount['status'], 'success' | 'warning' | 'danger' | 'info'> = {
  Active: 'success',
  Pending: 'warning',
  Disabled: 'danger',
  Deleted: 'info'
};
const creatableStudyRoles: StudyRole[] = ['STUDY_CRC', 'STUDY_PI', 'STUDY_CONFIG_ADMIN', 'STUDY_DATA_MANAGER'];
const creatableGlobalRoles: UserRole[] = ['LZ_ADMIN', 'LZ_CRC', 'LZ_DATA_MANAGER', ...creatableStudyRoles];
const studyBindingRoleLabels: Record<StudyRole, string> = {
  STUDY_CONFIG_ADMIN: 'Study Admin',
  STUDY_PI: 'Study PI',
  STUDY_CRC: 'Study CRC',
  STUDY_DATA_MANAGER: 'Study DM'
};
const editableStudyBindingRoles: StudyRole[] = ['STUDY_CONFIG_ADMIN', 'STUDY_PI', 'STUDY_CRC', 'STUDY_DATA_MANAGER'];
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
  const consentTemplateUploadInputRef = useRef<globalThis.HTMLInputElement>(null);
  const [systemQuery] = useState('');
  const [accountPage, setAccountPage] = useState(1);
  const [fieldPage, setFieldPage] = useState(1);
  const [accountRows, setAccountRows] = useState<SystemAccount[]>([]);
  const [fieldRows, setFieldRows] = useState<SystemField[]>([]);
  const [fieldEditor, setFieldEditor] = useState<SystemField | null>(null);
  const [crfVersionRows, setCrfVersionRows] = useState<StudyCrfVersionRecord[]>([]);
  const [crfMigrationPreview, setCrfMigrationPreview] = useState<CrfMigrationPreview | null>(null);
  const [crfMigrationRows, setCrfMigrationRows] = useState<CrfMigrationApprovalRecord[]>([]);
  const [approvalRows, setApprovalRows] = useState<ApiApprovalRequest[]>([]);
  const [visitPlanRows, setVisitPlanRows] = useState<StudyVisitPlanRecord[]>([]);
  const [siteRows, setSiteRows] = useState<ApiStudySite[]>([]);
  const [siteUserRows, setSiteUserRows] = useState<ApiSiteUser[]>([]);
  const [queryRows, setQueryRows] = useState<ApiDataQuery[]>([]);
  const [queryStatusFilter, setQueryStatusFilter] = useState<'all' | ApiDataQuery['status']>('all');
  const [operationLogRows, setOperationLogRows] = useState<ApiOperationLog[]>([]);
  const [operationLogActionFilter, setOperationLogActionFilter] = useState('all');
  const [operationLogEntityFilter, setOperationLogEntityFilter] = useState('all');
  const [studyCreateDraft, setStudyCreateDraft] = useState<StudyCreateDraft | null>(null);
  const [studyDraftMode, setStudyDraftMode] = useState<StudyDraftMode>('create');
  const [accountCreateDraft, setAccountCreateDraft] = useState<AccountCreateDraft | null>(null);
  const [accountEditDraft, setAccountEditDraft] = useState<AccountEditDraft | null>(null);
  const [accountPasswordDraft, setAccountPasswordDraft] = useState<AccountPasswordDraft | null>(null);
  const [permissionMatrixRows, setPermissionMatrixRows] = useState<PermissionRow[]>(fallbackPermissionMatrixRows);
  const [systemActionStatus, setSystemActionStatus] = useState('等待系统管理操作');
  const [globalDiseaseTypesDraft, setGlobalDiseaseTypesDraft] = useState(() => getGlobalDiseaseTypes().join(', '));
  const [globalSampleTypesDraft, setGlobalSampleTypesDraft] = useState(() => getGlobalSampleTypes().join(', '));
  const [globalDetectionTypesDraft, setGlobalDetectionTypesDraft] = useState(() => getGlobalDetectionTypes().join(', '));
  const [globalQuantityUnitsDraft, setGlobalQuantityUnitsDraft] = useState(() => getGlobalQuantityUnits().join(', '));
  const [studyConfigurationRows, setStudyConfigurationRows] = useState<ApiStudyConfiguration[]>([]);
  const [consentTemplateDraft, setConsentTemplateDraft] = useState('');
  const [consentTemplateFileRows, setConsentTemplateFileRows] = useState<ApiFileMetadata[]>([]);
  const normalizedQuery = systemQuery.trim().toLowerCase();
  const suggestedStudyCode = useMemo(() => nextStudyCode(studyRows), [studyRows]);
  const isStudyDraftEdit = studyDraftMode === 'edit';
  const isStudyCreateReady = Boolean(
    studyCreateDraft?.id.trim() &&
      studyCreateDraft.name.trim() &&
      studyCreateDraft.indication.trim()
  );
  const groupedAccountRows = useMemo(() => groupSystemAccounts(accountRows, allSystemStudyIds), [accountRows, allSystemStudyIds]);
  const studyScopedAccountRows = useMemo(() => {
    if (!scopedStudyId) return [];
    return accountRows.filter((account) =>
      account.role.startsWith('STUDY_') &&
      accountScopeTokens(account, allSystemStudyIds).includes(scopedStudyId)
    );
  }, [accountRows, allSystemStudyIds, scopedStudyId]);
  const accountSummaryRows = isGlobalManagement ? groupedAccountRows : studyScopedAccountRows;
  const visibleAccounts = useMemo(() => {
    if (!normalizedQuery) return accountSummaryRows;
    return accountSummaryRows.filter((account) =>
      [
        account.name,
        account.email,
        account.role,
        account.roleLabel,
        account.studyScope,
        ...(account.assignedRoles ?? []).flatMap((role) => [role.role, role.roleLabel, role.studyScope]),
        ...(account.studyScopes ?? []),
        account.status
      ].some((item) => item.toLowerCase().includes(normalizedQuery))
    );
  }, [accountSummaryRows, normalizedQuery]);

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
  const operationLogStudyId = scopedStudyId || undefined;
  const scopedOperationLogRows = useMemo(
    () => (operationLogStudyId ? operationLogRows.filter((log) => log.study_id === operationLogStudyId) : operationLogRows),
    [operationLogRows, operationLogStudyId]
  );
  const operationLogActionOptions = useMemo(
    () => Array.from(new Set(scopedOperationLogRows.map((log) => log.action))).sort(),
    [scopedOperationLogRows]
  );
  const operationLogEntityOptions = useMemo(
    () => Array.from(new Set(scopedOperationLogRows.map((log) => log.entity_type))).sort(),
    [scopedOperationLogRows]
  );
  const visibleOperationLogs = useMemo(() => {
    return scopedOperationLogRows
      .filter((log) => operationLogActionFilter === 'all' || log.action === operationLogActionFilter)
      .filter((log) => operationLogEntityFilter === 'all' || log.entity_type === operationLogEntityFilter)
      .slice(0, 8);
  }, [operationLogActionFilter, operationLogEntityFilter, scopedOperationLogRows]);
  const operationLogCounts = useMemo(() => {
    return {
      total: scopedOperationLogRows.length,
      creates: scopedOperationLogRows.filter((log) => log.action === 'CREATE').length,
      updates: scopedOperationLogRows.filter((log) => log.action === 'UPDATE' || log.action === 'UPSERT').length,
      deletes: scopedOperationLogRows.filter((log) => log.action === 'DELETE').length
    };
  }, [scopedOperationLogRows]);
  const scopedStudyConfiguration = useMemo(
    () => studyConfigurationRows.find((configuration) => configuration.study_id === scopedStudyId),
    [scopedStudyId, studyConfigurationRows]
  );
  const scopedStudySummary = useMemo(
    () => studyRows.find((study) => study.id === scopedStudyId),
    [scopedStudyId, studyRows]
  );
  const scopedStudyDiseaseArea = scopedStudyConfiguration?.disease_area || scopedStudySummary?.indication || '';
  const explicitConsentTemplate = scopedStudyConfiguration?.consent_template?.trim() ?? '';
  const effectiveConsentTemplateId = inferConsentTemplateId(
    scopedStudyId,
    scopedStudyConfiguration,
    scopedStudySummary?.indication,
    scopedStudySummary?.name
  );
  const effectiveConsentTemplate = consentTemplateCatalogItem(effectiveConsentTemplateId);
  const effectiveConsentTitle = effectiveConsentTemplate?.title
    ?? getConsentStudyTitle(scopedStudyId, scopedStudyConfiguration, scopedStudySummary?.indication, scopedStudySummary?.name);
  const consentTemplateSourceLabel = explicitConsentTemplate
    ? 'Study 显式配置'
    : effectiveConsentTemplateId
      ? '疾病领域自动匹配'
      : '系统默认兜底';
  const consentTemplateStatusLabel = explicitConsentTemplate
    ? '当前 Study 生效中'
    : effectiveConsentTemplateId
      ? '尚未保存为 Study 显式配置'
      : '需要配置模板';
  const selectedConsentTemplateCatalogItem = consentTemplateCatalogItem(consentTemplateDraft);
  const selectedConsentPreviewSections = selectedConsentTemplateCatalogItem?.sections
    ?? configuredConsentContent(scopedStudyId, { ...scopedStudyConfiguration, consent_template: consentTemplateDraft } as ApiStudyConfiguration, scopedStudySummary?.indication, scopedStudySummary?.name);
  const selectedConsentPreviewTitle = selectedConsentTemplateCatalogItem?.title
    ?? (consentTemplateDraft.trim() || effectiveConsentTitle);
  const hasConsentTemplateDraftChanges = consentTemplateDraft.trim() !== explicitConsentTemplate;
  const currentConsentTemplateFile = useMemo(() => {
    if (!scopedStudyId) return undefined;
    return consentTemplateFileRows
      .filter((file) =>
        file.study_id === scopedStudyId &&
        file.category === 'consent' &&
        !file.patient_id &&
        !file.consent_id
      )
      .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))[0];
  }, [consentTemplateFileRows, scopedStudyId]);
  const visiblePermissionColumns = isGlobalManagement ? permissionColumns : studyPermissionColumns;
  const visiblePermissionMatrixRows = useMemo(() => {
    if (isGlobalManagement) return permissionMatrixRows;
    return permissionMatrixRows.filter((row) =>
      !row.action.startsWith('LZ System Management /') &&
      studyPermissionColumns.some((column) => row.values[column.key])
    );
  }, [isGlobalManagement, permissionMatrixRows]);
  const editableRoleOptions = isGlobalManagement && currentUser?.role === 'LZ_ADMIN' ? editableAccountRoles : editableStudyBindingRoles;
  const permissionsByRole = useMemo(() => {
    return editableAccountRoles.reduce<Record<UserRole, string[]>>((permissions, role) => {
      permissions[role] = visiblePermissionMatrixRows.filter((row) => row.values[role]).map((row) => row.action);
      return permissions;
    }, {} as Record<UserRole, string[]>);
  }, [visiblePermissionMatrixRows]);
	  const studyRegistryRows = useMemo(() => {
	    return studyRows.filter((study) => availableSystemStudies.includes(study.id)).map((study) => {
	      const studyId = study.id;
	      const accounts = accountRows.filter((account) => account.studyScope === '全部 Study' || account.studyScope.split('/').map((item) => item.trim()).includes(studyId));
	      const leadingPiNames = accounts
	        .filter((account) => account.role === 'STUDY_PI')
	        .map((account) => account.name)
	        .filter(Boolean);
	      const adminNames = accounts
	        .filter((account) => account.role === 'STUDY_CONFIG_ADMIN')
	        .map((account) => account.name)
	        .filter(Boolean);
	      return {
	        ...study,
	        studyId,
	        leadingPiInfo: study.leading_pi_info || Array.from(new Set(leadingPiNames)).join(' / ') || '-',
	        systemAdmin: study.system_admin || Array.from(new Set(adminNames)).join(' / ') || '-',
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
    const refresh = () => {
      setGlobalDiseaseTypesDraft(getGlobalDiseaseTypes().join(', '));
      setGlobalSampleTypesDraft(getGlobalSampleTypes().join(', '));
      setGlobalDetectionTypesDraft(getGlobalDetectionTypes().join(', '));
      setGlobalQuantityUnitsDraft(getGlobalQuantityUnits().join(', '));
    };
    window.addEventListener(globalConfigChangedEvent, refresh);
    return () => window.removeEventListener(globalConfigChangedEvent, refresh);
  }, []);

  useEffect(() => {
    let ignore = false;
    void fetchGlobalConfiguration()
      .then((config) => {
        if (ignore) return;
        setGlobalDiseaseTypesDraft(config.diseaseTypes.join(', '));
        setGlobalSampleTypesDraft(config.sampleTypes.join(', '));
        setGlobalDetectionTypesDraft(config.detectionTypes.join(', '));
        setGlobalQuantityUnitsDraft(config.quantityUnits.join(', '));
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

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
	    let ignore = false;
	    void fetchPermissionMatrix()
	      .then((rows) => {
	        if (!ignore) {
	          const nextRows = permissionRowsFromMatrix(rows);
	          setPermissionMatrixRows(nextRows.length ? nextRows : fallbackPermissionMatrixRows);
	        }
	      })
	      .catch(() => {
	        if (!ignore) setPermissionMatrixRows(fallbackPermissionMatrixRows);
	      });
	    return () => {
	      ignore = true;
	    };
	  }, [currentUser?.id]);

  useEffect(() => {
    if (!isGlobalManagement && !scopedStudyId) return;
    let ignore = false;
    void fetchUsers(isGlobalManagement ? undefined : scopedStudyId)
      .then((users) => {
        if (ignore) return;
        const accounts = users.flatMap((user) => accountRowsFromApiUser(user, scopedStudyId));
        setAccountRows(accounts);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [isGlobalManagement, scopedStudyId]);

  useEffect(() => {
    if (!scopedStudyId) {
      setConsentTemplateDraft('');
      return;
    }
    let ignore = false;
    void fetchStudyConfiguration(scopedStudyId)
      .then((configuration) => {
        if (ignore) return;
        setStudyConfigurationRows((rows) => [
          ...rows.filter((row) => row.study_id !== configuration.study_id),
          configuration
        ]);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [scopedStudyId]);

  useEffect(() => {
    setConsentTemplateDraft(explicitConsentTemplate || effectiveConsentTemplateId);
  }, [effectiveConsentTemplateId, explicitConsentTemplate, scopedStudyId]);

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
      fetchStudyFileMetadata(scopedStudyId)
    ])
      .then(([visitPlanResult, memberResult, crfFieldResult, crfVersionResult, crfMigrationResult, approvalResult, siteResult, queryResult, fileResult]) => {
        if (ignore) return;
        if (visitPlanResult.status === 'fulfilled') {
          setVisitPlanRows((rows) => [
            ...rows.filter((plan) => plan.studyId !== scopedStudyId),
            ...visitPlanResult.value
          ]);
        }
        if (memberResult.status === 'fulfilled' && memberResult.value.length) {
          const memberAccounts = memberResult.value.map(accountFromStudyMember);
          setAccountRows((rows) => memberAccounts.reduce((nextRows, account) => upsertAccountRow(nextRows, account), rows));
        }
        if (crfFieldResult.status === 'fulfilled') {
          setFieldRows((rows) => [
            ...rows.filter((field) => field.studyId !== scopedStudyId),
            ...crfFieldResult.value
          ]);
        }
        if (crfVersionResult.status === 'fulfilled') {
          setCrfVersionRows((rows) => [
            ...rows.filter((version) => version.studyId !== scopedStudyId),
            ...crfVersionResult.value
          ]);
        }
        if (crfMigrationResult.status === 'fulfilled') {
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
        if (fileResult.status === 'fulfilled') {
          setConsentTemplateFileRows((rows) => [
            ...rows.filter((file) => file.study_id !== scopedStudyId),
            ...fileResult.value.filter((file) => file.category === 'consent' && !file.patient_id && !file.consent_id)
          ]);
        }
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [isGlobalManagement, scopedStudyId]);

  useEffect(() => {
    if (!isGlobalManagement && !operationLogStudyId) return;
    let ignore = false;
    void fetchOperationLogs(operationLogStudyId, { limit: 100 })
      .then((logs) => {
        if (!ignore) setOperationLogRows(logs);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [isGlobalManagement, operationLogStudyId]);

  function openSystemAccountCreate() {
    const studyScope = scopedStudyId;
    const canCreatePlatformWithoutStudy = isGlobalManagement && currentUser?.role === 'LZ_ADMIN';
    if (!studyScope && !canCreatePlatformWithoutStudy) {
      setSystemActionStatus('请先新建或选择 Study，再创建 Study 用户');
      return;
    }
    const defaultRole: UserRole = isGlobalManagement && currentUser?.role === 'LZ_ADMIN'
      ? (studyScope ? 'LZ_CRC' : 'LZ_ADMIN')
      : 'STUDY_CRC';
    setAccountCreateDraft({
      displayName: '',
      username: '',
      role: defaultRole,
      password: '',
      status: 'active',
      studyId: studyScope,
      platformStudyScopeIds: studyScope ? [studyScope] : [],
      memberStatus: 'pending'
    });
    setAccountEditDraft(null);
    setAccountPasswordDraft(null);
    setSystemActionStatus('请填写用户资料、角色、密码和所属 Study 后提交');
  }

  async function submitSystemAccountCreate() {
    if (!accountCreateDraft) return;
    const username = accountCreateDraft.username.trim();
    const displayName = accountCreateDraft.displayName.trim();
    const password = accountCreateDraft.password.trim();
    const studyId = accountCreateDraft.studyId.trim();
    const isPlatformAccount = accountCreateDraft.role.startsWith('LZ_');
    if (!username || !displayName || !password || (!isPlatformAccount && !studyId)) {
      setSystemActionStatus('请完整填写姓名、邮箱、密码和所属 Study');
      return;
    }
    const platformStudyIds = Array.from(new Set(accountCreateDraft.platformStudyScopeIds.filter(Boolean)));
    if (isPlatformAccount && accountCreateDraft.role !== 'LZ_ADMIN' && !platformStudyIds.length) {
      setSystemActionStatus('请至少选择一个平台角色可访问的 Study');
      return;
    }
    setSystemActionStatus(isPlatformAccount ? '平台账户正在创建并同步 Study Scope...' : '用户账户正在创建并同步 Study 成员...');
    try {
      let user = await createUserAccount({
        username,
        display_name: displayName,
        role: accountCreateDraft.role,
        password,
        status: accountCreateDraft.status,
        study_id: isPlatformAccount ? undefined : studyId,
        member_status: accountCreateDraft.memberStatus
      });
      if (isPlatformAccount && accountCreateDraft.role !== 'LZ_ADMIN') {
        user = await updateGlobalRoleStudyScope(user.id, platformStudyIds);
      }
      const savedAccount = accountFromApiUser(user, studyId);
      setAccountRows((rows) => upsertAccountRow(rows, savedAccount));
      setAccountCreateDraft(null);
      setAccountPage(1);
      setSystemActionStatus(isPlatformAccount ? `平台账户已创建：${savedAccount.email}` : `用户账户已创建并加入 Study：${savedAccount.email}`);
    } catch {
      setSystemActionStatus('后端不可用、密码不符合策略，或当前角色无用户创建权限');
    }
  }

  function openSystemStudyCreate() {
    if (currentUser?.role !== 'LZ_ADMIN') {
      setSystemActionStatus('只有 LZ 系统管理员可以新建 Study');
      return;
    }
    setStudyDraftMode('create');
    setStudyCreateDraft({
      id: '',
      code: suggestedStudyCode,
      name: '',
      indication: '',
	      phase: 'RWD',
	      status: 'draft',
	      owner_org: 'LinZight',
		      leading_pi_info: '',
		      system_admin: ''
		    });
    setSystemActionStatus('请先填写 Study ID、名称和适应症，再提交创建 Study');
  }

  function openSystemStudyEdit(studyId: string) {
    if (currentUser?.role !== 'LZ_ADMIN') {
      setSystemActionStatus('只有 LZ 系统管理员可以编辑 Study');
      return;
    }
    const study = studyRows.find((row) => row.id === studyId);
    if (!study) {
      setSystemActionStatus(`未找到 Study：${studyId}`);
      return;
    }
    setStudyDraftMode('edit');
    setSelectedSystemStudyId(study.id);
    setStudyCreateDraft({
      id: study.id,
      code: study.code,
      name: study.name,
      indication: study.indication,
      phase: study.phase,
      status: study.status,
      owner_org: study.owner_org,
      leading_pi_info: study.leading_pi_info,
      system_admin: study.system_admin
    });
    setSystemActionStatus(`正在编辑 Study：${study.id}`);
  }

  function closeSystemStudyDraft() {
    setStudyCreateDraft(null);
    setStudyDraftMode('create');
  }

  async function submitSystemStudyCreate() {
    if (!studyCreateDraft) return;
    const id = studyCreateDraft.id.trim();
    const code = studyCreateDraft.code.trim() || suggestedStudyCode;
    const name = studyCreateDraft.name.trim();
    const indication = studyCreateDraft.indication.trim();
    if (!id || !name || !indication) {
      setSystemActionStatus('请完整填写 Study ID、Study 名称和适应症');
      return;
    }
    const payload = {
      code,
      name,
      indication,
      phase: studyCreateDraft.phase.trim() || 'RWD',
      status: studyCreateDraft.status,
      owner_org: studyCreateDraft.owner_org.trim() || 'LinZight',
      leading_pi_info: studyCreateDraft.leading_pi_info.trim(),
      system_admin: studyCreateDraft.system_admin.trim()
    };
    setSystemActionStatus(isStudyDraftEdit ? `Study ${id} 正在保存修改...` : `Study ${id} 正在创建...`);
    try {
      const study = isStudyDraftEdit
        ? await updateStudy(id, payload)
        : await createStudy({ id, ...payload });
      setStudyRows((rows) => (
        isStudyDraftEdit
          ? rows.map((row) => (row.id === study.id ? { ...study, systemAdminCount: row.systemAdminCount } : row))
          : [{ ...study, systemAdminCount: 0 }, ...rows.filter((row) => row.id !== study.id)]
      ));
      setSelectedSystemStudyId(study.id);
      closeSystemStudyDraft();
      notifyStudiesUpdated();
      setSystemActionStatus(isStudyDraftEdit
        ? `Study 已更新：${study.id}`
        : `Study 已创建为草稿：${study.id}。发布前需绑定 CRF、访视计划、知情模板和系统管理员。`
      );
    } catch {
      setSystemActionStatus(isStudyDraftEdit ? '后端不可用或当前角色无 Study 编辑权限' : '后端不可用或当前角色无 Study 新建权限');
    }
  }

  function openSystemAccountEdit(account: SystemAccount) {
    const studyScopeIds = studyScopeToIds(account.studyScope, allSystemStudyIds);
    const fallbackStudyId = scopedStudyId || selectedSystemStudyId || availableSystemStudies[0] || '';
    const sameUserAccounts = accountRows.filter((row) =>
      (account.userId && row.userId === account.userId) || row.email === account.email
    );
    const editableAccountsForScope = isGlobalManagement
      ? sameUserAccounts
      : sameUserAccounts.filter((row) =>
        row.role.startsWith('STUDY_') &&
        scopedStudyId &&
        accountScopeTokens(row, allSystemStudyIds).includes(scopedStudyId)
      );
    const studyBindings = editableAccountsForScope
      .filter((row) => row.role.startsWith('STUDY_') && studyScopeToIds(row.studyScope, allSystemStudyIds).length)
      .map<AccountStudyBindingDraft>((row) => ({
        studyId: studyScopeToIds(row.studyScope, allSystemStudyIds)[0],
        role: row.role as StudyRole,
        status: studyMemberStatusFromAccountStatus(row.status)
      }));
    const uniqueStudyBindings = studyBindings.filter((binding, index, rows) =>
      rows.findIndex((row) => row.studyId === binding.studyId) === index
    );
    const effectiveStudyBindings = uniqueStudyBindings.length
      ? uniqueStudyBindings
      : account.role.startsWith('STUDY_') && fallbackStudyId
        ? [{ studyId: fallbackStudyId, role: account.role as StudyRole, status: studyMemberStatusFromAccountStatus(account.status) }]
        : [];
    setAccountCreateDraft(null);
    setAccountPasswordDraft(null);
    setAccountEditDraft({
      userId: account.userId ?? userIdForEmail(account.email),
      originalEmail: account.email,
      displayName: account.name,
      accountRole: effectiveStudyBindings[0]?.role ?? account.role,
      platformStudyScopeIds: account.studyScope === '全部 Study' ? availableSystemStudies : studyScopeIds,
      studyBindings: effectiveStudyBindings,
      originalStudyBindings: effectiveStudyBindings,
      status: account.status,
      password: ''
    });
    setSystemActionStatus(`正在编辑账户：${account.email}`);
  }

  function openSystemAccountPasswordReset(account: SystemAccount) {
    const userId = account.userId ?? userIdForEmail(account.email);
    if (!userId) {
      setSystemActionStatus('缺少用户 ID，无法修改账户密码');
      return;
    }
    setAccountCreateDraft(null);
    setAccountEditDraft(null);
    setAccountPasswordDraft({
      userId,
      email: account.email,
      displayName: account.name,
      password: ''
    });
    setSystemActionStatus(`正在修改账户密码：${account.email}`);
  }

  async function saveSystemAccountPassword() {
    if (!accountPasswordDraft) return;
    const password = accountPasswordDraft.password.trim();
    if (!password) {
      setSystemActionStatus('请填写新密码');
      return;
    }
    setSystemActionStatus(`账户 ${accountPasswordDraft.email} 密码正在更新...`);
    try {
      await updateUserAccount(accountPasswordDraft.userId, { password }, scopedStudyId || undefined);
      setAccountPasswordDraft(null);
      setSystemActionStatus(`账户密码已更新：${accountPasswordDraft.email}`);
    } catch {
      setSystemActionStatus('后端不可用、密码不符合策略，或当前角色无账户密码修改权限');
    }
  }

  function patchAccountEditDraft(patch: Partial<AccountEditDraft>) {
    setAccountEditDraft((draft) => (draft ? { ...draft, ...patch } : draft));
  }

  function patchAccountStudyBinding(index: number, patch: Partial<AccountStudyBindingDraft>) {
    setAccountEditDraft((draft) => {
      if (!draft) return draft;
      return {
        ...draft,
        studyBindings: draft.studyBindings.map((binding, bindingIndex) => (
          bindingIndex === index ? { ...binding, ...patch } : binding
        ))
      };
    });
  }

  function addAccountStudyBinding() {
    setAccountEditDraft((draft) => {
      if (!draft) return draft;
      const usedStudyIds = new Set(draft.studyBindings.map((binding) => binding.studyId));
      const nextStudyId = availableSystemStudies.find((studyId) => !usedStudyIds.has(studyId)) ?? availableSystemStudies[0] ?? '';
      if (!nextStudyId) return draft;
      return {
        ...draft,
        studyBindings: [
          ...draft.studyBindings,
          { studyId: nextStudyId, role: 'STUDY_CRC', status: 'active' }
        ]
      };
    });
  }

  function removeAccountStudyBinding(index: number) {
    setAccountEditDraft((draft) => (
      draft
        ? { ...draft, studyBindings: draft.studyBindings.filter((_, bindingIndex) => bindingIndex !== index) }
        : draft
    ));
  }

  async function saveSystemAccountEdit() {
    if (!accountEditDraft) return;
    const userId = accountEditDraft.userId;
    const displayName = accountEditDraft.displayName.trim();
    const platformStudyIds = accountEditDraft.accountRole === 'LZ_ADMIN'
      ? availableSystemStudies
      : accountEditDraft.platformStudyScopeIds.filter(Boolean);
    const studyBindings = accountEditDraft.studyBindings.filter((binding) => binding.studyId);
    const uniqueStudyIds = new Set(studyBindings.map((binding) => binding.studyId));
    if (!userId) {
      setSystemActionStatus('缺少用户 ID，无法同步账户编辑');
      return;
    }
    if (!displayName) {
      setSystemActionStatus('请填写用户姓名');
      return;
    }
    if (uniqueStudyIds.size !== studyBindings.length) {
      setSystemActionStatus('同一个用户不能重复绑定同一个 Study，请调整 Study Scope');
      return;
    }
    if (accountEditDraft.accountRole.startsWith('LZ_') && accountEditDraft.accountRole !== 'LZ_ADMIN' && platformStudyIds.length === 0) {
      setSystemActionStatus('请为平台角色选择 Study Scope');
      return;
    }
    if (!accountEditDraft.accountRole.startsWith('LZ_') && studyBindings.length === 0) {
      setSystemActionStatus('请至少添加一个 Study 绑定');
      return;
    }

    setSystemActionStatus(`账户 ${accountEditDraft.originalEmail} 正在同步账号资料和多 Study 角色绑定...`);
    try {
      const basePayload = {
        display_name: displayName,
        ...(accountEditDraft.password.trim() ? { password: accountEditDraft.password.trim() } : {})
      };
      const accountRole = accountEditDraft.accountRole.startsWith('LZ_')
        ? accountEditDraft.accountRole
        : studyBindings[0]?.role ?? accountEditDraft.accountRole;
      let updatedUser = await updateUserAccount(userId, {
        ...basePayload,
        ...(isGlobalManagement && currentUser?.role === 'LZ_ADMIN' ? { role: accountRole, status: userStatusFromAccountStatus(accountEditDraft.status) } : {})
      }, scopedStudyId || studyBindings[0]?.studyId);
      if (isGlobalManagement && accountRole.startsWith('LZ_') && accountRole !== 'LZ_ADMIN') {
        updatedUser = await updateGlobalRoleStudyScope(userId, platformStudyIds);
      }
      const savedMembers = await Promise.all(studyBindings.map((binding) =>
        upsertStudyMember(binding.studyId, {
          userId,
          studyRole: binding.role,
          status: binding.status
        })
      ));
      const retainedStudyIds = new Set(studyBindings.map((binding) => binding.studyId));
      await Promise.all(
        accountEditDraft.originalStudyBindings
          .filter((binding) => !retainedStudyIds.has(binding.studyId))
          .map((binding) =>
            upsertStudyMember(binding.studyId, {
              userId,
              studyRole: binding.role,
              status: 'disabled'
            }).catch(() => undefined)
          )
      );
      const savedAccounts = savedMembers.map(accountFromStudyMember);
      if (isGlobalManagement && accountRole.startsWith('LZ_')) {
        savedAccounts.unshift(accountFromApiUser(updatedUser, platformStudyIds[0] ?? '全部 Study'));
      }
      if (!savedAccounts.length) {
        savedAccounts.push(accountFromApiUser(updatedUser, scopedStudyId || platformStudyIds[0] || '全部 Study'));
      }
      setAccountRows((rows) => replaceAccountRowsForUser(rows, accountEditDraft.originalEmail, savedAccounts));
      setAccountEditDraft(null);
      if (studyBindings.length) {
        setSystemActionStatus(`账户 Study 绑定已同步：${accountEditDraft.originalEmail} -> ${studyBindings.map((binding) => `${binding.studyId}/${binding.role}`).join('，')}`);
      } else {
        setSystemActionStatus(`账户权限已同步：${accountEditDraft.originalEmail}`);
      }
    } catch {
      setSystemActionStatus('后端不可用、密码不符合策略，或当前角色无账户权限修改权限');
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
    if (!window.confirm(`${t('确认删除 Study')} ${studyId}？${t('删除后将归档并从 Study 选择列表中隐藏。')}`)) {
      return;
    }
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
	      if (currentUser?.role === 'LZ_ADMIN') {
	        try {
	          const updatedStudy = await updateStudy(studyId, { system_admin: `${savedAccount.name} <${savedAccount.email}>` });
	          setStudyRows((rows) => rows.map((row) => (row.id === updatedStudy.id ? { ...updatedStudy, systemAdminCount: row.systemAdminCount } : row)));
	        } catch {
	          setStudyRows((rows) => rows.map((row) => (row.id === studyId ? { ...row, system_admin: `${savedAccount.name} <${savedAccount.email}>` } : row)));
	        }
	      }
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
    if (account.status === 'Deleted') {
      setSystemActionStatus(`账户 ${account.email} 已归档，不能再启用或停用`);
      return;
    }
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
      if (!isGlobalManagement && scopedStudyId && account.role.startsWith('STUDY_')) {
        const member = await upsertStudyMember(scopedStudyId, {
          userId,
          studyRole: account.role as ApiStudyMember['study_role'],
          status: studyMemberStatusFromAccountStatus(nextStatus)
        });
        savedAccount = accountFromStudyMember(member);
      } else if (currentUser?.role === 'LZ_ADMIN') {
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
      setSystemActionStatus(`保存失败：账户 ${account.email} 状态未写入后端`);
    }
  }

  async function deleteSystemAccount(account: SystemAccount) {
    const userId = account.userId ?? userIdForEmail(account.email);
    if (!userId || currentUser?.role !== 'LZ_ADMIN') {
      setSystemActionStatus('只有 LZ_ADMIN 可以归档账户');
      return;
    }
    if (userId === currentUser.id) {
      setSystemActionStatus('不能归档当前登录账户');
      return;
    }
    if (account.status === 'Deleted') {
      setSystemActionStatus(`账户 ${account.email} 已经归档`);
      return;
    }
    if (!window.confirm(`${t('确认归档账户')} ${account.email}？${t('归档后账户不能登录，但历史审计记录会保留。')}`)) {
      return;
    }
    setSystemActionStatus(`账户 ${account.email} 正在归档...`);
    try {
      const updatedUser = await deleteUserAccount(userId);
      const savedAccounts = accountRowsFromApiUser(updatedUser, scopedStudyId ?? account.studyScope);
      setAccountRows((rows) => replaceAccountRowsForUser(rows, account.email, savedAccounts));
      setAccountEditDraft((draft) => (draft?.userId === userId ? null : draft));
      setAccountPasswordDraft((draft) => (draft?.userId === userId ? null : draft));
      setSystemActionStatus(`账户已归档：${account.email}`);
    } catch {
      setSystemActionStatus(`归档失败：账户 ${account.email} 未写入后端`);
    }
  }

  async function createSystemField() {
    if (!scopedStudyId) {
      setSystemActionStatus('请先选择一个 Study，再创建 CRF 字段');
      return;
    }
    const studyId = scopedStudyId;
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
    setSystemActionStatus('CRF 字段正在同步后端...');
    try {
      const created = await createStudyCrfField(nextField);
      setFieldRows((rows) => [created, ...rows.filter((field) => !(field.id === created.id && field.studyId === created.studyId))]);
      setFieldPage(1);
      setSystemActionStatus(`CRF 字段已同步后端：${created.id}`);
    } catch {
      setSystemActionStatus('保存失败：后端未接受 CRF 字段创建');
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
    setSystemActionStatus(`CRF 字段 ${nextField.id} 正在保存到后端...`);
    try {
      const saved = await updateStudyCrfField(nextField);
      setFieldRows((rows) => rows.map((row) => (row.id === saved.id && row.studyId === saved.studyId ? saved : row)));
      setFieldEditor(null);
      setSystemActionStatus(`CRF 字段 ${saved.id} 已保存：${saved.name} / ${saved.type} / ${saved.module} / ${saved.status}`);
    } catch {
      setSystemActionStatus(`保存失败：CRF 字段 ${nextField.id} 未写入后端`);
    }
  }

  async function createCrfDraftVersion() {
    if (!scopedStudyId) {
      setSystemActionStatus('请先选择一个 Study，再创建 CRF 草稿版本');
      return;
    }
    const studyId = scopedStudyId;
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
    if (!scopedStudyId) {
      setSystemActionStatus('请先选择一个 Study，再生成 CRF 迁移预览');
      return;
    }
    const studyId = scopedStudyId;
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
      const nextApprovals = await fetchApprovalRequests(completed.study_id);
      setApprovalRows((rows) => [
        ...rows.filter((row) => row.study_id !== completed.study_id),
        ...nextApprovals
      ]);
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
    if (!scopedStudyId) {
      setSystemActionStatus('请先选择一个 Study，再创建访视计划');
      return;
    }
    const studyId = scopedStudyId;
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
    setSystemActionStatus('访视计划正在同步后端...');
    try {
      const created = await createStudyVisitPlan(nextPlan);
      setVisitPlanRows((rows) => [created, ...rows.filter((plan) => plan.id !== created.id)]);
      setSystemActionStatus(`访视计划已同步后端：${created.studyId} / ${created.code}`);
    } catch {
      setSystemActionStatus('保存失败：访视计划未写入后端');
    }
  }

  async function createSiteConfiguration() {
    if (!scopedStudyId) {
      setSystemActionStatus('请先选择一个 Study，再创建 Study site');
      return;
    }
    const studyId = scopedStudyId;
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
      setSystemActionStatus('保存失败：Study site 未写入后端');
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
    if (!scopedStudyId) {
      setSystemActionStatus('请先选择一个 Study，再创建 Query');
      return;
    }
    const studyId = scopedStudyId;
    setSystemActionStatus('Query 正在创建并写入后端...');
    try {
      const dataset = await fetchWorkspaceDataset();
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

  async function refreshOperationLogs() {
    setSystemActionStatus('操作日志正在从后端刷新...');
    try {
      const logs = await fetchOperationLogs(operationLogStudyId, {
        action: operationLogActionFilter === 'all' ? undefined : operationLogActionFilter,
        entityType: operationLogEntityFilter === 'all' ? undefined : operationLogEntityFilter,
        limit: 100
      });
      setOperationLogRows(logs);
      setSystemActionStatus(`操作日志已刷新：${logs.length} 条`);
    } catch {
      setSystemActionStatus('后端不可用或当前角色无操作日志读取权限');
    }
  }

  async function exportOperationLogs() {
    setSystemActionStatus('操作日志 CSV 正在生成...');
    try {
      await downloadOperationLogsCsv(operationLogStudyId, {
        action: operationLogActionFilter === 'all' ? undefined : operationLogActionFilter,
        entityType: operationLogEntityFilter === 'all' ? undefined : operationLogEntityFilter,
        limit: 500
      });
      setSystemActionStatus('操作日志 CSV 已生成');
    } catch {
      setSystemActionStatus('后端不可用或当前角色无操作日志导出权限');
    }
  }

  function parseGlobalConfigList(value: string) {
    return Array.from(new Set(value.split(/[,\n，、/]/).map((item) => item.trim()).filter(Boolean)));
  }

  async function saveGlobalConfigDrafts() {
    const diseaseTypes = parseGlobalConfigList(globalDiseaseTypesDraft);
    const sampleTypes = parseGlobalConfigList(globalSampleTypesDraft);
    const detectionTypes = parseGlobalConfigList(globalDetectionTypesDraft);
    const quantityUnits = parseGlobalConfigList(globalQuantityUnitsDraft);
    if (!diseaseTypes.length || !sampleTypes.length || !detectionTypes.length || !quantityUnits.length) {
      setSystemActionStatus('疾病类型、样本类型、检测类型和单位类型至少各保留一项');
      return;
    }
    setSystemActionStatus('全局配置正在保存到后端数据库...');
    try {
      const saved = await updateGlobalConfiguration({ diseaseTypes, sampleTypes, detectionTypes, quantityUnits });
      setGlobalDiseaseTypesDraft(saved.diseaseTypes.join(', '));
      setGlobalSampleTypesDraft(saved.sampleTypes.join(', '));
      setGlobalDetectionTypesDraft(saved.detectionTypes.join(', '));
      setGlobalQuantityUnitsDraft(saved.quantityUnits.join(', '));
      setSystemActionStatus(`全局配置已更新：疾病类型 ${saved.diseaseTypes.length} 项，样本类型 ${saved.sampleTypes.length} 项，检测类型 ${saved.detectionTypes.length} 项，单位类型 ${saved.quantityUnits.length} 项`);
    } catch {
      saveGlobalDiseaseTypes(diseaseTypes);
      saveGlobalSampleTypes(sampleTypes);
      saveGlobalDetectionTypes(detectionTypes);
      saveGlobalQuantityUnits(quantityUnits);
      setSystemActionStatus('后端暂不可用，全局配置已暂存本地；后端恢复后请再次保存');
    }
  }

  async function resetGlobalConfigDrafts() {
    const diseaseTypes = defaultDiseaseTypes;
    const sampleTypes = defaultSampleTypes;
    const detectionTypes = defaultDetectionTypes;
    const quantityUnits = defaultQuantityUnits;
    setSystemActionStatus('全局默认配置正在写入后端数据库...');
    try {
      const saved = await updateGlobalConfiguration({ diseaseTypes, sampleTypes, detectionTypes, quantityUnits });
      setGlobalDiseaseTypesDraft(saved.diseaseTypes.join(', '));
      setGlobalSampleTypesDraft(saved.sampleTypes.join(', '));
      setGlobalDetectionTypesDraft(saved.detectionTypes.join(', '));
      setGlobalQuantityUnitsDraft(saved.quantityUnits.join(', '));
      setSystemActionStatus('全局疾病类型、样本类型、检测类型和单位类型已恢复默认配置');
    } catch {
      saveGlobalDiseaseTypes(diseaseTypes);
      saveGlobalSampleTypes(sampleTypes);
      saveGlobalDetectionTypes(detectionTypes);
      saveGlobalQuantityUnits(quantityUnits);
      setGlobalDiseaseTypesDraft(diseaseTypes.join(', '));
      setGlobalSampleTypesDraft(sampleTypes.join(', '));
      setGlobalDetectionTypesDraft(detectionTypes.join(', '));
      setGlobalQuantityUnitsDraft(quantityUnits.join(', '));
      setSystemActionStatus('后端暂不可用，默认配置已暂存本地；后端恢复后请再次保存');
    }
  }

  async function saveStudyConsentTemplate() {
    if (!scopedStudyId) {
      setSystemActionStatus('请先选择 Study，再配置知情同意模板');
      return;
    }
    const consentTemplate = consentTemplateDraft.trim();
    if (!consentTemplate) {
      setSystemActionStatus('知情同意模板不能为空');
      return;
    }
    setSystemActionStatus(`正在保存 ${scopedStudyId} 的知情同意配置...`);
    try {
      const saved = await updateStudyConfiguration(scopedStudyId, { consent_template: consentTemplate });
      setStudyConfigurationRows((rows) => [
        ...rows.filter((row) => row.study_id !== saved.study_id),
        saved
      ]);
      setConsentTemplateDraft(saved.consent_template);
      setSystemActionStatus(`已保存 ${saved.study_id} 的知情同意模板：${saved.consent_template}`);
    } catch {
      setSystemActionStatus('后端不可用，或当前角色无本 Study 知情同意配置权限');
    }
  }

  async function uploadStudyConsentTemplateFile(file: globalThis.File | undefined) {
    if (!file) return;
    if (!scopedStudyId) {
      setSystemActionStatus('请先选择 Study，再上传知情同意模板 PDF');
      return;
    }
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setSystemActionStatus('知情同意模板只支持上传已审批 PDF 文件');
      if (consentTemplateUploadInputRef.current) consentTemplateUploadInputRef.current.value = '';
      return;
    }
    setSystemActionStatus(`正在上传 ${scopedStudyId} 的知情同意模板 PDF：${file.name}`);
    try {
      const uploaded = await uploadFileToBackend(file, {
        category: 'consent',
        studyId: scopedStudyId,
        isDeidentified: false
      });
      setConsentTemplateFileRows((rows) => [uploaded, ...rows.filter((row) => row.id !== uploaded.id)]);
      setSystemActionStatus(`已上传 ${scopedStudyId} 的知情同意模板 PDF：${uploaded.original_filename}`);
    } catch {
      setSystemActionStatus('知情同意模板 PDF 上传失败；请确认后端连接、当前 Study 权限和文件扫描状态');
    } finally {
      if (consentTemplateUploadInputRef.current) consentTemplateUploadInputRef.current.value = '';
    }
  }

  async function openStudyConsentTemplateFile() {
    if (!currentConsentTemplateFile) {
      setSystemActionStatus('当前 Study 尚未上传已审批知情同意模板 PDF');
      return;
    }
    setSystemActionStatus(`正在打开知情同意模板 PDF：${currentConsentTemplateFile.original_filename}`);
    try {
      await openFileFromBackend(currentConsentTemplateFile);
      setSystemActionStatus(`已打开知情同意模板 PDF：${currentConsentTemplateFile.original_filename}`);
    } catch {
      setSystemActionStatus('知情同意模板 PDF 打开失败；请确认文件权限、扫描状态和后端连接');
    }
  }

  function renderStudyConsentConfiguration(compact = false) {
    const selectedTemplateControlValue = selectedConsentTemplateCatalogItem ? selectedConsentTemplateCatalogItem.id : customConsentTemplateOption;
    const sourceDetail = explicitConsentTemplate
      ? `${t('模板编号')}: ${explicitConsentTemplate}`
      : effectiveConsentTemplateId
        ? `${t('疾病领域')}: ${scopedStudyDiseaseArea || '-'} · ${t('建议保存为当前 Study 配置')}`
        : t('当前 Study 尚未匹配到可用模板，请选择或填写自定义模板。');
    return (
      <div className={`system-create-form system-consent-config${compact ? ' system-consent-config--compact' : ''}`}>
        {compact ? (
          <div className="system-consent-config__heading">
            <strong>{t('Study 配置 / 知情同意模板')}</strong>
            <span>{t('作为当前 Study 的 CRF 与字段配置项保存，不能影响其他 Study。')}</span>
          </div>
        ) : null}
        <div className="system-consent-config__effective">
          <span>{t('当前生效模板')}</span>
          <strong>{t(effectiveConsentTitle)}</strong>
          <small>{t('模板编号')}: {effectiveConsentTemplateId || '-'}</small>
          <small>{t('来源')}: {t(consentTemplateSourceLabel)} · {sourceDetail}</small>
          <span className={`status-pill status-pill--${explicitConsentTemplate ? 'success' : effectiveConsentTemplateId ? 'warning' : 'danger'}`}>
            {t(consentTemplateStatusLabel)}
          </span>
        </div>
        <div className="system-consent-config__summary">
          <span>{t('当前 Study')}</span>
          <strong>{scopedStudyId || '-'}</strong>
          <small>{t(scopedStudySummary?.name ?? '未选择 Study')}</small>
        </div>
        <div className="system-consent-config__summary">
          <span>{t('疾病领域')}</span>
          <strong>{scopedStudyDiseaseArea || '-'}</strong>
          <small>{t('仅保存当前 Study 的配置，不影响其他 Study')}</small>
        </div>
        <div className="system-consent-config__summary">
          <span>{t('当前 CRF')}</span>
          <strong>{scopedStudyConfiguration?.active_crf_version_id || '-'}</strong>
          <small>{t('知情同意与当前 Study 配置总表关联')}</small>
        </div>
        <div className="system-consent-config__binding">
          <label>
            <span>{t('模板选择')}</span>
            <select
              value={selectedTemplateControlValue}
              disabled={!scopedStudyId}
              onChange={(event) => {
                const value = event.target.value;
                setConsentTemplateDraft(value === customConsentTemplateOption ? '' : value);
              }}
            >
              {consentTemplateCatalog.map((template) => (
                <option value={template.id} key={template.id}>{t(template.label)}</option>
              ))}
              <option value={customConsentTemplateOption}>{t('自定义模板编号 / 说明')}</option>
            </select>
          </label>
          <label>
            <span>{t('模板编号或说明')}</span>
            <textarea
              value={consentTemplateDraft}
              disabled={!scopedStudyId}
              onChange={(event) => setConsentTemplateDraft(event.target.value)}
              placeholder={t('请输入当前 Study 的知情同意模板编号或说明')}
            />
          </label>
        </div>
        <div className="system-consent-config__preview" aria-label={t('知情同意模板预览')}>
          <span>{t('预览摘要')}</span>
          <strong>{t(selectedConsentPreviewTitle)}</strong>
          <small>{t(selectedConsentTemplateCatalogItem?.description ?? '自定义模板将按当前编号或说明在知情同意页展示。')}</small>
          <div>
            {selectedConsentPreviewSections.slice(0, 4).map((section) => (
              <span key={`${selectedConsentPreviewTitle}-${section.title}`}>{t(section.title)}</span>
            ))}
          </div>
        </div>
        <div className="system-consent-config__preview" aria-label={t('已审批 PDF 模板')}>
          <span>{t('已审批 PDF 模板')}</span>
          <strong>{currentConsentTemplateFile?.original_filename ?? t('尚未上传')}</strong>
          <small>
            {currentConsentTemplateFile
              ? `${t('上传时间')}: ${currentConsentTemplateFile.uploaded_at.slice(0, 16).replace('T', ' ')} · ${currentConsentTemplateFile.scan_status ?? '-'}`
              : t('上传伦理或项目组已审批的 PDF 知情同意模板，患者页仍按患者上传已签署文件归档。')}
          </small>
          <div>
            <span>{scopedStudyId || '-'}</span>
            <span>{t('仅绑定当前 Study')}</span>
          </div>
        </div>
        <input
          ref={consentTemplateUploadInputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(event) => void uploadStudyConsentTemplateFile(event.target.files?.[0])}
        />
        <div className="system-create-form__actions system-consent-config__actions">
          <button
            className="module-link-button"
            type="button"
            disabled={!scopedStudyId}
            onClick={() => setConsentTemplateDraft(explicitConsentTemplate || effectiveConsentTemplateId)}
          >
            {t('恢复当前配置')}
          </button>
          <a className="module-link-button" href="?module=知情同意&locale=zh-CN#informed-consent">
            {t('打开知情同意页预览')}
          </a>
          <button
            className="module-link-button"
            type="button"
            disabled={!scopedStudyId}
            onClick={() => consentTemplateUploadInputRef.current?.click()}
          >
            {t('上传已审批 PDF')}
          </button>
          <button
            className="module-link-button"
            type="button"
            disabled={!currentConsentTemplateFile}
            onClick={() => void openStudyConsentTemplateFile()}
          >
            {t('查看已审批 PDF')}
          </button>
          <button
            className="module-primary-button"
            type="button"
            disabled={!scopedStudyId || !consentTemplateDraft.trim()}
            onClick={() => void saveStudyConsentTemplate()}
          >
            {t(hasConsentTemplateDraftChanges ? '保存为当前 Study 配置' : '保存知情同意配置')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="content workspace-page system-management-page">
      <section className="system-management-hero module-card">
        <div className="system-management-title">
          <span>System Management</span>
          <h2>{t(isGlobalManagement ? 'Study 系统管理' : '系统管理')}</h2>
          <p>{t(isGlobalManagement ? 'LZ 平台层管理 Study、用户、Study 绑定和跨 Study 业务权限。' : '仅管理当前 Study 的成员、Study 角色、权限策略和 CRF 版本。')}</p>
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
	        </header>
        <div className="system-summary-grid">
          <div>
            <span>Total Accounts</span>
            <strong>{accountSummaryRows.length}</strong>
          </div>
          {isGlobalManagement ? (
            <div>
              <span>Global Roles</span>
              <strong>{accountSummaryRows.filter((account) => (account.assignedRoles ?? [account]).some((role) => role.role.startsWith('LZ_'))).length}</strong>
            </div>
          ) : null}
          <div>
            <span>Study Roles</span>
            <strong>{accountSummaryRows.filter((account) => (account.assignedRoles ?? [account]).some((role) => role.role.startsWith('STUDY_'))).length}</strong>
          </div>
          {!isGlobalManagement ? (
            <div>
              <span>Study Admins</span>
              <strong>{accountSummaryRows.filter((account) => (account.assignedRoles ?? [account]).some((role) => role.role === 'STUDY_CONFIG_ADMIN')).length}</strong>
            </div>
          ) : null}
          <div>
            <span>{isGlobalManagement ? 'Studies' : 'Current Study'}</span>
            <strong>{isGlobalManagement ? studyRows.filter((study) => study.status !== 'deleted').length : scopedStudyId || '-'}</strong>
          </div>
        </div>
        <div className="system-global-actions">
          <Icon name="alerts" />
          <span>{isGlobalManagement ? 'LZ Global Layer' : 'Study Scope'}</span>
          <strong>{t(isGlobalManagement ? 'LZ 平台跨 Study 汇总业务数据，读写仍逐个校验 study_id。' : 'Study 成员、CRF 版本、导出和权限策略变更均按当前 Study 校验。')}</strong>
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
              <span>{t('维护 Study、用户、平台角色和每个 Study 的角色绑定。')}</span>
            </div>
            <button className="module-primary-button" type="button" onClick={openSystemStudyCreate}>
              <Icon name="studies" />{t('填写 Study 信息')}<br /><span>{t('先填写后创建')}</span>
            </button>
          </header>
          {studyCreateDraft ? (
            <div className="system-create-form" aria-label={t(isStudyDraftEdit ? '编辑 Study 表单' : '新建 Study 表单')}>
              <label>
                <span>Study ID</span>
                <input required readOnly={isStudyDraftEdit} value={studyCreateDraft.id} onChange={(event) => setStudyCreateDraft({ ...studyCreateDraft, id: event.target.value })} placeholder="LZ-RWS-001" />
              </label>
              <label>
                <span>Study Code</span>
                <input readOnly={!isStudyDraftEdit} value={studyCreateDraft.code || suggestedStudyCode} onChange={(event) => setStudyCreateDraft({ ...studyCreateDraft, code: event.target.value })} placeholder="01" />
              </label>
		              <label>
		                <span>{t('Study 名称')}</span>
		                <input required value={studyCreateDraft.name} onChange={(event) => setStudyCreateDraft({ ...studyCreateDraft, name: event.target.value })} placeholder={t('请输入 Study 名称')} />
		              </label>
	              <label>
	                <span>{t('Leading PI 信息')}</span>
	                <input value={studyCreateDraft.leading_pi_info} onChange={(event) => setStudyCreateDraft({ ...studyCreateDraft, leading_pi_info: event.target.value })} placeholder={t('请输入 leading PI 姓名/单位/联系方式')} />
	              </label>
		              <label>
		                <span>{t('适应症 / 疾病领域')}</span>
		                <input required value={studyCreateDraft.indication} onChange={(event) => setStudyCreateDraft({ ...studyCreateDraft, indication: event.target.value })} placeholder={t('请输入适应症或疾病领域')} />
		              </label>
              <label>
                <span>Phase</span>
                <input value={studyCreateDraft.phase} onChange={(event) => setStudyCreateDraft({ ...studyCreateDraft, phase: event.target.value })} placeholder="RWD" />
              </label>
              <label>
                <span>{t('状态')}</span>
                <select value={studyCreateDraft.status} onChange={(event) => setStudyCreateDraft({ ...studyCreateDraft, status: event.target.value as ApiStudy['status'] })}>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  {isStudyDraftEdit ? <option value="terminated">terminated</option> : null}
                </select>
              </label>
	              <label>
	                <span>Owner Org</span>
	                <input value={studyCreateDraft.owner_org} onChange={(event) => setStudyCreateDraft({ ...studyCreateDraft, owner_org: event.target.value })} placeholder="LinZight" />
	              </label>
	              <label>
	                <span>{t('系统管理员')}</span>
	                <input value={studyCreateDraft.system_admin} onChange={(event) => setStudyCreateDraft({ ...studyCreateDraft, system_admin: event.target.value })} placeholder={t('请输入系统管理员姓名或邮箱')} />
		              </label>
	              <div className="system-create-form__actions">
	                <button className="module-primary-button" type="button" disabled={!isStudyCreateReady} title={isStudyCreateReady ? undefined : t('请先填写必填 Study 信息')} onClick={() => void submitSystemStudyCreate()}>{t(isStudyDraftEdit ? '提交修改 Study' : '提交创建 Study')}</button>
	                <button className="module-link-button" type="button" onClick={closeSystemStudyDraft}>{t('取消')}</button>
	              </div>
            </div>
          ) : null}
          <div className="module-table-wrap">
            <table className="module-table system-study-registry-table">
              <thead>
	                <tr>
	                  <th>Study ID</th>
	                  <th>Study Code</th>
	                  <th>{t('Study 名称')}</th>
		                  <th>{t('Leading PI 信息')}</th>
		                  <th>{t('状态')}</th>
		                  <th>{t('系统管理员')}</th>
		                  <th>{t('Actions')}</th>
		                </tr>
		              </thead>
		              <tbody>
		                {!studyRegistryRows.length ? (
		                  <tr>
		                    <td colSpan={7}>{t('暂无 Study，请点击新建 Study 创建第一个研究。')}</td>
		                  </tr>
		                ) : null}
		                {studyRegistryRows.map((study) => (
		                  <tr key={study.studyId}>
		                    <td><span className="status-pill status-pill--info">{study.studyId}</span></td>
		                    <td><span className="status-pill status-pill--info">{formatStudyCode(study.code)}</span></td>
		                    <td>{t(study.name)}</td>
		                    <td>{study.leadingPiInfo}</td>
		                    <td><span className={`status-pill status-pill--${study.status === 'active' ? 'success' : study.status === 'draft' ? 'warning' : 'danger'}`}>{study.status}</span></td>
		                    <td>{study.systemAdmin}</td>
		                    <td>
	                      <div className="module-table-actions">
	                        <button className="module-link-button" type="button" disabled={study.status === 'deleted'} onClick={() => openSystemStudyEdit(study.studyId)}>{t('Edit')}</button>
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

      {isGlobalManagement ? (
        <section className="module-card system-global-config-card">
          <header className="module-card__header">
            <div>
              <h2>{t('Global Configuration | 全局配置')}</h2>
              <span>{t('维护患者疾病类型、样本类型、检测类型和单位类型字典，供患者队列与样本及检测下拉框使用。')}</span>
            </div>
            <div className="module-table-actions">
              <button className="module-link-button" type="button" onClick={() => void resetGlobalConfigDrafts()}>{t('恢复默认')}</button>
              <button className="module-primary-button" type="button" onClick={() => void saveGlobalConfigDrafts()}>{t('保存配置')}</button>
            </div>
          </header>
          <div className="system-create-form system-create-form--global-config">
            <label>
              <span>{t('疾病类型')}</span>
              <textarea value={globalDiseaseTypesDraft} onChange={(event) => setGlobalDiseaseTypesDraft(event.target.value)} rows={3} />
            </label>
            <label>
              <span>{t('样本类型')}</span>
              <textarea value={globalSampleTypesDraft} onChange={(event) => setGlobalSampleTypesDraft(event.target.value)} rows={3} />
            </label>
            <label>
              <span>{t('检测类型')}</span>
              <textarea value={globalDetectionTypesDraft} onChange={(event) => setGlobalDetectionTypesDraft(event.target.value)} rows={3} />
            </label>
            <label>
              <span>{t('单位类型')}</span>
              <textarea value={globalQuantityUnitsDraft} onChange={(event) => setGlobalQuantityUnitsDraft(event.target.value)} rows={3} />
            </label>
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
	              <button className="module-primary-button" type="button" onClick={openSystemAccountCreate}><Icon name="userPlus" />Create Account<br /><span>{t('新增账户')}</span></button>
	            </header>
            {accountCreateDraft ? (
              <div className="system-create-form" aria-label={t('新建用户表单')}>
                <label>
                  <span>{t('姓名')}</span>
                  <input value={accountCreateDraft.displayName} onChange={(event) => setAccountCreateDraft({ ...accountCreateDraft, displayName: event.target.value })} placeholder={t('请输入姓名')} />
                </label>
                <label>
                  <span>{t('账号邮箱')}</span>
                  <input value={accountCreateDraft.username} onChange={(event) => setAccountCreateDraft({ ...accountCreateDraft, username: event.target.value })} placeholder="name@linzight.com" />
                </label>
                <label>
                  <span>{t('角色')}</span>
                  <select value={accountCreateDraft.role} onChange={(event) => {
                    const role = event.target.value as UserRole;
                    setAccountCreateDraft({
                      ...accountCreateDraft,
                      role,
                      platformStudyScopeIds: role === 'LZ_ADMIN'
                        ? availableSystemStudies
                        : role.startsWith('LZ_')
                          ? (accountCreateDraft.platformStudyScopeIds.length ? accountCreateDraft.platformStudyScopeIds : [accountCreateDraft.studyId])
                          : []
                    });
                  }}>
                    {(isGlobalManagement && currentUser?.role === 'LZ_ADMIN' ? creatableGlobalRoles : creatableStudyRoles).map((role) => (
                      <option value={role} key={role}>{role} | {t(roleLabels[role])}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t('密码')}</span>
                  <input type="password" value={accountCreateDraft.password} onChange={(event) => setAccountCreateDraft({ ...accountCreateDraft, password: event.target.value })} placeholder={t('请输入初始密码')} />
                </label>
                {accountCreateDraft.role.startsWith('LZ_') ? (
                  <label>
                    <span>{t('平台 Study Scope')}</span>
                    {accountCreateDraft.role === 'LZ_ADMIN' ? (
                      <select value="全部 Study" disabled>
                        <option value="全部 Study">{t('全部 Study')}</option>
                      </select>
                    ) : (
                      <select
                        multiple
                        value={accountCreateDraft.platformStudyScopeIds}
                        onChange={(event) => setAccountCreateDraft({
                          ...accountCreateDraft,
                          platformStudyScopeIds: Array.from(event.target.selectedOptions).map((option) => option.value)
                        })}
                      >
                        {availableSystemStudies.map((studyId) => (
                          <option value={studyId} key={studyId}>{studyId}</option>
                        ))}
                      </select>
                    )}
                  </label>
                ) : (
                  <label>
                    <span>Study ID</span>
                    <select value={accountCreateDraft.studyId} onChange={(event) => setAccountCreateDraft({ ...accountCreateDraft, studyId: event.target.value })}>
                      {availableSystemStudies.map((studyId) => (
                        <option value={studyId} key={studyId}>{studyId}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  <span>{t('账户状态')}</span>
                  <select value={accountCreateDraft.status} onChange={(event) => setAccountCreateDraft({ ...accountCreateDraft, status: event.target.value as AccountCreateDraft['status'] })}>
                    <option value="active">active</option>
                    <option value="disabled">disabled</option>
                  </select>
                </label>
                {!accountCreateDraft.role.startsWith('LZ_') ? (
                  <label>
                    <span>{t('Study 成员状态')}</span>
                    <select value={accountCreateDraft.memberStatus} onChange={(event) => setAccountCreateDraft({ ...accountCreateDraft, memberStatus: event.target.value as AccountCreateDraft['memberStatus'] })}>
                      <option value="pending">pending</option>
                      <option value="active">active</option>
                      <option value="disabled">disabled</option>
                    </select>
                  </label>
                ) : null}
                <div className="system-create-form__actions">
                  <button className="module-primary-button" type="button" onClick={() => void submitSystemAccountCreate()}>{t('提交新建')}</button>
                  <button className="module-link-button" type="button" onClick={() => setAccountCreateDraft(null)}>{t('取消')}</button>
                </div>
              </div>
            ) : null}
            {accountEditDraft ? (
              <div className="system-create-form system-create-form--edit" aria-label={t('编辑用户表单')}>
                <label>
                  <span>{t('姓名')}</span>
                  <input value={accountEditDraft.displayName} onChange={(event) => patchAccountEditDraft({ displayName: event.target.value })} placeholder={t('请输入姓名')} />
                </label>
                <label>
                  <span>{t('账号邮箱')}</span>
                  <input value={accountEditDraft.originalEmail} disabled />
                </label>
                <label>
                  <span>{t(isGlobalManagement ? '账号基础角色' : 'Study Role')}</span>
                  <select value={accountEditDraft.accountRole} onChange={(event) => {
                    const role = event.target.value as UserRole;
                    patchAccountEditDraft({
                      accountRole: role,
                      platformStudyScopeIds: role === 'LZ_ADMIN'
                        ? availableSystemStudies
                        : accountEditDraft.platformStudyScopeIds.length
                          ? accountEditDraft.platformStudyScopeIds
                          : availableSystemStudies.slice(0, 1),
                      studyBindings: role.startsWith('LZ_') || accountEditDraft.studyBindings.length
                        ? accountEditDraft.studyBindings
                        : [{ studyId: scopedStudyId || availableSystemStudies[0] || '', role: role as StudyRole, status: 'active' }]
                    });
                  }}>
                    {editableRoleOptions.map((role) => (
                      <option value={role} key={role}>{role} | {t(roleLabels[role])}</option>
                    ))}
                  </select>
                </label>
                {isGlobalManagement && accountEditDraft.accountRole.startsWith('LZ_') ? (
                  <label>
                    <span>{t('平台 Study Scope')}</span>
                  {accountEditDraft.accountRole === 'LZ_ADMIN' ? (
                    <select value="全部 Study" disabled>
                      <option value="全部 Study">{t('全部 Study')}</option>
                    </select>
                  ) : (
                    <select
                      multiple
                      value={accountEditDraft.platformStudyScopeIds}
                      onChange={(event) => patchAccountEditDraft({
                        platformStudyScopeIds: Array.from(event.target.selectedOptions).map((option) => option.value)
                      })}
                    >
                      {availableSystemStudies.map((studyId) => (
                        <option value={studyId} key={studyId}>{studyId}</option>
                      ))}
                    </select>
                  )}
                  </label>
                ) : null}
                <label>
                  <span>{t('账户状态')}</span>
                  <select value={accountEditDraft.status} onChange={(event) => patchAccountEditDraft({ status: event.target.value as AccountEditDraft['status'] })}>
                    <option value="Active">{t('Active')}</option>
                    <option value="Pending">{t('Pending')}</option>
                    <option value="Disabled">{t('Disabled')}</option>
                  </select>
                </label>
                <label>
                  <span>{t('修改密码')}</span>
                  <input type="password" value={accountEditDraft.password} onChange={(event) => patchAccountEditDraft({ password: event.target.value })} placeholder={t('留空则不修改密码')} />
                </label>
                <div className="system-study-bindings">
                  <div className="system-study-bindings__header">
                    <div>
                      <strong>{t('Study 角色绑定')}</strong>
                      <span>{t(isGlobalManagement ? '一个用户可以绑定多个 Study，每个 Study 独立选择角色' : '当前页面只调整本 Study 内角色')}</span>
                    </div>
                    {isGlobalManagement ? (
                      <button className="module-link-button module-link-button--primary" type="button" onClick={addAccountStudyBinding}>{t('添加 Study 绑定')}</button>
                    ) : null}
                  </div>
                  {accountEditDraft.studyBindings.length ? (
                    <div className="system-study-binding-list">
                      {accountEditDraft.studyBindings.map((binding, bindingIndex) => (
                        <div className="system-study-binding-row" key={`${binding.studyId}-${bindingIndex}`}>
                          <label>
                            <span>Study Scope</span>
                            <select value={binding.studyId} onChange={(event) => patchAccountStudyBinding(bindingIndex, { studyId: event.target.value })}>
                              {availableSystemStudies.map((studyId) => (
                                <option value={studyId} key={studyId}>{studyId}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Study Role</span>
                            <select value={binding.role} onChange={(event) => patchAccountStudyBinding(bindingIndex, { role: event.target.value as StudyRole })}>
                              {editableStudyBindingRoles.map((role) => (
                                <option value={role} key={role}>{studyBindingRoleLabels[role]} | {t(roleLabels[role])}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{t('Study 成员状态')}</span>
                            <select value={binding.status} onChange={(event) => patchAccountStudyBinding(bindingIndex, { status: event.target.value as AccountStudyBindingDraft['status'] })}>
                              <option value="active">active</option>
                              <option value="pending">pending</option>
                              <option value="disabled">disabled</option>
                            </select>
                          </label>
                          <button className="module-link-button module-link-button--danger" type="button" onClick={() => removeAccountStudyBinding(bindingIndex)}>{t('移除')}</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="system-study-bindings__empty">{t('暂无 Study 绑定')}</span>
                  )}
                </div>
                <div className="system-role-permissions">
                  <strong>{t('具体权限')}</strong>
                  <span>{t('按每个 Study 绑定角色匹配权限策略矩阵')}</span>
                  <ul>
                    {accountEditDraft.studyBindings.length ? accountEditDraft.studyBindings.flatMap((binding) => (
                      (permissionsByRole[binding.role] ?? []).map((permission) => (
                        <li key={`${binding.studyId}-${binding.role}-${permission}`}>
                          {binding.studyId} / {studyBindingRoleLabels[binding.role]}: {t(permission)}
                        </li>
                      ))
                    )) : accountEditDraft.accountRole.startsWith('LZ_') && (permissionsByRole[accountEditDraft.accountRole] ?? []).length ? (permissionsByRole[accountEditDraft.accountRole] ?? []).map((permission) => (
                      <li key={`${accountEditDraft.accountRole}-${permission}`}>{accountEditDraft.accountRole}: {t(permission)}</li>
                    )) : (
                      <li>{t('当前角色没有矩阵授权项')}</li>
                    )}
                  </ul>
                </div>
                <div className="system-create-form__actions">
                  <button className="module-primary-button" type="button" onClick={() => void saveSystemAccountEdit()}>{t('保存调整')}</button>
                  <button className="module-link-button" type="button" onClick={() => setAccountEditDraft(null)}>{t('取消')}</button>
                </div>
              </div>
            ) : null}
            {accountPasswordDraft ? (
              <div className="system-create-form system-password-form" aria-label={t('密码修改表单')}>
                <div className="system-password-form__title">
                  <span>{t('修改密码')}</span>
                  <strong>{accountPasswordDraft.displayName} · {accountPasswordDraft.email}</strong>
                </div>
                <label>
                  <span>{t('新密码')}</span>
                  <input
                    type="password"
                    value={accountPasswordDraft.password}
                    onChange={(event) => setAccountPasswordDraft({ ...accountPasswordDraft, password: event.target.value })}
                    placeholder={t('至少 8 位，并包含字母和数字')}
                    autoComplete="new-password"
                  />
                </label>
                <div className="system-password-form__hint">
                  {t('新密码至少 8 位，且包含字母和数字。')}
                </div>
                <div className="system-create-form__actions">
                  <button className="module-primary-button" type="button" onClick={() => void saveSystemAccountPassword()}>{t('保存密码')}</button>
                  <button className="module-link-button" type="button" onClick={() => setAccountPasswordDraft(null)}>{t('取消')}</button>
                </div>
              </div>
            ) : null}
            <div className="module-table-wrap">
              <table className="module-table system-account-table">
                <thead>
	                  <tr>
	                    <th>{t('姓名')}</th>
	                    <th>{t('账号邮箱')}</th>
	                    <th>{t('对应 StudyID')}</th>
	                    <th>{t('角色')}</th>
	                    <th>Status</th>
	                    <th>Last Login</th>
	                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
	                  {pagedAccounts.map((account) => {
	                    const isDeletedAccount = account.status === 'Deleted';
	                    const canToggleAccount = Boolean(
	                      (account.userId ?? userIdForEmail(account.email)) &&
	                        !isDeletedAccount &&
	                        (currentUser?.role === 'LZ_ADMIN' || (scopedStudyId && account.role.startsWith('STUDY_')))
	                    );
	                    const canDeleteAccount = Boolean(
	                      currentUser?.role === 'LZ_ADMIN' &&
	                        !isDeletedAccount &&
	                        (account.userId ?? userIdForEmail(account.email)) &&
	                        (account.userId ?? userIdForEmail(account.email)) !== currentUser.id
	                    );
	                    return (
                    <tr key={`${account.userId ?? account.email}-${account.name}`}>
	                      <td>{t(account.name)}</td>
	                      <td>{account.email}</td>
	                      <td>
	                        <div className="system-account-chip-list system-account-chip-list--scope">
	                          {(account.studyScopes?.length ? account.studyScopes : [account.studyScope]).map((scope) => (
	                            <span className="status-pill status-pill--info" key={`${account.userId ?? account.email}-${scope}`}>{t(scope)}</span>
	                          ))}
	                        </div>
	                      </td>
	                      <td>
	                        <div className="system-account-chip-list">
	                          {(account.assignedRoles?.length ? account.assignedRoles : [{ role: account.role, roleLabel: account.roleLabel, studyScope: account.studyScope }]).map((role) => (
	                            <span className={`system-role-pill system-role-pill--${roleTone[role.role]}`} key={`${role.role}-${role.studyScope}`}>
                              {role.role} | {t(role.roleLabel)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td><span className={`status-pill status-pill--${systemStatusTone[account.status]}`}>{t(account.status)}</span></td>
                      <td>{account.lastLogin}</td>
		                      <td>
		                        <div className="module-table-actions">
		                          <button className="module-link-button" type="button" disabled={isDeletedAccount} onClick={() => openSystemAccountEdit(account)}>{t('Edit')}</button>
		                          <button className="module-link-button module-link-button--primary" type="button" disabled={isDeletedAccount} onClick={() => openSystemAccountPasswordReset(account)}>{t('修改密码')}</button>
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
		                            disabled={isDeletedAccount || !scopedStudyId || !(account.userId ?? userIdForEmail(account.email))}
		                            title={t('设置为当前 Study 的系统管理员')}
		                            onClick={() => void makeStudySystemAdmin(account)}
	                          >
	                            {t('Set Admin')}
	                          </button>
	                          {isGlobalManagement ? (
		                            <button
		                              className="module-link-button"
		                              type="button"
		                              disabled={isDeletedAccount || currentUser?.role !== 'LZ_ADMIN' || !account.role.startsWith('LZ_') || account.role === 'LZ_ADMIN'}
		                              title={t('授予或移除当前 Study 的平台角色授权')}
		                              onClick={() => void togglePlatformStudyScope(account)}
		                            >
		                              {t('Scope')}
		                            </button>
		                          ) : null}
		                          <button
		                            className="module-link-button module-link-button--danger"
		                            type="button"
		                            disabled={!canDeleteAccount}
		                            title={canDeleteAccount ? t('软删除账号并保留审计记录') : t('当前账户不能删除或当前角色无权限')}
		                            onClick={() => void deleteSystemAccount(account)}
		                          >
		                            {t('Delete')}
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
            {renderStudyConsentConfiguration(true)}
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
                <span>{t(isGlobalManagement ? '平台级角色跨 Study；研究级角色只在所属 Study 内生效' : '当前 Study 仅显示 Study 角色权限，不显示 LZ 平台级角色')}</span>
              </div>
            </header>
            <div className="module-table-wrap system-permission-wrap">
              <table className="module-table system-permission-table">
                <thead>
                  <tr>
                    <th>Permission</th>
                    {visiblePermissionColumns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiblePermissionMatrixRows.map((row) => (
                    <tr key={row.action}>
                      <td>{t(row.action)}</td>
                      {visiblePermissionColumns.map((column) => (
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

          <section className="module-card system-operation-log-card">
            <header className="module-card__header">
              <div>
                <h2>{t('Operation Logs | 操作日志')}</h2>
                <span>{t('后端记录所有核心增删改、审批、导出、文件和登录操作。')}</span>
              </div>
              <div className="module-table-actions">
                <button className="module-link-button" type="button" onClick={() => void refreshOperationLogs()}><Icon name="clock" />{t('刷新')}</button>
                <button className="module-link-button module-link-button--primary" type="button" onClick={() => void exportOperationLogs()}><Icon name="file" />CSV</button>
              </div>
            </header>
            <div className="system-query-summary">
              <span className="status-pill status-pill--info">{t('总计')}: {operationLogCounts.total}</span>
              <span className="status-pill status-pill--success">CREATE: {operationLogCounts.creates}</span>
              <span className="status-pill status-pill--warning">UPDATE/UPSERT: {operationLogCounts.updates}</span>
              <span className="status-pill status-pill--danger">DELETE: {operationLogCounts.deletes}</span>
            </div>
            <div className="system-query-summary" aria-label={t('操作日志筛选')}>
              <label className="system-inline-filter">
                <span>Action</span>
                <select value={operationLogActionFilter} onChange={(event) => setOperationLogActionFilter(event.target.value)}>
                  <option value="all">{t('全部')}</option>
                  {operationLogActionOptions.map((action) => <option value={action} key={action}>{action}</option>)}
                </select>
              </label>
              <label className="system-inline-filter">
                <span>Entity</span>
                <select value={operationLogEntityFilter} onChange={(event) => setOperationLogEntityFilter(event.target.value)}>
                  <option value="all">{t('全部')}</option>
                  {operationLogEntityOptions.map((entity) => <option value={entity} key={entity}>{entity}</option>)}
                </select>
              </label>
              <small>{t(operationLogStudyId ? '当前仅显示本 Study scope 内的操作日志。' : 'LZ Admin 可查看全局日志；Study 用户只能查看所属 Study 日志。')}</small>
            </div>
            <div className="module-table-wrap">
              <table className="module-table system-operation-log-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Study</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOperationLogs.length ? visibleOperationLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <strong>{log.created_at.slice(0, 10)}</strong>
                        <span>{log.created_at.slice(11, 19)}</span>
                      </td>
                      <td>{log.study_id ? <span className="status-pill status-pill--info">{log.study_id}</span> : '-'}</td>
                      <td>
                        <strong>{log.actor_role ?? '-'}</strong>
                        <span>{log.actor_id ?? '-'}</span>
                      </td>
                      <td><span className={`status-pill status-pill--${log.action === 'DELETE' ? 'danger' : log.action === 'CREATE' ? 'success' : 'warning'}`}>{log.action}</span></td>
                      <td>
                        <strong>{log.entity_type}</strong>
                        <span>{log.entity_id}</span>
                      </td>
                      <td>
                        {log.diff.length ? log.diff.slice(0, 3).map((item) => <span key={`${log.id}-${item.field}`}>{item.field}</span>) : <span>{t('无字段差异')}</span>}
                        {log.diff.length > 3 ? <small>+{log.diff.length - 3}</small> : null}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6}>{t('暂无操作日志')}</td>
                    </tr>
                  )}
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

const exportWriteRoles = new Set<UserRole>(['LZ_ADMIN', 'LZ_CRC', 'LZ_DATA_MANAGER', 'STUDY_CONFIG_ADMIN', 'STUDY_DATA_MANAGER']);
const qualityWriteRoles = new Set<UserRole>(['LZ_ADMIN', 'LZ_CRC', 'LZ_DATA_MANAGER', 'STUDY_CONFIG_ADMIN', 'STUDY_DATA_MANAGER']);

function canCreateExports(user?: { role: UserRole } | null) {
  return Boolean(user && exportWriteRoles.has(user.role));
}

function canRunQualityValidation(user?: { role: UserRole } | null) {
  return Boolean(user && qualityWriteRoles.has(user.role));
}

function exportStudyOptionsForUser(user?: AuthenticatedUser | null, runtimeStudyIds: string[] = []) {
  const scopedStudyId = getCurrentScopedStudyId();
  if (scopedStudyId) return [scopedStudyId];
  if (user?.studyScope?.scopeType === 'all_studies') return runtimeStudyIds.length ? runtimeStudyIds : systemStudyOptions;
  return user?.studyScope?.studyIds?.length ? user.studyScope.studyIds : [];
}

export function ReportsPage({ currentUser }: { currentUser?: AuthenticatedUser | null } = {}) {
  const { t } = useI18n();
  const [runtimeExportStudyIds, setRuntimeExportStudyIds] = useState<string[]>([]);
  const exportStudyOptions = useMemo(() => exportStudyOptionsForUser(currentUser, runtimeExportStudyIds), [currentUser, runtimeExportStudyIds]);
  const [selectedStudyId, setSelectedStudyId] = useState(exportStudyOptions[0] ?? '');
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
  const productionReportRecords = useMemo<ReportRecord[]>(() => {
    const scope = selectedStudyId ? `${selectedStudyId} Study Workspace` : '请选择 Study';
    const now = new Date().toISOString().slice(0, 10);
    return [
      { id: 'RPT-PATIENT-CSV', name: '患者主数据导出', type: 'CSV', scope, status: '可导出', updatedAt: now },
      { id: 'RPT-QUALITY-CSV', name: '质控问题导出', type: 'CSV', scope, status: '可导出', updatedAt: now },
      { id: 'RPT-ARCHIVE-CSV', name: '归档状态导出', type: 'CSV', scope, status: '可导出', updatedAt: now }
    ];
  }, [selectedStudyId]);

  useEffect(() => {
    let ignore = false;
    if (getCurrentScopedStudyId()) {
      setRuntimeExportStudyIds([]);
      return undefined;
    }
    void fetchStudies()
      .then((studies) => {
        if (!ignore) setRuntimeExportStudyIds(studies.filter((study) => study.status !== 'deleted').map((study) => study.id));
      })
      .catch(() => {
        if (!ignore) setRuntimeExportStudyIds([]);
      });
    return () => {
      ignore = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!exportStudyOptions.includes(selectedStudyId)) {
      setSelectedStudyId(exportStudyOptions[0] ?? '');
    }
  }, [exportStudyOptions, selectedStudyId]);

  const refreshQualityIssueRows = useCallback(async () => {
    if (!selectedStudyId) {
      setQualityIssues([]);
      return;
    }
    try {
      setQualityIssues(await fetchQualityIssues(selectedStudyId));
    } catch {
      setQualityIssues([]);
    }
  }, [selectedStudyId]);

  useEffect(() => {
    void refreshQualityIssueRows();
  }, [refreshQualityIssueRows]);

  useEffect(() => {
    const refresh = () => void refreshQualityIssueRows();
    window.addEventListener(workspaceDataChangedEvent, refresh);
    return () => window.removeEventListener(workspaceDataChangedEvent, refresh);
  }, [refreshQualityIssueRows]);

  async function handleCreateExport(record: ReportRecord) {
    if (!exportEnabled) {
      setExportStatus('当前角色没有导出写入权限，请切换到数据管理员或 CRC');
      return;
    }
    if (!selectedStudyId) {
      setExportStatus('请先选择一个 Study，再生成导出');
      return;
    }
    setExportStatus(`${record.name} / ${selectedStudyId} 生成中...`);
    try {
      const job = await createExportJob('cohort_csv', selectedStudyId);
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
    if (!selectedStudyId) {
      setQualityStatus('请先选择一个 Study，再运行校验');
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
        <ModuleKpi icon="reports" label={t('可导出报表')} value={`${productionReportRecords.length}`} helper="CSV" />
        <ModuleKpi icon="database" label={t('授权 Study')} value={`${exportStudyOptions.length}`} helper={t('来自后端 Study API')} tone="green" />
        <ModuleKpi icon="shield" label={t('质控问题')} value={`${qualityIssues.length}`} helper={t('来自 data_quality_issues')} tone="purple" />
        <ModuleKpi icon="clock" label={t('待复核')} value={`${openCriticalIssues}`} helper={t('严重开放问题')} tone="orange" />
      </section>

      <div className="report-grid">
        {productionReportRecords.map((record) => (
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
            <span>{t('用于后端 API 联调')}</span>
          </div>
          <div className="module-header-actions">
            <label className="module-select-inline">
              <span>{t('Study ID')}</span>
              <select value={selectedStudyId} onChange={(event) => setSelectedStudyId(event.target.value)}>
                {!exportStudyOptions.length ? <option value="">{t('暂无 Study')}</option> : null}
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
          {['患者主数据', '临床 CRF', '样本台账', '多组学结果', '知情同意归档', '数据包归档'].map((item, index) => (
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
      <DetailList rows={[[t('Study ID'), exportJob?.study_id ?? selectedStudyId], [t('格式'), 'CSV'], [t('状态'), t(exportJob?.status ?? record.status)], [t('更新时间'), exportJob?.completed_at ?? record.updatedAt]]} />
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
