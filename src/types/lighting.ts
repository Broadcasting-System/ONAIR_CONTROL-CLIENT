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
  swatch: string;
  value: LightColor;
}

// 색을 섞는 LED 기준 기본 8색 — 실제 강당 LED 모델을 확인하면 맞춘다
export const COLOR_PRESETS: ColorPreset[] = [
  { name: "흰색", swatch: "#F4F4F4", value: { r: 255, g: 255, b: 255, w: 255, a: 0 } },
  { name: "빨강", swatch: "#FF3B3B", value: { r: 255, g: 0, b: 0, w: 0, a: 0 } },
  { name: "주황", swatch: "#FF8A1F", value: { r: 255, g: 90, b: 0, w: 0, a: 0 } },
  { name: "노랑", swatch: "#FFD83D", value: { r: 255, g: 190, b: 0, w: 0, a: 0 } },
  { name: "초록", swatch: "#2BE36A", value: { r: 0, g: 255, b: 0, w: 0, a: 0 } },
  { name: "하늘", swatch: "#3FC8FF", value: { r: 0, g: 190, b: 255, w: 0, a: 0 } },
  { name: "파랑", swatch: "#3D6BFF", value: { r: 0, g: 0, b: 255, w: 0, a: 0 } },
  { name: "보라", swatch: "#A855F7", value: { r: 150, g: 0, b: 255, w: 0, a: 0 } },
];
