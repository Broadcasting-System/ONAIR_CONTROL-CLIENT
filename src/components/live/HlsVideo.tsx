"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Loader2 } from "lucide-react";
import { backendBase } from "@/lib/backend";
import { cn } from "@/lib/utils";

/** live 중계 HLS (서버 app/services/live_stream.py) — 서버 PC 가 송출 화면을 찍어 R2 에 올린 720p·480p.
 *  hls.js 로 틀고(처음엔 480p 로 빨리, 망이 되면 720p), 아이폰처럼 MediaSource 가 없는 곳은 브라우저가 직접 튼다. */

/** GET /api/live 의 hls — R2 공개 주소, 또는 서버가 직접 내보낼 때(/api/live/hls/..) 경로 */
export interface LiveHls {
  url: string;
  startedAt: number;
}

export const hlsSrc = (url: string) => (url.startsWith("/") ? backendBase() + url : url);

/** 화질 — auto 거나 높이(720·480) */
export type Quality = "auto" | number;

export function HlsVideo({
  src,
  volume = 0,
  fit = "contain",
  quality = "auto",
  onLevels,
  onLevel,
  onFatal,
  className,
}: {
  src: string;
  /** 0~1, 0 이면 음소거 (자동 재생은 음소거여야 된다) */
  volume?: number;
  fit?: "contain" | "cover";
  quality?: Quality;
  /** 고를 수 있는 화질 높이 (높은 것부터). 브라우저가 직접 틀면 [] */
  onLevels?: (heights: number[]) => void;
  /** 지금 나오는 화질 높이 */
  onLevel?: (height: number) => void;
  /** 다시 해도 안 될 때 — 부르는 쪽이 예전 화면(DisplayMirror)으로 돌아간다 */
  onFatal?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [loading, setLoading] = useState(true);
  const cb = useRef({ onLevels, onLevel, onFatal });
  useEffect(() => {
    cb.current = { onLevels, onLevel, onFatal };
  });

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    setLoading(true);
    v.muted = true;
    const play = () => void v.play().catch(() => {});
    // MediaSource 가 없으면(아이폰 사파리) 브라우저가 HLS 를 직접 — 맥 사파리·안드로이드·PC 는 hls.js
    const native = typeof window.MediaSource === "undefined" && v.canPlayType("application/vnd.apple.mpegurl") !== "";
    let hls: Hls | null = null;
    let recovered = 0;
    if (!native && Hls.isSupported()) {
      hls = new Hls({
        // 2초 조각 × 3 뒤에서 튼다 (약 6초 + 올리기) — 학교 업로드가 1초쯤 늦거나 R2 에서 받는 데 0.5~1초 걸려도
        // 멈추지 않게 (2개 뒤일 때 학교 밖 LTE 에서 자주 멈췄다, 2026-10-22 실측: 여유 2.9초).
        // 16초 넘게 밀리면 앞으로 뛰고, 조금 밀리면 살짝 빨리 틀어 따라간다
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 8,
        maxLiveSyncPlaybackRate: 1.1,
        backBufferLength: 10,
        maxBufferLength: 20,
        // 처음엔 480p 로 빨리 띄우고, 받는 속도를 재서 되면 720p 로 (칸 크기로 화질을 깎지는 않는다)
        capLevelToPlayerSize: false,
        abrEwmaDefaultEstimate: 1_500_000,
      });
      hlsRef.current = hls;
      const h = hls;
      h.on(Hls.Events.MANIFEST_PARSED, () => {
        const heights = h.levels.map((l) => l.height);
        const low = heights.indexOf(Math.min(...heights));
        if (low >= 0) h.startLevel = low;
        cb.current.onLevels?.([...new Set(heights)].sort((a, b) => b - a));
        play();
      });
      h.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => {
        const lv = h.levels[d.level];
        if (lv) cb.current.onLevel?.(lv.height);
      });
      h.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal) return;
        if (recovered++ < 3) {
          if (d.type === Hls.ErrorTypes.MEDIA_ERROR) h.recoverMediaError();
          else h.startLoad();
          return;
        }
        cb.current.onFatal?.();
      });
      h.loadSource(src);
      h.attachMedia(v);
    } else if (native) {
      cb.current.onLevels?.([]);
      v.src = src;
      play();
    } else {
      cb.current.onFatal?.();
    }
    const on = () => setLoading(false);
    const off = () => setLoading(true);
    v.addEventListener("playing", on);
    v.addEventListener("waiting", off);
    v.addEventListener("canplay", play);
    // 실시간이라 멈춤 버튼이 없다 — 새 소스를 붙이는 사이 play() 가 끊겨 멈춰 있으면 다시 튼다
    const keep = setInterval(() => {
      if (v.paused && v.readyState >= 3) play();
    }, 2000);
    return () => {
      clearInterval(keep);
      v.removeEventListener("playing", on);
      v.removeEventListener("waiting", off);
      v.removeEventListener("canplay", play);
      hlsRef.current = null;
      hls?.destroy();
      v.removeAttribute("src");
      v.load();
    };
  }, [src]);

  // 화질 고르기 — 다음 조각부터 바꾼다 (자동 = -1)
  useEffect(() => {
    const h = hlsRef.current;
    if (!h || !h.levels.length) return;
    if (quality === "auto") {
      h.nextLevel = -1;
      return;
    }
    const i = h.levels.findIndex((l) => l.height === quality);
    if (i >= 0) h.nextLevel = i;
  }, [quality, loading]);

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

/** 컨트롤 송출 미리보기용 — 이 채널이 live 로 중계되고 있으면 그 HLS 주소 (5초마다 확인) */
export function useLiveHlsUrl(channel: number, enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      setUrl(null);
      return;
    }
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`${backendBase()}/api/live`, { cache: "no-store" });
        if (!r.ok) return;
        const rows = ((await r.json()) as { channels: { channel: number; hls?: LiveHls | null }[] }).channels;
        const hit = rows.find((c) => c.channel === channel)?.hls;
        if (!stop) setUrl(hit ? hlsSrc(hit.url) : null);
      } catch {
        // 서버가 잠깐 안 닿으면 지금 것 그대로
      }
    };
    void load();
    const id = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [channel, enabled]);
  return url;
}
