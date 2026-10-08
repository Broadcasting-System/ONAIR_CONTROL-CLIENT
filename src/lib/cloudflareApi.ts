import { del, post, put, request, seg } from "@/lib/http";
import type {
  CfAccessEmails,
  CfDevice,
  CfExtraAddress,
  CfMailOverview,
  CfSettings,
  CfSettingsUpdate,
  CfStatus,
} from "@/types/cloudflare";
import type { Member, RoleAddress } from "@/types/member";

/** Cloudflare 관리 (서버 docs/cloudflare.md). 부장 이상 — 연결 설정만 최고 관리자 */
export const cloudflareApi = {
  /** 연결 상태 체크리스트 — 서버가 20초 동안 기억한다. refresh 면 다시 확인 */
  status: (refresh = false) => request<CfStatus>(`/cloudflare/status${refresh ? "?refresh=true" : ""}`),

  /** 메일 주소 — 부원·역할·추가 주소 + 받을 메일 + 메일 연결 상태 */
  mail: () => request<CfMailOverview>("/cloudflare/mail"),
  /** 추가 주소 발급 (행사·선생님 등) */
  addAddress: (body: { localPart: string; forwardTo: string[]; note?: string }) =>
    post<{ address: CfExtraAddress }>("/cloudflare/mail/addresses", body),
  deleteAddress: (id: string) => del<{ ok: boolean }>(`/cloudflare/mail/addresses/${seg(id)}`),
  resendDestination: (id: string) =>
    post<{ destination: { id: string; email: string; verified: boolean } }>(
      `/cloudflare/mail/destinations/${seg(id)}/resend`,
    ),
  /** 역할 주소 워커 규칙 + 부원 규칙 + 사라진 추가 주소 규칙 다시 만들기 */
  syncMail: () =>
    post<{ roleRules: { address: RoleAddress; routed: boolean }[]; failed: string[]; extrasFixed: number }>(
      "/cloudflare/mail/sync",
    ),

  /** 로그인 허용 이메일 (Access 이메일 허용 정책) */
  accessEmails: () => request<CfAccessEmails>("/cloudflare/access/emails"),
  addAccessEmail: (email: string) => post<CfAccessEmails>("/cloudflare/access/emails", { email }),
  removeAccessEmail: (email: string) => del<CfAccessEmails>(`/cloudflare/access/emails/${seg(email)}`),

  /** 기기 접속 키 (Access 서비스 토큰) */
  devices: () => request<{ driver: "mock" | "cloudflare"; devices: CfDevice[] }>("/cloudflare/access/devices"),
  /** 부원 기기면 내보내기, 등록 전 초대면 초대 취소 */
  disconnect: (tokenId: string) =>
    del<{ kind: "member" | "invite" | "other"; member?: Member }>(`/cloudflare/access/devices/${seg(tokenId)}`),

  /** 연결 설정 (최고 관리자) — 토큰은 쓰기만 */
  settings: () => request<CfSettings>("/cloudflare/settings"),
  saveSettings: (body: CfSettingsUpdate) => put<CfSettings>("/cloudflare/settings", body),
  testSettings: () => post<CfStatus>("/cloudflare/settings/test"),
};
