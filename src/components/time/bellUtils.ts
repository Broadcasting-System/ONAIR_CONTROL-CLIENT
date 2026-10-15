import { Bell, DaySchedule, DayType } from "@/types/time";
import { CATEGORY_ORDER, DEAD_SPEAKERS, SPEAKER_CATEGORY } from "@/constants/speakerMap";
import { dayTypeOf } from "@/constants/days";

/** 시보 음악을 기기 호스트와 무관하게 식별하기 위한 정규화.
 *  절대 URL(http://host:8000/api/files/stream/audio/x.mp3)이 기기마다 호스트가 달라
 *  드롭다운이 매칭에 실패("없음")하던 문제를 해결 → 경로(pathname)만 저장·비교. */
export function audioKey(u: string): string {
  if (!u || u === "none") return u;
  try {
    return u.startsWith("http") ? new URL(u).pathname : u;
  } catch {
    return u;
  }
}

export const sortBells = (bells: Bell[]) =>
  [...bells].sort((a, b) => a.time.localeCompare(b.time) || a.label.localeCompare(b.label, "ko"));

/** 같은 시보 짝: 이름과 시간이 같다 (요일마다 id 가 달라도) */
export const samePair = (a: Pick<Bell, "label" | "time">, b: Pick<Bell, "label" | "time">) =>
  a.label.trim() === b.label.trim() && a.time === b.time;

/** 비교용 — 서버가 시간 앞자리 0 을 채우고, 옛 시보는 음악이 절대 주소·볼륨 없음이라 맞춰서 본다 */
const pad = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : t;
};
const norm = (b: Bell) =>
  JSON.stringify([
    (b.label ?? "").trim(),
    pad(b.time),
    audioKey(b.audioFile ?? ""),
    [...(b.speakers ?? [])].sort(),
    b.volume ?? 100,
  ]);

/** 한 요일의 로컬 시보와 서버 시보 비교.
 *  - 같은 id 인데 내용이 다르면 고친 것
 *  - id 가 달라도 내용이 같은 짝이 서버에 있으면 그대로인 것 (요일 복사·붙여넣기로 id 만 바뀐 경우)
 *  - 남은 로컬은 새로 넣은 것, 남은 서버는 지운 것 */
export function diffDay(local: Bell[], server: Bell[]): { changed: Set<string>; count: number } {
  const byId = new Map(server.map((b) => [b.id, b]));
  const used = new Set<string>();
  const changed = new Set<string>();
  let count = 0;
  const rest: Bell[] = [];
  for (const b of local) {
    const s = byId.get(b.id);
    if (s && !used.has(s.id)) {
      used.add(s.id);
      if (norm(s) !== norm(b)) {
        changed.add(b.id);
        count += 1;
      }
    } else rest.push(b);
  }
  const left = new Map<string, number>();
  for (const s of server) if (!used.has(s.id)) left.set(norm(s), (left.get(norm(s)) ?? 0) + 1);
  for (const b of rest) {
    const k = norm(b);
    const n = left.get(k) ?? 0;
    if (n > 0) left.set(k, n - 1);
    else {
      changed.add(b.id);
      count += 1;
    }
  }
  for (const n of left.values()) count += n;
  return { changed, count };
}

// ---------------------------------------------------------------- 장소 묶음

export interface SpeakerSection {
  name: string;
  ids: string[];
  /** 교실만: 학년별 줄 */
  grades?: { grade: string; ids: string[] }[];
}

const CLASS_RE = /^(\d+)-(\d+)$/;

