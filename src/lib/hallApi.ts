import { del, post, put, request, seg } from "@/lib/http";
import type {
  BridgesStatus, HallSummary, HallsStatus, LearnedParam, MixerConfig, MixerState, VideoMatrixState,
} from "@/types/hall";

export const hallApi = {
  list: () => request<{ halls: HallSummary[] }>("/halls"),
  status: () => request<HallsStatus>("/halls/status"),
  bridges: () => request<BridgesStatus>("/halls/bridges"),

  mixer: (hall: string) => request<MixerState>(`/halls/${seg(hall)}/mixer`),
  recallScene: (hall: string, pc: number) =>
    post<{ success: boolean; scene: string }>(`/halls/${seg(hall)}/mixer/scene`, { pc }),
  setChannel: (hall: string, channel: string, body: { level?: number; mute?: boolean }) =>
    post<{ success: boolean }>(`/halls/${seg(hall)}/mixer/channels/${seg(channel)}`, body),

  matrix: (hall: string) => request<VideoMatrixState>(`/halls/${seg(hall)}/matrix`),
  route: (hall: string, output: number, input: number) =>
    post<{ success: boolean }>(`/halls/${seg(hall)}/matrix/route`, { output, input }),
  routeAll: (hall: string, input: number) =>
    post<{ success: boolean }>(`/halls/${seg(hall)}/matrix/route-all`, { input }),
  applyPreset: (hall: string, presetId: string) =>
    post<{ success: boolean; preset: string }>(`/halls/${seg(hall)}/matrix/presets/${seg(presetId)}/apply`),
  savePreset: (hall: string, name: string) =>
    post<{ id: string; name: string }>(`/halls/${seg(hall)}/matrix/presets`, { name }),
  deletePreset: (hall: string, presetId: string) =>
    del<{ success: boolean }>(`/halls/${seg(hall)}/matrix/presets/${seg(presetId)}`),

  // 관리자 설정 편집 — 이름·씬 목록·채널 구성 (장비 연결 방식은 서버 파일에서)
  updateMixerConfig: (hall: string, config: MixerConfig) =>
    put<{ success: boolean }>(`/halls/${seg(hall)}/mixer/config`, config),
  updateMatrixConfig: (hall: string, inputs: string[], outputs: string[]) =>
    put<{ success: boolean }>(`/halls/${seg(hall)}/matrix/config`, { inputs, outputs }),

  // 믹서 주소 찾기 — 콘솔에서 움직인 파라미터를 기록
  learnStart: (hall: string) => post<{ watching: number }>(`/halls/${seg(hall)}/mixer/learn/start`),
  learnResults: (hall: string) =>
    request<{ active: boolean; moved: LearnedParam[] }>(`/halls/${seg(hall)}/mixer/learn`),
  learnStop: (hall: string) => post<{ success: boolean }>(`/halls/${seg(hall)}/mixer/learn/stop`),
};
