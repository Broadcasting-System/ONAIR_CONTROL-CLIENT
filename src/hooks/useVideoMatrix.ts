import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hallApi } from "@/lib/hallApi";
import { toast } from "@/components/common/Toast";
import type { VideoMatrixState } from "@/types/hall";

const POLL_MS = 3000;

export function useVideoMatrix(hallId: string | null) {
  const qc = useQueryClient();
  const key = ["videoMatrix", hallId] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => hallApi.matrix(hallId as string),
    enabled: !!hallId,
    refetchInterval: POLL_MS,
  });

  const patchRoutes = useCallback(
    (fn: (output: number, input: number | null) => number | null) =>
      qc.setQueryData<VideoMatrixState>(key, (old) =>
        old ? { ...old, outputs: old.outputs.map((o) => ({ ...o, input: fn(o.no, o.input) })) } : old,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, hallId],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const fail = (e: Error) => {
    toast.error(e.message);
    refresh();
  };

  const routeMutation = useMutation({
    mutationFn: ({ output, input }: { output: number; input: number }) =>
      hallApi.route(hallId as string, output, input),
    onMutate: async ({ output, input }) => {
      await qc.cancelQueries({ queryKey: key });
      patchRoutes((o, cur) => (o === output ? input : cur));
    },
    onError: fail,
  });

  const routeAllMutation = useMutation({
    mutationFn: (input: number) => hallApi.routeAll(hallId as string, input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      patchRoutes(() => input);
    },
    onError: fail,
  });

  const presetMutation = useMutation({
    mutationFn: (presetId: string) => hallApi.applyPreset(hallId as string, presetId),
    onSuccess: (res) => {
      toast.success(`'${res.preset}' 프리셋을 적용했습니다.`);
      refresh();
    },
    onError: fail,
  });

  const savePresetMutation = useMutation({
    mutationFn: (name: string) => hallApi.savePreset(hallId as string, name),
    onSuccess: (res) => {
      toast.success(`'${res.name}' 프리셋을 저장했습니다.`);
      refresh();
    },
    onError: fail,
  });

  const deletePresetMutation = useMutation({
    mutationFn: (presetId: string) => hallApi.deletePreset(hallId as string, presetId),
    onSuccess: () => refresh(),
    onError: fail,
  });

  return {
    state: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    route: (output: number, input: number) => routeMutation.mutate({ output, input }),
    routeAll: (input: number) => routeAllMutation.mutate(input),
    applyPreset: (presetId: string) => presetMutation.mutate(presetId),
    savePreset: (name: string) => savePresetMutation.mutate(name),
    isSavingPreset: savePresetMutation.isPending,
    deletePreset: (presetId: string) => deletePresetMutation.mutate(presetId),
  };
}
