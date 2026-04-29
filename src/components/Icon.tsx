import type { ReactNode, SVGProps } from 'react';
import type { IconName } from '../types';

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

const icons: Record<IconName, ReactNode> = {
  home: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  patients: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  cohorts: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </>
  ),
  studies: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  visits: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  samples: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M7.5 8.5 12 11l4.5-2.5" />
    </>
  ),
  data: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </>
  ),
  analytics: (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  reports: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10,9 9,9 8,9" />
    </>
  ),
  insights: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </>
  ),
  alerts: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
    </>
  ),
  create: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </>
  ),
  chevronRight: <polyline points="9,18 15,12 9,6" />,
  chevronDown: <polyline points="6,9 12,15 18,9" />,
  sparkles: (
    <>
      <path d="M12 2 14 8l6 2-6 2-2 6-2-6-6-2 6-2 2-6z" />
      <path d="M19 3v4M21 5h-4M5 17v5M7.5 19.5h-5" />
    </>
  ),
  wave: <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />,
  building: (
    <>
      <path d="M3 9 12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </>
  ),
  microphone: (
    <>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </>
  ),
  send: (
    <>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22,2 15,22 11,13 2,9 22,2" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  location: (
    <>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  calendarCheck: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="m8 16 2.2 2.2L16 13" />
    </>
  ),
  check: (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22,4 12,14.01 9,11.01" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  activity: <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />,
  userPlus: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  filePlus: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </>
  ),
  homeOutline: (
    <>
      <path d="M3 9 12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </>
  ),
  female: (
    <>
      <circle cx="12" cy="8" r="5" />
      <line x1="12" y1="13" x2="12" y2="22" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </>
  ),
  lab: (
    <>
      <path d="M9 2v6l-5 9a4 4 0 0 0 3.5 6h9a4 4 0 0 0 3.5-6l-5-9V2" />
      <line x1="8" y1="2" x2="16" y2="2" />
      <path d="M7 16h10" />
    </>
  ),
  dna: (
    <>
      <path d="M17 3c0 6-10 6-10 12 0 2 1 4 3 6" />
      <path d="M7 3c0 6 10 6 10 12 0 2-1 4-3 6" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="7.5" y1="12" x2="16.5" y2="12" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </>
  ),
  sampleTube: (
    <>
      <path d="M10 2h4" />
      <path d="M10 2v6.5l-4.4 7.7A4 4 0 0 0 9.1 22h5.8a4 4 0 0 0 3.5-5.8L14 8.5V2" />
      <path d="M8 16h8" />
      <path d="M9.3 19h5.4" />
    </>
  ),
  sampleBank: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v12c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 11c0 1.66 3.58 3 8 3s8-1.34 8-3" />
      <path d="M8 8v3M12 8v3M16 8v3" />
    </>
  ),
  crf: (
    <>
      <path d="M9 3h6l1 2h3a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3l1-2z" />
      <path d="M9 5h6" />
      <path d="M8 11h8" />
      <path d="M8 15h8" />
      <path d="M8 19h5" />
      <path d="m16 18 1 1 2-3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </>
  ),
  blood: (
    <>
      <path d="M12 2.5S5.5 10 5.5 15.2a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z" />
      <path d="M9 15.5c.4 1.8 1.6 2.8 3.2 3" />
    </>
  ),
  csf: (
    <>
      <path d="M9 3a3 3 0 0 0-3 3v8.5A4.5 4.5 0 0 0 10.5 19H12" />
      <path d="M15 3a3 3 0 0 1 3 3v8.5A4.5 4.5 0 0 1 13.5 19H12" />
      <path d="M12 4v17" />
      <path d="M8 10c1.5-.7 2.9-.7 4 0s2.5.7 4 0" />
      <path d="M8 14c1.5-.7 2.9-.7 4 0s2.5.7 4 0" />
    </>
  ),
  kidney: (
    <>
      <path d="M9.5 3.5C6.2 3.5 4 6.5 4 11.2 4 16 6.4 20 9.2 20c1.7 0 2.8-1.4 2.8-3.2V6.8C12 4.9 11 3.5 9.5 3.5z" />
      <path d="M14.5 3.5c3.3 0 5.5 3 5.5 7.7 0 4.8-2.4 8.8-5.2 8.8-1.7 0-2.8-1.4-2.8-3.2" />
      <path d="M12 11h4" />
      <path d="M16 11c1.2 0 2 .7 2 1.8V15" />
    </>
  )
};

export function Icon({ name, size = 16, className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      focusable="false"
      {...props}
    >
      {icons[name]}
    </svg>
  );
}
