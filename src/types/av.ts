/** 녹음·녹화 (서버 /api/av) */

export type AvKind = "av" | "video" | "audio";

/** 서버 PC 화면 녹화기 준비 상태 */
export interface ScreenRecorderStatus {
  driver: "mock" | "window" | string;
  ready: boolean;
  detail: string;
  ffmpeg: boolean;
  /** window 드라이버만 — 크롬(없으면 엣지)을 찾았는지 */
  chrome: boolean | null;
  browser?: string | null;
  /** h264_nvenc · h264_qsv · h264_amf · libx264 */
  encoder?: string | null;
  hardware: boolean;
  capture?: string | null;
  fps: number;
  fpsOptions: number[];
  recording: boolean;
  channel?: number | null;
  error: string;
}

export interface AvChannel {
  channel: number;
  /** 관리자가 붙인 이름 (비면 '') */
  name: string;
  /** 이름이 없으면 기본 이름 (방송 & 전광판·다목적홀·강당, 그 밖은 CHn) */
  label: string;
  /** 연결된 홀 — 이 채널을 고르면 그 홀 콘솔이 소리로 자동 선택 */
  hall: string | null;
  hallName: string | null;
  /** 이 채널에 TV(송출 화면)가 붙어 있는지. 녹화와는 상관없다 (서버 PC 가 화면을 직접 띄워 찍음) */
  live: boolean;
  displays: number;
  /** 지금 송출 중인 것 (standby·image·video·screen …) */
  type: string;
}

export interface AvHall {
  id: string;
  name: string;
  /** 콘솔 녹음이 설정되어 있는지 */
  configured: boolean;
}

export interface AvSession {
  kind: AvKind;
  kindName: string;
  id: string | null;
  channel: number | null;
  hall: string | null;
  label: string;
  source: string;
  startedAt: string;
  elapsed: number;
  fps: number | null;
  encoder: string | null;
  error: string;
}

export interface AvState {
  recorder: ScreenRecorderStatus;
  session: AvSession | null;
  channels: AvChannel[];
  halls: AvHall[];
  disk: { free: number | null; hoursLeft: number | null };
  mbPerHour: { audio: number; video: number };
}

export interface AvItem {
  id: string;
  kind: AvKind;
  kindName: string;
  label: string;
  startedAt: string;
  duration: number;
  /** 예: 강당 프로젝터 + 강당 콘솔 */
  source: string;
  channel: number | null;
  channelName: string;
  hall: string | null;
  hallName: string | null;
  /** 소리만: importing·ready·error / 영상: recording·processing·ready·error */
  status: "recording" | "processing" | "importing" | "ready" | "error";
  stage: string;
  stageName: string;
  progress: number;
  error: string;
  warning: string;
  size: number;
  thumb: boolean;
  /** 소리만이면 자기 자신, 영상+소리면 함께 녹음한 콘솔 WAV */
  audioId: string | null;
  hasVideo: boolean;
  hasOutput: boolean;
  fps: number | null;
  encoder: string | null;
  offset: number | null;
  lanes?: string[];
}
