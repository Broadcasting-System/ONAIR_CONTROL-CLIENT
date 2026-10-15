import { post, request } from "@/lib/http";

/** 스위처 — 한 채널에 소스 여러 개를 한 화면·2분할·4분할·PIP 로 (서버 app/services/switcher.py) */
export type SwitchLayout = "one" | "two" | "four" | "pip";

export type SwitchSource =
  | { kind: "share"; id: string; name: string }
  | { kind: "video"; url: string; fileId?: string; name: string }
  | { kind: "image"; url: string; fileId?: string; name: string }
  | { kind: "youtube"; videoId: string; name: string }
  | { kind: "timer"; durationSec: number; mode: "down" | "up"; label: string; name: string };

export interface SwitchSlot {
  source: SwitchSource | null;
  mute: boolean;
  volume: number;
  startedAt: number;
}

export interface SwitchState {
  type: "switch";
  layout: SwitchLayout;
  slots: SwitchSlot[];
  sources: SwitchSource[];
}

export const SLOT_COUNT: Record<SwitchLayout, number> = { one: 1, two: 2, four: 4, pip: 2 };

export function sourceKey(s: SwitchSource | null | undefined): string {
  if (!s) return "";
  if (s.kind === "share") return `share:${s.id}`;
  if (s.kind === "video" || s.kind === "image") return `${s.kind}:${s.fileId || s.url}`;
  if (s.kind === "youtube") return `youtube:${s.videoId}`;
  return `timer:${s.durationSec}:${s.mode}:${s.label}`;
}

const qs = (channel: number) => (channel > 1 ? `?channel=${channel}` : "");

export const switchApi = {
  get: (channel: number) => request<SwitchState>(`/display/switch${qs(channel)}`),
  set: (channel: number, body: { layout: SwitchLayout; slots: Omit<SwitchSlot, "startedAt">[]; sources: SwitchSource[] }) =>
    post<SwitchState>(`/display/switch${qs(channel)}`, body),
};
