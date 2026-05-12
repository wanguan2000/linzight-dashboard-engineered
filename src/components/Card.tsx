import type { ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';

type CardProps = {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Card({ title, action, className = '', children }: CardProps) {
  const { t } = useI18n();

  return (
    <section className={`card ${className}`.trim()}>
      {(title || action) && (
        <header className="card__header">
          {title && <h2 className="card__title">{t(title)}</h2>}
          {action && <div className="card__action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
