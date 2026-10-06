import { getApiBase } from "@/lib/apiBase";
import { del, post, put, request, seg } from "@/lib/http";
import type {
  AutoAudioState,
  AutoFeature,
  AutoParams,
  MeterSourceKind,
  MusicLightSettings,
  MusicLightState,
  ShowDetail,
  ShowOptions,
  ShowSummary,
} from "@/types/autoAudio";

const auto = (hall: string) => `/halls/${seg(hall)}/auto-audio`;
const ml = (hall: string) => `/halls/${seg(hall)}/music-light`;

export const autoAudioApi = {
  state: (hall: string) => request<AutoAudioState>(auto(hall)),
  // 켜기·끄기·멈춘 채널 다시 돌리기는 운영
  setEnabled: (hall: string, feature: AutoFeature, enabled: boolean) =>
    post<{ success: boolean }>(`${auto(hall)}/${seg(feature)}/enabled`, { enabled }),
  resume: (hall: string, channel: string) =>
    post<{ success: boolean }>(`${auto(hall)}/channels/${seg(channel)}/resume`),
  // 숫자·대상 채널·미터 출처는 관리자 (서버가 경로로 막는다)
  updateFeature: (hall: string, feature: AutoFeature, params: AutoParams) =>
    put<{ params: AutoParams }>(`${auto(hall)}/${seg(feature)}`, { params }),
  updateSettings: (
    hall: string,
    body: {
      meter?: {
        source: MeterSourceKind;
        url?: string;
        name?: string;
        lanes?: Record<string, string>;
      };
      overrideS?: number;
    },
  ) => put<{ success: boolean }>(`${auto(hall)}/settings`, body),
};

export const musicLightApi = {
  state: (hall: string) => request<MusicLightState>(ml(hall)),
  show: (hall: string, id: string) => request<ShowDetail>(`${ml(hall)}/shows/${seg(id)}`),
  /** 미리 듣기용 음악 주소 */
  audioUrl: (hall: string, id: string) => `${getApiBase()}${ml(hall)}/shows/${seg(id)}/audio`,
  /** MR 올리기 → 서버가 분석해 쇼를 만든다 (몇 초 걸린다) */
  upload: async (
    hall: string,
    file: File,
    name: string,
    options: ShowOptions,
  ): Promise<ShowSummary> => {
    const form = new FormData();
    form.append("file", file);
    form.append("name", name);
    form.append("style", options.style ?? "basic");
    form.append("strobe", options.strobe ? "true" : "false");
    const res = await fetch(`${getApiBase()}${ml(hall)}/shows`, { method: "POST", body: form });
    if (!res.ok) {
      let message =
        res.status === 403 ? "이 작업을 수행할 권한이 없습니다." : "음악을 올리지 못했습니다.";
      try {
        const body = await res.json();
        if (typeof body?.detail === "string") message = body.detail;
      } catch {
        /* 본문 없음 */
      }
      throw new Error(message);
    }
    return (await res.json()) as ShowSummary;
  },
  update: (
    hall: string,
    id: string,
    body: { name?: string; options?: ShowOptions; cues?: Record<string, boolean> },
  ) => put<ShowSummary>(`${ml(hall)}/shows/${seg(id)}`, body),
  remove: (hall: string, id: string) => del<{ success: boolean }>(`${ml(hall)}/shows/${seg(id)}`),
  start: (hall: string, id: string, offset = 0) =>
    post<{ showId: string; name: string }>(`${ml(hall)}/shows/${seg(id)}/start`, { offset }),
  stop: (hall: string) => post<{ success: boolean }>(`${ml(hall)}/stop`),
  live: (hall: string, enabled: boolean) =>
    post<{ success: boolean }>(`${ml(hall)}/live`, { enabled }),
  // 스트로브 허용·깜빡임 상한·소리 입력은 관리자
  updateSettings: (hall: string, body: Partial<MusicLightSettings>) =>
    put<MusicLightSettings>(`${ml(hall)}/settings`, body),
};
