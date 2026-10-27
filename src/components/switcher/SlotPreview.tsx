"use client";

/* eslint-disable @next/next/no-img-element -- 미리보기 사진·썸네일은 서버·유튜브가 주는 임의 주소 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Hls from "hls.js";
import { resolveMediaUrl } from "@/lib/backend";
import { shareApi, type ShareRequest } from "@/lib/shareApi";
import type { SwitchLayout, SwitchSlot, SwitchSource } from "@/lib/switchApi";

/** 스위처 칸·소스 목록의 작은 미리보기 — 소리 없이.
 *  외부 화면은 발표자가 몇 초마다 올리는 사진(진짜 영상은 송출 화면에만 WebRTC 로 간다). */

function Countdown({ startedAt, durationSec, mode, label }: { startedAt: number; durationSec: number; mode: "down" | "up"; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const el = Math.max(0, (now - (startedAt || now)) / 1000);
  const s = Math.floor(mode === "up" ? el : Math.max(0, durationSec - el));
  const p = (n: number) => String(n).padStart(2, "0");
  const t = s >= 3600 ? `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}` : `${Math.floor(s / 60)}:${p(s % 60)}`;
  // 글자 크기는 칸 너비 기준 — cqw 는 자기 자신이 아니라 바깥 컨테이너를 보므로 한 겹 감싼다
  return (
    <div className="absolute inset-0 bg-black" style={{ containerType: "size" }}>
      <div className="flex h-full w-full flex-col items-center justify-center gap-[3cqw]">
        {label ? <span className="font-mbc text-white/80" style={{ fontSize: "7cqw" }}>{label}</span> : null}
        <span className="font-orbitron font-extrabold tabular-nums text-white" style={{ fontSize: "20cqw", lineHeight: 1 }}>
          {t}
        </span>
      </div>
    </div>
  );
}

/** 영상 칸 — 송출 중인 칸이면 서버 시각(startedAt) 기준 같은 자리로 맞춘다 */
function VideoPreview({ url, startedAt, live, fit, loop }: { url: string; startedAt: number; live: boolean; fit: Fit; loop: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const sync = () => {
    const v = ref.current;
    if (!v || !live || !startedAt || !v.duration || !isFinite(v.duration)) return;
    const el = Math.max(0, (Date.now() - startedAt) / 1000);
    const want = loop ? el % v.duration : Math.min(el, v.duration);
    if (Math.abs(v.currentTime - want) > 1.5) v.currentTime = want;
  };
  useEffect(sync); // startedAt 이 바뀌면 (진행바로 옮김) 다시 맞춘다
  // live 화면은 영상 칸이 R2 사본(HLS, 두 화질)으로 온다 — 크롬·안드로이드는 hls.js, 아이폰 사파리는 브라우저가 직접
  const src = resolveMediaUrl(url);
  const isHls = src.includes(".m3u8");
  useEffect(() => {
    const v = ref.current;
    if (!v || !isHls) return;
    if (!Hls.isSupported()) {
      v.src = src;
      return;
    }
    const h = new Hls({ maxBufferLength: 20, maxMaxBufferLength: 20 });
    h.loadSource(src);
    h.attachMedia(v);
    return () => h.destroy();
  }, [src, isHls]);
  return (
    <video
      ref={ref}
      src={isHls ? undefined : src}
      muted
      playsInline
      autoPlay={live}
      loop={loop}
      preload="metadata"
      onLoadedMetadata={sync}
      className="absolute inset-0 h-full w-full"
      style={{ objectFit: fit }}
    />
  );
}

type Fit = "contain" | "cover";

export function SlotPreview({
  source,
  startedAt = 0,
  share,
  live = true,
  shareNote,
  fit = "contain",
  loop = true,
}: {
  source: SwitchSource | null | undefined;
  startedAt?: number;
  /** 화면 맞춤 · 꽉 채움 */
  fit?: Fit;
  /** 영상 반복 */
  loop?: boolean;
  /** 외부 화면이면 그 요청 (미리보기 사진·끝났는지) */
  share?: ShareRequest;
  /** 영상을 움직이게 (소스 목록 작은 칸은 멈춘 첫 화면) */
  live?: boolean;
  /** 외부 화면 요청을 모를 때 (live 화면 등 사진을 못 보는 곳) */
  shareNote?: string;
}) {
  if (!source) return null;
  if (source.kind === "share") {
    if (!share) return <Note text={shareNote ?? "끝남"} />;
    return share.hasSnapshot ? (
      <img src={shareApi.snapshotUrl(share)} alt="" className="absolute inset-0 h-full w-full" style={{ objectFit: fit }} />
    ) : (
      <Note text="연결 중" />
    );
  }
  if (source.kind === "video") return <VideoPreview url={source.url} startedAt={startedAt} live={live} fit={fit} loop={loop} />;
  if (source.kind === "image")
    return <img src={resolveMediaUrl(source.url)} alt="" className="absolute inset-0 h-full w-full" style={{ objectFit: fit }} />;
  if (source.kind === "youtube")
    return <img src={`https://i.ytimg.com/vi/${source.videoId}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  return <Countdown startedAt={startedAt} durationSec={source.durationSec} mode={source.mode} label={source.label} />;
}

function Note({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0d0e11]">
      <span className="font-pretendard text-[12px] text-white/40">{text}</span>
    </div>
  );
}

/** 배치대로 칸 자리 잡기 — cell(i, className, style) 로 칸을 그린다 (스위처 송출 화면·미리보기 공용) */
export function SwitchGrid({
  layout,
  cell,
}: {
  layout: SwitchLayout;
  cell: (i: number, className: string, style?: CSSProperties) => ReactNode;
}) {
  if (layout === "one") return <>{cell(0, "absolute inset-0")}</>;
  if (layout === "two")
    return (
      <div className="absolute inset-0 grid grid-cols-2 items-center gap-[2px]">
        {cell(0, "relative aspect-video w-full")}
        {cell(1, "relative aspect-video w-full")}
      </div>
    );
  if (layout === "four")
    return (
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[2px]">
        {[0, 1, 2, 3].map((i) => cell(i, "relative h-full w-full"))}
      </div>
    );
  return (
    <>
      {cell(0, "absolute inset-0")}
      {cell(1, "absolute rounded-md shadow-[0_0_0_2px_rgba(255,255,255,0.35)]", {
        right: "2.5%",
        bottom: "4%",
        width: "28%",
        aspectRatio: "16 / 9",
      })}
    </>
  );
}

/** 송출 미리보기·live 화면용 — 스위처 송출을 소리 없이 그대로 */
export function SwitchMirror({ layout, slots }: { layout: SwitchLayout; slots: SwitchSlot[] }) {
  return (
    <div className="absolute inset-0 bg-black">
      <SwitchGrid
        layout={layout}
        cell={(i, cls, style) => (
          <div key={i} className={`overflow-hidden bg-black ${cls}`} style={style}>
            <SlotPreview
              source={slots[i]?.source}
              startedAt={slots[i]?.startedAt}
              fit={slots[i]?.fit}
              loop={slots[i]?.loop !== false}
              shareNote="외부 화면"
            />
          </div>
        )}
      />
    </div>
  );
}
