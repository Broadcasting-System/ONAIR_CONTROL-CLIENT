import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lightingApi } from "@/lib/lightingApi";
import { toast } from "@/components/common/Toast";
import type { LightColor, LightingState } from "@/types/lighting";

const POLL_MS = 3000;

export function useLighting(hallId: string | null) {
  const qc = useQueryClient();
  const key = ["lighting", hallId] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => lightingApi.state(hallId as string),
    enabled: !!hallId,
    refetchInterval: POLL_MS,
  });

  const patchCache = useCallback(
    (fn: (s: LightingState) => LightingState) =>
      qc.setQueryData<LightingState>(key, (old) => (old ? fn(old) : old)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, hallId],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const fail = (e: Error) => {
    toast.error(e.message);
    refresh();
  };

  const setMutation = useMutation({
    mutationFn: (body: { fixtures?: string[]; intensity?: number; color?: LightColor }) =>
      lightingApi.set(hallId as string, body),
    onMutate: async ({ fixtures, intensity, color }) => {
      await qc.cancelQueries({ queryKey: key });
      patchCache((s) => ({
        ...s,
        current: null,
        blackout: intensity ? false : s.blackout,
        fixtures: s.fixtures.map((f) =>
          fixtures && !fixtures.includes(f.id)
            ? f
            : {
                ...f,
                value: {
                  intensity: intensity ?? f.value.intensity,
                  color: color && f.hasColor ? { ...f.value.color, ...color } : f.value.color,
                },
              },
        ),
      }));
    },
    onError: fail,
  });

  const masterMutation = useMutation({
    mutationFn: (level: number) => lightingApi.master(hallId as string, level),
    onMutate: async (level) => {
      await qc.cancelQueries({ queryKey: key });
      patchCache((s) => ({ ...s, master: level }));
    },
    onError: fail,
  });

  const blackoutMutation = useMutation({
    mutationFn: (on: boolean) => lightingApi.blackout(hallId as string, on),
    onMutate: async (on) => {
      await qc.cancelQueries({ queryKey: key });
      patchCache((s) => ({ ...s, blackout: on }));
    },
    onError: fail,
  });

  const sceneMutation = useMutation({
    mutationFn: (sceneId: string) => lightingApi.recallScene(hallId as string, sceneId),
    onMutate: async (sceneId) => {
      await qc.cancelQueries({ queryKey: key });
      patchCache((s) => ({ ...s, current: sceneId, blackout: false }));
    },
    onSuccess: (res) => {
      toast.success(`'${res.scene}' 장면으로 바꿨습니다.`);
      refresh();
    },
    onError: fail,
  });

  const saveSceneMutation = useMutation({
    mutationFn: ({ name, fade }: { name: string; fade: number }) => lightingApi.saveScene(hallId as string, name, fade),
    onSuccess: (res) => {
      toast.success(`'${res.name}' 장면을 저장했습니다.`);
      refresh();
    },
    onError: fail,
  });

  const deleteSceneMutation = useMutation({
    mutationFn: (sceneId: string) => lightingApi.deleteScene(hallId as string, sceneId),
    onSuccess: () => refresh(),
    onError: fail,
  });

  return {
    state: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    setIntensity: (fixtureId: string, intensity: number) => setMutation.mutate({ fixtures: [fixtureId], intensity }),
    setColor: (fixtureId: string, color: LightColor) => setMutation.mutate({ fixtures: [fixtureId], color }),
    // 색 LED 전체를 한 색으로 (밝기만 되는 조명은 그대로)
    setAllColor: (color: LightColor) => setMutation.mutate({ color }),
    setMaster: (level: number) => masterMutation.mutate(level),
    setBlackout: (on: boolean) => blackoutMutation.mutate(on),
    recallScene: (sceneId: string) => sceneMutation.mutate(sceneId),
    isRecalling: sceneMutation.isPending,
    saveScene: (name: string, fade: number) => saveSceneMutation.mutate({ name, fade }),
    isSavingScene: saveSceneMutation.isPending,
    deleteScene: (sceneId: string) => deleteSceneMutation.mutate(sceneId),
  };
}
