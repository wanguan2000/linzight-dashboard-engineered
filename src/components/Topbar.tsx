import { useState } from 'react';
import { userProfile } from '../data/dashboard';
import { visibleStudyLabel, type AuthenticatedUser } from '../data/auth';
import { AiCommandBar } from './AiCommandBar';
import { Icon } from './Icon';
import { LanguageToggle } from './LanguageToggle';
import { useI18n } from '../i18n/I18nProvider';

interface TopbarProps {
  aiPlaceholder?: string;
  showAiPrompts?: boolean;
  title?: string;
  subtitle?: string;
  currentUser?: AuthenticatedUser;
  activeStudyId?: string;
  studyOptions?: Array<{ id: string; name: string }>;
  onStudyChange?: (studyId: string) => void;
  onGlobalManagement?: () => void;
  onLogout?: () => void;
}

export function Topbar({
  aiPlaceholder,
  showAiPrompts = true,
  title = '欢迎回来，任约翰博士',
  subtitle = '这里是今日临床研究运营概览。',
  currentUser,
  activeStudyId,
  studyOptions = [],
  onStudyChange,
  onGlobalManagement,
  onLogout
}: TopbarProps) {
  const { t } = useI18n();
  const [notificationStatus, setNotificationStatus] = useState('');
  const profile = currentUser ?? userProfile;
  const roleLabel = currentUser ? currentUser.roleLabel : userProfile.role;
  const studyLabel = activeStudyId ?? visibleStudyLabel(currentUser);
  const showStudySwitcher = Boolean(onStudyChange && (studyOptions.length > 1 || onGlobalManagement));

  return (
    <header className="topbar">
      <div className="topbar__row">
        <div className="topbar__title">
          <h1 className="page-title">{t(title)}</h1>
          <p className="page-subtitle">{t(subtitle)}</p>
        </div>

        <div className="topbar__actions">
          <LanguageToggle />
          {showStudySwitcher ? (
            <label className="study-badge study-badge--select" aria-label={t('Study Workspace')}>
              <span>{t(activeStudyId ? 'Study Workspace' : '全局管理')}</span>
              <select
                value={activeStudyId ?? '__GLOBAL__'}
                onChange={(event) => {
                  if (event.target.value === '__GLOBAL__') onGlobalManagement?.();
                  else onStudyChange?.(event.target.value);
                }}
              >
                {onGlobalManagement ? <option value="__GLOBAL__">{t('LZ 全局管理')}</option> : null}
                {studyOptions.map((study) => (
                  <option value={study.id} key={study.id}>{study.id}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="study-badge" aria-label={`${t('Study 范围')}：${t(studyLabel)}`}>
              <span>{t(activeStudyId ? 'Study Workspace' : 'Study 范围')}</span>
              <strong>{t(studyLabel)}</strong>
            </div>
          )}
          <div className="role-badge" aria-label={`${t('当前角色')}：${t(roleLabel)}`}>
            <span>{t('当前角色')}</span>
            <strong>{t(roleLabel)}</strong>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label={t('通知')}
            title={t('暂无通知')}
            onClick={() => setNotificationStatus('暂无通知')}
          >
            <Icon name="bell" />
          </button>
          {onLogout ? (
            <button className="icon-button" type="button" aria-label={t('退出登录')} onClick={onLogout}>
              <Icon name="lock" />
            </button>
          ) : null}
          <div className="avatar avatar--top" aria-label={t(profile.name)}>
            {profile.initials}
          </div>
        </div>
      </div>
      {notificationStatus ? <p className="ai-bar__status">{t(notificationStatus)}</p> : null}
      <AiCommandBar placeholder={aiPlaceholder} showPrompts={showAiPrompts} />
    </header>
  );
}
