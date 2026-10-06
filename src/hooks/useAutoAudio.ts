import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { autoAudioApi } from "@/lib/autoAudioApi";
import { toast } from "@/components/common/Toast";
import type { AutoAudioState, AutoFeature, AutoParams, MeterSourceKind } from "@/types/autoAudio";

// 미터·동작 기록을 보여주므로 자주 가져온다
const POLL_MS = 1000;

export function useAutoAudio(hallId: string | null) {
  const qc = useQueryClient();
  const key = ["autoAudio", hallId] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => autoAudioApi.state(hallId as string),
    enabled: !!hallId,
    refetchInterval: POLL_MS,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const fail = (e: Error) => {
    toast.error(e.message);
    refresh();
  };

  const enableMutation = useMutation({
    mutationFn: ({ feature, enabled }: { feature: AutoFeature; enabled: boolean }) =>
      autoAudioApi.setEnabled(hallId as string, feature, enabled),
    onMutate: async ({ feature, enabled }) => {
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<AutoAudioState>(key, (s) =>
        s
          ? { ...s, features: { ...s.features, [feature]: { ...s.features[feature], enabled } } }
          : s,
      );
    },
    onSuccess: () => refresh(),
    onError: fail,
  });

  const paramsMutation = useMutation({
    mutationFn: ({ feature, params }: { feature: AutoFeature; params: AutoParams }) =>
      autoAudioApi.updateFeature(hallId as string, feature, params),
    onSuccess: () => {
      toast.success("저장했습니다.");
      refresh();
    },
    onError: fail,
  });

  const settingsMutation = useMutation({
    mutationFn: (body: {
      meter?: {
        source: MeterSourceKind;
        url?: string;
        name?: string;
        lanes?: Record<string, string>;
      };
      overrideS?: number;
    }) => autoAudioApi.updateSettings(hallId as string, body),
    onSuccess: () => {
      toast.success("저장했습니다.");
      refresh();
    },
    onError: fail,
  });

  const resumeMutation = useMutation({
    mutationFn: (channel: string) => autoAudioApi.resume(hallId as string, channel),
    onSuccess: () => refresh(),
    onError: fail,
  });

  return {
    state: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    setEnabled: (feature: AutoFeature, enabled: boolean) =>
      enableMutation.mutate({ feature, enabled }),
    saveParams: (feature: AutoFeature, params: AutoParams) =>
      paramsMutation.mutateAsync({ feature, params }),
    isSavingParams: paramsMutation.isPending,
    saveSettings: settingsMutation.mutateAsync,
    isSavingSettings: settingsMutation.isPending,
    resume: (channel: string) => resumeMutation.mutate(channel),
  };
}
