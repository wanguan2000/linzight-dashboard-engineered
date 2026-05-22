import { useEffect, useMemo, useState, type FormEvent } from 'react';
import linzightLogo from '../assets/linzight-logo.svg';
import { accessibleStudyIdsForUser, isPlatformRole, type AuthenticatedUser } from '../data/auth';
import { confirmPasswordReset, loginWithBackend, requestPasswordReset } from '../services/api';
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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState(() => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('reset_token') ?? ''));
  const [newPassword, setNewPassword] = useState('');
  const [resetMode, setResetMode] = useState(() => Boolean(resetToken));
  const [resetStatus, setResetStatus] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingUser, setPendingUser] = useState<AuthenticatedUser | null>(null);
  const [pendingStudyId, setPendingStudyId] = useState('');

  const pendingStudyOptions = useMemo(
    () => accessibleStudyIdsForUser(pendingUser).map((id) => ({ id, name: id })),
    [pendingUser]
  );
  const pendingStudy = pendingStudyOptions.find((study) => study.id === pendingStudyId) ?? pendingStudyOptions[0] ?? { id: '', name: '' };

  useEffect(() => {
    document.body.classList.add('login-page-active');
    return () => document.body.classList.remove('login-page-active');
  }, []);

  useEffect(() => {
    setPendingUser(null);
    setError('');
  }, [entryMode, username]);

  useEffect(() => {
    if (pendingStudyOptions.length && !pendingStudyOptions.some((study) => study.id === pendingStudyId)) {
      setPendingStudyId(pendingStudyOptions[0].id);
    }
  }, [pendingStudyId, pendingStudyOptions]);

  async function handleResetRequest() {
    setResetStatus(t('重置邮件正在发送...'));
    setError('');
    try {
      const response = await requestPasswordReset({ username: resetEmail });
      setResetStatus(
        response.email === 'sent'
          ? t('如果账号存在，系统会发送密码重置邮件。')
          : t('邮件服务尚未配置，请联系 LZ 系统管理员。')
      );
    } catch {
      setResetStatus(t('邮件服务暂不可用，请联系 LZ 系统管理员。'));
    }
  }

  async function handleResetConfirm() {
    if (!resetToken) {
      setResetStatus(t('缺少密码重置 token。'));
      return;
    }
    setResetStatus(t('密码正在更新...'));
    setError('');
    try {
      await confirmPasswordReset({ token: resetToken, password: newPassword });
      setResetStatus(t('密码已更新，请使用新密码登录。'));
      setResetMode(false);
      setNewPassword('');
      setResetToken('');
    } catch {
      setResetStatus(t('密码重置链接无效或已过期。'));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pendingUser) {
      onAuthenticated(pendingUser, pendingStudy.id);
      return;
    }

    setIsSubmitting(true);
    const user = await loginWithBackend(username, password).catch(() => null);
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

    if (['LZ_ADMIN', 'LZ_CRC', 'LZ_DATA_MANAGER'].includes(user.role)) {
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
            <span>RWS EDC</span>
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
            <p>{t('正式系统认证')}</p>
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
            <span>{t('平台级账号可跨 Study 管理业务数据；读写仍使用 Study-scoped API。')}</span>
          </div>
        )}

        {resetMode ? (
          <div className="login-reset-panel">
            <label>
              <span>{t('账号邮箱')}</span>
              <input type="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} autoComplete="email" />
            </label>
            {resetToken ? (
              <label>
                <span>{t('新密码')}</span>
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
              </label>
            ) : null}
            <button className="module-link-button module-link-button--primary" type="button" onClick={() => (resetToken ? void handleResetConfirm() : void handleResetRequest())}>
              {resetToken ? t('修改密码') : t('发送重置邮件')}
            </button>
            <button className="module-link-button" type="button" onClick={() => setResetMode(false)}>
              {t('返回登录')}
            </button>
            {resetStatus ? <p className="login-reset-status">{resetStatus}</p> : null}
          </div>
        ) : !pendingUser ? (
          <>
            <label>
              <span>{t('账号邮箱')}</span>
              <input type="email" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
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
            <button className="module-link-button login-reset-link" type="button" onClick={() => setResetMode(true)}>
              {t('忘记密码 / 修改密码')}
            </button>
          </>
        ) : null}

        {!resetMode ? <div className="login-user-preview">
          <div className="avatar avatar--small">{pendingUser?.initials ?? 'LZ'}</div>
          <div>
            <strong>{t(pendingUser?.name ?? username)}</strong>
            <span>{t(pendingUser?.roleLabel ?? (entryMode === 'lz' ? 'LZ 系统管理' : 'Study 研究入口'))}</span>
          </div>
        </div> : null}
        {!resetMode ? <div className="login-scope-preview">
          <span>{entryMode === 'study' ? t('工作区边界') : t('管理入口')}</span>
          <strong>{entryMode === 'study' ? (pendingUser ? `${pendingStudy.id} · ${t(pendingStudy.name)}` : t('登录后选择或自动进入单个 Study')) : t('LZ 系统管理 · 全局配置与索引')}</strong>
        </div> : null}

        {error ? <p className="login-error">{t(error)}</p> : null}

        <button className="login-submit" type="submit" disabled={isSubmitting || resetMode}>
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
