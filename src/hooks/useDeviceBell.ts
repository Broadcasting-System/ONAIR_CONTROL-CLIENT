import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getApiBase } from "@/lib/apiBase";
import type { DeviceBellInfo } from "@/constants/deviceBell";

export const DEVICE_BELL_KEY = ["time", "device"] as const;

const EMPTY: DeviceBellInfo = { enabled: false, groups: [], tracks: [], last: null, rows: null, link: null, pending: null };

async function fetchDeviceBell(): Promise<DeviceBellInfo> {
  const res = await fetch(`${getApiBase()}/time/device`);
  if (!res.ok) throw new Error(`device ${res.status}`);
  return { ...EMPTY, ...(await res.json()) };
}

/** 장비 시보 — 장비 그룹·음원 목록(서버 config/lnb_timer.json)과 마지막 전송 결과 (GET /api/time/device) */
export function useDeviceBell() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: DEVICE_BELL_KEY,
    queryFn: fetchDeviceBell,
    staleTime: 15_000,
    // 종 뒤로 미룬 전송이 있으면 끝날 때까지 자주 본다
    refetchInterval: (query) => (query.state.data?.pending ? 5_000 : 60_000),
  });
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: DEVICE_BELL_KEY }), [qc]);
  return { info: q.data ?? EMPTY, loaded: !!q.data, refresh };
}
