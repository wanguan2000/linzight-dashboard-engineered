import { useEffect, useMemo, useState, type FormEvent } from 'react';
import linzightLogo from '../assets/linzight-logo.svg';
import { accessibleStudyIdsForUser, authenticateDemoUser, demoUsers, isPlatformRole, studyOptions, type AuthenticatedUser } from '../data/auth';
import { loginWithBackend } from '../services/api';
import { useI18n } from '../i18n/I18nProvider';
import { Icon } from './Icon';
import { LanguageToggle } from './LanguageToggle';

interface LoginPageProps {
  onAuthenticated: (user: AuthenticatedUser, activeStudyId?: string) => void;
}

type LoginEntryMode = 'study' | 'lz';

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const { t } = useI18n();
  const [entryMode, setEntryMode] = useState<LoginEntryMode>('study');
  const [username, setUsername] = useState('lung-crc@demo.linzight');
  const [password, setPassword] = useState('Demo1234!');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingUser, setPendingUser] = useState<AuthenticatedUser | null>(null);
  const [pendingStudyId, setPendingStudyId] = useState('LZXK-01');

  const availableUsers = useMemo(() => {
    if (entryMode === 'lz') return demoUsers.filter((user) => user.role.startsWith('LZ_'));
    return demoUsers;
  }, [entryMode]);

  const selectedUser = useMemo(
    () => availableUsers.find((user) => user.username === username) ?? availableUsers[0] ?? demoUsers[0],
    [availableUsers, username]
  );
  const pendingStudyOptions = useMemo(
    () => accessibleStudyIdsForUser(pendingUser).map((id) => studyOptions.find((study) => study.id === id) ?? { id, name: id }),
    [pendingUser]
  );
  const pendingStudy = pendingStudyOptions.find((study) => study.id === pendingStudyId) ?? pendingStudyOptions[0] ?? studyOptions[0];

  useEffect(() => {
    if (!availableUsers.some((user) => user.username === username)) {
      setUsername(availableUsers[0]?.username ?? demoUsers[0].username);
    }
  }, [availableUsers, username]);

  useEffect(() => {
    setPendingUser(null);
    setError('');
  }, [entryMode, username]);

  useEffect(() => {
    if (pendingStudyOptions.length && !pendingStudyOptions.some((study) => study.id === pendingStudyId)) {
      setPendingStudyId(pendingStudyOptions[0].id);
    }
  }, [pendingStudyId, pendingStudyOptions]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pendingUser) {
      onAuthenticated(pendingUser, pendingStudy.id);
      return;
    }

    setIsSubmitting(true);
    const user = await loginWithBackend(username, password).catch(() => authenticateDemoUser(username, password));
    setIsSubmitting(false);
    if (!user) {
      setError(t('账号或密码不正确，或账号已被禁用。'));
      return;
    }

    setError('');
    if (entryMode === 'lz') {
      if (!isPlatformRole(user)) {
        setError(t('LZ 系统管理入口仅支持平台级账号。'));
        return;
      }
      onAuthenticated(user);
      return;
    }

    const studyIds = accessibleStudyIdsForUser(user);
    if (!studyIds.length) {
      setError(t('当前账号没有可进入的 Study。'));
      return;
    }
    if (studyIds.length === 1) {
      onAuthenticated(user, studyIds[0]);
      return;
    }
    setPendingStudyId(studyIds[0]);
    setPendingUser(user);
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-label={t('LinZight 登录')}>
        <div className="login-panel__brand">
          <img src={linzightLogo} alt="LinZight" />
          <div className="login-panel__tools">
            <span>RWS EDC Demo</span>
            <LanguageToggle />
          </div>
        </div>
        <div className="login-panel__copy">
          <h1>{t('真实世界研究工作台')}</h1>
          <p>{t('登录后按 Study 权限进入患者队列、CRF 录入、样本登记、多组学检测、Patient Journey 与数据分析主链路。')}</p>
        </div>
        <div className="login-chain" aria-label={t('主链路')}>
          {['登录', 'Study', '患者列表', 'CRF', '样本', '组学', '上传', 'Journey', '分析', '导出'].map((step) => (
            <span key={step}>{t(step)}</span>
          ))}
        </div>
      </section>

      <form className="login-card" onSubmit={handleSubmit}>
        <header>
          <div className="login-card__icon">
            <Icon name="shield" />
          </div>
          <div>
            <h2>{t('账号登录')}</h2>
            <p>{t('开发阶段 Demo 认证')}</p>
          </div>
        </header>

        <div className="login-entry-switch" role="group" aria-label={t('入口类型')}>
          <button
            className={entryMode === 'study' ? 'is-active' : undefined}
            type="button"
            onClick={() => setEntryMode('study')}
          >
            {t('Study 研究入口')}
          </button>
          <button
            className={entryMode === 'lz' ? 'is-active' : undefined}
            type="button"
            onClick={() => setEntryMode('lz')}
          >
            {t('LZ 系统管理')}
          </button>
        </div>

        {entryMode === 'study' && pendingUser ? (
          <label>
            <span>{t('选择 Study Workspace')}</span>
            <select value={pendingStudyId} onChange={(event) => setPendingStudyId(event.target.value)}>
              {pendingStudyOptions.map((study) => (
                <option value={study.id} key={study.id}>
                  {study.id} · {t(study.name)}
                </option>
              ))}
            </select>
          </label>
        ) : entryMode === 'study' ? (
          <div className="login-management-summary">
            <strong>{t('Study Workspace')}</strong>
            <span>{t('登录后如账号只授权一个 Study，将直接进入；多个 Study 时再选择工作区。')}</span>
          </div>
        ) : (
          <div className="login-management-summary">
            <strong>{t('LZ 系统管理')}</strong>
            <span>{t('平台级账号仅管理 Study、成员、权限配置和全局索引；业务操作需进入单个 Study Workspace。')}</span>
          </div>
        )}

        {!pendingUser ? (
          <>
            <label>
              <span>{t('角色账号')}</span>
              <select value={username} onChange={(event) => setUsername(event.target.value)}>
                {availableUsers.map((user) => (
                  <option value={user.username} key={user.id}>
                    {t(user.name)} · {t(user.roleLabel)} · {user.username}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{t('密码')}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
          </>
        ) : null}

        <div className="login-user-preview">
          <div className="avatar avatar--small">{pendingUser?.initials ?? selectedUser.initials}</div>
          <div>
            <strong>{t(pendingUser?.name ?? selectedUser.name)}</strong>
            <span>{t(pendingUser?.roleLabel ?? selectedUser.roleLabel)}</span>
          </div>
        </div>
        <div className="login-scope-preview">
          <span>{entryMode === 'study' ? t('工作区边界') : t('管理入口')}</span>
          <strong>{entryMode === 'study' ? (pendingUser ? `${pendingStudy.id} · ${t(pendingStudy.name)}` : t('登录后选择或自动进入单个 Study')) : t('LZ 系统管理 · 全局配置与索引')}</strong>
        </div>

        {error ? <p className="login-error">{t(error)}</p> : null}

        <button className="login-submit" type="submit" disabled={isSubmitting}>
          <Icon name="lock" />
          {isSubmitting ? t('登录中') : pendingUser ? t('进入 Study Workspace') : t('进入系统')}
        </button>
        <a className="icp-link login-icp" href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
          {t('沪ICP备2026020480号')}
        </a>
      </form>
    </main>
  );
}
