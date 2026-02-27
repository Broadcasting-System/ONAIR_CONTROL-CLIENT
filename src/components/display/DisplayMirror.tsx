"use client";

import { useEffect, useState, useRef } from "react";
import { useDisplaySync, DisplayContent } from "@/hooks/useDisplaySync";

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

export const DisplayMirror = () => {
  const { content } = useDisplaySync();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(() =>
    calculateSlideIndex(content)
  );
  const videoRef = useRef<HTMLVideoElement>(null);

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

    const syncSlides = () => {
      const elapsedMs = Date.now() - content.serverTimestamp!;
      const totalDurationMs = content.duration! * 1000;
      const index = Math.floor(elapsedMs / totalDurationMs);

      if (index >= content.urls!.length) {
        // In mirror mode, we just keep showing or clear locally
      } else {
        setCurrentSlideIndex((prev) => (prev !== index ? index : prev));
      }
    };

    const intervalId = setInterval(syncSlides, 1000);
    return () => clearInterval(intervalId);
  }, [content]);

  useEffect(() => {
    if (content?.type === "video" && content.serverTimestamp && videoRef.current) {
      const video = videoRef.current;
      const elapsedSec = (Date.now() - content.serverTimestamp) / 1000;

      const syncVideo = async () => {
        try {
          video.currentTime = elapsedSec;
          await video.play();
        } catch (err) {
          // Mirror is muted by default for safety
          video.muted = true;
          video.play().catch(() => { });
        }
      };

      syncVideo();
    }
  }, [content]);

  if (!content || content.type === "standby") {
    return (
      <div className="relative z-10 flex flex-col items-center justify-center gap-2">
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
    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <div className="relative aspect-video w-full max-h-full flex items-center justify-center bg-black rounded-lg overflow-hidden border border-white/5 shadow-2xl">
          {content.type === "image" && content.url ? (
            <img
              src={content.url}
              alt="Mirror View"
              className="w-full h-full object-contain"
            />
          ) : null}

          {content.type === "video" && content.url ? (
            <video
              ref={videoRef}
              src={content.url}
              muted
              playsInline
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : null}

          {content.type === "presentation" && content.urls ? (
            <img
              src={content.urls[currentSlideIndex]}
              alt="Mirror Slide"
              className="w-full h-full object-contain"
            />
          ) : null}

          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 bg-red-600/90 rounded-full border border-red-500/50 shadow-lg">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-[10px] font-black tracking-tighter text-white uppercase">LIVE MONITOR</span>
          </div>
        </div>
      </div>
    </div>
  );
};
