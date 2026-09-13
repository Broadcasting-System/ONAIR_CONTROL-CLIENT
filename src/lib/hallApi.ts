import { del, post, put, request, seg } from "@/lib/http";
import type {
  BridgesStatus, ConnectionTestResult, DiscoverResult, HallSummary, HallsStatus, LearnedParam, MidiPorts,
  MixerConfig, MixerConnection, MixerState, VideoMatrixState,
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

  // 관리자 설정 편집 — 이름·씬 목록·채널 구성 (믹서 연결 방식은 아래 '현장 세팅')
  updateMixerConfig: (hall: string, config: MixerConfig) =>
    put<{ success: boolean }>(`/halls/${seg(hall)}/mixer/config`, config),
  updateMatrixConfig: (hall: string, inputs: string[], outputs: string[]) =>
    put<{ success: boolean }>(`/halls/${seg(hall)}/matrix/config`, { inputs, outputs }),

  // 믹서 주소 찾기 — 콘솔에서 움직인 파라미터를 기록
  learnStart: (hall: string) => post<{ watching: number }>(`/halls/${seg(hall)}/mixer/learn/start`),
  learnResults: (hall: string) =>
    request<{ active: boolean; moved: LearnedParam[] }>(`/halls/${seg(hall)}/mixer/learn`),
  learnStop: (hall: string) => post<{ success: boolean }>(`/halls/${seg(hall)}/mixer/learn/stop`),

  // 현장 세팅 (관리자) — 연결 방식, 저장 전 시험, 콘솔 찾기, 노트북 MIDI 포트
  updateMixerConnection: (hall: string, conn: MixerConnection) =>
    put<{ success: boolean }>(`/halls/${seg(hall)}/mixer/connection`, conn),
  testMixerConnection: (hall: string, conn: MixerConnection) =>
    post<ConnectionTestResult>(`/halls/${seg(hall)}/mixer/connection/test`, conn),
  discoverConsoles: (body: { via: "server" | "bridge"; bridgeUrl?: string; seconds?: number }) =>
    post<DiscoverResult>("/halls/discover", body),
  bridgeMidiPorts: (url: string) => post<MidiPorts>("/halls/bridge/midi-ports", { url }),
  bridgeConfigureMidi: (url: string, device: string, out: string, inPort?: string | null) =>
    put<{ out: string; in: string | null; open: boolean }>("/halls/bridge/midi", {
      url,
      device,
      out,
      in: inPort ?? null,
    }),
  // 세팅 확인용 — 조작 범위·숨김과 상관없이 움직여 보고, 씬은 방송부 알림 없이 부른다
  tryChannel: (hall: string, channel: string, body: { level?: number; mute?: boolean }) =>
    post<{ success: boolean }>(`/halls/${seg(hall)}/mixer/test/channels/${seg(channel)}`, body),
  tryScene: (hall: string, pc: number) =>
    post<{ success: boolean; scene: string }>(`/halls/${seg(hall)}/mixer/test/scene`, { pc }),
};
