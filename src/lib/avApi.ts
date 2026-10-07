import { getApiBase } from "@/lib/apiBase";
import { del, post, put, request, seg } from "@/lib/http";
import type { AvChannel, AvItem, AvState } from "@/types/av";

export const avApi = {
  state: (refresh = false) => request<AvState>(`/av/state${refresh ? "?refresh=1" : ""}`),
  /** channel 없음 = 소리만, hall 없음 = 영상만 */
  start: (body: { channel: number | null; hall: string | null; label: string; fps?: number }) =>
    post<AvState>("/av/start", body),
  stop: (hall?: string | null) => post<AvItem>("/av/stop", hall ? { hall } : {}),
  // 채널 이름·연결된 홀은 관리자 (서버가 경로로 막는다)
  saveChannels: (channels: { channel: number; name: string; hall: string | null }[]) =>
    put<{ channels: AvChannel[] }>("/av/channels", { channels }),

  library: () => request<{ items: AvItem[] }>("/av/library"),
  rename: (id: string, label: string) =>
    request<AvItem>(`/av/items/${seg(id)}`, { method: "PATCH", body: JSON.stringify({ label }) }),
  retry: (id: string) => post<AvItem>(`/av/items/${seg(id)}/retry`),
  remove: (id: string) => del<{ success: boolean }>(`/av/items/${seg(id)}`),
  /** auto = 합친 영상(있으면) · screen = 화면 원본 */
  fileUrl: (id: string, download = false, part: "auto" | "screen" = "auto") =>
    `${getApiBase()}/av/items/${seg(id)}/file?part=${part}${download ? "&download=1" : ""}`,
  thumbUrl: (id: string) => `${getApiBase()}/av/items/${seg(id)}/thumb`,
};
