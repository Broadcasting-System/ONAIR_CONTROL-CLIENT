import { getApiBase } from "@/lib/apiBase";
import { del, post, put, request, seg } from "@/lib/http";
import type { AssignableRole, Invite, InviteCreated, MeInfo, Member } from "@/types/member";

export const memberApi = {
  me: () => request<MeInfo>("/members/me"),
  register: (body: { name: string; cohort: number; intro: string }) =>
    post<{ status: string; member: Member }>("/members/register", body),

  list: () => request<{ members: Member[]; counts: Record<string, number> }>("/members"),
  invites: () => request<{ invites: Invite[] }>("/members/invites"),
  createInvite: (note = "") => post<InviteCreated>("/members/invites", { note }),
  cancelInvite: (id: string) => del<{ ok: boolean }>(`/members/invites/${seg(id)}`),

  approve: (id: string, role: AssignableRole) => post<{ member: Member }>(`/members/${seg(id)}/approve`, { role }),
  update: (id: string, patch: Partial<Pick<Member, "name" | "cohort" | "intro" | "mailLocalPart">> & { role?: AssignableRole }) =>
    put<{ member: Member }>(`/members/${seg(id)}`, patch),
  graduate: (id: string) => post<{ member: Member }>(`/members/${seg(id)}/graduate`),
  revoke: (id: string) => post<{ member: Member }>(`/members/${seg(id)}/revoke`),

  discordCode: () => post<{ code: string; expiresAt: string }>("/members/me/discord-code"),
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
