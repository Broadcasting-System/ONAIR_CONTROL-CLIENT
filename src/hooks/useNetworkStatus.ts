import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "@/lib/apiBase";

export interface NetworkStatusResponse {
  speaker_controller: "online" | "offline";
  internet: "online" | "offline";
  latency: number;
}

/** 방송실 서버가 재는 스피커 장비 연결·응답 시간 (5초마다) */
export function useNetworkStatus() {
  const { data, isLoading, isError } = useQuery<NetworkStatusResponse>({
    queryKey: ["networkStatus"],
    queryFn: async () => {
      const BASE = getApiBase();
      const res = await fetch(`${BASE}/network/status`);
      if (!res.ok) throw new Error("네트워크 상태 로드 실패");
      return res.json();
    },
    refetchInterval: 5000,
  });

  return { data, isLoading, isError };
}
