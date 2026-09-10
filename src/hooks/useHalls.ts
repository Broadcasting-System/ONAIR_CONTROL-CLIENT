import { useQuery } from "@tanstack/react-query";
import { hallApi } from "@/lib/hallApi";

/** 설정된 공간(강당·다목적홀)과 각 공간의 장비 유무 */
export function useHalls() {
  const query = useQuery({
    queryKey: ["halls"],
    queryFn: hallApi.list,
    staleTime: 60_000,
  });
  return { halls: query.data?.halls ?? [], isLoading: query.isLoading, isError: query.isError };
}

/** 모든 공간 장비(믹서·매트릭스)의 연결 요약 — 메인 화면 카드용 */
export function useHallsStatus() {
  const query = useQuery({
    queryKey: ["hallsStatus"],
    queryFn: hallApi.status,
    refetchInterval: 10_000,
  });
  return { summary: query.data, isError: query.isError };
}
