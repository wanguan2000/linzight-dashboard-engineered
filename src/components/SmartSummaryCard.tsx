import type { ReactNode } from 'react';
import { summaryItems } from '../data/dashboard';
import { useI18n } from '../i18n/I18nProvider';
import { Card } from './Card';
import { Icon } from './Icon';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, emphasis: string[] = []): ReactNode[] {
  if (!emphasis.length) return [text];

  const pattern = new RegExp(`(${emphasis.map(escapeRegExp).join('|')})`, 'g');
  return text.split(pattern).filter(Boolean).map((part, index) => {
    const matched = emphasis.includes(part);
    return matched ? <strong key={`${part}-${index}`}>{part}</strong> : part;
  });
}

export function SmartSummaryCard({ onViewInsights = () => undefined }: { onViewInsights?: () => void }) {
  const { locale, t } = useI18n();

  return (
    <Card
      title="智能摘要"
      action={
        <span className="summary-badge">
          <Icon name="sparkles" /> {t('LinZight AI 生成')}
        </span>
      }
    >
      <div className="summary-list">
        {summaryItems.map((item) => (
          <div className="summary-list__row" key={item.text}>
            <span className={`summary-list__marker summary-list__marker--${item.theme}`}>{locale === 'zh-CN' ? item.marker : t(item.marker)}</span>
            <p>{locale === 'zh-CN' ? highlightText(item.text, item.emphasis) : t(item.text)}</p>
          </div>
        ))}
      </div>
      <button className="link-button link-button--block" type="button" onClick={onViewInsights}>{t('查看全部洞察')} →</button>
    </Card>
  );
}
