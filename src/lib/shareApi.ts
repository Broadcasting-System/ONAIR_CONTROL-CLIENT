import { getApiBase } from "@/lib/apiBase";
import { del, post, request, seg } from "@/lib/http";

/** 외부 화면 공유 — 방송부 쪽 (코드·요청·허용·끊기). 발표자 쪽은 components/share/ShareApp */
export interface ShareRoom {
  code: string;
  channel: number;
  expiresAt: string;
  createdBy: string;
}

export interface ShareRequest {
  id: string;
  name: string;
  status: "waiting" | "approved";
  channel: number | null;
  createdAt: string;
  approvedAt: string | null;
  hasSnapshot: boolean;
  snapshotAt: number;
}

export const shareApi = {
  overview: () => request<{ room: ShareRoom | null; requests: ShareRequest[] }>("/share"),
  openRoom: (channel: number) => post<{ room: ShareRoom }>("/share/room", { channel }),
  closeRoom: () => del<{ room: null }>("/share/room"),
  /** mode — air: 바로 그 채널에 송출 · source: 스위처 소스로만 */
  approve: (id: string, channel: number, mode: "air" | "source" = "air") =>
    post<{ request: ShareRequest }>(`/share/requests/${seg(id)}/approve`, { channel, mode }),
  reject: (id: string) => post<{ request: ShareRequest }>(`/share/requests/${seg(id)}/reject`),
  end: (id: string) => post<{ ok: boolean }>(`/share/requests/${seg(id)}/end`),
  snapshotUrl: (r: ShareRequest) =>
    `${getApiBase()}/share/requests/${seg(r.id)}/snapshot?t=${r.snapshotAt}`,
};
