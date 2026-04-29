import { kpiMetrics } from '../data/dashboard';
import type { KpiMetric } from '../types';
import { Icon } from './Icon';

export function KpiProgress({ progress }: { progress: number }) {
  const circumference = 2 * Math.PI * 16;
  const offset = circumference - (circumference * progress) / 100;

  return (
    <svg className="kpi-progress" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="16" />
      <circle cx="20" cy="20" r="16" strokeDasharray={circumference} strokeDashoffset={offset} />
    </svg>
  );
}

function KpiCard({ metric }: { metric: KpiMetric }) {
  return (
    <article className="kpi-card">
      <div>
        <p className="kpi-card__label">{metric.label}</p>
        <strong className="kpi-card__value">{metric.value}</strong>
        <p className={`kpi-card__delta${metric.delta ? ' is-up' : ''}`}>
          {metric.delta && <span className="delta-arrow">↑</span>}
          {metric.delta && <span>{metric.delta}</span>}
          <span>{metric.helper}</span>
        </p>
      </div>
      {metric.progress ? <KpiProgress progress={metric.progress} /> : <Icon className="kpi-card__icon" name={metric.icon} size={44} />}
    </article>
  );
}

export function MetricGrid() {
  return (
    <section className="kpi-grid" aria-label="研究关键指标">
      {kpiMetrics.map((metric) => (
        <KpiCard key={metric.label} metric={metric} />
      ))}
    </section>
  );
}
