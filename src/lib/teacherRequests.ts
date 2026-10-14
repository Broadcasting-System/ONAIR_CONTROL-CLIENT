import { post, request, seg } from "@/lib/http";
import { getApiBase } from "@/lib/apiBase";

/** 선생님 요청 — 서버 app/services/teacher_service.py 와 같은 모양 */
export type Kind = "announce" | "media" | "event" | "bell";
export type Status = "new" | "accepted" | "rejected" | "done" | "canceled";
export type Tier = "general" | "lead" | "admin";
export type Scope = "class" | "grade" | "school";

export interface Teacher {
  id: string;
  email: string;
  name: string;
  dept: string;
  duty: string;
  status: "pending" | "approved" | "revoked";
  tier: Tier;
  tierLabel: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  requests: number;
}

export interface Comment {
  side: "crew" | "teacher";
  by: string;
  text: string;
  at: string;
}

export interface TeacherRequest {
  id: string;
  kind: Kind;
  kindLabel: string;
  status: Status;
  statusLabel: string;
  payload: Record<string, unknown> & {
    date?: string;
    time?: string;
    dates?: string[];
    target?: { scope: Scope; value: string };
    method?: "tts" | "crew";
    text?: string;
    channel?: number;
    memo?: string;
    title?: string;
    period?: string;
    place?: "auditorium" | "multipurpose";
    needs?: { mics: number; screen: boolean; lights: boolean; record: boolean; music: boolean };
    mode?: "short" | "exam" | "off" | "custom";
  };
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
  history: { status: Status; at: string; by: string }[];
  auto?: { type: "tts" | "media"; job?: string; fileId?: string } | null;
  autoError?: string;
  handledBy?: string;
  teacher: { id: string; name: string; dept: string; tier: Tier; tierLabel: string } | null;
  upload?: { id: string; name: string; size: number } | null;
}

export const TIER_LABEL: Record<Tier, string> = { general: "일반 교사", lead: "부장·학년부", admin: "교무·관리자" };
export const HALL_LABEL = { auditorium: "강당", multipurpose: "다목적홀" } as const;
export const BELL_MODE_LABEL = { short: "단축 수업", exam: "시험 시간표", off: "종 끄기", custom: "직접 적기" } as const;

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** 2026-10-15 → 10/15(수) */
export function dayLabel(date?: string): string {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`;
}

export function targetLabel(t?: { scope: Scope; value: string }): string {
  if (!t) return "";
  if (t.scope === "class") {
    const [g, c] = t.value.split("-");
    return `${g}학년 ${c}반`;
  }
  if (t.scope === "grade") return `${t.value}학년 전체`;
  return "학교 전체";
}

/** 목록 한 줄 요약 — 언제 · 어디로 */
export function whenOf(r: TeacherRequest): string {
  const p = r.payload;
  if (r.kind === "bell") return (p.dates ?? []).map(dayLabel).join(", ");
  if (r.kind === "event") return `${dayLabel(p.date)} ${p.period ?? ""}`.trim();
  return `${dayLabel(p.date)} ${p.time ?? ""}`;
}

export function whereOf(r: TeacherRequest): string {
  const p = r.payload;
  if (r.kind === "announce") return targetLabel(p.target);
  if (r.kind === "media") return `CH${p.channel}`;
  if (r.kind === "event") return p.place ? HALL_LABEL[p.place] : "";
  return p.mode ? BELL_MODE_LABEL[p.mode] : "";
}

/** 상태 표시 — 수락된 글 읽어 주기·영상은 '예약됨' */
export function statusText(r: TeacherRequest): string {
  if (r.status === "accepted" && r.auto && !r.autoError) return "예약됨";
  return r.statusLabel;
}

/** 방송부 요청함 API (부원 이상, 선생님 관리는 부장 이상) */
export const requestsApi = {
  list: () => request<{ requests: TeacherRequest[]; counts: Counts }>("/requests"),
  counts: () => request<Counts>("/requests/counts"),
  accept: (id: string, comment = "") => post<{ request: TeacherRequest }>(`/requests/${seg(id)}/accept`, { comment }),
  reject: (id: string, comment = "") => post<{ request: TeacherRequest }>(`/requests/${seg(id)}/reject`, { comment }),
  done: (id: string, comment = "") => post<{ request: TeacherRequest }>(`/requests/${seg(id)}/done`, { comment }),
  comment: (id: string, text: string) => post<{ request: TeacherRequest }>(`/requests/${seg(id)}/comment`, { text }),
  fileUrl: (id: string) => `${getApiBase()}/requests/${seg(id)}/file`,
  teachers: () => request<{ teachers: Teacher[] }>("/requests/teachers/all"),
  approve: (id: string, tier: Tier) => post<{ teacher: Teacher }>(`/requests/teachers/${seg(id)}/approve`, { tier }),
  setTier: (id: string, tier: Tier) => post<{ teacher: Teacher }>(`/requests/teachers/${seg(id)}/tier`, { tier }),
  revoke: (id: string) => post<{ teacher: Teacher }>(`/requests/teachers/${seg(id)}/revoke`),
};

export interface Counts {
  new: number;
  accepted: number;
  pendingTeachers: number;
}
