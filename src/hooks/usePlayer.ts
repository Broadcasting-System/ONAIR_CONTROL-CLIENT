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

const chQs = (channel: number) => (channel > 1 ? `?channel=${channel}` : "");

async function sendPlayer(body: PlayerBody, channel: number = 1) {
  try {
    const res = await fetch(`${getApiBase()}/display/player${chQs(channel)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** 일반 display 영상 재생 제어 (서버 권위적, WS로 display·control 동기화). channel 대상. */
export function usePlayer(channel: number = 1) {
  const play = useCallback(() => sendPlayer({ action: "play" }, channel), [channel]);
  const pause = useCallback(() => sendPlayer({ action: "pause" }, channel), [channel]);
  const toggle = useCallback(() => sendPlayer({ action: "toggle" }, channel), [channel]);
  const seek = useCallback(
    (position: number) => sendPlayer({ action: "seek", position }, channel),
    [channel],
  );
  const setVolume = useCallback(
    (volume: number) => sendPlayer({ action: "volume", volume }, channel),
    [channel],
  );
  const setMuted = useCallback(
    (muted: boolean) => sendPlayer({ action: "volume", muted }, channel),
    [channel],
  );
  const setFit = useCallback(
    (fit: "contain" | "cover") => sendPlayer({ action: "fit", fit }, channel),
    [channel],
  );
  const setLoop = useCallback(
    (loop: boolean) => sendPlayer({ action: "loop", loop }, channel),
    [channel],
  );
  const setSlide = useCallback(async (index: number) => {
    try {
      await fetch(`${getApiBase()}/display/slide${chQs(channel)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
    } catch {
      /* ignore */
    }
  }, [channel]);
  const setOverlay = useCallback(
    async (patch: {
      text?: string;
      size?: number;
      color?: string;
      position?: "top" | "center" | "bottom";
      visible?: boolean;
    }) => {
      try {
        await fetch(`${getApiBase()}/display/overlay${chQs(channel)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      } catch {
        /* ignore */
      }
    },
    [channel],
  );
  return { play, pause, toggle, seek, setVolume, setMuted, setFit, setLoop, setSlide, setOverlay };
}
