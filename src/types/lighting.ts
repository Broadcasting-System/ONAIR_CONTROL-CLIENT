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

export interface LightingState {
  hall: HallRef;
  configured: boolean;
  connected: boolean;
  detail: string;
  driver?: string;
  fixtures: Fixture[];
  scenes: LightScene[];
  current: string | null;
  master: number;
  blackout: boolean;
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
