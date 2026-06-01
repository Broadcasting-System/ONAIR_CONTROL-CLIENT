import { useCallback } from "react";
import { getApiBase } from "@/lib/apiBase";

type PlayerBody = {
  action: "play" | "pause" | "toggle" | "seek" | "volume" | "fit" | "loop";
  position?: number;
  volume?: number;
  muted?: boolean;
  fit?: "contain" | "cover";
  loop?: boolean;
};

async function sendPlayer(body: PlayerBody) {
  try {
    const res = await fetch(`${getApiBase()}/display/player`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** 일반 display 영상 재생 제어 (서버 권위적, WS로 display·control 동기화). */
export function usePlayer() {
  const play = useCallback(() => sendPlayer({ action: "play" }), []);
  const pause = useCallback(() => sendPlayer({ action: "pause" }), []);
  const toggle = useCallback(() => sendPlayer({ action: "toggle" }), []);
  const seek = useCallback(
    (position: number) => sendPlayer({ action: "seek", position }),
    [],
  );
  const setVolume = useCallback(
    (volume: number) => sendPlayer({ action: "volume", volume }),
    [],
  );
  const setMuted = useCallback(
    (muted: boolean) => sendPlayer({ action: "volume", muted }),
    [],
  );
  const setFit = useCallback(
    (fit: "contain" | "cover") => sendPlayer({ action: "fit", fit }),
    [],
  );
  const setLoop = useCallback(
    (loop: boolean) => sendPlayer({ action: "loop", loop }),
    [],
  );
  const setSlide = useCallback(async (index: number) => {
    try {
      await fetch(`${getApiBase()}/display/slide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
    } catch {
      /* ignore */
    }
  }, []);
  return { play, pause, toggle, seek, setVolume, setMuted, setFit, setLoop, setSlide };
}
