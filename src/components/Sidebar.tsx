import linzightLogo from '../assets/linzight-logo.svg';
import { navItems, userProfile } from '../data/dashboard';
import { Icon } from './Icon';

interface SidebarProps {
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function Sidebar({ activeIndex, onSelect }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="主导航">
      <div className="logo">
        <img className="logo__image" src={linzightLogo} alt="LinZight" />
      </div>

      <nav className="sidebar__nav">
        {navItems.map((item, index) => (
          <button
            key={`${item.label}-${index}`}
            className={`nav-item${activeIndex === index ? ' is-active' : ''}`}
            type="button"
            onClick={() => onSelect(index)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {item.hasChildren && <Icon className="nav-item__chevron" name="chevronRight" />}
          </button>
        ))}
      </nav>

      <footer className="sidebar__footer">
        <div className="user-card">
          <div className="avatar avatar--small">{userProfile.initials}</div>
          <div>
            <strong>{userProfile.name}</strong>
            <span>● {userProfile.role}</span>
          </div>
        </div>
      </footer>
    </aside>
  );
}
