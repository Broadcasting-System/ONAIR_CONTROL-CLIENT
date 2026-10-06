import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { musicLightApi } from "@/lib/autoAudioApi";
import { toast } from "@/components/common/Toast";
import type { MusicLightSettings, MusicLightState, ShowOptions } from "@/types/autoAudio";

// 틀고 있을 때는 재생 위치·박자를 자주, 아니면 가끔
const PLAY_POLL_MS = 500;
const IDLE_POLL_MS = 4000;

export function useMusicLight(hallId: string | null, enabled = true) {
  const qc = useQueryClient();
  const key = ["musicLight", hallId] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => musicLightApi.state(hallId as string),
    enabled: !!hallId && enabled,
    refetchInterval: (q) => {
      const s = q.state.data as MusicLightState | undefined;
      return s?.playing || s?.live ? PLAY_POLL_MS : IDLE_POLL_MS;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["musicShow", hallId] });
  };
  const fail = (e: Error) => {
    toast.error(e.message);
    refresh();
  };

  const uploadMutation = useMutation({
    mutationFn: ({ file, name, options }: { file: File; name: string; options: ShowOptions }) =>
      musicLightApi.upload(hallId as string, file, name, options),
    onSuccess: (show) => {
      toast.success(`'${show.name}' 분석 끝 — ${Math.round(show.bpm)} BPM, 큐 ${show.cues}개`);
      refresh();
    },
    onError: fail,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { name?: string; options?: ShowOptions; cues?: Record<string, boolean> };
    }) => musicLightApi.update(hallId as string, id, body),
    onSuccess: () => refresh(),
    onError: fail,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => musicLightApi.remove(hallId as string, id),
    onSuccess: () => refresh(),
    onError: fail,
  });

  const startMutation = useMutation({
    mutationFn: ({ id, offset }: { id: string; offset: number }) =>
      musicLightApi.start(hallId as string, id, offset),
    onSuccess: () => refresh(),
    onError: fail,
  });

  const stopMutation = useMutation({
    mutationFn: () => musicLightApi.stop(hallId as string),
    onSuccess: () => refresh(),
    onError: fail,
  });

  const liveMutation = useMutation({
    mutationFn: (on: boolean) => musicLightApi.live(hallId as string, on),
    onSuccess: () => refresh(),
    onError: fail,
  });

  const settingsMutation = useMutation({
    mutationFn: (body: Partial<MusicLightSettings>) =>
      musicLightApi.updateSettings(hallId as string, body),
    onSuccess: () => {
      toast.success("저장했습니다.");
      refresh();
    },
    onError: fail,
  });

  return {
    state: query.data,
    error: query.error as Error | null,
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    update: (
      id: string,
      body: { name?: string; options?: ShowOptions; cues?: Record<string, boolean> },
    ) => updateMutation.mutate({ id, body }),
    remove: (id: string) => removeMutation.mutate(id),
    start: (id: string, offset = 0) => startMutation.mutate({ id, offset }),
    stop: () => stopMutation.mutate(),
    setLive: (on: boolean) => liveMutation.mutate(on),
    saveSettings: (body: Partial<MusicLightSettings>) => settingsMutation.mutate(body),
  };
}

/** 쇼 하나 — 타임라인(구간·크기 곡선·큐) */
export function useMusicShow(hallId: string | null, showId: string | null) {
  return useQuery({
    queryKey: ["musicShow", hallId, showId],
    queryFn: () => musicLightApi.show(hallId as string, showId as string),
    enabled: !!hallId && !!showId,
  });
}
