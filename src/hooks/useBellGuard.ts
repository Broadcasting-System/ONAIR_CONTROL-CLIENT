import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { broadcastApi, type BellGuardStatus } from "@/lib/broadcastApi";

/**
 * 종이 최우선 — 방송 화면이 다음 종과 지금 쓸 수 있는 시간을 몇 초마다 본다 (GET /api/broadcast/bell-guard).
 * 서버가 같은 계산으로 마지막에 다시 보고 막는다(409 · 마이크 4409). 여기는 버튼을 미리 끄고 까닭 한 줄을 보이려는 것.
 * 규칙: 서버 docs/bell.md '종이 최우선'.
 */
export const BELL_GUARD_KEY = ["broadcast", "bell-guard"] as const;

/** 글을 읽는 데 드는 어림(초) — 선생님 화면과 같은 값. 서버는 TTS 를 만들어 실제 길이로 다시 본다 */
export const readSeconds = (text: string) => text.trim().length / 6;

export const mmss = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

function useTick(ms: number, on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, on]);
  return now;
}

export function useBellGuard(enabled = true) {
  const q = useQuery({
    queryKey: BELL_GUARD_KEY,
    queryFn: broadcastApi.bellGuard,
    enabled,
    refetchInterval: (query) => {
      const b = query.state.data?.bell;
      // 종이 2분 안이면 1초마다 (막힘이 풀리는 순간을 놓치지 않게)
      return b && query.state.data?.now && b.at - query.state.data.now < 120_000 ? 1000 : 3000;
    },
  });
  const st: BellGuardStatus | undefined = q.data;
  /** 서버 시계와의 차이 — 종 시각은 서버 기준 */
  const offset = st?.now ? st.now - q.dataUpdatedAt : 0;
  const now = useTick(250, !!st?.bell);
  const serverNow = now + offset;
  const bell = st?.bell ?? null;

  /** 소리 seconds 초(시작·끝 음원 포함)를 지금 보내면 종 전에 다 못 끝나는지 */
  const playBlocked = (seconds: number) => {
    if (!st || st.playSeconds === null) return false;
    const passed = Math.max(0, (serverNow - (st.now ?? serverNow)) / 1000);
    const room = st.playSeconds - passed;
    return room < 3 || seconds > room;
  };

  return {
    status: st,
    bell,
    serverNow,
    /** 종까지 남은 시간 '0:42' */
    countdown: bell ? mmss((bell.at - serverNow) / 1000) : "",
    chimeSeconds: st?.chimeSeconds ?? 1.65,
    micBlocked: !!st?.micBlocked,
    playBlocked,
    refetch: q.refetch,
  };
}
