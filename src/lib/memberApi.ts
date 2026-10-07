import { getApiBase } from "@/lib/apiBase";
import { del, post, put, request, seg } from "@/lib/http";
import type {
  AssignableRole,
  Invite,
  InviteCreated,
  MailCheck,
  MailSettings,
  MailSummary,
  MeInfo,
  Member,
} from "@/types/member";

export const memberApi = {
  me: () => request<MeInfo>("/members/me"),
  register: (body: { name: string; cohort: number; intro: string; mailId?: string; personalEmail?: string }) =>
    post<{ status: string; member: Member }>("/members/register", body),

  list: () => request<{ members: Member[]; counts: Record<string, number>; mail?: MailSummary }>("/members"),
  invites: () => request<{ invites: Invite[] }>("/members/invites"),
  createInvite: (note = "") => post<InviteCreated>("/members/invites", { note }),
  cancelInvite: (id: string) => del<{ ok: boolean }>(`/members/invites/${seg(id)}`),

  approve: (id: string, role: AssignableRole) => post<{ member: Member }>(`/members/${seg(id)}/approve`, { role }),
  update: (
    id: string,
    patch: Partial<Pick<Member, "name" | "cohort" | "intro" | "mailId">> & { role?: AssignableRole; personalEmail?: string },
  ) => put<{ member: Member }>(`/members/${seg(id)}`, patch),
  graduate: (id: string) => post<{ member: Member }>(`/members/${seg(id)}/graduate`),
  revoke: (id: string) => post<{ member: Member }>(`/members/${seg(id)}/revoke`),

  discordCode: () => post<{ code: string; expiresAt: string }>("/members/me/discord-code"),
};

/** 부원 메일 (docs/mail.md — 서버) */
export const mailApi = {
  check: (cohort: number, mailId: string) =>
    request<MailCheck>(`/mail/check?cohort=${cohort}&mailId=${encodeURIComponent(mailId)}`),
  resend: (id: string) => post<{ member: Member }>(`/mail/members/${seg(id)}/resend`),
  /** 가짜(mock) 메일일 때만 — 확인된 것으로 */
  devVerify: (id: string) => post<{ member: Member }>(`/mail/members/${seg(id)}/dev-verify`),
  settings: () => request<MailSettings>("/mail/settings"),
  sync: () => post<{ failed: string[]; settings: MailSettings }>("/mail/settings/sync"),
};

/** 명단 CSV 받기 (GET) */
export async function downloadMembersCsv(): Promise<void> {
  const res = await fetch(`${getApiBase()}/members/export.csv`);
  if (!res.ok) throw new Error(res.status === 403 ? "부장 이상만 받을 수 있습니다." : "명단을 받지 못했습니다.");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `onair-부원-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
