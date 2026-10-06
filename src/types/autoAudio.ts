import type { HallRef } from "@/types/hall";

/** 자동 음향 규칙 — 서버 app/services/auto_audio_service.FEATURES 와 같다 */
export type AutoFeature = "duck" | "idle" | "level" | "gain";
export const AUTO_FEATURES: AutoFeature[] = ["duck", "idle", "level", "gain"];

/** 숫자 값(dB·초·번) 또는 대상 채널 목록 */
export type AutoParams = Record<string, number | string[]>;

export interface AutoFeatureState {
  name: string;
  enabled: boolean;
  params: AutoParams;
  /** 숫자 값의 [최소, 최대] */
  limits: Record<string, [number, number]>;
}

export interface AutoChannel {
  id: string;
  name: string;
  /** 이 채널에 붙어 있는 규칙 */
  rules: AutoFeature[];
  /** 덕킹의 '목소리' 채널 (움직이지 않고 듣기만) */
  voice: boolean;
  /** 사람이 만져서 자동이 멈춘 남은 초 */
  pausedFor: number;
  /** 사람이 맞춘 페이더(%) */
  base: number | null;
  /** 자동이 마지막으로 보낸 페이더(%) — 없으면 손대지 않은 상태 */
  sent: number | null;
  offsetDb: { duck: number; idle: number; level: number };
  gainCutDb: number;
  meter: { level: number; peak: number } | null;
}

export interface AutoLogEntry {
  at: number;
  rule: AutoFeature | "human" | "system";
  channel: string | null;
  text: string;
}

export type MeterSourceKind = "none" | "demo" | "console" | "bridge";

export interface AutoAudioState {
  hall: HallRef;
  features: Record<AutoFeature, AutoFeatureState>;
  overrideS: number;
  meter: {
    source: MeterSourceKind;
    url: string;
    name: string;
    lanes: Record<string, string>;
    ok: boolean;
    detail: string;
  };
  running: boolean;
  warnings: string[];
  ducking: boolean;
  error: string;
  channels: AutoChannel[];
  log: AutoLogEntry[];
}

export const FEATURE_INFO: Record<AutoFeature, { en: string; desc: string; tone: string }> = {
  duck: {
    en: "DUCKING",
    desc: "목소리 채널에 말소리가 들어오면 음악 채널을 줄였다가, 말이 끝나면 천천히 원래대로.",
    tone: "#3FC8FF",
  },
  idle: {
    en: "IDLE MIC",
    desc: "마이크가 한동안 조용하면 조금씩 줄여 잡음·하울링을 막아요. 소리가 나면 바로 원래대로. 끄지는 않아요.",
    tone: "#B48CFF",
  },
  level: {
    en: "AUTO LEVEL",
    desc: "말하는 동안 소리가 목표보다 작거나 크면 페이더를 조금씩 움직여 맞춰요. 정한 범위 밖으로는 안 가요.",
    tone: "#00FF57",
  },
  gain: {
    en: "CLIP GUARD",
    desc: "입력이 자꾸 꽉 차서 찢어지면 게인을 조금씩 내려요. 올리지는 않아요.",
    tone: "#FFB23F",
  },
};

/** 숫자 값 이름·단위 (자세히 설정 화면) */
export const PARAM_INFO: Record<string, { label: string; unit: string; step: number }> = {
  threshold_db: { label: "말소리 기준", unit: "dBFS", step: 1 },
  depth_db: { label: "얼마나 줄일까", unit: "dB", step: 1 },
  attack_s: { label: "줄이는 시간", unit: "초", step: 0.05 },
  hold_s: { label: "말 끝나고 기다리기", unit: "초", step: 0.1 },
  release_s: { label: "돌아오는 시간", unit: "초", step: 0.1 },
  gate_db: { label: "조용함 기준", unit: "dBFS", step: 1 },
  after_s: { label: "조용하다고 볼 때까지", unit: "초", step: 1 },
  reduce_db: { label: "얼마나 줄일까", unit: "dB", step: 1 },
  ramp_s: { label: "줄이는 데 걸리는 시간", unit: "초", step: 0.5 },
  target_db: { label: "목표 크기", unit: "dBFS", step: 1 },
  tolerance_db: { label: "그냥 둘 차이", unit: "dB", step: 0.5 },
  step_db: { label: "한 번에 움직이는 양", unit: "dB", step: 0.25 },
  interval_s: { label: "움직이는 간격", unit: "초", step: 0.5 },
  range_db: { label: "최대로 움직일 범위", unit: "dB", step: 1 },
  clip_db: { label: "찢어짐 기준", unit: "dBFS", step: 0.5 },
  count: { label: "몇 번 넘으면", unit: "번", step: 1 },
  window_s: { label: "이 시간 안에", unit: "초", step: 0.5 },
  cooldown_s: { label: "내린 뒤 쉬는 시간", unit: "초", step: 1 },
  max_cut_db: { label: "최대로 내릴 양", unit: "dB", step: 1 },
};

