"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { cn } from "@/lib/utils";
import {
  useDisplaySync,
  DisplayContent,
  Playback,
  ImageOverlay,
} from "@/hooks/useDisplaySync";

/** 이미지 위 텍스트 오버레이 (송출 화면과 동일 규칙, 16:9 박스의 cqw 기준) */
function MirrorTextOverlay({ overlay }: { overlay: ImageOverlay }) {
  if (!overlay.visible || !overlay.text?.trim()) return null;
  const justify =
    overlay.position === "top"
      ? "flex-start"
      : overlay.position === "center"
        ? "center"
        : "flex-end";
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        containerType: "inline-size",
        display: "flex",
        flexDirection: "column",
        justifyContent: justify,
        alignItems: "center",
        padding: "6cqw",
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          fontFamily: '"Paperlogy", "Pretendard Variable", sans-serif',
          fontWeight: 800,
          fontSize: `${overlay.size}cqw`,
          lineHeight: 1.15,
          color: overlay.color || "#ffffff",
          textAlign: "center",
          whiteSpace: "pre-wrap",
          wordBreak: "keep-all",
          textShadow:
            "0 0.3cqw 1.2cqw rgba(0,0,0,0.85), 0 0 0.4cqw rgba(0,0,0,0.9)",
          WebkitTextStroke: "0.08cqw rgba(0,0,0,0.55)",
        }}
      >
        {overlay.text}
      </span>
    </div>
  );
}

const calculateSlideIndex = (content: DisplayContent | null) => {
  if (
    content?.type !== "presentation" ||
    !content.urls ||
    !content.duration ||
    !content.serverTimestamp
  ) {
    return 0;
  }
  const elapsedMs = Date.now() - content.serverTimestamp;
  const totalDurationMs = content.duration * 1000;
  const index = Math.floor(elapsedMs / totalDurationMs);
  return index < content.urls.length ? index : content.urls.length - 1;
};

const posFromPlayback = (
  pb?: Playback | null,
  duration?: number,
): number | null => {
  if (!pb) return null;
  const raw = pb.playing
    ? Math.max(0, pb.offset + (Date.now() - pb.anchorTs) / 1000)
    : Math.max(0, pb.offset);
  // 반복 재생: 서버 시계는 계속 증가하므로 영상 길이로 나눈 나머지로 환산
  if (pb.loop && duration && Number.isFinite(duration) && duration > 0) {
    return raw % duration;
  }
  return raw;
};

/** 미리보기용 카운트다운/업 (송출 CountdownView 축소판) */
function MirrorCountdown({
  serverTimestamp,
  durationSec = 0,
  mode = "down",
  label,
}: {
  serverTimestamp?: number;
  durationSec?: number;
  mode?: "down" | "up";
  label?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const start = serverTimestamp ?? now;
  const elapsed = Math.max(0, (now - start) / 1000);
  const secs = mode === "up" ? elapsed : Math.max(0, durationSec - elapsed);
  const done = mode === "down" && secs <= 0;
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black">
      {label ? <span className="font-mbc text-lg text-white/70">{label}</span> : null}
      <span
        className={cn(
          "font-orbitron text-[18%] font-extrabold tabular-nums",
          done ? "animate-pulse text-red-400" : "text-white",
        )}
        style={{ fontSize: "min(22vh, 12vw)" }}
      >
        {text}
      </span>
    </div>
  );
}

