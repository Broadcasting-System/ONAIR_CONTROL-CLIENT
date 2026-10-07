import type { HallRef } from "@/types/hall";

/** 색 채널 — 빨·초·파·흰·호박·자외선 (0~255) */
export type ColorRole = "r" | "g" | "b" | "w" | "a" | "uv";
export type LightColor = Partial<Record<ColorRole, number>>;

export interface LightValue {
  intensity: number; // 0~100
  color?: LightColor;
}

export interface Fixture {
  id: string;
  name: string;
  type: string;
  address: number;
  // 채널 역할 (dim r g b w a uv strobe none) 또는 늘 보내는 고정 값
  channels: (string | number)[];
  group: string;
  hasColor: boolean;
  hasDim: boolean;
  value: LightValue;
}

export interface LightScene {
  id: string;
  name: string;
  fade: number;
}

/** 조명기 종류 — 서버 FIXTURE_TYPES (custom 은 채널을 직접 적는다) */
export interface FixtureType {
  name: string;
  channels: string[];
}

/** 조명 변환기 — esp32=ONAIR 조명 노드, opendmx=FTDI USB-DMX 케이블, pro=ENTTEC Pro 방식 */
export type DmxInterface = "esp32" | "opendmx" | "pro";

/** 조명 연결 방식 (서버에 보내는 값과 같은 모양) */
export interface LightingConnection {
  driver: "mock" | "bridge";
  bridgeUrl: string;
  device: string;
  port: string;
  virtual: boolean;
  interface: DmxInterface;
  /** 콘솔 신호 수신기(ESP32) COM 포트 — USB-DMX 케이블로 내보낼 때만 */
  inputPort: string;
}

export interface LightingState {
  hall: HallRef;
  configured: boolean;
  connected: boolean;
  detail: string;
  driver?: string;
  /** 설정이 없으면 빠진다 */
  connection?: LightingConnection;
  types: Record<string, FixtureType>;
  /** 채널 역할 → 한국어 이름 (dim r g b w a uv strobe none) */
  roles: Record<string, string>;
  fixtures: Fixture[];
  groups?: string[];
  scenes: LightScene[];
  current: string | null;
  master: number;
  blackout: boolean;
  /** 지금 켜 둔 채널 시험 값 {주소: 값} */
  channelTest?: Record<string, number>;
  sentAt?: number | null;
}

/** 조명 목록 저장에 보내는 한 줄 — id 가 비면 서버가 만든다 */
export interface FixtureItem {
  id: string;
  name: string;
  type: string;
  address: number;
  channels?: (string | number)[];
  group: string;
}

/** 두 조명이 같이 쓰는 주소 (a·b 는 조명 id) */
export interface FixtureOverlap {
  address: number;
  a: string;
  b: string;
}

/** 콘솔 신호 읽기 — 읽는 동안 0 이 아니었던 주소 */
export interface CaptureResult {
  frames: number;
  used: { address: number; max: number; last: number }[];
}

/** 조명 화면의 색 버튼. value 는 조명에 보내는 값, swatch 는 화면에 보이는 색 */
export interface ColorPreset {
  name: string;
  /** 좁은 버튼에 쓰는 짧은 이름 */
  short?: string;
  swatch: string;
  value: LightColor;
}

// 색을 섞는 LED 기준 기본 9색 — 견본은 채도를 낮춘 무대 조명 색, value 는 실제 강당 LED 를 보고 맞춘다
// (onair-server music_light_service.COLORS 와 같은 값)
export const COLOR_PRESETS: ColorPreset[] = [
  { name: "따뜻한 흰색", short: "따뜻한", swatch: "#F3D9B1", value: { r: 255, g: 190, b: 110, w: 180, a: 200 } },
  { name: "흰색", swatch: "#ECEEF2", value: { r: 255, g: 255, b: 255, w: 255, a: 0 } },
  { name: "호박색", swatch: "#F2A65A", value: { r: 255, g: 110, b: 0, w: 0, a: 255 } },
  { name: "빨강", swatch: "#E5484D", value: { r: 255, g: 0, b: 0, w: 0, a: 0 } },
  { name: "자홍", swatch: "#D6409F", value: { r: 255, g: 0, b: 140, w: 0, a: 0 } },
  { name: "보라", swatch: "#8E5BD9", value: { r: 120, g: 0, b: 255, w: 0, a: 0 } },
  { name: "파랑", swatch: "#4C6FE0", value: { r: 0, g: 0, b: 255, w: 0, a: 0 } },
  { name: "청록", swatch: "#3DB9CF", value: { r: 0, g: 200, b: 220, w: 0, a: 0 } },
  { name: "초록", swatch: "#46A758", value: { r: 0, g: 255, b: 40, w: 0, a: 0 } },
];

/** 할로겐(색 없는 조명)을 화면에 그릴 때 쓰는 색 */
export const WARM_SWATCH = "#F3D9B1";

/** 조명에 보내는 색 값 → 화면 견본 (가장 가까운 기본색) */
export function swatchOf(color?: LightColor | null): string {
  if (!color) return WARM_SWATCH;
  const rgb = (c: LightColor) => [c.r ?? 0, c.g ?? 0, c.b ?? 0];
  const [r, g, b] = rgb(color);
  if (r + g + b === 0) return (color.w ?? 0) + (color.a ?? 0) > 0 ? WARM_SWATCH : "#3a3b40";
  let best = COLOR_PRESETS[0];
  let bestD = Infinity;
  for (const p of COLOR_PRESETS) {
    const [pr, pg, pb] = rgb(p.value);
    const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best.swatch;
}
