import { useEffect, useMemo, useState, type FormEvent } from 'react';
import linzightLogo from '../assets/linzight-logo.svg';
import { authenticateDemoUser, demoUsers, type AuthenticatedUser } from '../data/auth';
import { loginWithBackend } from '../services/api';
import { Icon } from './Icon';
import { LanguageToggle } from './LanguageToggle';

interface LoginPageProps {
  onAuthenticated: (user: AuthenticatedUser) => void;
}

type LoginEntryMode = 'study' | 'lz';

const studyOptions = [
  { id: 'LZXK-01', name: '真实世界肺癌耐药研究' },
  { id: 'LGL-1111', name: '免疫相关性神经系统疾病 RWD 研究' },
  { id: 'RWD-NMO-2026', name: 'NMOSD 真实世界随访研究' }
];

function userCanEnterStudy(user: (typeof demoUsers)[number], studyId: string) {
  return Boolean(user.studyScope.studyIds?.includes(studyId));
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [entryMode, setEntryMode] = useState<LoginEntryMode>('study');
  const [studyId, setStudyId] = useState('LZXK-01');
  const [username, setUsername] = useState('lung-crc@demo.linzight');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableUsers = useMemo(() => {
    if (entryMode === 'lz') return demoUsers.filter((user) => user.role.startsWith('LZ_'));
    return demoUsers.filter((user) => !user.role.startsWith('LZ_') && userCanEnterStudy(user, studyId));
  }, [entryMode, studyId]);

  const selectedUser = useMemo(
    () => availableUsers.find((user) => user.username === username) ?? availableUsers[0] ?? demoUsers[0],
    [availableUsers, username]
  );
  const selectedStudy = studyOptions.find((study) => study.id === studyId) ?? studyOptions[0];

  useEffect(() => {
    if (!availableUsers.some((user) => user.username === username)) {
      setUsername(availableUsers[0]?.username ?? demoUsers[0].username);
    }
  }, [availableUsers, username]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    const user = await loginWithBackend(username, password).catch(() => authenticateDemoUser(username, password));
    setIsSubmitting(false);
    if (!user) {
      setError('账号或密码不正确');
      return;
    }

    setError('');
    onAuthenticated(user);
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-label="LinZight 登录">
        <div className="login-panel__brand">
          <img src={linzightLogo} alt="LinZight" />
          <div className="login-panel__tools">
            <span>RWS EDC Demo</span>
            <LanguageToggle />
          </div>
        </div>
        <div className="login-panel__copy">
          <h1>真实世界研究工作台</h1>
          <p>登录后按 Study 权限进入患者队列、CRF 录入、样本登记、多组学检测、Patient Journey 与数据分析主链路。</p>
        </div>
        <div className="login-chain" aria-label="主链路">
          {['登录', 'Study', '患者列表', 'CRF', '样本', '组学', '上传', 'Journey', '分析', '导出'].map((step) => (
            <span key={step}>{step}</span>
          ))}
        </div>
      </section>

      <form className="login-card" onSubmit={handleSubmit}>
        <header>
          <div className="login-card__icon">
            <Icon name="shield" />
          </div>
          <div>
            <h2>账号登录</h2>
            <p>开发阶段 Demo 认证</p>
          </div>
        </header>

        <div className="login-entry-switch" role="group" aria-label="入口类型">
          <button
            className={entryMode === 'study' ? 'is-active' : undefined}
            type="button"
            onClick={() => setEntryMode('study')}
          >
            Study 研究入口
          </button>
          <button
            className={entryMode === 'lz' ? 'is-active' : undefined}
            type="button"
            onClick={() => setEntryMode('lz')}
          >
            LZ 系统管理
          </button>
        </div>

        {entryMode === 'study' ? (
          <label>
            <span>研究编号 / study_id</span>
            <select value={studyId} onChange={(event) => setStudyId(event.target.value)}>
              {studyOptions.map((study) => (
                <option value={study.id} key={study.id}>
                  {study.id} · {study.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="login-management-summary">
            <strong>LZ 系统管理</strong>
            <span>平台级账号，可跨 Study 管理研究、成员、CRF、质控、导出和审计。</span>
          </div>
        )}

        <label>
          <span>角色账号</span>
          <select value={username} onChange={(event) => setUsername(event.target.value)}>
            {availableUsers.map((user) => (
              <option value={user.username} key={user.id}>
                {user.name} · {user.roleLabel} · {user.username}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>密码</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>

        <div className="login-user-preview">
          <div className="avatar avatar--small">{selectedUser.initials}</div>
          <div>
            <strong>{selectedUser.name}</strong>
            <span>{selectedUser.roleLabel}</span>
          </div>
        </div>
        <div className="login-scope-preview">
          <span>{entryMode === 'study' ? '研究编号' : '管理入口'}</span>
          <strong>{entryMode === 'study' ? `${selectedStudy.id} · ${selectedStudy.name}` : 'LZ 系统管理 · 全部或授权 Study'}</strong>
        </div>

        {error ? <p className="login-error">{error}</p> : null}

        <button className="login-submit" type="submit" disabled={isSubmitting}>
          <Icon name="lock" />
          {isSubmitting ? '登录中' : '进入系统'}
        </button>
      </form>
    </main>
  );
}
