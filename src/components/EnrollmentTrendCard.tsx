import { Card } from './Card';

export function EnrollmentTrendCard() {
  return (
    <Card
      title="入组趋势"
      action={
        <select className="select-sm" aria-label="入组时间范围">
          <option>本季度</option>
        </select>
      }
    >
      <div className="trend-card__value">2,842</div>
      <div className="trend-card__label">累计入组</div>
      <div className="trend-card__delta">↑ 较上季度 18.6%</div>

      <div className="mini-chart" aria-label="入组趋势图">
        <svg viewBox="0 0 220 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2dbfb8" />
              <stop offset="100%" stopColor="#3a7bd5" />
            </linearGradient>
            <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2dbfb8" stopOpacity=".25" />
              <stop offset="100%" stopColor="#2dbfb8" stopOpacity=".01" />
            </linearGradient>
          </defs>
          <line x1="0" y1="20" x2="220" y2="20" className="chart-grid" />
          <line x1="0" y1="40" x2="220" y2="40" className="chart-grid" />
          <line x1="0" y1="60" x2="220" y2="60" className="chart-grid" />
          <text x="0" y="22" className="chart-label">3K</text>
          <text x="0" y="42" className="chart-label">2K</text>
          <text x="0" y="62" className="chart-label">1K</text>
          <text x="0" y="78" className="chart-label">0</text>
          <path
            d="M 20 72 C 40 70 50 65 65 58 C 80 51 90 48 105 42 C 120 36 130 30 145 22 C 160 14 175 10 210 8 L 210 80 L 20 80 Z"
            fill="url(#areaGrad)"
          />
          <path
            d="M 20 72 C 40 70 50 65 65 58 C 80 51 90 48 105 42 C 120 36 130 30 145 22 C 160 14 175 10 210 8"
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="210" cy="8" r="4" fill="#3a7bd5" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>
      <div className="chart-axis"><span>4月</span><span>5月</span><span>6月</span></div>
    </Card>
  );
}
