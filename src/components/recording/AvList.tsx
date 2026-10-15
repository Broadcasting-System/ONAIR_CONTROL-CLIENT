"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Film, Mic, MoreHorizontal, Pause, Pencil, Play, RotateCcw, Trash2, Video, X } from "lucide-react";
import ConfirmModal from "@/components/common/ConfirmModal";
import InputModal from "@/components/common/InputModal";
import Portal from "@/components/common/Portal";
import { duration, gb, when } from "@/components/recording/format";
import { useIsMobile } from "@/hooks/useIsMobile";
import { avApi } from "@/lib/avApi";
import { recordingApi } from "@/lib/recordingApi";
import { cn } from "@/lib/utils";
import type { AvItem } from "@/types/av";

type Filter = "all" | "video" | "audio";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "video", label: "영상" },
  { key: "audio", label: "소리만" },
];

const isBusy = (i: AvItem) => ["recording", "processing", "importing"].includes(i.status);
// 영상+소리를 합치다 실패해도 화면 영상은 볼 수 있다
const isPlayable = (i: AvItem) => (i.kind === "audio" ? i.status === "ready" : i.hasVideo);
const downloadUrl = (i: AvItem) => (i.kind === "audio" ? recordingApi.audioUrl(i.id, 0, true) : avApi.fileUrl(i.id, true));
const place = (i: AvItem) => (i.kind === "audio" ? i.hallName : i.hallName || (i.channel ? `CH${i.channel}` : ""));
const meta = (i: AvItem) =>
  [when(i.startedAt), place(i), i.status === "ready" && i.size > 0 ? gb(i.size).replace(" ", "") : ""].filter(Boolean).join(" · ");
const retryName = (i: AvItem) => (i.kind === "audio" ? "다시 가져오기" : "다시 만들기");

// ---------------------------------------------------------------- 썸네일

const WAVE_BARS = 60;

/** 서버 피크(0~1)를 막대로 — 가장 큰 칸에 맞춰 키운다. 없으면 낮은 줄 */
function Wave({ peaks, played }: { peaks: number[] | null; played: number }) {
  const bars = Array.from({ length: WAVE_BARS }, (_, i) => {
    if (!peaks?.length) return 0;
    const a = Math.floor((i * peaks.length) / WAVE_BARS);
    const b = Math.max(a + 1, Math.floor(((i + 1) * peaks.length) / WAVE_BARS));
    return Math.max(...peaks.slice(a, b));
  });
  const top = Math.max(0.05, ...bars);
  return (
    <div className="absolute inset-0 flex items-center gap-[2px] bg-[#0d0d10] px-2.5">
      {bars.map((v, i) => (
        <i
          key={i}
          className={cn(
            "flex-1 rounded-[1px]",
            !peaks?.length ? "bg-white/15" : played > 0 && i / WAVE_BARS < played ? "bg-white" : "bg-white/55",
          )}
          style={{ height: `${peaks?.length ? 6 + (v / top) * 76 : 4}%` }}
        />
      ))}
    </div>
  );
}

function AudioThumb({ item, played }: { item: AvItem; played: number }) {
  const q = useQuery({
    queryKey: ["recordingPeaks", item.id],
    queryFn: () => recordingApi.peaks(item.id),
    enabled: item.status === "ready",
    staleTime: Infinity,
    retry: false,
  });
  return <Wave peaks={q.data?.peaks ?? null} played={played} />;
}

/** 영상 대신 — 이미지가 없거나 깨지면 */
function VideoFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(70%_90%_at_50%_35%,#24191b,#0d0d10_75%)] text-white/15">
      <Film size={26} strokeWidth={1.6} />
    </div>
  );
}

