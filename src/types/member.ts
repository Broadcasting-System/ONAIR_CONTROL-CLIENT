/** 역할 — superadmin 최고 관리자 · lead 부장 · member 부원 · alumni 졸업 · teacher 교사 · guest 미등록 */
export type Role = "superadmin" | "lead" | "member" | "alumni" | "teacher" | "guest";
/** 부원 관리에서 고를 수 있는 역할 (최고 관리자는 서버 .env 로만) */
export type AssignableRole = "lead" | "member" | "alumni" | "teacher";
export type MemberStatus = "unregistered" | "pending" | "approved" | "revoked";
/** 메일 상태 — none 없음 · pending 메일 확인 대기 · active 사용 중 · off 꺼짐(졸업·내보냄·교사·승인 전) */
export type MailStatus = "none" | "pending" | "active" | "off";
/** 역할 주소 — Cloudflare Email Worker 가 그때의 역할로 받는 사람을 정한다 */
export type RoleAddress = "admin" | "lead" | "all";
/** 프로필 카드 배경 — wave 이름으로 만든 소리 파형(기본) · photo 본인 사진 */
export type CardBg = "wave" | "photo";

/** 프로필 카드 배경 (서버가 준 값). cardBg 는 지금 보이는 배경 — 사진이 없으면 photo 를 골랐어도 wave */
export interface CardBgInfo {
  cardBg: CardBg;
  hasPhoto: boolean;
  /** /api/members/<id>/photo?v=… (없으면 "") */
  photoUrl: string;
}

export interface Permissions {
  operate: boolean;
  setup: boolean;
  manageMembers: boolean;
  serverSettings: boolean;
  teacherRequest: boolean;
}

/** GET /members/me */
/** 한 사람이 쓰는 기기 하나 — 처음 기기 id 는 "main" */
export interface MemberDevice {
  id: string;
  name: string;
  primary: boolean;
  addedAt: string | null;
  lastSeenAt: string | null;
  clientIdTail: string;
}

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
  /** 방송부 직함·소개글 (예전 서버면 없다) */
  title?: string;
  bio?: string;
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
  /** 프로필 카드 배경·사진 (예전 서버면 없다) */
  cardBg?: CardBg;
  photoUrl?: string;
  /** 내 기기 — 지금 이 기기 id 와 목록 (예전 서버면 없다) */
  deviceId?: string;
  devices?: MemberDevice[];
  /** [다른 기기 추가] 초대로 들어온 새 기기면 붙을 사람 */
  addTo?: { id: string; name: string; cohort: number | null } | null;
}

export interface Member extends Partial<CardBgInfo> {
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
  /** 이 사람이 쓰는 기기 (예전 서버면 없다) */
  devices?: MemberDevice[];
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
  /** 방송부 직함·한 줄 (40자) */
  title: string;
  /** 방송부 소개글 (1000자) */
  bio: string;
  /** 그 기수의 부장이었다 ("4기 부장") — 지금 역할과는 따로 */
  wasLead: boolean;
  /** 명단만 — 기기·토큰 없이 이름만 올라 있다 (대개 졸업생) */
  rosterOnly: boolean;
  hasDevice: boolean;
  /** 명단만 부원에게 이어진 등록이면 그 전 역할 (승인 기본값) */
  rosterRole: "" | "member" | "alumni";
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
  /** 명단만 부원에게 이어 둔 초대 */
  memberId?: string;
}

/** GET /members/crew — 방송부 보기 한 사람 */
export interface CrewMember extends CardBgInfo {
  id: string;
  name: string;
  cohort: number;
  role: "superadmin" | "lead" | "member" | "alumni";
  roleLabel: string;
  /** 지금 부장이거나 그 기수 부장이었다 */
  lead: boolean;
  wasLead: boolean;
  title: string;
  bio: string;
  rosterOnly: boolean;
  hasDevice: boolean;
  /** 지금 기수 */
  current: boolean;
  /** ONAIR 메일 주소 앞부분 (부원 이상에게만, 없으면 "") */
  mailAddress: string;
  /** 보고 있는 기기의 부원 본인 */
  me: boolean;
  /** 본인 또는 부장 이상 */
  canEdit: boolean;
}

export interface CrewResponse {
  crew: CrewMember[];
  currentCohorts: number[];
  domain: string;
  me: string | null;
  canManage: boolean;
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

/** POST /members/me/devices/invite — 내 다른 기기 추가 QR·코드 (30분, 이때 한 번만) */
export interface DeviceInviteCreated {
  code: string;
  qr: string;
  server: string;
  expiresAt: string;
  cloudflare: boolean;
}

/** POST /members/invites — QR·코드는 이때 한 번만 온다 */
export interface InviteCreated {
  invite: Invite;
  code: string;
  qr: string;
  server: string;
  cloudflare: boolean;
}
