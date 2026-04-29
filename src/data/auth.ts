export type UserRole = 'sys_admin' | 'project_admin' | 'investigator' | 'crc' | 'data_manager' | 'viewer';

export interface DemoUser {
  id: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  initials: string;
  username: string;
  password: string;
}

export const roleLabels: Record<UserRole, string> = {
  sys_admin: '系统管理员',
  project_admin: '项目管理员',
  investigator: 'PI研究者',
  crc: 'CRC',
  data_manager: '数据管理员',
  viewer: '只读访客'
};

export const demoUsers: DemoUser[] = [
  {
    id: 'USR-001',
    name: '约翰·伦格',
    role: 'investigator',
    roleLabel: roleLabels.investigator,
    initials: 'JL',
    username: 'pi@demo.linzight',
    password: 'demo123'
  },
  {
    id: 'USR-002',
    name: '林清妍',
    role: 'crc',
    roleLabel: roleLabels.crc,
    initials: 'LQ',
    username: 'crc@demo.linzight',
    password: 'demo123'
  },
  {
    id: 'USR-003',
    name: '陈序',
    role: 'data_manager',
    roleLabel: roleLabels.data_manager,
    initials: 'CX',
    username: 'dm@demo.linzight',
    password: 'demo123'
  },
  {
    id: 'USR-004',
    name: '顾明远',
    role: 'project_admin',
    roleLabel: roleLabels.project_admin,
    initials: 'GM',
    username: 'project@demo.linzight',
    password: 'demo123'
  },
  {
    id: 'USR-005',
    name: '系统管理员',
    role: 'sys_admin',
    roleLabel: roleLabels.sys_admin,
    initials: 'SA',
    username: 'admin@demo.linzight',
    password: 'demo123'
  },
  {
    id: 'USR-006',
    name: '审阅者',
    role: 'viewer',
    roleLabel: roleLabels.viewer,
    initials: 'VW',
    username: 'viewer@demo.linzight',
    password: 'demo123'
  }
];

export type AuthenticatedUser = Omit<DemoUser, 'password'>;

export function toAuthenticatedUser(user: DemoUser): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    roleLabel: user.roleLabel,
    initials: user.initials,
    username: user.username
  };
}

export function authenticateDemoUser(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const user = demoUsers.find(
    (item) => item.username.toLowerCase() === normalizedUsername && item.password === password
  );

  return user ? toAuthenticatedUser(user) : null;
}
