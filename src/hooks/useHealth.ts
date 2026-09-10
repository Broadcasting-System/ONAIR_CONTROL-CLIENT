import { useCallback, useEffect, useState } from "react";
import { getApiBase } from "@/lib/apiBase";

export interface ChannelHealth {
  count: number;
  live: boolean;
  displays: { name: string; ip: string; ageSec: number; stale: boolean }[];
  /** 지금 이 채널이 송출 중인 종류 (standby = 대기) */
  type?: string;
}

export interface Health {
  channels: Record<string, ChannelHealth>;
  matrix: { connected: boolean; host: string };
}

/** 채널별 송출 화면 생존 + 스피커 매트릭스 연결 상태 (폴링). */
export function useHealth(intervalMs = 3000) {
  const [health, setHealth] = useState<Health | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/display/health`);
      if (res.ok) setHealth((await res.json()) as Health);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, intervalMs);
    return () => clearInterval(id);
  }, [fetchHealth, intervalMs]);

  return { health };
}
