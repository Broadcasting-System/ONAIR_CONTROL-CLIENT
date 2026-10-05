/** 강당·다목적홀 장비 (서버 /api/halls 응답 형태) */

export interface HallRef {
  id: string;
  name: string;
}

export interface HallSummary extends HallRef {
  hasMixer: boolean;
  hasVideoMatrix: boolean;
  hasLighting?: boolean;
}

/** 드라이버가 할 수 있는 일. scene=씬 전환, channel=채널 조작, meter=입력 레벨, processing=게인·EQ·컴프·이펙트,
 * route=라우팅, query=장비 상태 조회 */
export type Capability = "scene" | "channel" | "meter" | "processing" | "route" | "query";

/** 채널 처리 값 — 손잡이(0~100%) 또는 켜기 스위치. 서버 app/drivers/console.PARAM_ROLES 와 같다 */
export type ProcessingRole =
  | "gain"
  | "eq_on"
  | "eq_low"
  | "eq_lomid"
  | "eq_himid"
  | "eq_high"
  | "comp_on"
  | "comp_threshold"
  | "comp_ratio"
  | "comp_makeup"
  | "fx1"
  | "fx2"
  | "fx3"
  | "fx4"
  | "fx1_on"
  | "fx2_on"
  | "fx3_on"
  | "fx4_on";

export const SWITCH_ROLES: ReadonlySet<string> = new Set([
  "mute", "eq_on", "comp_on", "fx1_on", "fx2_on", "fx3_on", "fx4_on",
]);

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
  /** 설정 파일에 적힌 콘솔 주소 (HiQnet 연결일 때) — 페이더·뮤트와 처리 값(게인·EQ…) */
  hiqnet?: { fader?: HiqnetParam; mute?: HiqnetParam } & Partial<Record<ProcessingRole, HiqnetParam>>;
  /** 화면에서 올릴 수 있는 최대 레벨(0~100). 없으면 제한 없음 */
  max?: number;
  /** 설정엔 남기되 조작 화면에서 뺀 채널 */
  hidden?: boolean;
  level: number | null;
  mute: boolean | null;
  meter: number | null;
  /** 장비 주소가 정해진 처리 값 (입력 채널만) */
  roles?: ProcessingRole[];
  /** 처리 값 — 장비가 아직 알려 주지 않았으면 null */
  params?: Partial<Record<ProcessingRole, number | boolean | null>>;
}

export interface MixerState extends DeviceStatus {
  mode: MixerMode;
  /** 콘솔까지 어떻게 붙는지 (설정 화면용) */
  connection: MixerConnection;
  scenes: MixerScene[];
  currentScene: number | null;
  channels: MixerChannel[];
  master: MixerChannel | null;
  /** 이펙트 리턴 (Si FX 1~4) — 채널의 fx1~fx4 가 여기로 보내는 양 */
  fx?: MixerChannel[];
  /** 이 연결 방식에서 다룰 수 있는 처리 값 (없으면 처리 화면을 숨긴다) */
  processingRoles?: ProcessingRole[];
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
  /** 노트북·명령 문법 (현장 세팅 화면용) */
  connection: MatrixConnection;
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
  /** env = .env 에 적은 값, file·generated = 서버가 만들어 둔 값 */
  tokenSource?: string;
  bridges: BridgeInfo[];
  /** 켜져 있다고 알려 온 노트북 (최근 10분) */
  announced?: AnnouncedBridge[];
}

/** 30초마다 '켜져 있다'고 알려 오는 노트북 — 서버는 알림이 온 주소로 노트북을 찾아간다 */
export interface AnnouncedBridge {
  url: string;
  name: string;
  hostname: string;
  version: string;
  features: string[];
  devices: Record<string, BridgeDevice>;
  lastSeen: number;
  /** 마지막 알림이 몇 초 전인지 */
  ago: number;
  online: boolean;
  /** ONAIR 설정의 어떤 장비가 이미 이 노트북을 쓰는지 */
  inUse: boolean;
}

/** GET /halls/bridge/kit-info — 노트북 설치 파일 받기 화면 */
export interface BridgeKitInfo {
  /** 노트북이 찾아올 이 서버의 주소 추정 (Tailscale IP). 모르면 빈 문자열 */
  suggestedServer: string;
  tokenSource: string;
  version: string;
  names: string[];
}

/** 노트북에 꽂힌 시리얼(COM) 포트 */
export interface SerialPortInfo {
  port: string;
  description: string;
  manufacturer: string;
  /** FTDI · Prolific · CH340 · CP210x (알 때만) */
  chip: string;
  usb: boolean;
}

/** 영상 매트릭스 연결 방식 — mock=모의 장비, serial-bridge=다목적홀 노트북의 USB-RS232 */
export type MatrixDriverKind = "mock" | "serial-bridge";

export interface MatrixConnection {
  driver: MatrixDriverKind;
  /** 노트북(브릿지) 주소와 그 노트북의 시리얼 장치 이름 */
  bridge: { url: string; device: string };
  protocol: {
    /** 입력→출력 명령 틀. {input} {output} 자리에 번호가 들어간다 (예: {input}V{output}.) */
    route: string;
    terminator: "\r\n" | "\r" | "\n" | "";
    /** 응답이 이 패턴과 맞아야 성공. 비우면 응답을 기다리지 않는다 */
    replyOk: string;
    timeout: number;
    /** 현재 라우팅 조회 명령 (예: Status.) — 비우면 서버가 마지막 명령으로 추정한다 */
    query: string;
    /** 조회 응답 해석 규칙 — (?P<input>…) 과 (?P<output>…) 이 있어야 한다 */
    queryRegex: string;
  };
  /** 명령표가 없을 때 차례로 보내 볼 문법 후보 */
  candidates?: { route: string; note: string }[];
  /** 조회 명령·해석 규칙 후보 */
  queryCandidates?: { query: string; regex: string; note: string }[];
  tokenConfigured?: boolean;
}

/** POST /halls/{hall}/matrix/test/route — 보낸 명령과 장비 응답 */
export interface MatrixTryResult {
  sent: string;
  reply: string;
  replyHex: string;
  /** 응답 확인 패턴과 맞았는지. 패턴이 없으면 null */
  matched: boolean | null;
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
