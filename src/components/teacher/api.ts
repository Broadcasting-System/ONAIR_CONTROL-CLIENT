import { backendBase, backendWs } from "@/lib/backend";

/** 선생님 화면 API (/api/teacher) — TeacherApp·바로 방송이 같이 쓴다 */

/** 시험용 — 서버 자신(localhost)에서 열면 이 칸의 이메일을 선생님으로 (서버도 그 주소에서만 받는다) */
export function devEmail(): string {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return "";
  try {
    return localStorage.getItem("onair.teacher.devEmail") ?? "";
  } catch {
    return "";
  }
}

export function devHeaders(): Record<string, string> {
  const e = devEmail();
  return e ? { "x-teacher-email": e } : {};
}

export async function tapi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${backendBase()}/api/teacher${path}`, {
    ...init,
    headers: { ...(init.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}), ...devHeaders(), ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      msg = ((await r.json()) as { detail?: string }).detail ?? msg;
    } catch {}
    throw new Error(msg);
  }
  const type = r.headers.get("content-type") ?? "";
  return (type.includes("json") ? await r.json() : await r.blob()) as T;
}

/** 마이크 바로 방송 웹소켓 — 브라우저 웹소켓은 머리글을 못 붙여 시험용 메일은 쿼리로 (서버는 믿는 주소에서만 받는다) */
export function teacherLiveUrl(): string {
  const base = backendWs("/api/teacher/live");
  const e = devEmail();
  return e ? `${base}${base.includes("?") ? "&" : "?"}devEmail=${encodeURIComponent(e)}` : base;
}
