/** Cloudflare 관리 (서버 docs/cloudflare.md — /api/cloudflare/*) */
import type { MailSettings, MailStatus } from "@/types/member";

/** 연결 상태 한 줄 — ok: true 정상 · false 문제 · null 확인 못 함(앞 단계가 막혀서) */
export interface CfCheck {
  key: string;
  ok: boolean | null;
  label: string;
  detail: string;
  fix: string;
}

export interface CfPermission {
  key: string;
  /** Cloudflare 토큰 편집 화면의 이름 그대로 (예: Account › Cloudflare Tunnel › Read) */
  name: string;
  usedFor: string;
  ok: boolean | null;
}

export interface CfStatus {
  driver: "mock" | "cloudflare";
  problem: string;
  checkedAt: string;
  ok: boolean;
  problems: number;
  checks: CfCheck[];
  permissions: CfPermission[];
}

export interface CfMemberAddress {
  kind: "member";
  id: string;
  address: string;
  memberName: string;
  cohort: number | null;
  roleLabel: string;
  memberStatus: string;
  status: MailStatus;
  statusLabel: string;
  forwardHint: string;
  aliases: { address: string; expiresAt: string }[];
  error: string;
}

export interface CfRoleAddress {
  kind: "role";
  id: string;
  address: string;
  forwardHint: string;
  recipients: number;
  status: "active" | "off";
  statusLabel: string;
}

export interface CfExtraAddress {
  kind: "extra";
  id: string;
  address: string;
  forwardTo: string[];
  note: string;
  status: "active" | "pending" | "error";
  statusLabel: string;
  createdAt: string;
  createdBy: string;
}

export type CfAddress = CfMemberAddress | CfRoleAddress | CfExtraAddress;

export interface CfDestination {
  id: string;
  /** 부원 개인 메일은 가려서(se•••@gmail.com), 추가 주소의 받을 메일은 그대로 */
  email: string;
  verified: boolean;
  verifiedAt: string | null;
  usedBy: string[];
}

export interface CfMailOverview {
  domain: string;
  driver: "mock" | "cloudflare";
  problem: string;
  error: string;
  addresses: CfAddress[];
  destinations: CfDestination[];
  settings: MailSettings;
}

export interface CfAccessEmail {
  email: string;
  member: string;
  protected: boolean;
  reason: string;
}

export interface CfAccessEmails {
  driver: "mock" | "cloudflare";
  app: { id: string; name: string; domain: string };
  policy: { id: string; name: string };
  emails: CfAccessEmail[];
  otherRules: number;
}

export interface CfDeviceOwner {
  kind: "member" | "invite" | "other";
  name: string;
  memberId?: string;
  inviteId?: string;
  cohort?: number | null;
  status?: string;
  roleLabel?: string;
  superadmin?: boolean;
}

export interface CfDevice {
  tokenId: string;
  name: string;
  clientIdTail: string;
  createdAt: string | null;
  expiresAt: string | null;
  lastSeenAt: string | null;
  owner: CfDeviceOwner;
  mine: boolean;
  canDisconnect: boolean;
}

export type CfSettingField =
  | "accountId"
  | "zoneId"
  | "accessAppId"
  | "emailPolicyId"
  | "devicePolicyId"
  | "tunnelId"
  | "teamDomain"
  | "appDomain"
  | "mailDriver";

/** 연결 설정 — 토큰 값은 오지 않는다(끝 4자리 tokenHint 만) */
export type CfSettings = Record<CfSettingField, string> & {
  /** settings(화면) · env(.env) · default(기본값) · ""(비어 있음) */
  sources: Record<CfSettingField, "settings" | "env" | "default" | "">;
  labels: Record<CfSettingField, string>;
  tokenSet: boolean;
  tokenHint: string | null;
  tokenSource: "settings" | "env" | null;
  mailDrivers: string[];
  driver: "mock" | "cloudflare";
  problem: string;
};

/** PUT — 보낸 칸만 바꾼다. 빈 문자열·null 은 지우기(.env 값으로) */
export type CfSettingsUpdate = Partial<Record<CfSettingField, string | null>> & { apiToken?: string | null };