/** 스피커 이름을 분류(SPEAKER_CATEGORY)로 묶는다. '학년-반' 이름은 교실, 분류에 없으면 기타, 연결 없는 스피커는 뺀다. */
export function buildSections(names: string[]): SpeakerSection[] {
  const dead = new Set(DEAD_SPEAKERS);
  const by = new Map<string, string[]>();
  for (const n of names) {
    if (dead.has(n)) continue;
    const cat = CLASS_RE.test(n) ? "교실" : (SPEAKER_CATEGORY[n] ?? "기타");
    by.set(cat, [...(by.get(cat) ?? []), n]);
  }
  const tail = ["기타", "미연결"];
  const known = CATEGORY_ORDER.filter((c) => !tail.includes(c));
  const extra = [...by.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort((a, b) => a.localeCompare(b, "ko"));
  return [...known, ...extra, ...tail]
    .filter((c) => by.has(c))
    .map((name) => {
      const ids = by.get(name)!;
      if (name !== "교실") return { name, ids };
      const cls = ids
        .filter((n) => CLASS_RE.test(n))
        .sort((a, b) => {
          const [, ga, ca] = CLASS_RE.exec(a)!;
          const [, gb, cb] = CLASS_RE.exec(b)!;
          return Number(ga) - Number(gb) || Number(ca) - Number(cb);
        });
      const grades: { grade: string; ids: string[] }[] = [];
      for (const n of cls) {
        const g = CLASS_RE.exec(n)![1];
        const row = grades.find((r) => r.grade === g);
        if (row) row.ids.push(n);
        else grades.push({ grade: g, ids: [n] });
      }
      const other = ids.filter((n) => !CLASS_RE.test(n));
      return { name, ids: [...cls, ...other], grades };
    });
}

/** 고른 장소를 짧게: 학교 전체 / 1·2학년 · 복도 2곳 / 3-1 */
export function summarizeSpeakers(
  sel: string[] | undefined,
  sections: SpeakerSection[],
): { text: string; all: boolean; none: boolean } {
  if (!sel || sel.length === 0) return { text: "장소 없음", all: false, none: true };
  const set = new Set(sel);
  const allIds = sections.flatMap((s) => s.ids);
  if (allIds.length > 0 && allIds.every((id) => set.has(id))) return { text: "학교 전체", all: true, none: false };
  const tokens: string[] = [];
  for (const sec of sections) {
    const on = sec.ids.filter((id) => set.has(id));
    if (on.length === 0) continue;
    if (on.length === sec.ids.length) {
      tokens.push(sec.name === "교실" ? "모든 교실" : sec.name);
      continue;
    }
    if (sec.grades) {
      const full = sec.grades.filter((g) => g.ids.every((id) => set.has(id)));
      if (full.length) tokens.push(`${full.map((g) => g.grade).join("·")}학년`);
      const inFull = new Set(full.flatMap((g) => g.ids));
      const rest = on.filter((id) => !inFull.has(id));
      if (rest.length > 2) tokens.push(`교실 ${rest.length}곳`);
      else tokens.push(...rest);
      continue;
    }
    tokens.push(on.length === 1 ? on[0] : `${sec.name.split("·")[0]} ${on.length}곳`);
  }
  const known = new Set(allIds);
  const stale = sel.filter((id) => !known.has(id) && !DEAD_SPEAKERS.includes(id));
  tokens.push(...stale);
  return { text: tokens.join(" · ") || "장소 없음", all: false, none: tokens.length === 0 };
}

// ---------------------------------------------------------------- 다음 시보

export interface BellAt {
  at: number;
  time: string;
  label: string;
}

/** 울리는 그룹의 앞뒤 시보. 특별 시간표면 P 시보가 매일, 아니면 그날 평일 요일 시보가 울린다. */
export function upcomingBells(
  days: DaySchedule[],
  special: boolean,
  now: Date,
): { next: BellAt | null; after: BellAt | null; prevAt: number | null } {
  const items: BellAt[] = [];
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let d = -7; d <= 7; d++) {
    const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d);
    const dt: DayType | null = special ? "P" : dayTypeOf(date);
    if (!dt) continue;
    for (const b of days.find((x) => x.dayType === dt)?.bells ?? []) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(b.time);
      if (!m) continue;
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(m[1]), Number(m[2])).getTime();
      items.push({ at, time: pad(b.time), label: b.label });
    }
  }
  items.sort((a, b) => a.at - b.at);
  const t = now.getTime();
  const i = items.findIndex((x) => x.at > t);
  if (i < 0) return { next: null, after: null, prevAt: items.length ? items[items.length - 1].at : null };
  return { next: items[i], after: items[i + 1] ?? null, prevAt: i > 0 ? items[i - 1].at : null };
}
