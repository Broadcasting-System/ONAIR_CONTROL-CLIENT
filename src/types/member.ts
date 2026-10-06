/** 역할 — superadmin 최고 관리자 · lead 부장 · member 부원 · alumni 졸업 · teacher 교사 · guest 미등록 */
export type Role = "superadmin" | "lead" | "member" | "alumni" | "teacher" | "guest";
/** 부원 관리에서 고를 수 있는 역할 (최고 관리자는 서버 .env 로만) */
export type AssignableRole = "lead" | "member" | "alumni" | "teacher";
export type MemberStatus = "unregistered" | "pending" | "approved" | "revoked";

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
  mailLocalPart: string;
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

/** POST /members/invites — QR·코드는 이때 한 번만 온다 */
export interface InviteCreated {
  invite: Invite;
  code: string;
  qr: string;
  server: string;
  cloudflare: boolean;
}
