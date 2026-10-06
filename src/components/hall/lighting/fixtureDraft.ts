import { nextKey } from "@/components/hall/setup/draft";
import type { CaptureResult, FixtureItem, FixtureType, LightingState } from "@/types/lighting";

/** 조명 목록 초안 — 폴링으로 덮이지 않게 화면이 들고 있다가 한 번에 저장한다 */

export const DMX_MAX = 512;

export interface FixtureRow {
  key: string;
  id: string;
  name: string;
  type: string;
  /** 입력 중에는 비어 있을 수 있어 글자로 둔다 */
  address: string;
  /** custom 일 때만 — 역할 이름 또는 0~255 고정 값 */
  channels: (string | number)[];
  group: string;
}

/** 콘솔 신호 읽기에서 이어진 주소 묶음 (한 조명으로 짐작) */
export interface Run {
  from: number;
  to: number;
  last: number[];
}

export function toRows(s: LightingState): FixtureRow[] {
  return s.fixtures.map((f) => ({
    key: nextKey(),
    id: f.id,
    name: f.name,
    type: f.type,
    address: String(f.address),
    channels: f.type === "custom" ? [...f.channels] : [],
    group: f.group ?? "",
  }));
}

/** 저장된 것과 비교하기 위한 문자열 (화면용 키는 뺀다) */
export function serializeRows(rows: FixtureRow[]): string {
  return JSON.stringify(
    rows.map((r) => [r.id, r.name, r.type, r.address.trim(), r.type === "custom" ? r.channels : [], r.group]),
  );
}

/** 한 조명이 쓰는 채널 수 */
export function widthOf(row: Pick<FixtureRow, "type" | "channels">, types: Record<string, FixtureType>): number {
  if (row.type === "custom") return row.channels.length;
  return types[row.type]?.channels.length ?? 1;
}

export const addrNum = (v: string): number | null => {
  const t = v.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  return Number(t);
};

/** 시작~끝 주소 (주소가 틀렸으면 null) */
export function spanOf(row: FixtureRow, types: Record<string, FixtureType>): { from: number; to: number } | null {
  const a = addrNum(row.address);
  const w = widthOf(row, types);
  if (a === null || w < 1 || a < 1 || a + w - 1 > DMX_MAX) return null;
  return { from: a, to: a + w - 1 };
}

export const rangeText = (from: number, to: number) => (to > from ? `${from}–${to}` : `${from}`);

/** 주소 목록 → "1–3, 7, 10–13" */
export function rangesText(addrs: number[]): string {
  const sorted = [...new Set(addrs)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    out.push(rangeText(sorted[i], sorted[j]));
    i = j + 1;
  }
  return out.join(", ");
}

/** 목록이 쓰는 주소 전체 */
export function coveredAddrs(rows: FixtureRow[], types: Record<string, FixtureType>): Set<number> {
  const set = new Set<number>();
  for (const r of rows) {
    const s = spanOf(r, types);
    if (s) for (let a = s.from; a <= s.to; a++) set.add(a);
  }
  return set;
}

/** 콘솔 신호 읽기 결과 → 이어진 주소끼리 묶음 */
export function groupRuns(used: CaptureResult["used"]): Run[] {
  const sorted = [...used].sort((a, b) => a.address - b.address);
  const runs: Run[] = [];
  for (const u of sorted) {
    const last = runs[runs.length - 1];
    if (last && u.address === last.to + 1) {
      last.to = u.address;
      last.last.push(u.last);
    } else {
      runs.push({ from: u.address, to: u.address, last: [u.last] });
    }
  }
  return runs;
}

/** 이어진 주소 개수로 종류를 짐작한다 (1=밝기만, 3=LED 색, 4=LED 밝기+색, 5=LED 밝기+색+흰색, 그 밖=직접 정하기) */
export function guessType(len: number): string {
  return ({ 1: "dimmer", 3: "rgb", 4: "drgb", 5: "drgbw" } as Record<number, string>)[len] ?? "custom";
}

/** 종류 이름 줄임 — "LED 밝기+색 (4채널)" → "LED 밝기+색" */
export const shortType = (name: string) => name.split(" (")[0];

/** 서로 주소가 겹치는 조명 쌍 — 서버 overlaps 와 같은 방식, 화면에는 이름으로 */
export function overlapPairs(
  rows: FixtureRow[],
  types: Record<string, FixtureType>,
): { a: string; b: string; addrs: number[] }[] {
  const owner = new Map<number, number>();
  const pairs = new Map<string, { a: string; b: string; addrs: number[] }>();
  rows.forEach((r, i) => {
    const s = spanOf(r, types);
    if (!s) return;
    for (let addr = s.from; addr <= s.to; addr++) {
      const j = owner.get(addr);
      if (j === undefined) {
        owner.set(addr, i);
        continue;
      }
      const k = `${j}:${i}`;
      const p = pairs.get(k) ?? { a: rows[j].name.trim() || `${j + 1}번째`, b: r.name.trim() || `${i + 1}번째`, addrs: [] };
      p.addrs.push(addr);
      pairs.set(k, p);
    }
  });
  return [...pairs.values()];
}

/** 저장 전에 고쳐야 할 것들 (없으면 빈 배열) */
export function rowProblems(rows: FixtureRow[], types: Record<string, FixtureType>): string[] {
  const out: string[] = [];
  if (rows.length > 128) out.push("조명은 128개까지 넣을 수 있어요");
  if (rows.some((r) => !r.name.trim())) out.push("이름 없는 조명이 있어요");
  if (rows.some((r) => r.name.trim().length > 24)) out.push("이름은 24자 이하로 적어 주세요");
  if (rows.some((r) => !types[r.type])) out.push("종류를 안 고른 조명이 있어요");
  if (rows.some((r) => r.type === "custom" && (r.channels.length < 1 || r.channels.length > 32)))
    out.push("직접 정하기는 채널이 1~32개여야 해요");
  if (rows.some((r) => r.channels.some((c) => typeof c === "number" && (!Number.isInteger(c) || c < 0 || c > 255))))
    out.push("고정 값은 0~255 사이여야 해요");
  if (rows.some((r) => !spanOf(r, types))) out.push("시작 주소가 비었거나 512 를 넘는 조명이 있어요");
  return out;
}

export function toItems(rows: FixtureRow[]): FixtureItem[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name.trim(),
    type: r.type,
    address: Number(r.address.trim()),
    ...(r.type === "custom" ? { channels: r.channels } : {}),
    group: r.group,
  }));
}

/** 목록 다음 빈 주소 — '직접 추가' 줄의 시작 주소 */
export function nextFreeAddr(rows: FixtureRow[], types: Record<string, FixtureType>): number {
  let end = 0;
  for (const r of rows) {
    const s = spanOf(r, types);
    if (s) end = Math.max(end, s.to);
  }
  return Math.min(DMX_MAX, end + 1);
}
