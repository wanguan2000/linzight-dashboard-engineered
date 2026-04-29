'use client';

import React, { useMemo } from 'react';
import { biomarkerPoints } from '../data';
import { useJourneyStore } from '../store';

function findNearestPoint(date: string) {
  const target = new Date(date).getTime();
  return biomarkerPoints.reduce((nearest, point) => {
    const delta = Math.abs(new Date(point.date).getTime() - target);
    const nearestDelta = Math.abs(new Date(nearest.date).getTime() - target);
    return delta < nearestDelta ? point : nearest;
  }, biomarkerPoints[0]);
}

export function MetricCards() {
  const selectedDate = useJourneyStore((state) => state.selectedDate);
  const current = useMemo(() => findNearestPoint(selectedDate), [selectedDate]);

  const cards = [
    { label: '当前SLEDAI', value: current.sledai, unit: '', className: 'metric-blue' },
    { label: 'C3 (g/L)', value: current.c3.toFixed(2), unit: '', className: 'metric-green' },
    { label: 'ESR (mm/h)', value: current.esr, unit: '', className: 'metric-orange' },
    { label: '24h尿蛋白 (g)', value: current.protein24h.toFixed(1), unit: '', className: 'metric-cyan' },
    { label: 'IgG (g/L)', value: current.igg.toFixed(1), unit: '', className: 'metric-purple' }
  ];

  return (
    <div className="metric-cards">
      {cards.map((item) => (
        <div className={`metric-card ${item.className}`} key={item.label}>
          <div className="metric-label">{item.label}</div>
          <div className="metric-value">
            {item.value}
            {item.unit && <span>{item.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
