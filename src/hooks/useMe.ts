import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/apiBase";

export type Role = "admin" | "operator" | "viewer";

export interface Me {
  ip: string;
  name: string;
  owner: string;
  role: Role;
}

const RANK: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };

/** 현재 기기(요청자)의 신원/역할. Tailscale IP 기반 서버 식별. */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/devices/me`);
        if (res.ok && alive) setMe((await res.json()) as Me);
      } catch {
        /* 네트워크 실패는 무시 — viewer 취급 */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const role: Role = me?.role ?? "viewer";
  const can = (required: Role) => RANK[role] >= RANK[required];

  return { me, role, loading, can, isAdmin: role === "admin", canOperate: can("operator") };
}
