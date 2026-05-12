import type { CSSProperties } from 'react';
import { workflowItems } from '../data/dashboard';
import { useI18n } from '../i18n/I18nProvider';
import type { WorkflowItem } from '../types';
import { Card } from './Card';
import { Icon } from './Icon';

export function WorkflowProgressCard({ items = workflowItems, overall = 68 }: { items?: WorkflowItem[]; overall?: number }) {
  const { t } = useI18n();
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (circumference * overall) / 100;

  return (
    <Card
      title="工作流进度"
      action={
        <select className="select-sm" aria-label={t('工作流研究筛选')}>
          <option>{t('全部研究')}</option>
        </select>
      }
      className="workflow-card"
    >
      <div className="workflow-card__body">
        <div className="workflow-list">
          {items.map((item) => {
            const width = `${Math.min(item.percent, 100)}%`;
            return (
              <div className={`workflow-list__row workflow-list__row--${item.status ?? 'normal'}`} key={item.label}>
                <Icon className="workflow-list__icon" name={item.icon} />
                <span className="workflow-list__label">{t(item.label)}</span>
                <div className="workflow-list__track">
                  <div className="workflow-list__bar" style={{ '--bar-width': width } as CSSProperties} />
                </div>
                <span className="workflow-list__count">{item.count}</span>
                <strong className="workflow-list__percent">{item.percent}%</strong>
              </div>
            );
          })}
        </div>

        <div className="workflow-donut">
          <svg viewBox="0 0 110 110" aria-hidden="true">
            <defs>
              <linearGradient id="workflowDonutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2dbfb8" />
                <stop offset="100%" stopColor="#3a7bd5" />
              </linearGradient>
            </defs>
            <circle cx="55" cy="55" r="45" className="workflow-donut__track" />
            <circle cx="55" cy="55" r="45" className="workflow-donut__ghost" strokeDasharray={`${circumference * 0.68} ${circumference}`} />
            <circle
              cx="55"
              cy="55"
              r="45"
              className="workflow-donut__value"
              stroke="url(#workflowDonutGrad)"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="workflow-donut__center">
            <strong>{overall}%</strong>
            <span>{t('总体')}</span>
            <span>{t('进度')}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
