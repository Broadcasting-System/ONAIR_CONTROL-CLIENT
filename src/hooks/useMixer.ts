import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hallApi } from "@/lib/hallApi";
import { toast } from "@/components/common/Toast";
import type { MixerChannel, MixerState } from "@/types/hall";

// 입력 레벨(VU)을 보여줄 수 있으면 자주, 아니면 상태 확인 정도로만 가져온다.
const METER_POLL_MS = 800;
const STATUS_POLL_MS = 4000;

type ChannelPatch = { level?: number; mute?: boolean };

export function useMixer(hallId: string | null) {
  const qc = useQueryClient();
  const key = ["mixer", hallId] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => hallApi.mixer(hallId as string),
    enabled: !!hallId,
    refetchInterval: (q) => {
      const data = q.state.data as MixerState | undefined;
      return data?.connected && data.capabilities.includes("meter") ? METER_POLL_MS : STATUS_POLL_MS;
    },
  });

  const patchCache = useCallback(
    (fn: (s: MixerState) => MixerState) =>
      qc.setQueryData<MixerState>(key, (old) => (old ? fn(old) : old)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, hallId],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const sceneMutation = useMutation({
    mutationFn: (pc: number) => hallApi.recallScene(hallId as string, pc),
    onMutate: async (pc) => {
      await qc.cancelQueries({ queryKey: key });
      patchCache((s) => ({ ...s, currentScene: pc }));
    },
    onSuccess: (res) => toast.success(`'${res.scene}' 씬으로 전환했습니다.`),
    onError: (e: Error) => {
      toast.error(e.message);
      refresh();
    },
  });

  const channelMutation = useMutation({
    mutationFn: ({ channel, patch }: { channel: string; patch: ChannelPatch }) =>
      hallApi.setChannel(hallId as string, channel, patch),
    onMutate: async ({ channel, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const apply = (c: MixerChannel): MixerChannel => (c.id === channel ? { ...c, ...patch } : c);
      patchCache((s) => ({
        ...s,
        channels: s.channels.map(apply),
        master: s.master ? apply(s.master) : s.master,
      }));
    },
    onError: (e: Error) => {
      toast.error(e.message);
      refresh();
    },
  });

  return {
    state: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    recallScene: (pc: number) => sceneMutation.mutate(pc),
    isRecalling: sceneMutation.isPending,
    setLevel: (channel: string, level: number) => channelMutation.mutate({ channel, patch: { level } }),
    setMute: (channel: string, mute: boolean) => channelMutation.mutate({ channel, patch: { mute } }),
  };
}