/** 대상 채널 목록 이름 */
export const LIST_INFO: Record<AutoFeature, { key: string; label: string }[]> = {
  duck: [
    { key: "voice", label: "목소리 (듣기만)" },
    { key: "music", label: "줄일 음악" },
  ],
  idle: [{ key: "channels", label: "대상 마이크" }],
  level: [{ key: "channels", label: "대상 채널" }],
  gain: [{ key: "channels", label: "대상 채널" }],
};

export const RULE_TAG: Record<AutoFeature, string> = {
  duck: "음악 줄이기",
  idle: "안 쓰면 줄이기",
  level: "자동 맞추기",
  gain: "찢어짐 감시",
};

// ---------------- 음악 조명 ----------------

export type ShowStyle = "basic" | "calm" | "party";

export interface ShowOptions {
  style?: ShowStyle;
  strobe?: boolean;
  startScene?: string;
  endScene?: string;
}

export interface ShowSummary {
  id: string;
  name: string;
  bpm: number;
  duration: number;
  cues: number;
  enabledCues: number;
  flashCues: number;
  options: ShowOptions;
  createdAt: number;
  hasAudio: boolean;
}

export type CueLane = "dimmer" | "color" | "beat" | "scene";

export interface ShowCue {
  id: string;
  t: number;
  lane: CueLane;
  label: string;
  enabled: boolean;
  kind: "fixtures" | "scene";
  fixtures?: string[];
  intensity?: number;
  color?: Record<string, number>;
  scene?: string;
  fade: number;
  flash?: boolean;
  strobe?: boolean;
}

export type SectionKind = "intro" | "quiet" | "mid" | "loud" | "outro";

export interface ShowDetail extends ShowSummary {
  analysis: {
    duration: number;
    bpm: number;
    beats: number[];
    sections: { start: number; end: number; kind: SectionKind; energy: number }[];
    energy: number[];
  };
  cueList: ShowCue[];
}

export interface MusicLightSettings {
  allowStrobe: boolean;
  maxFlashPerSec: number;
  feed: { source: "none" | "demo" | "bridge"; bpm: number; url?: string; name?: string };
}

export interface MusicLightState {
  hall: HallRef;
  settings: MusicLightSettings;
  /** 소리 입력 설명 (없으면 빈 문자열) */
  feed: string;
  maxFlashPerSec: number;
  dimmerMinFade: number;
  fixtures: { led: number; dimmer: number };
  scenes: { id: string; name: string }[];
  styles: Record<ShowStyle, string>;
  shows: ShowSummary[];
  playing: {
    showId: string;
    name: string;
    position: number;
    duration: number;
    ran: number;
    skipped: Record<string, number>;
    error: string;
  } | null;
  live: {
    bpm: number | null;
    energy: number;
    beats: number;
    lastBeatAt: number | null;
    error: string;
    skipped: Record<string, number>;
  } | null;
  lastError: string;
}

export const SECTION_INFO: Record<SectionKind, { label: string; color: string }> = {
  intro: { label: "도입", color: "#3D6BFF" },
  quiet: { label: "조용", color: "#A855F7" },
  mid: { label: "중간", color: "#3FC8FF" },
  loud: { label: "신남", color: "#FF3B3B" },
  outro: { label: "마무리", color: "#585858" },
};

export const LANE_INFO: { lane: CueLane; label: string; color: string }[] = [
  { lane: "dimmer", label: "밝기(할로겐)", color: "#FFD49A" },
  { lane: "color", label: "LED 색", color: "#A855F7" },
  { lane: "beat", label: "LED 박자", color: "#FF3B3B" },
  { lane: "scene", label: "장면", color: "#3FC8FF" },
];
