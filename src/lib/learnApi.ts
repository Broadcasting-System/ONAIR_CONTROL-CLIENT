import { post, request } from "@/lib/http";

/** 장비 배우기 (캡처 마법사) — 어느 학교에서나 스피커 선택기를 연결한다. */

export interface LearnStep {
  label: string;
  title: string;
  zone: number | null;
}

export interface LearnStatus {
  active: boolean;
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

export interface LearnStartBody {
  host: string;
  port: number;
  zones: number;
  cols: number;
  listenPort?: number;
}

export const learnApi = {
  status: () => request<LearnStatus>("/speakers/learn"),
  start: (body: LearnStartBody) => post<LearnStatus>("/speakers/learn/start", body),
  mark: (label: string) => post<LearnStatus>("/speakers/learn/mark", { label }),
  name: (zone: number, name: string) => post<LearnStatus>("/speakers/learn/name", { zone, name }),
  result: () => request<LearnResult>("/speakers/learn/result"),
  apply: () => post<{ applied: boolean; mode: string; namesSaved: boolean }>("/speakers/learn/apply"),
  stop: () => post<{ active: boolean }>("/speakers/learn/stop"),
};
