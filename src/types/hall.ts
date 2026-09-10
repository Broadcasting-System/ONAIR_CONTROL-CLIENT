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

export interface MixerChannel {
  id: string;
  name: string;
  label?: string;
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

/** 드라이버 종류 → 화면 표시 이름 */
export const DRIVER_LABEL: Record<string, string> = {
  mock: "모의 장비",
  hiqnet: "HiQnet",
  "midi-bridge": "MIDI",
  "oshm88-bridge": "RS-232",
  unavailable: "미연결",
};
