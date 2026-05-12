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

  function submitPrompt() {
    const nextQuery = query.trim();
    if (!nextQuery) {
      setStatus('请输入 AI 指令');
      return;
    }
    setStatus(`AI 指令已记录：${nextQuery}`);
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
