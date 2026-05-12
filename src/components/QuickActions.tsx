import { quickActions } from '../data/dashboard';
import { useI18n } from '../i18n/I18nProvider';
import { Icon } from './Icon';

export function QuickActions({
  disabledActions = new Set<string>(),
  disabledReason = '当前角色没有快捷写入权限',
  disabledReasons = {},
  moreDisabled = false,
  moreDisabledReason = '当前角色不能进入系统管理',
  onSelectAction = () => undefined,
  onMore = () => undefined
}: {
  disabledActions?: Set<string>;
  disabledReason?: string;
  disabledReasons?: Record<string, string>;
  moreDisabled?: boolean;
  moreDisabledReason?: string;
  onSelectAction?: (label: string) => void;
  onMore?: () => void;
}) {
  const { t } = useI18n();

  return (
    <section className="quick-actions" aria-label={t('快捷操作')}>
      <h2>{t('快捷操作')}</h2>
      {quickActions.map((action) => {
        const disabled = disabledActions.has(action.label);
        return (
          <button
            className="quick-action"
            disabled={disabled}
            key={action.label}
            title={disabled ? t(disabledReasons[action.label] ?? disabledReason) : undefined}
            type="button"
            onClick={() => {
              if (!disabled) onSelectAction(action.label);
            }}
          >
            <span className="quick-action__icon"><Icon name={action.icon} /></span>
            <span>{t(action.label)}</span>
          </button>
        );
      })}
      <span className="quick-actions__separator" />
      <button
        className="quick-actions__more"
        disabled={moreDisabled}
        title={moreDisabled ? t(moreDisabledReason) : undefined}
        type="button"
        aria-label={t('更多快捷操作')}
        onClick={() => {
          if (!moreDisabled) onMore();
        }}
      >
        ›
      </button>
    </section>
  );
}
