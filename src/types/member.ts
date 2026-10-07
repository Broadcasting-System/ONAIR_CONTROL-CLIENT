/** 역할 — superadmin 최고 관리자 · lead 부장 · member 부원 · alumni 졸업 · teacher 교사 · guest 미등록 */
export type Role = "superadmin" | "lead" | "member" | "alumni" | "teacher" | "guest";
/** 부원 관리에서 고를 수 있는 역할 (최고 관리자는 서버 .env 로만) */
export type AssignableRole = "lead" | "member" | "alumni" | "teacher";
export type MemberStatus = "unregistered" | "pending" | "approved" | "revoked";
/** 메일 상태 — none 없음 · pending 메일 확인 대기 · active 사용 중 · off 꺼짐(졸업·내보냄·교사·승인 전) */
export type MailStatus = "none" | "pending" | "active" | "off";
/** 역할 주소 — Cloudflare Email Worker 가 그때의 역할로 받는 사람을 정한다 */
export type RoleAddress = "admin" | "lead" | "all";

export interface Permissions {
  operate: boolean;
  setup: boolean;
  manageMembers: boolean;
  serverSettings: boolean;
  teacherRequest: boolean;
}

/** GET /members/me */
export interface MeInfo {
  status: MemberStatus;
  role: Role;
  roleLabel: string;
  permissions: Permissions;
  canRegister: boolean;
  source: "ip" | "cloudflare" | "client-id" | "none";
  name: string;
  cohort: number | null;
  intro: string;
  memberId: string | null;
  discordLinked: boolean;
  cloudflare: boolean;
  ip?: string;
  owner?: string;
  /** 내 메일 (예전 서버면 없다) */
  mailId?: string;
  mailAddress?: string;
  mailDomain?: string;
  mailStatus?: MailStatus;
  mailStatusLabel?: string;
  personalEmail?: string;
}

export interface Member {
  id: string;
  name: string;
  cohort: number | null;
  intro: string;
  role: Role;
  roleLabel: string;
  status: "pending" | "approved" | "revoked";
  superadmin: boolean;
  device: string;
  hasToken: boolean;
  tokenExpiresAt: string | null;
  email: string;
  /** 메일 ID (주소 = 기수 2자리 + mailId) */
  mailId: string;
  /** 주소 앞부분 — 예: 04junghyun (없으면 "") */
  mailAddress: string;
  mailStatus: MailStatus;
  mailStatusLabel: string;
  /** 받는 역할 주소 — 역할로 정해진다 */
  mailRoles: RoleAddress[];
  /** 받을 메일(개인) 가린 것 — se•••@gmail.com */
  personalEmailHint: string;
  /** 메일 ID 를 바꾼 뒤 30일 더 받는 예전 주소 */
  mailAliases: { address: string; expiresAt: string }[];
  /** 마지막 Cloudflare 실패 이유 */
  mailError: string;
  discordLinked: boolean;
  discordId: string;
  createdAt: string | null;
  registeredAt: string | null;
  approvedAt: string | null;
  approvedBy: string;
  updatedAt: string | null;
}

export interface Invite {
  id: string;
  note: string;
  createdAt: string;
  createdBy: string;
  expiresAt: string;
  codeExpiresAt: string;
  codeActive: boolean;
}

/** GET /members 의 mail — 메일 드라이버(mock 이면 시험용 확인 버튼을 보인다) */
export interface MailSummary {
  domain: string;
  driver: "mock" | "cloudflare" | "off";
}

/** GET /mail/check — 등록 화면의 실시간 확인 */
export interface MailCheck {
  ok: boolean;
  mailId: string;
  address: string;
  domain: string;
  problem: string;
}

/** GET /mail/settings (최고 관리자) */
export interface MailSettings {
  driver: "mock" | "cloudflare";
  requestedDriver: string;
  problem: string;
  domain: string;
  configured: boolean;
  connection: { ok: boolean; message?: string; enabled?: boolean; status?: string; zone?: string };
  workerName: string;
  workerSecretSet: boolean;
  roleRules: { address: RoleAddress; routed: boolean }[];
  counts: Partial<Record<MailStatus, number>>;
  failed: number;
}

/** POST /members/invites — QR·코드는 이때 한 번만 온다 */
export interface InviteCreated {
  invite: Invite;
  code: string;
  qr: string;
  server: string;
  cloudflare: boolean;
}
