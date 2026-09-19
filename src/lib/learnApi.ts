import { post, request } from "@/lib/http";

/** 장비 배우기 (캡처 마법사) — 어느 학교에서나 스피커 선택기를 연결한다. */

/** 캡처 방식 — tcp: 랜 중계 · serial: 가상 COM 포트 중계 · manual: 딴 패킷 붙여넣기 */
export type LearnMode = "tcp" | "serial" | "manual";
/** 배운 뒤 ONAIR 가 장비에 보낼 방법 */
export type LearnTransport = "tcp" | "udp" | "serial";

export interface LearnStep {
  label: string;
  title: string;
  zone: number | null;
}

export interface LearnStatus {
  active: boolean;
  mode: LearnMode | null;
  transport: LearnTransport;
  /** 시리얼 중계일 때 — 프로그램이 붙을 포트·장비 포트·속도 */
  serial: { listen: string; target: string; baud: number } | null;
  listenHost: string;
  listenPort: number;
  localIps: string[];
  target: { host: string; port: number } | null;
  zones: number;
  cols: number;
  steps: LearnStep[];
  label: string | null;
  captured: Record<string, number>;
  names: Record<string, string>;
  connections: number;
  replies: number;
  errors: string[];
}

export interface LearnResult {
  template: { mode: "bitmap" | "replay"; grid: { rows: number; cols: number }; title?: string };
  report: string[];
  checks: { single: boolean; combo: boolean | null };
  capturedZones: number[];
  missingZones: number[];
  names: Record<string, string>;
}

export interface SerialPortInfo {
  port: string;
  description: string;
  manufacturer: string;
  chip: string;
  usb: boolean;
}

export interface LearnStartBody {
  mode: LearnMode;
  /** 랜: 장비 IP · 시리얼: 장비가 붙은 COM 포트 */
  host: string;
  port?: number;
  zones: number;
  cols: number;
  listenPort?: number;
  /** 시리얼: 제조사 프로그램이 붙을 가상 COM 포트 */
  listenSerial?: string;
  baud?: number;
  /** manual 에서만 고른다 */
  transport?: LearnTransport;
}

export const learnApi = {
  status: () => request<LearnStatus>("/speakers/learn"),
  serialPorts: () => request<{ ports: SerialPortInfo[] }>("/speakers/learn/serial-ports"),
  start: (body: LearnStartBody) => post<LearnStatus>("/speakers/learn/start", body),
  mark: (label: string) => post<LearnStatus>("/speakers/learn/mark", { label }),
  packet: (label: string, hex: string) => post<LearnStatus>("/speakers/learn/packet", { label, hex }),
  name: (zone: number, name: string) => post<LearnStatus>("/speakers/learn/name", { zone, name }),
  result: () => request<LearnResult>("/speakers/learn/result"),
  apply: () => post<{ applied: boolean; mode: string; namesSaved: boolean }>("/speakers/learn/apply"),
  stop: () => post<{ active: boolean }>("/speakers/learn/stop"),
};
