"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  Check,
  ChevronRight,
  Eye,
  MessageSquareOff,
  SlidersHorizontal,
  SendHorizontal,
  Maximize,
  Minimize,
  MonitorUp,
  Music,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  Settings,
  Timer,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import NeonButton from "@/components/common/NeonButton";
import OnairMark from "@/components/common/OnairMark";
import { DisplayMirror } from "@/components/display/DisplayMirror";
import { HlsVideo, hlsSrc, type LiveHls, type Quality } from "@/components/live/HlsVideo";
import { SfuVideo, type LiveSfu } from "@/components/live/SfuVideo";
import { useDisplaySync } from "@/hooks/useDisplaySync";
import { backendBase, resolveMediaUrl } from "@/lib/backend";
import { cn } from "@/lib/utils";
import { channelName } from "@/constants/channels";

/** GET /api/live 의 채널 하나 */
interface LiveChannel {
  channel: number;
  label: string;
  hallName: string | null;
  type: string;
  title: string;
  startedAt: number | null;
  viewers: number;
  thumb: string | null;
  /** live 중계 — 서버 PC 가 찍어 올린 HLS. 화면 공유를 송출할 때만 생긴다 */
  hls?: LiveHls | null;
  /** 이 송출을 중계로 봐야 하는지 (화면 공유) — 아니면 송출 내용을 이 기기가 직접 그린다. 예전 서버는 안 보낸다 */
  relay?: boolean;
  /** 화면 공유를 Cloudflare Realtime SFU 에서 받을 수 있으면 — 중계(HLS)보다 먼저 (지연 1초 안쪽) */
  sfu?: LiveSfu | null;
}

