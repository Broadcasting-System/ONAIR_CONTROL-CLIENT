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
  /** 누를 때 한 번 더 묻기 (비상방송·행사 등) */
  confirm?: boolean;
}

/** 방송부 조작 범위 — channels=페이더·뮤트·씬, scenes=씬 전환만 */
export type MixerMode = "channels" | "scenes";

/** HiQnet 파라미터 표기: "VD.o1.o2.o3/파라미터" 또는 켜짐 스위치처럼 반대인 경우 {addr, pid, invert} */
export type HiqnetParam = string | { addr: string; pid: number; invert?: boolean };

export interface MixerChannel {
  id: string;
  name: string;
  label?: string;
  /** 설정 파일에 적힌 콘솔 주소 (HiQnet 연결일 때) */
  hiqnet?: { fader?: HiqnetParam; mute?: HiqnetParam };
  /** 화면에서 올릴 수 있는 최대 레벨(0~100). 없으면 제한 없음 */
  max?: number;
  /** 설정엔 남기되 조작 화면에서 뺀 채널 */
  hidden?: boolean;
  level: number | null;
  mute: boolean | null;
  meter: number | null;
}

export interface MixerState extends DeviceStatus {
  mode: MixerMode;
  /** 콘솔까지 어떻게 붙는지 (설정 화면용) */
  connection: MixerConnection;
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

/** 콘솔 연결 방식 — mock=모의 장비, hiqnet=랜선(채널 조작), midi-bridge=MIDI 씬 전환만 */
export type ConsoleDriverKind = "mock" | "hiqnet" | "midi-bridge";

/** PUT /halls/{hall}/mixer/connection — 현장 세팅에서 정하는 연결 방식 */
export interface MixerConnection {
  driver: ConsoleDriverKind;
  hiqnet: {
    host: string;
    port: number;
    device: number;
    /** direct = 서버가 콘솔에 바로, bridge = 강당 노트북이 중계 */
    via: "direct" | "bridge";
    relayPort: number;
  };
  /** 강당 노트북(브릿지) 주소와 그 노트북의 MIDI 장치 이름 */
  bridge: { url: string; device: string };
  /** 씬 전환을 노트북의 USB-MIDI 로 */
  midi: { enabled: boolean; channel: number; oneBased: boolean };
  /** 서버 .env 에 BRIDGE_TOKEN 이 있는지 (값은 안 보낸다) */
  tokenConfigured?: boolean;
}

/** POST /halls/{hall}/mixer/connection/test — 단계별 결과 */
export interface ConnectionStep {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  /** 실패했을 때 현장에서 할 일 */
  hint: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  steps: ConnectionStep[];
}

/** POST /halls/discover — 네트워크에서 찾은 HiQnet 콘솔 */
export interface FoundConsole {
  ip: string;
  device: number;
  serial: string;
  mac?: string | null;
  mask?: string | null;
  dhcp?: boolean | null;
  /** 찾은 컴퓨터(서버 또는 노트북)가 콘솔과 같은 대역인지. 모르면 null */
  sameSubnet: boolean | null;
}

export interface DiscoverResult {
  consoles: FoundConsole[];
  /** 찾은 컴퓨터의 IPv4 주소들 */
  interfaces: string[];
  via: "server" | "bridge";
}

/** 노트북에 꽂힌 MIDI 포트 이름 */
export interface MidiPorts {
  out: string[];
  in: string[];
}

/** 화면에서 보내는 채널 주소 — 빈 문자열이면 지운다 */
export interface HiqnetAddress {
  fader: string;
  mute: string;
  muteInvert: boolean;
}

/** PUT /halls/{hall}/mixer/config — 씬 목록·채널 구성 편집 (관리자) */
export interface MixerConfig {
  mode?: MixerMode;
  scenes: MixerScene[];
  channels: { id: string; name: string; max?: number; hidden?: boolean; hiqnet?: HiqnetAddress }[];
  masterName?: string;
  masterMax?: number;
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
