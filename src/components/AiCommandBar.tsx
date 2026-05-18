import { useState } from 'react';
import { quickPrompts } from '../data/dashboard';
import { useI18n } from '../i18n/I18nProvider';
import { Icon } from './Icon';

interface AiCommandBarProps {
  placeholder?: string;
  showPrompts?: boolean;
}

export function AiCommandBar({
  placeholder = '询问 LinZight AI，例如：“查看本季度患者入组趋势”',
  showPrompts = true
}: AiCommandBarProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  function cannedInsight(prompt: string) {
    const normalized = prompt.toLowerCase();
    if (prompt.includes('完整') || normalized.includes('missing')) {
      return '完整性洞察：优先核查 CRF 必填缺失、未完成随访和样本结果文件，当前建议从完整度低于 80% 的患者开始处理。';
    }
    if (prompt.includes('待签署') || prompt.includes('知情') || normalized.includes('consent')) {
      return '知情同意洞察：筛选待签署和已撤回记录，先处理已入组但未归档签署文件的患者，并保留上传/重签审计记录。';
    }
    if (prompt.includes('样本') || prompt.includes('检测') || normalized.includes('sample')) {
      return '样本检测洞察：优先处理已采集未送检、检测完成未归档结果文件和 QC 待确认记录，避免样本链路断点。';
    }
    if (prompt.includes('随访') || prompt.includes('风险') || normalized.includes('follow')) {
      return '随访风险洞察：请关注超窗、失访原因为空、疗效进展或 AE 未复核的患者，必要时生成 Query。';
    }
    if (prompt.includes('导出') || prompt.includes('数据分析') || normalized.includes('export')) {
      return '导出建议：先运行数据校验，确认脱敏策略、Study 范围和文件格式，再生成可下载的数据包并写入审计。';
    }
    return `AI 建议：已识别“${prompt}”，可继续选择完整性、待签署、样本未上传、随访风险或导出建议。`;
  }

  function submitPrompt() {
    const nextQuery = query.trim();
    if (!nextQuery) {
      setStatus('请输入 AI 指令');
      return;
    }
    setStatus(cannedInsight(nextQuery));
  }

  return (
    <>
      <div className="ai-bar" role="search">
        <div className="ai-bar__icon">
          <Icon name="sparkles" />
        </div>
        <input
          aria-label={t('询问 LinZight AI')}
          type="text"
          placeholder={t(placeholder)}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitPrompt();
          }}
        />
        <div className="ai-bar__actions">
          <button className="ai-bar__button ai-bar__button--send" type="button" aria-label={t('发送提示词')} onClick={submitPrompt}>
            <Icon name="send" />
          </button>
        </div>
      </div>
      {status ? <p className="ai-bar__status">{t(status)}</p> : null}

      {showPrompts && (
        <div className="quick-chips" aria-label={t('AI 提示示例')}>
          {quickPrompts.map((prompt) => (
            <button className="chip" key={prompt.label} type="button" onClick={() => setQuery(prompt.label)}>
              <Icon name={prompt.icon} />
              <span>{t(prompt.label)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
