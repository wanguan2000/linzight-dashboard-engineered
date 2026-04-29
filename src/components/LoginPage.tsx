import { useMemo, useState, type FormEvent } from 'react';
import linzightLogo from '../assets/linzight-logo.svg';
import { authenticateDemoUser, demoUsers, type AuthenticatedUser } from '../data/auth';
import { loginWithBackend } from '../services/api';
import { Icon } from './Icon';

interface LoginPageProps {
  onAuthenticated: (user: AuthenticatedUser) => void;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [username, setUsername] = useState(demoUsers[1].username);
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedUser = useMemo(
    () => demoUsers.find((user) => user.username === username) ?? demoUsers[1],
    [username]
  );

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
          <span>RWS EDC Demo</span>
        </div>
        <div className="login-panel__copy">
          <h1>真实世界研究工作台</h1>
          <p>登录后进入患者队列、CRF 录入、样本登记、多组学检测、Patient Journey 与数据分析主链路。</p>
        </div>
        <div className="login-chain" aria-label="主链路">
          {['登录', '患者列表', 'CRF', '样本', '组学', '上传', 'Journey', '分析', '导出'].map((step) => (
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

        <label>
          <span>角色账号</span>
          <select value={username} onChange={(event) => setUsername(event.target.value)}>
            {demoUsers.map((user) => (
              <option value={user.username} key={user.id}>
                {user.roleLabel} · {user.username}
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

        {error ? <p className="login-error">{error}</p> : null}

        <button className="login-submit" type="submit" disabled={isSubmitting}>
          <Icon name="lock" />
          {isSubmitting ? '登录中' : '进入系统'}
        </button>
      </form>
    </main>
  );
}
