import type { HallRef } from "@/types/hall";

/** 통로 — 녹음 인터페이스 입력 하나 (예: 1 = 마이크, 2 = 음악) */
export interface RecordingLane {
  name: string;
  /** 이 녹음 버스로 보낼 콘솔 입력 채널 (저장만 — 콘솔 주소를 찾으면 ONAIR 가 직접 켠다) */
  sends: number[];
}

export interface RecordingConnection {
  driver: "mock" | "bridge";
  bridgeUrl: string;
  device: string;
  /** 노트북의 입력 장치 이름 (일부만 맞아도 됨) */
  input: string;
  channels: number;
  samplerate: number;
}

/** 서버 GET /halls/{hall}/recording */
export interface RecordingState {
  hall: HallRef;
  configured: boolean;
  connected: boolean;
  detail: string;
  driver?: string;
  connection?: RecordingConnection;
  lanes: RecordingLane[];
  splitLanes?: boolean;
  recording: boolean;
  /** 지난 물음 뒤로 가장 컸던 값 (dBFS, 소리 없으면 -90) */
  levels: number[];
  peakHold?: number[];
  receiving?: boolean | null;
  elapsed?: number | null;
  label?: string;
  startedAt?: string | null;
  bytes?: number | null;
  /** 녹음 중 소리가 찢어진(0dBFS) 횟수 — 통로마다 */
  clips?: number[];
  recError?: string;
  inputDevice?: string;
  disk: { free: number | null; hoursLeft: number | null };
  mbPerHour: number;
  importing: { id: string; label: string; progress: number }[];
}

export type RecordingStatus = "importing" | "ready" | "error";

export interface RecordingItem {
  id: string;
  hall: string;
  hallName: string;
  label: string;
  startedAt: string;
  duration: number;
  channels: number;
  samplerate: number;
  lanes: string[];
  clips: number[];
  split: boolean;
  status: RecordingStatus;
  progress: number;
  error: string;
  warning: string;
  size: number;
}

export interface InputDevice {
  index: number;
  name: string;
  hostapi: string;
  channels: number;
  samplerate: number;
  default: boolean;
}

export interface UploadedVideo {
  id: string;
  name: string;
  size: number;
  duration: number;
  codec: string;
  width: number;
  height: number;
  hasAudio: boolean;
  uploadedAt: string;
}

export type LaneMode = "both" | "1" | "2";
export type AmbientMode = "off" | "low" | "mid";
export type MergeStage = "queued" | "extract" | "prepare" | "sync" | "render" | "done" | "error";

export interface MergeJob {
  id: string;
  videoId: string;
  videoName: string;
  recordingId: string;
  recordingLabel: string;
  lanes: LaneMode;
  ambient: AmbientMode;
  nudgeMs: number;
  status: "queued" | "running" | "done" | "error";
  stage: MergeStage;
  stageName: string;
  progress: number;
  error: string;
  createdAt: string;
  finishedAt: string | null;
  sync: { offset: number; driftPpm: number; precise: boolean } | null;
  summary: { start: string; drift: string } | null;
  size: number;
  duration: number;
  name: string;
}
