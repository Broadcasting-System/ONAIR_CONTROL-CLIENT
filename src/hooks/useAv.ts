import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/common/Toast";
import { avApi } from "@/lib/avApi";
import { recordingApi } from "@/lib/recordingApi";
import type { AvItem } from "@/types/av";

const KEY = ["avState"] as const;
const LIB = ["avLibrary"] as const;

/** 녹음·녹화 상태 — 녹화기 준비, 지금 녹음·녹화, 채널(이름·연결된 홀·송출 화면), 홀 */
export function useAvState() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => avApi.state(),
    refetchInterval: (q) => (q.state.data?.session ? 1000 : 3000),
    retry: false,
  });

  const refreshLists = () => {
    qc.invalidateQueries({ queryKey: LIB });
    qc.invalidateQueries({ queryKey: ["recordings"] });
  };

  const start = useMutation({
    mutationFn: avApi.start,
    onSuccess: (st) => {
      qc.setQueryData(KEY, st);
      qc.invalidateQueries({ queryKey: ["recording"] });
      toast.success("시작했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stop = useMutation({
    mutationFn: (hall?: string | null) => avApi.stop(hall),
    onSuccess: (item) => {
      toast.success(
        item.kind === "audio"
          ? "녹음을 멈췄습니다."
          : "녹화를 멈췄습니다.",
      );
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["recording"] });
      refreshLists();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** 오른쪽 위 칩의 '다시 확인' — ffmpeg·크롬·인코더를 다시 살핀다 */
  const recheck = async () => {
    try {
      qc.setQueryData(KEY, await avApi.state(true));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return {
    state: query.data,
    error: query.error as Error | null,
    fetchedAt: query.dataUpdatedAt,
    start: start.mutate,
    isStarting: start.isPending,
    stop: stop.mutate,
    isStopping: stop.isPending,
    recheck,
  };
}

/** 통합 목록 (영상+소리 · 영상만 · 소리만) — 만드는 중인 게 있으면 자주 */
export function useAvLibrary() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: LIB,
    queryFn: avApi.library,
    refetchInterval: (q) =>
      q.state.data?.items.some((i) => ["recording", "processing", "importing"].includes(i.status)) ? 1000 : 10_000,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: LIB });
    qc.invalidateQueries({ queryKey: ["recordings"] });
  };
  const fail = (e: Error) => toast.error(e.message);

  // 소리만은 지금까지의 녹음 API, 영상은 녹화 API
  const rename = useMutation({
    mutationFn: async ({ item, label }: { item: AvItem; label: string }): Promise<unknown> =>
      item.kind === "audio" ? recordingApi.rename(item.id, label) : avApi.rename(item.id, label),
    onSuccess: refresh,
    onError: fail,
  });
  const retry = useMutation({
    mutationFn: async (item: AvItem): Promise<unknown> =>
      item.kind === "audio" ? recordingApi.retryImport(item.id) : avApi.retry(item.id),
    onSuccess: refresh,
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (item: AvItem) => (item.kind === "audio" ? recordingApi.remove(item.id) : avApi.remove(item.id)),
    onSuccess: () => {
      toast.success("지웠습니다.");
      refresh();
    },
    onError: fail,
  });

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    rename: (item: AvItem, label: string) => rename.mutate({ item, label }),
    retry: retry.mutate,
    remove: remove.mutate,
  };
}
