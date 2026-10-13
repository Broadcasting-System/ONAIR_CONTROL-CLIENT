import { failure, request, upload } from "@/lib/http";
import { getApiBase } from "@/lib/apiBase";

/** GET /api/tts/voices — "gtts"(기본) + Google 목소리 */
export interface TtsVoice {
  id: string;
  label: string;
  gender: string | null;
  tier: string | null;
  provider: "gtts" | "google" | string;
}

export interface TtsVoices {
  voices: TtsVoice[];
  googleReady: boolean;
  defaultVoice: string;
  speakingRate: number;
}

export interface MicEffect {
  id: string;
  label: string;
}

/** GET /api/broadcast/mic/options */
export interface MicOptions {
  effects: MicEffect[];
  effectDefault: string;
  chimeDefault: boolean;
  live: { maxSeconds: number; idleSeconds: number; sampleRateMin: number; sampleRateMax: number };
  clip: { maxSeconds: number; maxBytes: number; types: string[] };
}

/** GET /api/broadcast/live/status */
export interface LiveStatus {
  active: boolean;
  by: string | null;
  targets: string[];
  startedAt: string | null;
  effect: string | null;
  elapsed?: number;
  maxSeconds: number;
}

export const RATE_MIN = 0.8;
export const RATE_MAX = 1.3;
export const TTS_MAX_CHARS = 500;

/** 1 → "1.0", 1.05 → "1.05", 0.9 → "0.9" */
export function fmtRate(rate: number): string {
  return rate.toFixed(2).replace(/0$/, "");
}

/** 목소리 카드 글자 — 큰 줄(여자 A)과 작은 줄(Neural2) */
export function voiceCardText(v: TtsVoice): { title: string; tier: string } {
  if (v.provider !== "google") return { title: v.label || "기본", tier: "gTTS" };
  const tier = v.tier ?? "";
  const rest = v.id.split("-").slice(2).join("-"); // ko-KR-Neural2-A → Neural2-A
  const variant = tier && rest.startsWith(tier) ? rest.slice(tier.length).replace(/^-/, "") : rest;
  const title = [v.gender, variant].filter(Boolean).join(" ") || v.label;
  return { title, tier };
}

export const broadcastApi = {
  voices: () => request<TtsVoices>("/tts/voices"),
  micOptions: () => request<MicOptions>("/broadcast/mic/options"),
  liveStatus: () => request<LiveStatus>("/broadcast/live/status"),

  /** 목소리 미리 듣기 — 교실 스피커는 켜지 않는다. audio/mpeg 와 기본 음성으로 대신했는지 */
  async preview(voice: string, rate: number, signal?: AbortSignal): Promise<{ blob: Blob; fallback: boolean }> {
    const res = await fetch(`${getApiBase()}/tts/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice, rate }),
      signal,
    });
    if (!res.ok) throw await failure(res);
    return { blob: await res.blob(), fallback: res.headers.get("X-TTS-Fallback") === "1" };
  },

  /** 녹음 후 방송 — 효과를 입혀 교실 스피커로. 소리가 끝나야 답이 온다 */
  clip: (file: Blob, filename: string, targets: string[], effect: string, chime: boolean) => {
    const form = new FormData();
    form.append("file", file, filename);
    form.append("targets", JSON.stringify(targets));
    form.append("effect", effect);
    form.append("chime", chime ? "true" : "false");
    return upload<{ success: boolean; message: string; seconds: number }>("/broadcast/clip", form);
  },
};