function VideoThumb({ item }: { item: AvItem }) {
  const [broken, setBroken] = useState(false);
  if (!item.hasVideo || broken) return <VideoFallback />;
  return (
    <>
      <VideoFallback />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avApi.thumbUrl(item.id)}
        alt=""
        loading="lazy"
        draggable={false}
        onError={() => setBroken(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </>
  );
}

function Thumb({ item, played, className, children }: { item: AvItem; played: number; className?: string; children?: ReactNode }) {
  const busy = isBusy(item);
  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-[9px] bg-[#0d0d10]", className)}>
      {item.kind === "audio" ? (
        <AudioThumb item={item} played={played} />
      ) : (
        <VideoThumb key={`${item.id}-${item.status}-${item.hasVideo}`} item={item} />
      )}
      <span
        title={item.warning || undefined}
        className="absolute left-1.5 top-1.5 flex items-center gap-[5px] rounded-md bg-black/70 px-[7px] py-0.5 font-pretendard text-[11px] font-semibold text-white"
      >
        {item.kind === "audio" ? <Mic size={12} /> : <Video size={12} />}
        {item.kindName}
      </span>
      <span className="absolute bottom-1.5 right-1.5 rounded-[5px] bg-black/75 px-1.5 py-px font-orbitron text-[11px] font-semibold text-white tabular-nums">
        {busy
          ? `${item.kind === "audio" ? "가져오는 중" : item.stageName || "만드는 중"} ${Math.round(item.progress * 100)}%`
          : duration(item.duration)}
      </span>
      {busy && (
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
          <span className="block h-full bg-[#FF3B3B] shadow-[0_0_6px_#FF3B3B]" style={{ width: `${item.progress * 100}%` }} />
        </span>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- 메뉴·시트·보기

const menuItem =
  "flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left font-pretendard text-[13.5px] font-semibold text-white/80 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-35";

type Actions = {
  canOperate: boolean;
  isAdmin: boolean;
  onRename: (i: AvItem) => void;
  onRetry: (i: AvItem) => void;
  onRemove: (i: AvItem) => void;
};

/** ⋯ 와 폰 시트가 같이 쓰는 줄 — 이름 바꾸기, 화면만·콘솔 소리 받기, 다시 만들기, 지우기 */
function MoreItems({ item, a, done }: { item: AvItem; a: Actions; done: () => void }) {
  const run = (fn: () => void) => () => {
    done();
    fn();
  };
  return (
    <>
      <button type="button" className={menuItem} disabled={!a.canOperate} onClick={run(() => a.onRename(item))}>
        <Pencil size={15} />
        이름 바꾸기
      </button>
      {item.hasOutput && (
        <a className={menuItem} href={avApi.fileUrl(item.id, true, "screen")} onClick={done}>
          <Download size={15} />
          화면만 받기
        </a>
      )}
      {item.hasOutput && item.audioId && (
        <a className={menuItem} href={recordingApi.audioUrl(item.audioId, 0, true)} onClick={done}>
          <Download size={15} />
          콘솔 소리 WAV
        </a>
      )}
      {item.status === "error" && (
        <button type="button" className={menuItem} disabled={!a.canOperate} onClick={run(() => a.onRetry(item))}>
          <RotateCcw size={15} />
          {retryName(item)}
        </button>
      )}
      {a.isAdmin && (
        <button
          type="button"
          className={cn(menuItem, "text-[#ff8a8a]")}
          disabled={item.status === "recording"}
          onClick={run(() => a.onRemove(item))}
        >
          <Trash2 size={15} />
          지우기
        </button>
      )}
    </>
  );
}

function MoreMenu({ item, a }: { item: AvItem; a: Actions }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label="더 보기"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-white hover:bg-black/80"
      >
        <MoreHorizontal size={17} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-white/10 bg-[#1a1a1d] p-1 shadow-[0_18px_40px_-10px_rgba(0,0,0,0.85)]">
          <MoreItems item={item} a={a} done={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/** 영상 보기 — 합친 영상(있으면), 아래에 화면만·콘솔 소리 받기 */
function Player({ item, onClose }: { item: AvItem; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <div className="absolute inset-0" onClick={onClose} />
        <div className="relative w-full max-w-[960px] overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 truncate font-pretendard text-[15px] font-bold text-white">{item.label || "이름 없음"}</span>
            <span className="shrink-0 font-pretendard text-[12.5px] text-white/45">{meta(item)}</span>
            <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-white/60 hover:bg-white/10">
              <X size={18} />
            </button>
          </div>
          <video src={avApi.fileUrl(item.id)} controls autoPlay playsInline className="aspect-video w-full bg-black" />
          {item.hasOutput && (
            <div className="flex justify-end gap-4 px-4 py-2.5 font-pretendard text-[12.5px] text-white/50">
              <a className="hover:text-white" href={avApi.fileUrl(item.id, true, "screen")}>
                화면만 받기
              </a>
              {item.audioId && (
                <a className="hover:text-white" href={recordingApi.audioUrl(item.audioId, 0, true)}>
                  콘솔 소리 WAV
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

const sheetBtn =
  "flex h-12 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] font-mbc text-[14px] text-white disabled:opacity-35";

/** 폰 — 카드를 누르면 아래에서 올라오는 판 (하단 탭 위) */
function Sheet({
  item,
  played,
  playing,
  a,
  onPlay,
  onClose,
}: {
  item: AvItem;
  played: number;
  playing: boolean;
  a: Actions;
  onPlay: () => void;
  onClose: () => void;
}) {
  const playable = isPlayable(item);
  return (
    <Portal>
      <div className="fixed inset-0 z-40 bg-black/55 md:hidden" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 max-h-[calc(100dvh-140px)] overflow-auto rounded-t-[22px] border-t border-white/10 bg-[#121214] p-4 shadow-[0_-20px_40px_rgba(0,0,0,0.6)] md:hidden">
        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0">
            <div className="truncate font-pretendard text-[16px] font-bold text-white">{item.label || "이름 없음"}</div>
            <div className="font-pretendard text-[12.5px] text-white/45">{meta(item)}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white/60">
            <X size={20} />
          </button>
        </div>
        <Thumb item={item} played={played} />
        {item.status === "error" && item.error && (
          <p className="mt-2 font-pretendard text-[12.5px] text-[#ff8a8a]">{item.error}</p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className={sheetBtn} disabled={!playable} onClick={onPlay}>
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
            {playing ? "멈추기" : item.kind === "audio" ? "듣기" : "보기"}
          </button>
          <a href={playable ? downloadUrl(item) : undefined} aria-disabled={!playable} className={cn(sheetBtn, !playable && "pointer-events-none opacity-35")}>
            <Download size={15} />
            받기
          </a>
        </div>
        <div className="mt-2 flex flex-col">
          <MoreItems item={item} a={a} done={onClose} />
        </div>
      </div>
    </Portal>
  );
}

// ---------------------------------------------------------------- 목록

/** 목록 — 썸네일 카드 격자. 전체·영상·소리만 거르기. 올리면 재생·받기·⋯, 폰은 누르면 시트 */
export default function AvList({
  items,
  canOperate,
  isAdmin,
  onRename,
  onRetry,
  onRemove,
}: {
  items: AvItem[];
  canOperate: boolean;
  isAdmin: boolean;
  onRename: (item: AvItem, label: string) => void;
  onRetry: (item: AvItem) => void;
  onRemove: (item: AvItem) => void;
}) {
  const mobile = useIsMobile();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [playing, setPlaying] = useState<string | null>(null);
  const [played, setPlayed] = useState(0);
  const [watching, setWatching] = useState<AvItem | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<AvItem | null>(null);
  const [deleting, setDeleting] = useState<AvItem | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  const stopAudio = () => {
    audio.current?.pause();
    setPlaying(null);
    setPlayed(0);
  };

  const play = (item: AvItem) => {
    if (!isPlayable(item)) return;
    if (item.kind !== "audio") {
      stopAudio();
      setWatching(item);
      return;
    }
    if (!audio.current) {
      const a = new Audio();
      a.onended = () => {
        setPlaying(null);
        setPlayed(0);
      };
      a.ontimeupdate = () => setPlayed(a.duration ? a.currentTime / a.duration : 0);
      audio.current = a;
    }
    const a = audio.current;
    if (playing === item.id) {
      stopAudio();
      return;
    }
    a.src = recordingApi.audioUrl(item.id);
    setPlayed(0);
    a.play().catch(() => setPlaying(null));
    setPlaying(item.id);
  };

  const actions: Actions = {
    canOperate,
    isAdmin,
    onRename: setRenaming,
    onRetry,
    onRemove: setDeleting,
  };

  const shown = items.filter((i) => filter === "all" || (filter === "audio" ? i.kind === "audio" : i.kind !== "audio"));
  const sheetItem = items.find((i) => i.id === sheet) ?? null;

  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-mbc text-[17px] text-white md:text-[18px]">목록</h3>
        <span className="font-orbitron text-[11px] text-white/40">{items.length}</span>
        <div data-tour="recording.filter" role="tablist" className="ml-auto flex gap-1 rounded-[10px] bg-white/[0.05] p-[3px]">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-[7px] px-2.5 py-[5px] font-mbc text-[12.5px] transition-colors max-md:h-9 max-md:px-3",
                filter === f.key ? "bg-white text-[#0b0b0d]" : "text-white/55 hover:text-white",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center font-pretendard text-sm text-white/40">{items.length ? "여기엔 없어요" : "녹음·녹화가 없어요"}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 md:gap-3 lg:grid-cols-3">
          {shown.map((it, idx) => {
            const playable = isPlayable(it);
            const on = playing === it.id;
            return (
              <div
                key={it.id}
                data-tour={idx === 0 ? "recording.item" : undefined}
                role={mobile ? "button" : undefined}
                tabIndex={mobile ? 0 : undefined}
                onClick={mobile ? () => setSheet(it.id) : undefined}
                className="group relative min-w-0 rounded-[14px] bg-white/[0.035] p-1.5 transition-colors hover:bg-white/[0.06] md:p-2"
              >
                <Thumb item={it} played={on ? played : 0}>
                  {/* 마우스를 올리면 — 재생·받기·⋯ (폰은 시트) */}
                  <div
                    className={cn(
                      "absolute inset-0 hidden bg-black/45 transition-opacity md:block",
                      on ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                    )}
                  >
                    <button
                      type="button"
                      disabled={!playable}
                      onClick={() => play(it)}
                      aria-label={`${it.label || "녹음"} ${on ? "멈추기" : "재생"}`}
                      className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[#0a0a0c] disabled:opacity-30"
                    >
                      {on ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <div className="absolute right-1.5 top-1.5 flex gap-1.5">
                      <a
                        href={playable ? downloadUrl(it) : undefined}
                        aria-disabled={!playable}
                        aria-label="받기"
                        title="받기"
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-white hover:bg-black/80",
                          !playable && "pointer-events-none opacity-35",
                        )}
                      >
                        <Download size={15} />
                      </a>
                      <MoreMenu item={it} a={actions} />
                    </div>
                  </div>
                </Thumb>
                <div className="truncate px-[3px] pt-2 font-pretendard text-[14px] font-bold text-white">{it.label || "이름 없음"}</div>
                <div className="truncate px-[3px] font-pretendard text-[12px] font-medium text-white/45">{meta(it)}</div>
                {it.status === "error" && (
                  <div className="flex items-center gap-2 px-[3px] pt-1">
                    <span className="min-w-0 truncate font-pretendard text-[12px] text-[#ff8a8a]" title={it.error}>
                      {it.error || "실패"}
                    </span>
                    {canOperate && !mobile && (
                      <button
                        type="button"
                        onClick={() => onRetry(it)}
                        className="ml-auto shrink-0 font-pretendard text-[12px] font-semibold text-white/70 underline-offset-4 hover:text-white hover:underline"
                      >
                        {retryName(it)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sheetItem && (
        <Sheet
          item={sheetItem}
          played={playing === sheetItem.id ? played : 0}
          playing={playing === sheetItem.id}
          a={actions}
          onPlay={() => play(sheetItem)}
          onClose={() => setSheet(null)}
        />
      )}
      {watching && <Player item={watching} onClose={() => setWatching(null)} />}
      {renaming && (
        <InputModal
          isOpen
          onClose={() => setRenaming(null)}
          title="이름 바꾸기"
          icon={<Pencil size={18} className="text-red-500" />}
          initialValue={renaming.label}
          confirmText="바꾸기"
          onConfirm={async (label) => onRename(renaming, label.trim())}
        />
      )}
      {deleting && (
        <ConfirmModal
          isOpen
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            if (playing === deleting.id) stopAudio();
            if (watching?.id === deleting.id) setWatching(null);
            if (sheet === deleting.id) setSheet(null);
            onRemove(deleting);
            setDeleting(null);
          }}
          title={`${deleting.kindName} 지우기`}
          message={`'${deleting.label || "이름 없음"}'\n되돌릴 수 없어요`}
          confirmText="지우기"
          cancelText="취소"
          isDestructive
        />
      )}
    </div>
  );
}
