import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "@/lib/apiBase";

interface NetworkStatusResponse {
  speaker_controller: "online" | "offline";
  internet: "online" | "offline";
  latency: number;
}

export function useNetworkStatus() {
  const { data, isLoading } = useQuery<NetworkStatusResponse>({
    queryKey: ["networkStatus"],
    queryFn: async () => {
      const BASE = getApiBase();
      const res = await fetch(`${BASE}/network/status`);
      if (!res.ok) throw new Error("네트워크 상태 로드 실패");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const statuses = [
    {
      label: "스피커",
      status: data?.speaker_controller === "online" ? ("good" as const) : ("critical" as const),
    },
    {
      label: "송출",
      status: data?.internet === "online" ? ("good" as const) : ("critical" as const),
    },
    {
      label: "지연속도",
      status: data ? (data.latency < 100 ? ("good" as const) : data.latency < 300 ? ("caution" as const) : ("critical" as const)) : ("critical" as const),
    },
  ];

  return { statuses, isLoading };
}
