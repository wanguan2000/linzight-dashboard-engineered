import { cohortStats } from '../data/dashboard';
import { Card } from './Card';
import { Icon } from './Icon';

export function CohortOverviewCard() {
  return (
    <Card title="真实世界队列概览">
      <div className="cohort-list">
        {cohortStats.map((stat) => (
          <div className="cohort-list__row" key={stat.label}>
            <div className="cohort-list__label">
              <Icon name={stat.icon} />
              <span>{stat.label}</span>
            </div>
            <strong>
              {stat.value}
              {stat.drillable && <span className="row-chevron">›</span>}
            </strong>
          </div>
        ))}
      </div>
      <button className="link-button link-button--block" type="button">查看队列分析 →</button>
    </Card>
  );
}
