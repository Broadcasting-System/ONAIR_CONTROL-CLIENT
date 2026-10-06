import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "@/lib/apiBase";
import type { MeInfo, Role } from "@/types/member";

export type { Role } from "@/types/member";

export interface Me extends MeInfo {
  ip: string;
  owner: string;
}

const RANK: Record<Role, number> = { guest: 0, alumni: 0, teacher: 0, member: 1, lead: 2, superadmin: 3 };
// 예전 기기 역할 이름도 받는다 (admin=부장 이상, operator=부원 이상, viewer=보기)
const LEGACY: Record<string, Role> = { admin: "lead", operator: "member", viewer: "alumni" };

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "최고 관리자",
  lead: "부장",
  member: "부원",
  alumni: "졸업",
  teacher: "교사",
  guest: "미등록",
};

function normalize(role: string | undefined | null): Role {
  if (!role) return "guest";
  const r = (LEGACY[role] ?? role) as Role;
  return r in RANK ? r : "guest";
}

const NO_PERMS = { operate: false, setup: false, manageMembers: false, serverSettings: false, teacherRequest: false };

/** 부원 API 가 없는 예전 서버면 기기 신원(/devices/me)으로 대신한다 */
async function fetchMe(): Promise<Me> {
  const base = getApiBase();
  const memberRes = await fetch(`${base}/members/me`);
  if (memberRes.ok) {
    const m = (await memberRes.json()) as MeInfo;
    return { ...m, ip: m.ip ?? "", owner: m.owner ?? "" };
  }
  const deviceRes = await fetch(`${base}/devices/me`);
  if (!deviceRes.ok) throw new Error("서버에 연결하지 못했습니다.");
  const device = (await deviceRes.json()) as { ip: string; name: string; owner: string; role: string };
  const role = normalize(device.role);
  return {
    status: role === "guest" ? "unregistered" : "approved",
    role,
    roleLabel: ROLE_LABEL[role],
    permissions: { ...NO_PERMS, operate: RANK[role] >= 1, setup: RANK[role] >= 2, manageMembers: RANK[role] >= 2 },
    canRegister: false,
    source: "ip",
    name: device.name,
    cohort: null,
    intro: "",
    memberId: null,
    discordLinked: false,
    cloudflare: false,
    ip: device.ip,
    owner: device.owner,
  };
}

/** 현재 기기(요청자)의 신원·역할. 서버가 Cloudflare 토큰·클라이언트 ID·Tailscale IP 로 판단한다. */
export function useMe() {
  const { data: me, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 30_000,
    retry: 1,
  });

  const role: Role = normalize(me?.role);
  const can = (required: Role | "admin" | "operator" | "viewer") => RANK[role] >= RANK[normalize(required)];

  return {
    me: me ?? null,
    role,
    loading: isLoading,
    refetch,
    can,
    /** 부장 이상 — 현장 세팅·부원 관리 */
    isAdmin: RANK[role] >= RANK.lead,
    /** 부원 이상 — 모든 조작 */
    canOperate: RANK[role] >= RANK.member,
    isSuperadmin: role === "superadmin",
    canManageMembers: RANK[role] >= RANK.lead,
  };
}
