import type { ReactNode } from 'react';
import { summaryItems } from '../data/dashboard';
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

export function SmartSummaryCard() {
  return (
    <Card
      title="智能摘要"
      action={
        <span className="summary-badge">
          <Icon name="sparkles" /> LinZight AI 生成
        </span>
      }
    >
      <div className="summary-list">
        {summaryItems.map((item) => (
          <div className="summary-list__row" key={item.text}>
            <span className={`summary-list__marker summary-list__marker--${item.theme}`}>{item.marker}</span>
            <p>{highlightText(item.text, item.emphasis)}</p>
          </div>
        ))}
      </div>
      <button className="link-button link-button--block" type="button">查看全部洞察 →</button>
    </Card>
  );
}
