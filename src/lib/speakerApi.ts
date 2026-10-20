import { post, put, request, seg } from "@/lib/http";

export interface SpeakerMatrix {
  rows: number;
  cols: number;
  driver: { kind: string; rows: number; cols: number; host?: string; port?: number };
  /** 행 × 열 구역 이름. 빈 문자열 = 연결 안 된 칸 */
  cells: string[][];
}

export interface CalibrationStatus {
  active: boolean;
  current: [number, number] | null;
  startedAt: number | null;
  /** 시험음을 낼 수 있는지 (서버에 VLC가 있어야 함) */
  tone: boolean;
  idleTimeoutSec: number;
  rows: number;
  cols: number;
  /** 종이 최우선 — 종 때문에 멈출 시각(ms)과 그 종. 걸린 종이 없으면 null */
  pauseAt?: number | null;
  bell?: { time: string; label: string; at: number; jobAt: number } | null;
  /** 마지막으로 저절로 멈춘 까닭 — 다시 시작하면 사라진다. resume: 멈출 때 켜 둔 칸 */
  ended?: { reason: "bell" | "idle" | string; message: string; bell: string | null; at: number; resume: [number, number] | null } | null;
}

export interface SpeakerConnection {
  driver: string;
  host: string;
  port: number;
  source: "env" | "saved";
  drivers: string[];
  connected: boolean;
  latency: number;
}

export interface MatrixBackup {
  name: string;
  savedAt: number;
}

type SaveResult = { success: boolean; backup: string | null; matrix: SpeakerMatrix };

export const speakerApi = {
  matrix: () => request<SpeakerMatrix>("/speakers/matrix"),
  saveMatrix: (cells: string[][]) => put<SaveResult>("/speakers/matrix", { cells }),
  backups: () => request<{ backups: MatrixBackup[] }>("/speakers/matrix/backups"),
  restore: (name: string) => post<SaveResult>(`/speakers/matrix/backups/${seg(name)}/restore`),

  calibration: () => request<CalibrationStatus>("/speakers/calibration"),
  start: () => post<CalibrationStatus>("/speakers/calibration/start"),
  ping: (row: number, col: number) => post<CalibrationStatus>("/speakers/calibration/ping", { row, col }),
  silence: () => post<CalibrationStatus>("/speakers/calibration/silence"),
  stop: () => post<CalibrationStatus>("/speakers/calibration/stop"),

  connection: () => request<SpeakerConnection>("/speakers/connection"),
  testConnection: (host: string, port: number) =>
    post<{ connected: boolean; latency: number }>("/speakers/connection/test", { host, port }),
  setConnection: (body: { driver: string; host: string; port: number }) =>
    put<{ success: boolean }>("/speakers/connection", body),
};
