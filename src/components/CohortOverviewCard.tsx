import { cohortStats } from '../data/dashboard';
import { useI18n } from '../i18n/I18nProvider';
import type { CohortStat } from '../types';
import { Card } from './Card';
import { Icon } from './Icon';

export function CohortOverviewCard({
  stats = cohortStats,
  onOpenCohort = () => undefined
}: {
  stats?: CohortStat[];
  onOpenCohort?: () => void;
}) {
  const { t } = useI18n();

  return (
    <Card title="真实世界队列概览">
      <div className="cohort-list">
        {stats.map((stat) => (
          <div className="cohort-list__row" key={stat.label}>
            <div className="cohort-list__label">
              <Icon name={stat.icon} />
              <span>{t(stat.label)}</span>
            </div>
            <strong>
              {stat.value}
              {stat.drillable && <span className="row-chevron">›</span>}
            </strong>
          </div>
        ))}
      </div>
      <button className="link-button link-button--block" type="button" onClick={onOpenCohort}>{t('查看队列分析')} →</button>
    </Card>
  );
}
