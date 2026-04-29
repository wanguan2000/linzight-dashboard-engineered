import { userProfile } from '../data/dashboard';
import type { AuthenticatedUser } from '../data/auth';
import { AiCommandBar } from './AiCommandBar';
import { Icon } from './Icon';

interface TopbarProps {
  aiPlaceholder?: string;
  showAiPrompts?: boolean;
  title?: string;
  subtitle?: string;
  currentUser?: AuthenticatedUser;
  onLogout?: () => void;
}

export function Topbar({
  aiPlaceholder,
  showAiPrompts = true,
  title = '欢迎回来，约翰·伦格博士',
  subtitle = '这里是今日临床研究运营概览。',
  currentUser,
  onLogout
}: TopbarProps) {
  const profile = currentUser ?? userProfile;
  const roleLabel = currentUser ? currentUser.roleLabel : userProfile.role;

  return (
    <header className="topbar">
      <div className="topbar__row">
        <div className="topbar__title">
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>

        <div className="topbar__actions">
          <div className="study-badge" aria-label="研究编号：LGL-1111">
            <span>研究编号</span>
            <strong>LGL-1111</strong>
          </div>
          <div className="role-badge" aria-label="当前角色：PI研究者">
            <span>当前角色</span>
            <strong>{roleLabel}</strong>
          </div>
          <button className="icon-button" type="button" aria-label="通知">
            <Icon name="bell" />
          </button>
          {onLogout ? (
            <button className="icon-button" type="button" aria-label="退出登录" onClick={onLogout}>
              <Icon name="lock" />
            </button>
          ) : null}
          <div className="avatar avatar--top" aria-label={profile.name}>
            {profile.initials}
          </div>
        </div>
      </div>
      <AiCommandBar placeholder={aiPlaceholder} showPrompts={showAiPrompts} />
    </header>
  );
}
