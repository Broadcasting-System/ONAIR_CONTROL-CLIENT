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