export const DisplayMirror = ({ channel = 1 }: { channel?: number }) => {
  const { content } = useDisplaySync(channel);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(() =>
    calculateSlideIndex(content),
  );
  const videoRef = useRef<HTMLVideoElement>(null);

  const playbackRef = useRef<Playback | null | undefined>(content?.playback);
  playbackRef.current = content?.playback;

  // 프레젠테이션 슬라이드
  useEffect(() => {
    if (
      content?.type !== "presentation" ||
      !content.urls ||
      !content.duration ||
      !content.serverTimestamp
    ) {
      setCurrentSlideIndex((prev) => (prev !== 0 ? 0 : prev));
      return;
    }
    const id = setInterval(() => {
      const elapsedMs = Date.now() - content.serverTimestamp!;
      const idx = Math.floor(elapsedMs / (content.duration! * 1000));
      if (idx < content.urls!.length) {
        setCurrentSlideIndex((prev) => (prev !== idx ? idx : prev));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [content]);

  // 영상 로드 (URL 변경 시에만)
  useEffect(() => {
    if (content?.type !== "video" || !content.url || !videoRef.current) return;
    const video = videoRef.current;
    const primary = content.url;
    let hls: Hls | null = null;

    const initialPos = () => {
      const p = posFromPlayback(playbackRef.current);
      if (p != null) return p;
      return content.serverTimestamp
        ? Math.max(0, (Date.now() - content.serverTimestamp) / 1000)
        : 0;
    };

    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      const pb = playbackRef.current;
      const target = posFromPlayback(pb, video.duration) ?? initialPos();
      if (
        Number.isFinite(video.duration) &&
        Math.abs(video.currentTime - target) > 0.7
      ) {
        try {
          video.currentTime = target;
        } catch {}
      }
      video.muted = true; // 모니터는 항상 음소거
      if (!pb || pb.playing) video.play().catch(() => {});
    };
    video.addEventListener("loadedmetadata", apply);

    // 반복 재생: 끝나면 처음부터 (네이티브 loop는 ended를 막으므로 이벤트로 처리)
    video.loop = false;
    const onEndedEvt = () => {
      if (playbackRef.current?.loop) {
        try {
          video.currentTime = 0;
        } catch {}
        video.play().catch(() => {});
      }
    };
    video.addEventListener("ended", onEndedEvt);
    const loopCheck = setInterval(() => {
      const pb = playbackRef.current;
      const dur = video.duration;
      const nearEnd =
        Number.isFinite(dur) && dur > 0 && video.currentTime >= dur - 0.4;
      if (pb?.loop && (video.ended || (video.paused && nearEnd))) {
        try {
          video.currentTime = 0;
        } catch {}
        video.play().catch(() => {});
      }
    }, 700);

    if (primary.includes(".m3u8") && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        maxMaxBufferLength: 20, // 미리보기는 가볍게
        maxBufferLength: 20,
        startPosition: initialPos(),
      });
      hls.loadSource(primary);
      hls.attachMedia(video);
    } else {
      video.src = primary;
      video.load();
    }

    return () => {
      video.removeEventListener("loadedmetadata", apply);
      video.removeEventListener("ended", onEndedEvt);
      clearInterval(loopCheck);
      if (hls) hls.destroy();
    };
  }, [content?.url, content?.type, content?.serverTimestamp]);

  // 재생제어 반영 (play/pause/seek) — 소리는 모니터라 항상 muted
  useEffect(() => {
    const v = videoRef.current;
    if (content?.type !== "video" || !v || !content.playback) return;
    const pb = content.playback;
    const target = posFromPlayback(pb, v.duration);
    if (
      target != null &&
      Number.isFinite(v.duration) &&
      Math.abs(v.currentTime - target) > 0.7
    ) {
      try {
        v.currentTime = target;
      } catch {}
    }
    if (pb.playing) {
      if (v.paused) v.play().catch(() => {});
    } else if (!v.paused) {
      v.pause();
    }
  }, [content?.type, content?.playback]);

  if (!content || content.type === "standby" || content.type === "screen") {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black">
        <h3 className="text-4xl font-black italic tracking-wider text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
          OFF AIR
        </h3>
        <p className="text-xs font-medium text-red-500 tracking-tight opacity-80">
          방송 송출 준비 중입니다 잠시만 기다려주세요
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      {content.type === "image" && content.url ? (
        <div
          className="relative flex items-center justify-center"
          style={{
            aspectRatio: "16 / 9",
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.url}
            alt="Mirror View"
            className="h-full w-full object-contain"
          />
          {content.overlay ? <MirrorTextOverlay overlay={content.overlay} /> : null}
        </div>
      ) : null}

      {content.type === "video" && content.url ? (
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-full w-full"
          style={{ objectFit: content.playback?.fit ?? "contain" }}
        />
      ) : null}

      {content.type === "presentation" && content.urls ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={
            content.urls[
              typeof content.slideIndex === "number"
                ? Math.max(0, Math.min(content.slideIndex, content.urls.length - 1))
                : currentSlideIndex
            ]
          }
          alt="Mirror Slide"
          className="h-full w-full object-contain"
        />
      ) : null}

      {content.type === "timer" ? (
        <MirrorCountdown
          serverTimestamp={content.serverTimestamp}
          durationSec={content.durationSec}
          mode={content.mode}
          label={content.label}
        />
      ) : null}

      {content.type === "youtube" && content.videoId ? (
        <iframe
          className="h-full w-full"
          src={`https://www.youtube.com/embed/${content.videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1`}
          allow="autoplay; encrypted-media"
          title="YouTube 미리보기"
        />
      ) : null}

      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-full border border-red-500/50 bg-red-600/90 px-3 py-1.5 shadow-lg">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        <span className="text-[10px] font-black uppercase tracking-tighter text-white">
          LIVE MONITOR
        </span>
      </div>
    </div>
  );
};
