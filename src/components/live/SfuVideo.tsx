"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { backendBase } from "@/lib/backend";
import { cn } from "@/lib/utils";

/** 화면 공유를 Cloudflare Realtime SFU 에서 받는다 (서버 app/services/sfu_service.py) — 지연 1초 안쪽.
 *  서버가 받기 세션을 열어 SFU 의 offer 를 주면 answer 를 돌려준다. 화질은 화면 크기로 처음 고르고(f·h),
 *  망이 모자라면 SFU 가 알아서 낮춘다. 끊기면 몇 번 다시 붙고, 그래도 안 되면 onFatal. */

/** GET /api/live 의 sfu — id 가 바뀌면(보내는 쪽이 다시 올림) 새로 붙는다 */
export interface LiveSfu {
  id: string;
  startedAt: number;
}

const MAX_RETRY = 4;

/** 큰 화면(노트북·태블릿 가로)은 원본, 폰은 절반부터 — 폰 화면에 1080p 는 망만 쓴다 */
export function pickRid(width: number, dpr: number): "f" | "h" {
  return width * Math.min(dpr, 2) >= 1100 ? "f" : "h";
}

export function SfuVideo({
  channel,
  sfuId,
  volume = 0,
  fit = "contain",
  onFatal,
  className,
}: {
  channel: number;
  sfuId: string;
  /** 0~1, 0 이면 음소거 (자동 재생은 음소거여야 된다) */
  volume?: number;
  fit?: "contain" | "cover";
  onFatal?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const fatal = useRef(onFatal);
  useEffect(() => {
    fatal.current = onFatal;
  });

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let pc: RTCPeerConnection | null = null;
    let stopped = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);

    const again = (why: string) => {
      try {
        pc?.close();
      } catch {}
      pc = null;
      if (stopped) return;
      if (tries >= MAX_RETRY) {
        console.warn(`[화면 공유 SFU] ${why} — 그만둔다`);
        fatal.current?.();
        return;
      }
      tries += 1;
      timer = setTimeout(() => void connect(), Math.min(8_000, 1_000 * 2 ** tries));
    };

    const connect = async () => {
      try {
        const rid = pickRid(window.innerWidth, window.devicePixelRatio || 1);
        const r = await fetch(`${backendBase()}/api/sfu/watch?channel=${channel}&rid=${rid}`, { method: "POST" });
        if (!r.ok) throw new Error(`받기 ${r.status}`);
        const w = (await r.json()) as { sessionId: string; sdp: string; iceServers: RTCIceServer[] };
        if (stopped) return;
        const conn = new RTCPeerConnection({ iceServers: w.iceServers, bundlePolicy: "max-bundle" });
        pc = conn;
        const ms = new MediaStream();
        conn.ontrack = (e) => {
          ms.addTrack(e.track);
          if (v.srcObject !== ms) v.srcObject = ms;
          void v.play().catch(() => {});
        };
        conn.onconnectionstatechange = () => {
          const s = conn.connectionState;
          if (s === "connected") {
            tries = 0;
            setLoading(false);
          }
          if ((s === "failed" || s === "closed") && pc === conn) again(`연결 ${s}`);
        };
        await conn.setRemoteDescription({ type: "offer", sdp: w.sdp });
        const answer = await conn.createAnswer();
        await conn.setLocalDescription(answer);
        const a = await fetch(`${backendBase()}/api/sfu/answer`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: w.sessionId, sdp: conn.localDescription?.sdp ?? answer.sdp }),
        });
        if (!a.ok) throw new Error(`answer ${a.status}`);
      } catch (e) {
        again(e instanceof Error ? e.message : String(e));
      }
    };

    v.muted = true;
    void connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      try {
        pc?.close();
      } catch {}
      v.srcObject = null;
    };
  }, [channel, sfuId]);

  // 소리 — 0 이면 음소거
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.volume = Math.min(1, Math.max(0, volume));
    v.muted = volume <= 0;
    if (v.paused) void v.play().catch(() => {});
  }, [volume]);

  return (
    <div className={cn("absolute inset-0 bg-black", className)}>
      <video ref={ref} muted playsInline autoPlay className="h-full w-full" style={{ objectFit: fit }} />
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 size={34} className="animate-spin text-white/50 motion-reduce:animate-none" />
        </div>
      ) : null}
    </div>
  );
}
