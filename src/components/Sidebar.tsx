import linzightLogo from '../assets/linzight-logo.svg';
import type { AuthenticatedUser } from '../data/auth';
import { navItems, userProfile } from '../data/dashboard';
import { Icon } from './Icon';
import type { NavItem } from '../types';
import { useI18n } from '../i18n/I18nProvider';

interface SidebarProps {
  activeIndex: number;
  items?: NavItem[];
  onSelect: (index: number) => void;
  currentUser?: AuthenticatedUser;
}

export function Sidebar({ activeIndex, items = navItems, onSelect, currentUser }: SidebarProps) {
  const { t } = useI18n();
  const profile = currentUser ?? userProfile;
  const roleLabel = currentUser ? currentUser.roleLabel : userProfile.role;

  return (
    <aside className="sidebar" aria-label={t('主导航')}>
      <div className="logo">
        <img className="logo__image" src={linzightLogo} alt="LinZight" />
      </div>

      <nav className="sidebar__nav">
        {items.map((item, index) => (
          <button
            key={`${item.label}-${index}`}
            className={`nav-item${activeIndex === index ? ' is-active' : ''}`}
            type="button"
            onClick={() => onSelect(index)}
          >
            <Icon name={item.icon} />
            <span>{t(item.label)}</span>
            {item.hasChildren && <Icon className="nav-item__chevron" name="chevronRight" />}
          </button>
        ))}
      </nav>

      <footer className="sidebar__footer">
        <div className="user-card">
          <div className="avatar avatar--small">{profile.initials}</div>
          <div>
            <strong>{t(profile.name)}</strong>
            <span>● {t(roleLabel)}</span>
          </div>
        </div>
      </footer>
    </aside>
  );
}