async function fetchLive(): Promise<LiveChannel[]> {
  const r = await fetch(`${backendBase()}/api/live`, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return ((await r.json()) as { channels: LiveChannel[] }).channels;
}

/** 30초마다 바뀌는 지금 시각 — '14분째' 같은 표시용 */
function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function since(startedAt: number | null, now: number): string {
  if (!startedAt) return "";
  const m = Math.max(0, Math.floor((now - startedAt) / 60_000));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

function clock(startedAt: number | null): string {
  if (!startedAt) return "";
  const d = new Date(startedAt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}부터`;
}

// 소리가 있는 송출 — 이것만 [소리 켜기]를 보인다
const AUDIBLE = new Set(["video", "youtube", "audio"]);
// 화면 맞춤(원본 비율/꽉 채우기)을 고를 수 있는 송출
const FITTABLE = new Set(["video", "image", "presentation"]);
// 중계(HLS)로 볼 때 소리가 있을 수 있는 송출 — 화면 공유·스위처도 소리를 싣는다
const HLS_AUDIBLE = new Set([...AUDIBLE, "screen", "switch"]);

const place = (c: LiveChannel) => c.label || channelName(c.channel);

function TypeIcon({ type, size = 28 }: { type: string; size?: number }) {
  if (type === "timer") return <Timer size={size} />;
  if (type === "screen") return <MonitorUp size={size} />;
  if (type === "audio") return <Music size={size} />;
  return <Play size={size} />;
}

function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-[5px] bg-[#FF3B3B] px-2 font-orbitron text-[11px] font-bold tracking-[0.12em] text-white",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
      LIVE
    </span>
  );
}

function Viewers({ n, long }: { n: number; long?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Eye size={13} className="opacity-80" />
      {long ? `${n}명 보는 중` : n}
    </span>
  );
}

/** 썸네일 — 서버가 준 그림(영상 첫 장면·이미지·지금 슬라이드·유튜브), 없으면 종류 아이콘 */
function Thumb({ c, now }: { c: LiveChannel; now: number }) {
  const src = c.thumb ? resolveMediaUrl(c.thumb) : "";
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#1d1d22]">
      {src ? (
        // 학교 서버·유튜브의 그림이라 next/image 원격 도메인을 정해 둘 수 없다
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/30">
          <TypeIcon type={c.type} />
        </div>
      )}
      <LiveBadge className="absolute left-2 top-2" />
      {c.startedAt ? (
        <span className="absolute bottom-2 right-2 rounded-[5px] bg-black/70 px-1.5 py-0.5 font-pretendard text-[12px] tabular-nums text-white/90">
          {since(c.startedAt, now)}
        </span>
      ) : null}
    </div>
  );
}

function Card({ c, now, onOpen }: { c: LiveChannel; now: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 flex-col gap-2 text-left focus-visible:outline-none"
    >
      <div className="rounded-xl ring-white/60 group-focus-visible:ring-2">
        <Thumb c={c} now={now} />
      </div>
      <div className="min-w-0 px-0.5">
        <p className="truncate font-pretendard text-[15px] font-semibold text-white">{c.title}</p>
        <p className="flex items-center gap-2 truncate font-pretendard text-[13px] text-white/50">
          <span className="truncate">{place(c)}</span>
          <Viewers n={c.viewers} />
        </p>
      </div>
    </button>
  );
}

/** 중계 화면 — 보는 사람으로 세어지도록 송출 연결(role=live)은 그대로 열어 둔다 (보는 사람이 있어야 중계가 돈다) */
function HlsStage({
  ch,
  url,
  volume,
  fit,
  quality,
  onLevels,
  onLevel,
  onFatal,
}: {
  ch: number;
  url: string;
  volume: number;
  fit: "contain" | "cover";
  quality: Quality;
  onLevels?: (h: number[]) => void;
  onLevel?: (h: number) => void;
  onFatal: () => void;
}) {
  useDisplaySync(ch, "live");
  return (
    <HlsVideo
      src={hlsSrc(url)}
      volume={volume}
      fit={fit}
      quality={quality}
      onLevels={onLevels}
      onLevel={onLevel}
      onFatal={onFatal}
    />
  );
}

/** 화면 공유를 SFU 에서 — 보는 사람으로 세어지도록 송출 연결(role=live)은 그대로 */
function SfuStage({ ch, sfuId, volume, fit, onFatal }: {
  ch: number;
  sfuId: string;
  volume: number;
  fit: "contain" | "cover";
  onFatal: () => void;
}) {
  useDisplaySync(ch, "live");
  return <SfuVideo channel={ch} sfuId={sfuId} volume={volume} fit={fit} onFatal={onFatal} />;
}

/** 송출 화면 — 송출 내용을 이 기기가 그대로 다시 그린다(DisplayMirror, 파일은 R2 사본에서).
 *  다시 그릴 수 없는 화면 공유는 SFU(Cloudflare Realtime)에서, SFU 가 없으면 live 중계(HLS) — 안 되면 다시 그리기로 */
function LiveStage({
  c,
  ch,
  volume = 0,
  fit = "contain",
  quality = "auto",
  onLevels,
  onLevel,
}: {
  c?: LiveChannel;
  ch: number;
  /** 0~100 */
  volume?: number;
  fit?: "contain" | "cover";
  quality?: Quality;
  onLevels?: (h: number[]) => void;
  onLevel?: (h: number) => void;
}) {
  const url = c?.hls?.url ?? null;
  const [failed, setFailed] = useState<string | null>(null);
  const sfuId = c?.sfu?.id ?? null;
  const [sfuFailed, setSfuFailed] = useState<string | null>(null);
  // 중계가 막 끝난 송출(화면 공유 → 영상)은 남은 조각 대신 바로 다시 그리기로
  const useHls = !!url && failed !== url && c?.relay !== false;
  // 중계가 바뀌거나 끝나면 화질 목록을 비운다 (예전 화면은 화질을 고를 수 없다)
  useEffect(() => {
    if (!useHls) onLevels?.([]);
  }, [useHls, onLevels]);
  if (sfuId && sfuFailed !== sfuId) {
    return (
      <SfuStage key={sfuId} ch={ch} sfuId={sfuId} volume={volume / 100} fit={fit} onFatal={() => setSfuFailed(sfuId)} />
    );
  }
  if (useHls) {
    return (
      <HlsStage
        key={url}
        ch={ch}
        url={url}
        volume={volume / 100}
        fit={fit}
        quality={quality}
        onLevels={onLevels}
        onLevel={onLevel}
        onFatal={() => setFailed(url)}
      />
    );
  }
  return (
    <DisplayMirror key={ch} channel={ch} role="live" badge={false} sound={volume > 0} volume={volume / 100} fit={fit} />
  );
}

function Header({ onBack }: { onBack?: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-white/[0.06] bg-[#0b0b0d]/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md md:h-16 md:px-8">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="처음 화면으로"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/[0.08]"
        >
          <ChevronLeft size={24} />
        </button>
      ) : null}
      <OnairMark size={26} className="text-[#FF3B3B]" />
      <span className="font-mbc text-[20px] tracking-wide text-white">ONAIR</span>
      <span className="ml-1 font-orbitron text-[11px] font-bold tracking-[0.3em] text-[#FF3B3B]">
        LIVE
      </span>
    </header>
  );
}

function Empty() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-6">
      <EmptyState>송출 중인 화면이 없어요</EmptyState>
    </div>
  );
}

/** 첫 화면 — 가장 오래 송출 중인 채널을 크게, 아래에 송출 중 전부 */
function Home({
  list,
  now,
  open,
}: {
  list: LiveChannel[];
  now: number;
  open: (ch: number) => void;
}) {
  const hero = list[0];
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 pb-[calc(32px+env(safe-area-inset-bottom))] pt-4 md:gap-10 md:px-8 md:pt-6">
      <section aria-label="대표 송출" className="flex flex-col gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => open(hero.channel)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(hero.channel)}
          className="group relative aspect-video max-h-[60dvh] w-full cursor-pointer overflow-hidden rounded-2xl bg-black ring-white/60 focus-visible:outline-none focus-visible:ring-2 md:rounded-[22px]"
        >
          <LiveStage c={hero} ch={hero.channel} />
          <div className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(to_top,rgba(0,0,0,.82),rgba(0,0,0,0)_55%)] max-md:hidden" />
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 md:left-5 md:top-5">
            <LiveBadge />
            <span className="rounded-[5px] bg-black/60 px-2 py-0.5 font-pretendard text-[12px] text-white/90">
              <Viewers n={hero.viewers} />
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 z-20 flex w-full items-end justify-between gap-4 p-6 max-md:hidden md:p-8">
            <div className="min-w-0">
              <h1 className="truncate font-mbc text-[34px] leading-tight text-white lg:text-[42px] [text-wrap:balance]">
                {hero.title}
              </h1>
              <p className="mt-1 font-pretendard text-[15px] text-white/65">
                {[place(hero), clock(hero.startedAt)].filter(Boolean).join(" · ")}
              </p>
            </div>
            {/* 누르면 위의 카드(role=button)가 받는다 — 키보드 초점은 카드 하나로 */}
            <NeonButton tabIndex={-1} size="lg" icon={<Play fill="currentColor" />} className="pointer-events-auto shrink-0">
              보기
            </NeonButton>
          </div>
        </div>
        <div className="md:hidden">
          <h1 className="font-mbc text-[24px] leading-tight text-white">{hero.title}</h1>
          <p className="mt-0.5 font-pretendard text-[13.5px] text-white/55">
            {[place(hero), clock(hero.startedAt)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </section>

      <section aria-label="지금 송출 중" className="flex flex-col gap-3">
        <h2 className="flex items-baseline gap-2 font-pretendard text-[18px] font-bold text-white md:text-[20px]">
          지금 송출 중{" "}
          <span className="font-orbitron text-[15px] text-[#FF3B3B]">{list.length}</span>
        </h2>
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 md:gap-x-5">
          {list.map((c) => (
            <Card key={c.channel} c={c} now={now} onOpen={() => open(c.channel)} />
          ))}
        </div>
      </section>
    </div>
  );
}

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

/** 송출 화면 전체 화면 — 브라우저 전체 화면이 되면 그걸로, 안 되는 곳(아이폰 등)은 화면을 꽉 채운다 */
function useFullscreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [native, setNative] = useState(false);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const sync = () => {
      const d = document as FsDoc;
      setNative(!!(d.fullscreenElement || d.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  // 꽉 채운 동안은 뒤 페이지가 스크롤되지 않게, Esc 로 나가게
  useEffect(() => {
    if (!filled) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFilled(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [filled]);

  const toggle = useCallback(async () => {
    const d = document as FsDoc;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.())?.catch?.(() => {});
      return;
    }
    if (filled) {
      setFilled(false);
      return;
    }
    const el = ref.current as FsEl | null;
    try {
      if (el?.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else if (el?.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else throw new Error("no fullscreen");
      // 폰은 가로로 돌려 보여 준다 (안 되는 브라우저는 그냥 넘어감)
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await o?.lock?.("landscape").catch(() => {});
    } catch {
      setFilled(true);
    }
  }, [filled]);

  return { ref, full: native || filled, filled, toggle };
}

/** 소리 크기 막대 — 유튜브처럼 3px 선 + 12px 동그라미 (기본 range 는 선이 굵다) */
function VolumeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // 동그라미(12px)가 양 끝에서 잘리지 않게 6px 안쪽에서 움직인다
  const pick = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = (clientX - r.left - 6) / Math.max(1, r.width - 12);
    onChange(Math.round(Math.min(1, Math.max(0, x)) * 100));
  };
  const at = `calc(6px + (100% - 12px) * ${value / 100})`;
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="소리 크기"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e.clientX);
      }}
      onPointerMove={(e) => e.buttons === 1 && pick(e.clientX)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(100, value + 5));
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(0, value - 5));
      }}
      className="relative mr-3 h-10 w-[64px] shrink-0 cursor-pointer touch-none focus-visible:outline-none"
    >
      <span className="absolute inset-x-1.5 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/30" />
      <span
        className="absolute left-1.5 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white"
        style={{ width: `calc((100% - 12px) * ${value / 100})` }}
      />
      <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: at }} />
    </div>
  );
}

const FIT_LABEL = { contain: "원본 비율", cover: "꽉 채우기" } as const;

/** 플레이어 조작부 — 유튜브 플레이어 구조: 바 없이 아래만 살짝 어둡게, 얇은 진행선, 반투명 알약 버튼.
 *  가만히 두면 2.5초 뒤 사라지고, 폰은 한 번 누르면 나타난다. */
function PlayerControls({
  audible,
  fittable,
  onPip,
  volume,
  setVolume,
  full,
  onFull,
  fit,
  setFit,
  qualities = [],
  quality = "auto",
  setQuality,
  current,
}: {
  audible: boolean;
  /** 화면 맞춤을 고를 수 있는 송출 (영상·이미지·PPT) */
  fittable: boolean;
  /** 작은 화면으로 보기 — 영상 송출이고 브라우저가 될 때만 */
  onPip?: () => void;
  volume: number;
  setVolume: (v: number) => void;
  full: boolean;
  onFull: () => void;
  fit: "contain" | "cover";
  setFit: (f: "contain" | "cover") => void;
  /** 중계(HLS) 화질 높이 — 둘 이상이면 설정에 '화질' */
  qualities?: number[];
  quality?: Quality;
  setQuality?: (q: Quality) => void;
  /** 지금 나오는 화질 높이 (자동일 때 옆에) */
  current?: number | null;
}) {
  const [shown, setShown] = useState(true);
  // 설정 — 유튜브처럼 첫 화면(항목 + 지금 값)에서 항목을 누르면 고르는 화면(체크 표시)으로 넘어간다
  const [menu, setMenu] = useState<null | "main" | "fit" | "quality">(null);
  const pickable = qualities.length > 1 && !!setQuality;
  const hasMenu = fittable || pickable;
  const qualityLabel = quality === "auto" ? (current ? `자동 (${current}p)` : "자동") : `${quality}p`;
  const last = useRef(70);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wake = useCallback(() => {
    setShown(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), 2500);
  }, []);
  useEffect(() => {
    wake();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [wake]);

  const visible = shown || !!menu;
  const muted = volume === 0;
  const toggleMute = () => {
    if (muted) setVolume(last.current || 70);
    else {
      last.current = volume;
      setVolume(0);
    }
  };
  const VolIcon = muted ? VolumeX : volume < 50 ? Volume1 : Volume2;
  const pill = "flex h-10 items-center rounded-[28px] bg-black/30";
  const btn =
    "inline-flex h-10 w-12 items-center justify-center rounded-[28px] text-[#eee] transition-colors hover:text-white";

  return (
    <div
      className={cn("absolute inset-0 z-20 font-pretendard transition-opacity duration-200", visible ? "opacity-100" : "cursor-none opacity-0")}
      onPointerMove={(e) => e.pointerType === "mouse" && wake()}
      onClick={(e) => {
        if (menu) {
          setMenu(null);
          wake();
          return;
        }
        // 폰은 누를 때마다 보였다 숨겼다 (유튜브처럼)
        const touch = (e.nativeEvent as PointerEvent).pointerType === "touch";
        if (touch && shown) {
          if (timer.current) clearTimeout(timer.current);
          setShown(false);
        } else wake();
      }}
    >
      {/* 노트북 — 아래만 살짝 어둡게 + 얇은 진행선 + 알약 버튼 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(to_top,rgba(0,0,0,.55),rgba(0,0,0,0))] max-md:hidden" />
      <div className="absolute inset-x-3 bottom-14 h-[3px] rounded-full bg-[#FF3B3B] max-md:hidden" />
      <div
        className="absolute inset-x-3 bottom-2 flex h-10 items-center gap-2 max-md:hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {audible ? (
          <div className={cn(pill, "group/vol")}>
            <button type="button" onClick={toggleMute} aria-label={muted ? "음소거 해제" : "음소거"} className={btn}>
              <VolIcon size={22} />
            </button>
            <span className="flex w-0 items-center overflow-hidden transition-[width] duration-200 group-hover/vol:w-[76px] group-focus-within/vol:w-[76px]">
              <VolumeSlider value={volume} onChange={setVolume} />
            </span>
          </div>
        ) : null}
        <div className={cn(pill, "gap-2 px-4 text-[14px] text-[#eee]")}>
          <span className="h-2 w-2 rounded-full bg-[#FF3B3B]" />
          실시간
        </div>
        <span className="flex-1" />
        <div className={cn(pill, "px-1")}>
          {hasMenu ? (
            <button type="button" aria-label="설정" onClick={() => setMenu((v) => (v ? null : "main"))} className={btn}>
              <Settings size={22} className={cn("transition-transform duration-200", menu && "rotate-45")} />
            </button>
          ) : null}
          {onPip ? (
            <button type="button" aria-label="작은 화면으로 보기" onClick={onPip} className={btn}>
              <PictureInPicture2 size={22} />
            </button>
          ) : null}
          <button type="button" aria-label={full ? "전체 화면 끄기" : "전체 화면"} onClick={onFull} className={btn}>
            {full ? <Minimize size={22} /> : <Maximize size={22} />}
          </button>
        </div>
      </div>

      {/* 폰 — 한 번 누르면 살짝 어두워지며 네 귀퉁이에 */}
      <div className="absolute inset-0 bg-black/40 md:hidden">
        {audible ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className="absolute left-2 top-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/45 px-3 text-[13px] text-white"
          >
            <VolIcon size={17} />
            {muted ? "음소거 해제" : null}
          </button>
        ) : null}
        {hasMenu ? (
          <button
            type="button"
            aria-label="설정"
            onClick={(e) => {
              e.stopPropagation();
              setMenu((v) => (v ? null : "main"));
            }}
            className="absolute right-0.5 top-0.5 inline-flex h-10 w-10 items-center justify-center text-white"
          >
            <Settings size={21} />
          </button>
        ) : null}
        <span className="absolute bottom-3.5 left-3 flex items-center gap-1.5 text-[13px] text-white">
          <span className="h-2 w-2 rounded-full bg-[#FF3B3B]" />
          실시간
        </span>
        <button
          type="button"
          aria-label={full ? "전체 화면 끄기" : "전체 화면"}
          onClick={(e) => {
            e.stopPropagation();
            onFull();
          }}
          className="absolute bottom-0.5 right-0.5 inline-flex h-10 w-10 items-center justify-center text-white"
        >
          {full ? <Minimize size={21} /> : <Maximize size={21} />}
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FF3B3B] md:hidden" />

      {/* 설정 메뉴 — 유튜브 팝업처럼: 항목 → 고르는 화면(체크) → 고르면 첫 화면으로 */}
      {menu ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-[60px] right-3 w-[250px] overflow-hidden rounded-xl bg-[rgba(28,28,28,.92)] py-2 text-[13px] text-white max-md:bottom-auto max-md:top-10 max-md:w-[220px]"
        >
          {menu === "main" ? (
            <>
              {fittable ? (
                <button
                  type="button"
                  onClick={() => setMenu("fit")}
                  className="flex h-10 w-full items-center gap-3.5 px-4 hover:bg-white/10"
                >
                  <RectangleHorizontal size={19} />
                  화면 맞춤
                  <span className="ml-auto flex items-center gap-0.5 text-white/70">
                    {FIT_LABEL[fit]}
                    <ChevronRight size={16} />
                  </span>
                </button>
              ) : null}
              {pickable ? (
                <button
                  type="button"
                  onClick={() => setMenu("quality")}
                  className="flex h-10 w-full items-center gap-3.5 px-4 hover:bg-white/10"
                >
                  <SlidersHorizontal size={19} />
                  화질
                  <span className="ml-auto flex items-center gap-0.5 text-white/70">
                    {qualityLabel}
                    <ChevronRight size={16} />
                  </span>
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMenu("main")}
                className="flex h-10 w-full items-center gap-2 border-b border-white/10 px-3 pb-1 hover:bg-white/10"
              >
                <ChevronLeft size={18} />
                {menu === "fit" ? "화면 맞춤" : "화질"}
              </button>
              <div className="pt-1">
                {menu === "fit"
                  ? (["contain", "cover"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setFit(f);
                          setMenu("main");
                        }}
                        className="flex h-10 w-full items-center gap-3 px-4 hover:bg-white/10"
                      >
                        <span className="flex w-5 justify-center">{fit === f ? <Check size={18} /> : null}</span>
                        {FIT_LABEL[f]}
                      </button>
                    ))
                  : (["auto", ...qualities] as Quality[]).map((q) => (
                      <button
                        key={String(q)}
                        type="button"
                        onClick={() => {
                          setQuality?.(q);
                          setMenu("main");
                        }}
                        className="flex h-10 w-full items-center gap-3 px-4 hover:bg-white/10"
                      >
                        <span className="flex w-5 justify-center">{quality === q ? <Check size={18} /> : null}</span>
                        {q === "auto" ? "자동" : `${q}p`}
                      </button>
                    ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------- 채팅 (서버 app/api/live_chat.py — 채널마다 방 하나) ----------------
interface ChatMsg {
  id: string;
  name: string;
  email: string;
  text: string;
  /** 보낸 시각 (ms) */
  at: number;
  /** 방송부 — 이름이 빨갛다 */
  crew?: boolean;
}

interface ChatMe {
  name: string;
  email: string;
  crew: boolean;
  canSend: boolean;
  /** 막혀 있으면 풀리는 시각(ms), 풀 때까지면 0, 안 막혔으면 null */
  blockedUntil: number | null;
}

interface ChatBlocked {
  email: string;
  name: string;
  until: number | null;
}

type ChatEvent =
  | { type: "hello"; enabled: boolean; messages: ChatMsg[]; me: ChatMe; blocked?: ChatBlocked[] }
  | { type: "message"; message: ChatMsg }
  | { type: "deleted"; id: string }
  | { type: "state"; enabled: boolean }
  | { type: "me"; me: ChatMe }
  | { type: "blocks"; blocked: ChatBlocked[] }
  | { type: "notice" | "error"; message: string };

const CHAT_KEEP = 100;
const CHAT_MAX = 200;

/** 채널 방 하나 — 끊기면 다시 붙는다 (share·teacher 주소처럼 서버가 거절한 것은 그대로) */
function useLiveChat(ch: number) {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [me, setMe] = useState<ChatMe | null>(null);
  const [blocked, setBlocked] = useState<ChatBlocked[]>([]);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const lastText = useRef("");

  useEffect(() => {
    let stop = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let wait = 1000;
    const connect = () => {
      const sock = new WebSocket(`${backendBase().replace(/^http/, "ws")}/api/live/chat/ws?channel=${ch}`);
      ws.current = sock;
      sock.onmessage = (e) => {
        let m: ChatEvent;
        try {
          m = JSON.parse(e.data as string) as ChatEvent;
        } catch {
          return;
        }
        if (m.type === "hello") {
          wait = 1000;
          setEnabled(m.enabled);
          setMessages(m.messages);
          setMe(m.me);
          setBlocked(m.blocked ?? []);
          setReady(true);
        } else if (m.type === "message") setMessages((l) => [...l, m.message].slice(-CHAT_KEEP));
        else if (m.type === "deleted") setMessages((l) => l.filter((x) => x.id !== m.id));
        else if (m.type === "state") setEnabled(m.enabled);
        else if (m.type === "me") setMe(m.me);
        else if (m.type === "blocks") setBlocked(m.blocked);
        else if (m.type === "notice" || m.type === "error") setNotice({ text: m.message, error: m.type === "error" });
      };
      sock.onclose = (e) => {
        if (stop || e.code === 4403 || e.code === 4404) return;
        retry = setTimeout(connect, wait);
        wait = Math.min(wait * 2, 15_000);
      };
    };
    connect();
    return () => {
      stop = true;
      if (retry) clearTimeout(retry);
      ws.current?.close();
      ws.current = null;
    };
  }, [ch]);

  // 알림은 잠깐만
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(id);
  }, [notice]);

  const post = (data: object) => {
    const sock = ws.current;
    if (sock?.readyState !== WebSocket.OPEN) return false;
    sock.send(JSON.stringify(data));
    return true;
  };

  return {
    ready,
    enabled,
    messages,
    me,
    blocked,
    notice,
    send: (text: string) => {
      lastText.current = text;
      return post({ type: "send", text });
    },
    /** 못 보냈을 때 다시 넣어 줄 글 */
    lastText,
    remove: (id: string) => post({ type: "delete", id }),
    block: (email: string, minutes: number | null) => post({ type: "block", email, minutes }),
    unblock: (email: string) => post({ type: "unblock", email }),
  };
}

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const MOD_BTN =
  "inline-flex h-7 items-center rounded-full bg-white/[0.08] px-3 font-pretendard text-[12.5px] text-white/85 hover:bg-white/15";

function ChatPanel({ ch, className }: { ch: number; className?: string }) {
  const chat = useLiveChat(ch);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [blockAsk, setBlockAsk] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const stick = useRef(true);
  const closed = chat.ready && !chat.enabled;
  const me = chat.me;
  const blocked = me?.blockedUntil != null;
  const canType = chat.ready && !closed && !!me?.canSend && !blocked;
  const crew = !!me?.crew;
  const blockedSet = new Set(chat.blocked.map((b) => b.email));

  // 맨 아래를 보고 있으면 새 채팅이 오면 따라 내려간다
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  // 못 보냈으면(3초·막힘 등) 쓰던 글을 돌려준다
  const { notice, lastText } = chat;
  useEffect(() => {
    if (notice?.error && lastText.current) {
      const back = lastText.current;
      setText((t) => t || back);
      lastText.current = "";
    }
  }, [notice, lastText]);

  const pick = (id: string) => {
    if (!crew) return;
    setBlockAsk(false);
    setPicked((p) => (p === id ? null : id));
  };

  return (
    <section
      aria-label="채팅"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121215]",
        className,
        // 꺼져 있으면 폰에서는 작게 — 빈 칸이 화면을 차지하지 않게
        closed && "max-lg:h-auto",
      )}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/[0.08] px-4">
        <h2 className="font-pretendard text-[15px] font-bold text-white">실시간 채팅</h2>
      </header>
      {closed ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-white/45">
            <MessageSquareOff size={22} />
          </span>
          <p className="font-pretendard text-[15px] font-semibold text-white/70">방송부가 채팅을 껐어요</p>
        </div>
      ) : (
        <ol
          ref={list}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
          className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-4 [scrollbar-width:thin]"
        >
          {chat.messages.map((m) => {
            const open = crew && picked === m.id;
            const isBlocked = blockedSet.has(m.email);
            return (
              <li key={m.id} className="min-w-0 font-pretendard">
                <div
                  role={crew ? "button" : undefined}
                  tabIndex={crew ? 0 : undefined}
                  onClick={() => pick(m.id)}
                  onKeyDown={(e) => crew && (e.key === "Enter" || e.key === " ") && pick(m.id)}
                  className={cn(crew && "-mx-2 cursor-pointer rounded-lg px-2 py-0.5 hover:bg-white/[0.04]", open && "bg-white/[0.06]")}
                >
                  <p className="flex min-w-0 items-baseline gap-1.5 text-[12.5px]">
                    <b className={cn("shrink-0 font-semibold", m.crew ? "text-[#FF3B3B]" : "text-white/85")}>
                      {m.crew ? `방송부 ${m.name}` : m.name}
                    </b>
                    <span className="min-w-0 truncate text-white/35">{m.email}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-white/30">{hhmm(m.at)}</span>
                  </p>
                  <p className="mt-0.5 break-words text-[14.5px] leading-snug text-white">{m.text}</p>
                </div>
                {open ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className={MOD_BTN}
                      onClick={() => {
                        chat.remove(m.id);
                        setPicked(null);
                      }}
                    >
                      지우기
                    </button>
                    {m.crew || m.email === me?.email ? null : isBlocked ? (
                      <button
                        type="button"
                        className={MOD_BTN}
                        onClick={() => {
                          chat.unblock(m.email);
                          setPicked(null);
                        }}
                      >
                        막기 풀기
                      </button>
                    ) : blockAsk ? (
                      <>
                        {([30, null] as const).map((min) => (
                          <button
                            key={String(min)}
                            type="button"
                            className={MOD_BTN}
                            onClick={() => {
                              chat.block(m.email, min);
                              setPicked(null);
                              setBlockAsk(false);
                            }}
                          >
                            {min ? `${min}분` : "풀 때까지"}
                          </button>
                        ))}
                      </>
                    ) : (
                      <button type="button" className={MOD_BTN} onClick={() => setBlockAsk(true)}>
                        채팅 막기
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t || !canType) return;
          if (chat.send(t)) setText("");
        }}
        className="shrink-0 border-t border-white/[0.08] p-3"
      >
        {/* 걸러진 말 등 알림만 잠깐 — 평소에는 아무것도 안 띄운다 */}
        {chat.notice ? (
          <p className="mb-2 truncate px-1 font-pretendard text-[12px] text-[#FF3B3B]">{chat.notice.text}</p>
        ) : null}
        <div className="flex h-11 items-center gap-2 rounded-full bg-white/[0.07] pl-4 pr-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={CHAT_MAX}
            disabled={!canType}
            aria-label="채팅"
            placeholder={
              closed || blocked
                ? "지금은 채팅을 보낼 수 없어요"
                : chat.ready && !me?.canSend
                  ? "학교 계정으로 들어와야 보낼 수 있어요"
                  : "채팅 보내기"
            }
            className="min-w-0 flex-1 bg-transparent font-pretendard text-[14.5px] text-white outline-none placeholder:text-white/35"
          />
          <button
            type="submit"
            aria-label="보내기"
            disabled={!canType || !text.trim()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0b0b0d] disabled:bg-white/15 disabled:text-white/40"
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      </form>
    </section>
  );
}

/** 보기 — 큰 화면(소리는 눌러야 켜짐), 정보, 다른 송출 */
function Watch({
  ch,
  list,
  now,
  open,
}: {
  ch: number;
  list: LiveChannel[];
  now: number;
  open: (ch: number) => void;
}) {
  const [volume, setVolume] = useState(0);
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [quality, setQuality] = useState<Quality>("auto");
  const [levels, setLevels] = useState<number[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const fs = useFullscreen();
  const [pipOk, setPipOk] = useState(false);
  useEffect(() => setPipOk(typeof document !== "undefined" && !!document.pictureInPictureEnabled), []);
  const pip = () => {
    const v = fs.ref.current?.querySelector("video");
    if (!v) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => {});
    else void v.requestPictureInPicture().catch(() => {});
  };
  const c = list.find((x) => x.channel === ch);
  const others = list.filter((x) => x.channel !== ch);

  // 채널을 바꾸면 다시 음소거로 시작
  useEffect(() => {
    setVolume(0);
    setQuality("auto");
  }, [ch]);

  return (
    <div className="mx-auto grid w-full max-w-[1700px] items-start gap-6 pb-[calc(32px+env(safe-area-inset-bottom))] md:px-8 md:pt-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
      <section aria-label="송출 보기" className="flex w-full min-w-0 flex-col gap-3">
        <div
          ref={fs.ref}
          onDoubleClick={() => void fs.toggle()}
          className={cn(
            "relative w-full overflow-hidden bg-black",
            fs.filled
              ? "fixed inset-0 z-[100] h-[100dvh] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
              : fs.full
                ? "h-full"
                : "aspect-video md:rounded-2xl",
          )}
        >
          <LiveStage
            c={c}
            ch={ch}
            volume={volume}
            fit={fit}
            quality={quality}
            onLevels={setLevels}
            onLevel={setCurrent}
          />
          {c ? (
            <PlayerControls
              audible={c.hls || c.sfu ? HLS_AUDIBLE.has(c.type) : AUDIBLE.has(c.type)}
              fittable={!!c.hls || !!c.sfu || FITTABLE.has(c.type)}
              onPip={(c.hls || c.sfu || c.type === "video") && pipOk ? pip : undefined}
              volume={volume}
              setVolume={setVolume}
              full={fs.full}
              onFull={() => void fs.toggle()}
              fit={fit}
              setFit={setFit}
              qualities={c.hls ? levels : []}
              quality={quality}
              setQuality={setQuality}
              current={current}
            />
          ) : (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/85">
              <p className="font-pretendard text-[17px] text-white/70">송출이 끝났어요</p>
              {list.length > 0 ? (
                <NeonButton onClick={() => open(list[0].channel)}>다른 송출 보기</NeonButton>
              ) : null}
            </div>
          )}
        </div>
        {c ? (
          <div className="px-4 md:px-0">
            <h1 className="font-mbc text-[24px] leading-tight text-white md:text-[30px] [text-wrap:balance]">
              {c.title}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-pretendard text-[14px] text-white/55">
              <span>{[place(c), clock(c.startedAt)].filter(Boolean).join(" · ")}</span>
              <span className="text-white/25">·</span>
              <Viewers n={c.viewers} long />
            </p>
          </div>
        ) : null}
      </section>

      {/* 채팅 — 노트북은 오른쪽(화면 높이만큼), 폰은 제목 아래 */}
      <ChatPanel
        key={ch}
        ch={ch}
        className="mx-4 h-[460px] md:mx-0 lg:sticky lg:top-[88px] lg:row-span-2 lg:h-[calc(100dvh-112px)]"
      />

      {others.length > 0 ? (
        <aside aria-label="다른 송출" className="flex flex-col gap-3 px-4 md:px-0">
          <h2 className="font-pretendard text-[17px] font-bold text-white">다른 송출</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {others.map((o) => (
              <Card key={o.channel} c={o} now={now} onOpen={() => open(o.channel)} />
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

export default function LiveApp() {
  const router = useRouter();
  const params = useSearchParams();
  const now = useNow();
  const q = useQuery({ queryKey: ["live"], queryFn: fetchLive, refetchInterval: 5000, retry: 1 });
  const list = q.data ?? [];
  const raw = Number(params.get("ch"));
  const ch = Number.isInteger(raw) && raw >= 1 && raw <= 5 ? raw : null;

  // 보기 시작하면 내 연결이 서버에 붙은 뒤 한 번 더 받아 '보는 사람 수'에 나를 넣는다
  const { refetch } = q;
  useEffect(() => {
    const id = setTimeout(() => void refetch(), 1500);
    return () => clearTimeout(id);
  }, [ch, refetch]);

  const open = (n: number) => {
    router.push(`?ch=${n}`, { scroll: false });
    window.scrollTo({ top: 0 });
  };
  const home = () => router.push("?", { scroll: false });

  return (
    <main className="min-h-[100dvh] bg-[#0b0b0d] text-white">
      <Header onBack={ch ? home : undefined} />
      {q.isLoading ? (
        <div className="mx-auto w-full max-w-[1400px] px-4 pt-4 md:px-8 md:pt-6">
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      ) : q.isError && !q.data ? (
        <div className="flex min-h-[60dvh] items-center justify-center px-6 text-center font-pretendard text-[16px] text-white/55">
          지금은 ONAIR 서버에 연결할 수 없어요
        </div>
      ) : ch ? (
        <Watch ch={ch} list={list} now={now} open={open} />
      ) : list.length === 0 ? (
        <Empty />
      ) : (
        <Home list={list} now={now} open={open} />
      )}
    </main>
  );
}
