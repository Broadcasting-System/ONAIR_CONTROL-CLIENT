import type { HiqnetAddress, HiqnetParam, MixerChannel, MixerConfig, MixerMode, MixerState } from "@/types/hall";

/** 믹서 구성 초안 (채널·씬·마스터·조작 범위). 폴링으로 덮이지 않게 화면이 들고 있다가 한 번에 저장한다. */

let seq = 0;
/** 줄 순서를 바꿔도 입력 칸이 섞이지 않게 붙이는 화면용 키 */
export const nextKey = () => `r${++seq}`;

export type ChannelRow = { key: string; id: string; name: string; max: number; hidden: boolean } & HiqnetAddress;
export type SceneRow = { key: string; pc: number; name: string; confirm: boolean };
export type MasterRow = { id: string; name: string; max: number } & HiqnetAddress;

export interface Draft {
  mode: MixerMode;
  scenes: SceneRow[];
  channels: ChannelRow[];
  master: MasterRow | null;
}

// HiQnet 파라미터 표기 "VD.o1.o2.o3/파라미터"
export const ADDR_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,5}$/;
export const CHANNEL_ID_RE = /^[0-9A-Za-z_-]{1,8}$/;
export const badAddr = (v: string) => v.trim() !== "" && !ADDR_RE.test(v.trim());
export const badMax = (v: number) => !Number.isInteger(v) || v < 0 || v > 100;
export const badPc = (pc: number) => !Number.isInteger(pc) || pc < 1 || pc > 128;

const specText = (p?: HiqnetParam) => (!p ? "" : typeof p === "string" ? p : `${p.addr}/${p.pid}`);

export const toAddress = (h?: MixerChannel["hiqnet"]): HiqnetAddress => ({
  fader: specText(h?.fader),
  mute: specText(h?.mute),
  muteInvert: typeof h?.mute === "object" && !!h.mute.invert,
});

export const cleanAddr = (a: HiqnetAddress): HiqnetAddress => ({
  fader: a.fader.trim(),
  mute: a.mute.trim(),
  muteInvert: a.muteInvert && !!a.mute.trim(),
});

export function toDraft(s: MixerState): Draft {
  return {
    mode: s.mode ?? "channels",
    scenes: s.scenes.map((sc) => ({ key: nextKey(), pc: sc.pc, name: sc.name, confirm: !!sc.confirm })),
    channels: s.channels.map((c) => ({
      key: nextKey(),
      id: c.id,
      name: c.name,
      max: c.max ?? 100,
      hidden: !!c.hidden,
      ...toAddress(c.hiqnet),
    })),
    master: s.master
      ? { id: s.master.id, name: s.master.name, max: s.master.max ?? 100, ...toAddress(s.master.hiqnet) }
      : null,
  };
}

/** 저장된 것과 비교하기 위한 문자열 (화면용 키는 뺀다) */
export function serialize(d: Draft): string {
  return JSON.stringify({
    mode: d.mode,
    scenes: d.scenes.map((s) => [s.pc, s.name, s.confirm]),
    channels: d.channels.map((c) => [c.id, c.name, c.max, c.hidden, c.fader, c.mute, c.muteInvert]),
    master: d.master,
  });
}

export function toConfig(d: Draft, hiqnet: boolean): MixerConfig {
  return {
    mode: d.mode,
    scenes: d.scenes.map((s) => ({ pc: s.pc, name: s.name.trim(), confirm: s.confirm })),
    channels: d.channels.map((c) => ({
      id: c.id.trim(),
      name: c.name.trim(),
      max: c.max,
      hidden: c.hidden,
      ...(hiqnet ? { hiqnet: cleanAddr(c) } : {}),
    })),
    masterName: d.master ? d.master.name.trim() : undefined,
    masterMax: d.master ? d.master.max : undefined,
    masterHiqnet: d.master && hiqnet ? cleanAddr(d.master) : undefined,
  };
}

export function duplicates(values: string[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return dup;
}

export function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** 저장 전에 고쳐야 할 것들 (없으면 빈 배열) */
export function draftProblems(d: Draft, hiqnet: boolean): string[] {
  const out: string[] = [];
  const pcs = d.scenes.map((s) => String(s.pc));
  if (d.scenes.some((s) => badPc(s.pc))) out.push("씬 번호는 1~128 사이여야 해요");
  if (duplicates(pcs).size) out.push("같은 씬 번호가 두 번 있어요");
  if (d.scenes.some((s) => !s.name.trim())) out.push("이름 없는 씬이 있어요");
  const ids = d.channels.map((c) => c.id.trim());
  if (ids.some((id) => !CHANNEL_ID_RE.test(id))) out.push("채널 번호는 영문·숫자 8자 이하여야 해요");
  if (duplicates([...ids, ...(d.master ? [d.master.id] : [])]).size) out.push("같은 채널 번호가 두 번 있어요");
  if (d.channels.some((c) => !c.name.trim())) out.push("이름 없는 채널이 있어요");
  if (d.master && !d.master.name.trim()) out.push("마스터 이름이 비어 있어요");
  if ([...d.channels, ...(d.master ? [d.master] : [])].some((c) => badMax(c.max))) out.push("MAX 는 0~100 사이여야 해요");
  if (hiqnet && [...d.channels, ...(d.master ? [d.master] : [])].some((c) => badAddr(c.fader) || badAddr(c.mute)))
    out.push("콘솔 주소 형식이 틀린 칸이 있어요 (예: 1.0.0.22/37)");
  return out;
}

/** Si 계열 기본 주소 (HiQontrol 분석 기준 추정) — CH N 페이더 = 1.0.0.22/(36+N), 뮤트 = 1.0.0.(47+N)/1 */
export function siAddress(id: string): { fader: string; mute: string } | null {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1 || n > 32) return null;
  return { fader: `1.0.0.22/${36 + n}`, mute: `1.0.0.${47 + n}/1` };
}
