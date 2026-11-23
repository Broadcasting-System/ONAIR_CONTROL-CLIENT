import type { InterviewBreak, RecruitApplication } from "@/types/recruit";

/** 모집 화면 글자·숫자 도우미 (날짜는 이 기기 시간대로 보인다) */

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
export const pad2 = (n: number) => String(n).padStart(2, "0");

const toDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** 3월 13일 */
export function md(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? `${d.getMonth() + 1}월 ${d.getDate()}일` : "";
}
/** 3월 13일 토요일 */
export function mdDow(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? `${md(iso)} ${DOW[d.getDay()]}요일` : "";
}
/** 18:00 */
export function hm(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : "";
}
/** 3월 15일 18:00 */
export function mdhm(iso: string | null | undefined): string {
  return iso && toDate(iso) ? `${md(iso)} ${hm(iso)}` : "";
}
/** 3.13 */
export function dotMd(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? `${d.getMonth() + 1}.${d.getDate()}` : "";
}

/** 남은 시간 → D-3 04:12:33 (하루 안이면 D-0) */
export function countdown(ms: number): { dd: string; hms: string; days: number } {
  const left = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return { dd: `D-${d}`, hms: `${pad2(h)}:${pad2(m)}:${pad2(s)}`, days: d };
}

/** 20시간 19분 · 6일 20시간 */
export function leftWords(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d}일 ${h}시간`;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

/** 3.2 : 1 */
export function ratioText(applied: number, quota: number): string {
  if (!quota) return "0 : 1";
  return `${(applied / quota).toFixed(1)} : 1`;
}

/** 학번 4자리 → 학년·반·번호 (1207 = 1학년 2반 07번) */
export function parseStudentId(id: string): { grade: number; cls: number; no: number } | null {
  const m = /^(\d)(\d)(\d{2})$/.exec(id.trim());
  if (!m) return null;
  return { grade: Number(m[1]), cls: Number(m[2]), no: Number(m[3]) };
}

export const isStudentId = (id: string) => {
  const p = parseStudentId(id);
  return !!p && p.grade >= 1 && p.grade <= 3 && p.cls >= 1 && p.no >= 1;
};

/** 010-1234-5678 꼴로 하이픈 넣기 */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
}
export const isPhone = (s: string) => /^01\d-\d{3,4}-\d{4}$/.test(s);

/** 반별로 묶고 반 안에서 학번순. 학년이 섞이면 '1학년 2반' 처럼 */
export function groupByClass<T extends { studentId: string }>(
  list: T[],
): { key: string; label: string; items: T[] }[] {
  const sorted = [...list].sort((a, b) => a.studentId.localeCompare(b.studentId));
  const grades = new Set(sorted.map((a) => parseStudentId(a.studentId)?.grade ?? 0));
  const groups = new Map<string, { key: string; label: string; items: T[] }>();
  for (const a of sorted) {
    const p = parseStudentId(a.studentId);
    const key = p ? `${p.grade}${p.cls}` : "?";
    const label = !p ? "학번 없음" : grades.size > 1 ? `${p.grade}학년 ${p.cls}반` : `${p.cls}반`;
    if (!groups.has(key)) groups.set(key, { key, label, items: [] });
    groups.get(key)!.items.push(a);
  }
  return [...groups.values()];
}

/** 이름 첫 글자 (아바타) */
export const initial = (name: string | null | undefined) => (name ?? "").trim().slice(0, 1) || "?";

/** 면접 큐시트 줄 — 서버가 준 쉬는 시간(beforeNo 번 앞)을 끼운다 */
export type CueRow =
  | { kind: "slot"; app: RecruitApplication; at: number; end: number }
  | { kind: "break"; at: number; minutes: number };

export function buildCue(
  apps: RecruitApplication[],
  breaks: InterviewBreak[],
  minutes: number,
): CueRow[] {
  const slotted = apps.filter((a) => a.no != null).sort((a, b) => (a.no ?? 0) - (b.no ?? 0));
  const len = Math.max(1, minutes || 10) * 60000;
  const rows: CueRow[] = [];
  const brk = new Map(breaks.map((b) => [b.beforeNo, b]));
  for (const a of slotted) {
    const b = brk.get(a.no!);
    if (b && rows.length) rows.push({ kind: "break", at: Date.parse(b.at), minutes: b.minutes });
    const at = a.interviewAt ? Date.parse(a.interviewAt) : NaN;
    rows.push({ kind: "slot", app: a, at, end: at + len });
  }
  return rows;
}

/** ISO ↔ 날짜(YYYY-MM-DD)·시각(HH:MM) 칸 */
export function splitIso(iso: string | null | undefined): { date: string; time: string } {
  const d = toDate(iso);
  if (!d) return { date: "", time: "" };
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: hm(iso),
  };
}
export function joinIso(date: string, time: string): string | null {
  if (!date) return null;
  const [y, mo, da] = date.split("-").map(Number);
  const [h, mi] = (time || "00:00").split(":").map(Number);
  const d = new Date(y, mo - 1, da, h || 0, mi || 0);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
