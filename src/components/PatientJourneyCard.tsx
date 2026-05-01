import { journeyRates, journeyStages } from '../data/dashboard';
import type { JourneyStage } from '../types';
import { Card } from './Card';
import { Icon } from './Icon';

export function PatientJourneyCard({ stages = journeyStages, rates = journeyRates }: { stages?: JourneyStage[]; rates?: string[] }) {
  return (
    <Card title="患者旅程概览" action={<button className="link-button" type="button">查看全部患者 →</button>}>
      <div className="journey__stats">
        {stages.map((stage) => (
          <div className="journey__stat" key={stage.label}>
            <span>{stage.label}</span>
            <strong>{stage.value}</strong>
          </div>
        ))}
      </div>

      <div className="journey__timeline">
        <div className="journey__line" />
        {stages.map((stage) => (
          <div className="journey__node-wrap" key={stage.label}>
            <div className={`journey__node journey__node--${stage.theme}`}>
              <Icon name={stage.icon} />
            </div>
          </div>
        ))}
      </div>

      <div className="journey__waves" aria-hidden="true">
        <svg viewBox="0 0 540 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2dbfb8" stopOpacity=".6" />
              <stop offset="100%" stopColor="#3a7bd5" stopOpacity=".4" />
            </linearGradient>
            <linearGradient id="wave2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4caf88" stopOpacity=".4" />
              <stop offset="100%" stopColor="#2dbfb8" stopOpacity=".25" />
            </linearGradient>
          </defs>
          <path d="M 0 40 C 60 20 100 50 160 30 C 220 10 280 45 340 25 C 400 5 460 35 540 20 L 540 60 L 0 60 Z" fill="url(#wave1)" />
          <path d="M 0 50 C 80 35 130 55 200 40 C 270 25 320 50 400 35 C 450 25 490 45 540 35 L 540 60 L 0 60 Z" fill="url(#wave2)" />
        </svg>
      </div>

      <div className="journey__rates">
        {rates.map((rate, index) => (
          <span key={`${rate}-${index}`}>{rate}</span>
        ))}
      </div>
    </Card>
  );
}
