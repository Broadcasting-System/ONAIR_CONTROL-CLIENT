import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/common/Toast";
import { recordingApi } from "@/lib/recordingApi";
import type { RecordingItem } from "@/types/recording";

// 미터는 자주, 설정 안 된 공간은 가끔
const METER_MS = 400;
const IDLE_MS = 5000;

/** 공간 하나의 녹음 상태(레벨·시간) + 시작·멈춤 */
export function useRecording(hallId: string | null) {
  const qc = useQueryClient();
  const key = ["recording", hallId] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => recordingApi.state(hallId as string),
    enabled: !!hallId,
    refetchInterval: (q) => (q.state.data?.configured ? METER_MS : IDLE_MS),
    // 미터가 멈춘 것처럼 보이지 않게 — 실패해도 오래된 값은 지운다
    retry: false,
  });

  const refreshLibrary = () => qc.invalidateQueries({ queryKey: ["recordings"] });

  const start = useMutation({
    mutationFn: (label: string) => recordingApi.start(hallId as string, label),
    onSuccess: (st) => {
      qc.setQueryData(key, st);
      toast.success("녹음을 시작했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stop = useMutation({
    mutationFn: () => recordingApi.stop(hallId as string),
    onSuccess: (item) => {
      toast.success(`녹음을 멈췄습니다 — ${item.label || "이름 없음"}. 서버로 가져오는 중이에요.`);
      qc.invalidateQueries({ queryKey: key });
      refreshLibrary();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    state: query.data,
    error: query.error as Error | null,
    isLoading: query.isLoading,
    fetchedAt: query.dataUpdatedAt,
    start: start.mutate,
    isStarting: start.isPending,
    stop: stop.mutate,
    isStopping: stop.isPending,
  };
}

/** 녹음 목록 — 가져오는 중인 게 있으면 자주 */
export function useRecordings() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["recordings"],
    queryFn: () => recordingApi.library(),
    refetchInterval: (q) => (q.state.data?.recordings.some((r) => r.status === "importing") ? 1000 : 10_000),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["recordings"] });
  const fail = (e: Error) => toast.error(e.message);

  const retry = useMutation({ mutationFn: recordingApi.retryImport, onSuccess: refresh, onError: fail });
  const remove = useMutation({
    mutationFn: recordingApi.remove,
    onSuccess: () => {
      toast.success("녹음을 지웠습니다.");
      refresh();
    },
    onError: fail,
  });
  const rename = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) => recordingApi.rename(id, label),
    onSuccess: refresh,
    onError: fail,
  });

  return {
    recordings: (query.data?.recordings ?? []) as RecordingItem[],
    isLoading: query.isLoading,
    retry: retry.mutate,
    remove: remove.mutate,
    rename: rename.mutate,
  };
}

/** 올린 영상 · 합치기 작업 — 합치는 중이면 1초마다 */
export function useMerge() {
  const qc = useQueryClient();
  const videos = useQuery({ queryKey: ["mergeVideos"], queryFn: recordingApi.videos });
  const jobs = useQuery({
    queryKey: ["mergeJobs"],
    queryFn: recordingApi.jobs,
    refetchInterval: (q) =>
      q.state.data?.jobs.some((j) => j.status === "queued" || j.status === "running") ? 1000 : 15_000,
  });
  const fail = (e: Error) => toast.error(e.message);

  const merge = useMutation({
    mutationFn: recordingApi.merge,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mergeJobs"] }),
    onError: fail,
  });
  const removeJob = useMutation({
    mutationFn: recordingApi.removeJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mergeJobs"] }),
    onError: fail,
  });
  const removeVideo = useMutation({
    mutationFn: recordingApi.removeVideo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mergeVideos"] }),
    onError: fail,
  });

  return {
    videos: videos.data?.videos ?? [],
    jobs: jobs.data?.jobs ?? [],
    refreshVideos: () => qc.invalidateQueries({ queryKey: ["mergeVideos"] }),
    merge: merge.mutateAsync,
    isMerging: merge.isPending,
    removeJob: removeJob.mutate,
    removeVideo: removeVideo.mutate,
  };
}
