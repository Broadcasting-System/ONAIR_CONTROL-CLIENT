import { getApiBase } from "@/lib/apiBase";
import type { HallSummary, MixerState, VideoMatrixState } from "@/types/hall";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    let message = res.status === 403 ? "이 작업을 수행할 권한이 없습니다." : "요청을 처리하지 못했습니다.";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
    } catch {
      /* 본문 없음 */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const seg = encodeURIComponent;

export const hallApi = {
  list: () => request<{ halls: HallSummary[] }>("/halls"),

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
    request<{ success: boolean }>(`/halls/${seg(hall)}/matrix/presets/${seg(presetId)}`, { method: "DELETE" }),
};
