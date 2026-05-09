export type GlobalRole = 'LZ_ADMIN' | 'LZ_CRC' | 'LZ_CRF_ADMIN' | 'LZ_DATA_MANAGER' | 'LZ_AUDITOR';
export type StudyRole = 'STUDY_PI' | 'STUDY_CRC' | 'STUDY_CONFIG_ADMIN' | 'STUDY_DATA_MANAGER';
export type UserRole = GlobalRole | StudyRole;
export type StudyScopeType = 'all_studies' | 'assigned_studies' | 'own_studies';

export interface StudyScope {
  scopeType: StudyScopeType;
  studyIds?: string[];
}

export interface StudyMembership {
  id: string;
  study_id: string;
  user_id: string;
  study_role: StudyRole;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface DemoUser {
  id: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  initials: string;
  username: string;
  password: string;
  studyScope: StudyScope;
  studyMemberships: StudyMembership[];
}

export const authStorageKey = 'linzight-demo-user';

export const roleLabels: Record<UserRole, string> = {
  LZ_ADMIN: 'LZ 系统管理员',
  LZ_CRC: 'LZ CRC / 中央 CRC',
  LZ_CRF_ADMIN: 'LZ CRF 管理员',
  LZ_DATA_MANAGER: 'LZ 数据管理员',
  LZ_AUDITOR: 'LZ 平台审计员',
  STUDY_PI: '研究 PI / 医生',
  STUDY_CRC: '研究 CRC',
  STUDY_CONFIG_ADMIN: '研究配置管理员',
  STUDY_DATA_MANAGER: '研究数据管理员'
};

const lglMembership = (userId: string, studyRole: StudyRole): StudyMembership => ({
  id: `LOCAL-${userId}-LGL`,
  study_id: 'LGL-1111',
  user_id: userId,
  study_role: studyRole,
  status: 'active'
});

const nmoMembership = (userId: string, studyRole: StudyRole): StudyMembership => ({
  id: `LOCAL-${userId}-NMO`,
  study_id: 'RWD-NMO-2026',
  user_id: userId,
  study_role: studyRole,
  status: 'active'
});

const lzxkMembership = (userId: string, studyRole: StudyRole): StudyMembership => ({
  id: `LOCAL-${userId}-LZXK`,
  study_id: 'LZXK-01',
  user_id: userId,
  study_role: studyRole,
  status: 'active'
});

export const demoUsers: DemoUser[] = [
  {
    id: 'USR-001',
    name: '约翰·伦格',
    role: 'STUDY_PI',
    roleLabel: roleLabels.STUDY_PI,
    initials: 'JL',
    username: 'pi@demo.linzight',
    password: 'demo123',
    studyScope: { scopeType: 'own_studies', studyIds: ['LGL-1111'] },
    studyMemberships: [lglMembership('USR-001', 'STUDY_PI')]
  },
  {
    id: 'USR-002',
    name: '林清妍',
    role: 'STUDY_CRC',
    roleLabel: roleLabels.STUDY_CRC,
    initials: 'LQ',
    username: 'crc@demo.linzight',
    password: 'demo123',
    studyScope: { scopeType: 'own_studies', studyIds: ['LGL-1111'] },
    studyMemberships: [lglMembership('USR-002', 'STUDY_CRC')]
  },
  {
    id: 'USR-003',
    name: '陈序',
    role: 'STUDY_DATA_MANAGER',
    roleLabel: roleLabels.STUDY_DATA_MANAGER,
    initials: 'CX',
    username: 'dm@demo.linzight',
    password: 'demo123',
    studyScope: { scopeType: 'own_studies', studyIds: ['LGL-1111'] },
    studyMemberships: [lglMembership('USR-003', 'STUDY_DATA_MANAGER')]
  },
  {
    id: 'USR-004',
    name: '顾明远',
    role: 'STUDY_CONFIG_ADMIN',
    roleLabel: roleLabels.STUDY_CONFIG_ADMIN,
    initials: 'GM',
    username: 'config@demo.linzight',
    password: 'demo123',
    studyScope: { scopeType: 'own_studies', studyIds: ['LGL-1111', 'RWD-NMO-2026'] },
    studyMemberships: [lglMembership('USR-004', 'STUDY_CONFIG_ADMIN'), nmoMembership('USR-004', 'STUDY_CONFIG_ADMIN')]
  },
  {
    id: 'USR-005',
    name: '系统管理员',
    role: 'LZ_ADMIN',
    roleLabel: roleLabels.LZ_ADMIN,
    initials: 'SA',
    username: 'admin@demo.linzight',
    password: 'demo123',
    studyScope: { scopeType: 'all_studies' },
    studyMemberships: []
  },
  {
    id: 'USR-006',
    name: '中央 CRC',
    role: 'LZ_CRC',
    roleLabel: roleLabels.LZ_CRC,
    initials: 'CC',
    username: 'lz-crc@demo.linzight',
    password: 'demo123',
    studyScope: { scopeType: 'assigned_studies', studyIds: ['LGL-1111', 'RWD-NMO-2026', 'LZXK-01'] },
    studyMemberships: []
  },
  {
    id: 'USR-007',
    name: 'CRF 管理员',
    role: 'LZ_CRF_ADMIN',
    roleLabel: roleLabels.LZ_CRF_ADMIN,
    initials: 'CA',
    username: 'crf-admin@demo.linzight',
    password: 'demo123',
    studyScope: { scopeType: 'assigned_studies', studyIds: ['LGL-1111', 'RWD-NMO-2026', 'LZXK-01'] },
    studyMemberships: []
  },
  {
    id: 'USR-008',
    name: '平台数据管理员',
    role: 'LZ_DATA_MANAGER',
    roleLabel: roleLabels.LZ_DATA_MANAGER,
    initials: 'DM',
    username: 'lz-dm@demo.linzight',
    password: 'demo123',
    studyScope: { scopeType: 'assigned_studies', studyIds: ['RWD-NMO-2026'] },
    studyMemberships: [nmoMembership('USR-008', 'STUDY_DATA_MANAGER')]
  },
  {
    id: 'USR-009',
    name: '平台审计员',
    role: 'LZ_AUDITOR',
    roleLabel: roleLabels.LZ_AUDITOR,
    initials: 'AU',
    username: 'auditor@demo.linzight',
    password: 'demo123',
    studyScope: { scopeType: 'assigned_studies', studyIds: ['LGL-1111', 'RWD-NMO-2026', 'LZXK-01'] },
    studyMemberships: []
  },
  {
    id: 'USR-010',
    name: '肺癌 PI',
    role: 'STUDY_PI',
    roleLabel: roleLabels.STUDY_PI,
    initials: 'LP',
    username: 'lung-pi@demo.linzight',
    password: 'demo123',
    studyScope: { scopeType: 'own_studies', studyIds: ['LZXK-01'] },
    studyMemberships: [lzxkMembership('USR-010', 'STUDY_PI')]
  },
  {
    id: 'USR-011',
    name: '肺癌 CRC',
    role: 'STUDY_CRC',
    roleLabel: roleLabels.STUDY_CRC,
    initials: 'LC',
    username: 'lung-crc@demo.linzight',
    password: 'demo123',
    studyScope: { scopeType: 'own_studies', studyIds: ['LZXK-01'] },
    studyMemberships: [lzxkMembership('USR-011', 'STUDY_CRC')]
  },
  {
    id: 'USR-012',
    name: '肺癌配置管理员',
    role: 'STUDY_CONFIG_ADMIN',
    roleLabel: roleLabels.STUDY_CONFIG_ADMIN,
    initials: 'LA',
    username: 'lung-config@demo.linzight',
    password: 'demo123',
    studyScope: { scopeType: 'own_studies', studyIds: ['LZXK-01'] },
    studyMemberships: [lzxkMembership('USR-012', 'STUDY_CONFIG_ADMIN')]
  },
  {
    id: 'USR-013',
    name: '肺癌数据管理员',
    role: 'STUDY_DATA_MANAGER',
    roleLabel: roleLabels.STUDY_DATA_MANAGER,
    initials: 'LD',
    username: 'lung-dm@demo.linzight',
    password: 'demo123',
    studyScope: { scopeType: 'own_studies', studyIds: ['LZXK-01'] },
    studyMemberships: [lzxkMembership('USR-013', 'STUDY_DATA_MANAGER')]
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
    username: user.username,
    studyScope: user.studyScope,
    studyMemberships: user.studyMemberships
  };
}

export function normalizeAuthenticatedUser(value: unknown): AuthenticatedUser | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AuthenticatedUser>;
  if (candidate.username) {
    const currentDemoUser = demoUsers.find((user) => user.username.toLowerCase() === candidate.username?.toLowerCase());
    if (currentDemoUser) return toAuthenticatedUser(currentDemoUser);
  }
  if (
    candidate.id &&
    candidate.name &&
    candidate.username &&
    candidate.role &&
    candidate.roleLabel &&
    candidate.initials &&
    candidate.studyScope?.scopeType
  ) {
    return {
      id: candidate.id,
      name: candidate.name,
      username: candidate.username,
      role: candidate.role,
      roleLabel: candidate.roleLabel,
      initials: candidate.initials,
      studyScope: candidate.studyScope,
      studyMemberships: candidate.studyMemberships ?? []
    } as AuthenticatedUser;
  }
  return null;
}

export function authenticateDemoUser(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const user = demoUsers.find(
    (item) => item.username.toLowerCase() === normalizedUsername && item.password === password
  );

  return user ? toAuthenticatedUser(user) : null;
}

export function userCanAccessStudy(user: Pick<AuthenticatedUser, 'studyScope'>, studyId: string) {
  if (!user.studyScope?.scopeType) return false;
  if (user.studyScope.scopeType === 'all_studies') return true;
  return Boolean(user.studyScope.studyIds?.includes(studyId));
}

export function visibleStudyLabel(user?: Pick<AuthenticatedUser, 'studyScope'> | null) {
  if (!user) return 'LGL-1111';
  if (!user.studyScope?.scopeType) return '未授权 Study';
  if (user.studyScope.scopeType === 'all_studies') return '全部 Study';
  return user.studyScope.studyIds?.join(' / ') || '未授权 Study';
}
