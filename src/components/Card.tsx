import type { ReactNode } from 'react';

type CardProps = {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Card({ title, action, className = '', children }: CardProps) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || action) && (
        <header className="card__header">
          {title && <h2 className="card__title">{title}</h2>}
          {action && <div className="card__action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
