import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "@/lib/apiBase";
import { MAX_CHANNELS } from "@/stores/channelStore";

/** 송출 화면 종류 → 짧은 한국어 이름 */
export const SHOW_LABEL: Record<string, string> = {
  video: "영상",
  image: "이미지",
  presentation: "PPT",
  audio: "오디오",
  youtube: "유튜브",
  timer: "타이머",
  screen: "화면 공유",
  screenshare: "화면 공유",
  text: "글자",
  switch: "스위처",
};

export const showLabel = (type: string) => SHOW_LABEL[type] ?? type;

/**
 * 송출 채널 1~MAX 중 뭔가 띄우고 있는 채널.
 * data: 띄우는 채널 목록, failed: 모든 채널 상태를 못 읽음(서버에 닿지 않음)
 */
export function useShowing() {
  const query = useQuery({
    queryKey: ["display", "showing"],
    refetchInterval: 10_000,
    queryFn: async () => {
      const base = getApiBase();
      const res = await Promise.all(
        Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1).map((ch) =>
          fetch(`${base}/display/status${ch > 1 ? `?channel=${ch}` : ""}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
            .then((s: { type?: string } | null) => (s ? { ch, type: s.type ?? "standby" } : null)),
        ),
      );
      const ok = res.filter((s): s is { ch: number; type: string } => s !== null);
      return { failed: ok.length === 0, list: ok.filter((s) => s.type !== "standby" && s.type !== "blank") };
    },
  });
  return { data: query.data?.list, failed: query.data?.failed ?? query.isError, isLoading: query.isLoading };
}
