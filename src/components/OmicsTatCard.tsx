import { omicsStats } from '../data/dashboard';
import { Card } from './Card';

export function OmicsTatCard() {
  return (
    <Card
      title="多组学检测的统计"
      action={
        <select className="select-sm" aria-label="多组学时间范围">
          <option>本月</option>
        </select>
      }
    >
      <div className="donut-stat">
        <svg viewBox="0 0 90 90" aria-hidden="true">
          <defs>
            <linearGradient id="omicsDonutGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2dbfb8" />
              <stop offset="100%" stopColor="#4caf88" />
            </linearGradient>
          </defs>
          <circle cx="45" cy="45" r="35" className="donut-stat__track" />
          <circle cx="45" cy="45" r="35" className="donut-stat__value" stroke="url(#omicsDonutGrad)" strokeDasharray="155 220" />
        </svg>
        <div className="donut-stat__center">
          <strong>2.6</strong>
          <span>天</span>
          <small>中位 TAT</small>
        </div>
      </div>

      <div className="omics-list">
        {omicsStats.map((stat) => (
          <div className="omics-list__item" key={stat.label}>
            <span>{stat.label}</span>
            <div>
              <strong>{stat.value}</strong>
              {stat.delta && <small>{stat.delta}</small>}
            </div>
          </div>
        ))}
      </div>
      <button className="link-button link-button--block" type="button">查看实验室看板 →</button>
    </Card>
  );
}
