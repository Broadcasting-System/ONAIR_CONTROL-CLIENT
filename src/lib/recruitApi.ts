import { getApiBase } from "@/lib/apiBase";
import { HttpError, del, failure, post, put, request, seg } from "@/lib/http";
import type {
  ApplicationDetail,
  ApplicationList,
  ConfirmationList,
  InterviewRecord,
  MyApplication,
  Recruit,
  RecruitApplication,
  RecruitPublic,
  RecruitPublicInfo,
  RecruitResult,
} from "@/types/recruit";

/** 면접 기록을 다른 부원이 먼저 고쳤다 — 서버가 돌려준 최신 기록 */
export class RecordConflict extends Error {
  constructor(readonly latest: InterviewRecord) {
    super("다른 부원이 먼저 저장했어요");
    this.name = "RecordConflict";
  }
}

const base = (rid: string) => `/recruit/${seg(rid)}`;
const app = (rid: string, aid: string) => `${base(rid)}/applications/${seg(aid)}`;

/** {recruit: …} 로 감싸 오든 그대로 오든 모집 하나로 */
function unwrapRecruit(x: unknown): Recruit {
  const o = x as { recruit?: Recruit } & Recruit;
  return (o && typeof o === "object" && "recruit" in o && o.recruit ? o.recruit : o) as Recruit;
}

/** 공개 공고 — {recruit, history, email} 이든 공고 그대로든 같은 모양으로 */
function toPublic(x: unknown): RecruitPublic {
  if (!x || typeof x !== "object") return { recruit: null, history: [] };
  const o = x as Partial<RecruitPublic> & Partial<RecruitPublicInfo>;
  const stats = o.stats && Array.isArray(o.stats.items) ? o.stats : null;
  if ("recruit" in o) {
    const r = o.recruit ?? null;
    return { recruit: r, history: o.history ?? r?.history ?? [], stats, email: o.email ?? null };
  }
  // 서버는 공고를 그대로 준다. 모집이 없으면 {id: null, phase: "none", history, stats}
  if (typeof o.id === "string")
    return { recruit: o as RecruitPublicInfo, history: o.history ?? [], stats, email: null };
  return { recruit: null, history: o.history ?? [], stats, email: null };
}

export interface ApplyBody {
  name: string;
  studentId: string;
  phone: string;
  answers: Record<string, string>;
  consent: true;
}

export type ResultValue = RecruitResult | { reserve: number } | null;

export const recruitApi = {
  // 지원자 (학교 계정, 부원 아니어도)
  current: async () => toPublic(await request<unknown>("/recruit/current")),
  apply: (rid: string, body: ApplyBody) => post<MyApplication>(`${base(rid)}/apply`, body),
  me: () => request<MyApplication>("/recruit/me"),
  /** 마감 전 내 지원서 고치기 */
  editMine: (body: Omit<ApplyBody, "consent">) => put<MyApplication>("/recruit/me", body),
  /** 마감 전 내 지원 취소 */
  cancelMine: () => del<MyApplication>("/recruit/me"),
  /** 합격자 입부 확정·거절. 확정한 뒤 메일 아이디만 다시 보낼 수도 있다 */
  confirm: (accept: boolean, mailId?: string) =>
    post<MyApplication>("/recruit/me/confirm", mailId ? { accept, mailId } : { accept }),

  // 부장
  list: async () => {
    const res = await request<{ recruits: Recruit[] } | Recruit[]>("/recruit");
    return Array.isArray(res) ? res : res.recruits;
  },
  create: async (body: Partial<Recruit> & { cohort: number }) =>
    unwrapRecruit(await post<unknown>("/recruit", body)),
  save: async (rid: string, body: Partial<Recruit>) =>
    unwrapRecruit(await put<unknown>(base(rid), body)),
  open: async (rid: string) => unwrapRecruit(await post<unknown>(`${base(rid)}/open`)),
  close: async (rid: string) => unwrapRecruit(await post<unknown>(`${base(rid)}/close`)),

  // 부원 (부장이면 답까지)
  applications: (rid: string) => request<ApplicationList>(`${base(rid)}/applications`),
  application: (rid: string, aid: string) => request<ApplicationDetail>(app(rid, aid)),
  /** 지원 취소 처리 (기록은 남김) · purge 면 개인 정보까지 지우기 */
  removeApplication: (rid: string, aid: string, purge = false) =>
    del<unknown>(`${app(rid, aid)}${purge ? "?purge=true" : ""}`),

  // 면접 배정 (부장)
  scheduleByName: (rid: string) =>
    post<{ moved: number; kept: number }>(`${base(rid)}/schedule/by-name`),
  moveSlot: (rid: string, aid: string, to: { swapWith?: string; toEnd?: boolean }) =>
    put<RecruitApplication>(`${app(rid, aid)}/slot`, to),

  // 면접 기록 (부원이면서 모집 기수보다 앞 기수)
  record: (rid: string, aid: string) => request<InterviewRecord>(`${app(rid, aid)}/record`),
  saveRecord: async (
    rid: string,
    aid: string,
    text: string,
    baseVersion: number,
  ): Promise<InterviewRecord> => {
    const res = await fetch(`${getApiBase()}${app(rid, aid)}/record`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, baseVersion }),
    });
    if (res.status === 409) {
      const body = await res
        .clone()
        .json()
        .catch(() => null);
      // 서버는 {detail, record} 로 최신 기록을 같이 준다
      const latest = (body?.record ?? body?.detail?.record ?? null) as InterviewRecord | null;
      if (latest && typeof latest.text === "string") throw new RecordConflict(latest);
      throw await failure(res);
    }
    if (!res.ok) throw await failure(res);
    return (await res.json()) as InterviewRecord;
  },
  /** 1~5, null 이면 내 점수 빼기 */
  score: (rid: string, aid: string, score: number | null) =>
    put<InterviewRecord>(`${app(rid, aid)}/score`, { score }),

  // 발표 (부장)
  setResults: async (rid: string, results: Record<string, ResultValue>) =>
    unwrapRecruit(await put<unknown>(`${base(rid)}/results`, { results })),
  announce: async (rid: string, at: string | null) =>
    unwrapRecruit(await post<unknown>(`${base(rid)}/announce`, { at })),
  promote: (rid: string, body: { count?: number; confirmBy?: string | null } = {}) =>
    post<{ promoted: RecruitApplication[]; vacancies: number }>(`${base(rid)}/promote`, body),
  confirmations: (rid: string) => request<ConfirmationList>(`${base(rid)}/confirmations`),
};

export { HttpError };
