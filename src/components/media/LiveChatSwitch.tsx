"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/broadcast/parts";
import { toast } from "@/components/common/Toast";
import { put, request } from "@/lib/http";

/** 채널마다 live 채팅 켜짐 (서버 app/api/live_chat.py) — 정해 둔 적 없는 채널은 꺼짐 */
type ChatSettings = { channels: Record<string, boolean> };

/** 송출 화면 — 고른 채널의 학생 live 화면 채팅 켜기·끄기 */
export function LiveChatSwitch({ channel, disabled }: { channel: number; disabled?: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["live-chat-settings"],
    queryFn: () => request<ChatSettings>("/live/chat/settings"),
    staleTime: 10_000,
  });
  const set = useMutation({
    mutationFn: (enabled: boolean) => put<ChatSettings>(`/live/chat/settings/${channel}`, { enabled }),
    onSuccess: (data) => qc.setQueryData(["live-chat-settings"], data),
    onError: (e) => toast.error(e instanceof Error ? e.message : "live 채팅을 바꾸지 못했어요"),
  });
  const on = !!q.data?.channels[String(channel)];
  return (
    <div className="flex items-center gap-3">
      <span className="font-pretendard text-[13.5px] text-white/70">live 채팅</span>
      <span className="ml-auto" />
      <Switch
        label="live 채팅"
        checked={set.isPending && set.variables !== undefined ? set.variables : on}
        disabled={disabled || !q.data || set.isPending}
        onChange={(v) => set.mutate(v)}
      />
    </div>
  );
}
