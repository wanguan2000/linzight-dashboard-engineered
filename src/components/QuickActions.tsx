import { quickActions } from '../data/dashboard';
import { Icon } from './Icon';

export function QuickActions() {
  return (
    <section className="quick-actions" aria-label="快捷操作">
      <h2>快捷操作</h2>
      {quickActions.map((action) => (
        <button className="quick-action" key={action.label} type="button">
          <span className="quick-action__icon"><Icon name={action.icon} /></span>
          <span>{action.label}</span>
        </button>
      ))}
      <span className="quick-actions__separator" />
      <button className="quick-actions__more" type="button" aria-label="更多快捷操作">›</button>
    </section>
  );
}
