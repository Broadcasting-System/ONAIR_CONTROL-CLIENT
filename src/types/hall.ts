/** 강당·다목적홀 장비 (서버 /api/halls 응답 형태) */

export interface HallRef {
  id: string;
  name: string;
}

export interface HallSummary extends HallRef {
  hasMixer: boolean;
  hasVideoMatrix: boolean;
}

/** 드라이버가 할 수 있는 일. scene=씬 전환, channel=채널 조작, meter=입력 레벨, route=라우팅, query=장비 상태 조회 */
export type Capability = "scene" | "channel" | "meter" | "route" | "query";

interface DeviceStatus {
  hall: HallRef;
  model: string | null;
  driver: string;
  connected: boolean;
  detail: string;
  capabilities: Capability[];
}

export interface MixerScene {
  pc: number;
  name: string;
}

/** HiQnet 파라미터 표기: "VD.o1.o2.o3/파라미터" 또는 켜짐 스위치처럼 반대인 경우 {addr, pid, invert} */
export type HiqnetParam = string | { addr: string; pid: number; invert?: boolean };

export interface MixerChannel {
  id: string;
  name: string;
  label?: string;
  /** 설정 파일에 적힌 콘솔 주소 (HiQnet 연결일 때) */
  hiqnet?: { fader?: HiqnetParam; mute?: HiqnetParam };
  level: number | null;
  mute: boolean | null;
  meter: number | null;
}

export interface MixerState extends DeviceStatus {
  scenes: MixerScene[];
  currentScene: number | null;
  channels: MixerChannel[];
  master: MixerChannel | null;
}

export interface MatrixPort {
  no: number;
  name: string;
}

export interface MatrixOutput extends MatrixPort {
  /** 연결된 입력 번호. 모르면 null */
  input: number | null;
}

export interface MatrixPreset {
  id: string;
  name: string;
  custom: boolean;
}

export interface VideoMatrixState extends DeviceStatus {
  /** device = 장비에서 읽음, assumed = 서버가 마지막으로 보낸 명령 기준 추정 */
  stateSource: "device" | "assumed" | "unknown";
  inputs: MatrixPort[];
  outputs: MatrixOutput[];
  presets: MatrixPreset[];
}

/** GET /halls/status — 메인 화면 카드용 장비 연결 요약 */
export interface HallsStatus {
  devices: {
    hall: string;
    hallName: string;
    kind: "mixer" | "matrix";
    driver: string;
    connected: boolean;
    detail: string;
  }[];
  connected: number;
  total: number;
}

/** 화면에서 보내는 채널 주소 — 빈 문자열이면 지운다 */
export interface HiqnetAddress {
  fader: string;
  mute: string;
  muteInvert: boolean;
}

/** PUT /halls/{hall}/mixer/config — 씬 목록·채널 구성 편집 (관리자) */
export interface MixerConfig {
  scenes: MixerScene[];
  channels: { id: string; name: string; hiqnet?: HiqnetAddress }[];
  masterName?: string;
  masterHiqnet?: HiqnetAddress;
}

/** GET /halls/{hall}/mixer/learn — 콘솔에서 사람이 움직인 파라미터 */
export interface LearnedParam {
  param: string;
  kind: "fader" | "mute";
  min: number;
  max: number;
  last: number;
  changes: number;
  at: number;
}

/** 브릿지 노트북의 장치 (bridge.json 의 devices) */
export interface BridgeDevice {
  kind: string; // "serial" | "midi"
  port?: string;
  baud?: number;
  out?: string;
  in?: string | null;
  open: boolean;
}

/** GET /halls/bridges — 브릿지 노트북 하나 */
export interface BridgeInfo {
  url: string;
  users: { hall: string; hallName: string; kind: "mixer" | "matrix"; driver: string; device: string }[];
  online: boolean;
  detail: string;
  latencyMs: number | null;
  name: string | null;
  version: string | null;
  devices: Record<string, BridgeDevice>;
  /** 설정은 쓰는데 브릿지에 없는 장치 */
  missing: string[];
}

export interface BridgesStatus {
  tokenConfigured: boolean;
  bridges: BridgeInfo[];
}

/** 드라이버 종류 → 화면 표시 이름 */
export const DRIVER_LABEL: Record<string, string> = {
  mock: "모의 장비",
  hiqnet: "HiQnet",
  "hiqnet+midi-bridge": "HiQnet + MIDI",
  "midi-bridge": "MIDI",
  "serial-bridge": "RS-232",
  "oshm88-bridge": "RS-232",
  unavailable: "미연결",
};
