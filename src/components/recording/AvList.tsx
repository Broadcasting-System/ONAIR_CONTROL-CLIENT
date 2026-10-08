"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { duration, gb, when } from "@/components/recording/format";
import { avApi } from "@/lib/avApi";
import { recordingApi } from "@/lib/recordingApi";
import { cn } from "@/lib/utils";
import type { AvItem } from "@/types/av";

const btn =
  "inline-flex h-[38px] items-center justify-center gap-2 rounded-[10px] border border-white/12 bg-white/5 px-3.5 font-pretendard text-sm font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35";

const busy = (i: AvItem) => ["recording", "processing", "importing"].includes(i.status);

function Thumb({ item }: { item: AvItem }) {
  if (item.kind === "audio") {
    return (
      <div className="aspect-video rounded-md bg-[#0a0a0c] px-2.5 py-3.5">
        <div className="h-full rounded-md bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.35)_0_2px,transparent_2px_5px)] [mask-image:linear-gradient(transparent_30%,#000_30%_70%,transparent_70%)]" />
      </div>
    );
  }
  return (
    <div className="aspect-video overflow-hidden rounded-md bg-[#0a0a0c]">
      {item.thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avApi.thumbUrl(item.id)} alt="" className="h-full w-full object-cover" draggable={false} />
      )}
    </div>
  );
}

/** 목록 — 영상+소리 · 소리만 · 영상만이 한곳에. ▶ 바로 보기·듣기, 받기, 이름 바꾸기, 지우기(관리자) */
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
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  const play = (item: AvItem) => {
    if (item.kind !== "audio") {
      audio.current?.pause();
      setPlaying(null);
      setWatching((w) => (w === item.id ? null : item.id));
      return;
    }
    setWatching(null);
    if (!audio.current) {
      audio.current = new Audio();
      audio.current.onended = () => setPlaying(null);
    }
    const a = audio.current;
    if (playing === item.id) {
      a.pause();
      setPlaying(null);
      return;
    }
    a.src = recordingApi.audioUrl(item.id);
    a.play().catch(() => setPlaying(null));
    setPlaying(item.id);
  };

  const askRemove = (item: AvItem) => {
    if (confirmDel !== item.id) {
      setConfirmDel(item.id);
      setTimeout(() => setConfirmDel((c) => (c === item.id ? null : c)), 4000);
      return;
    }
    if (playing === item.id) {
      audio.current?.pause();
      setPlaying(null);
    }
    if (watching === item.id) setWatching(null);
    setConfirmDel(null);
    onRemove(item);
  };

  if (items.length === 0) {
    return <p className="font-pretendard text-sm text-white/40">녹음·녹화가 없어요</p>;
  }

  return (
    <div className="flex flex-col">
      {items.map((it) => {
        const ready = it.status === "ready";
        // 영상+소리를 합치다 실패해도 화면 영상은 볼 수 있다
        const playable = it.kind === "audio" ? ready : it.hasVideo;
        const downloadUrl =
          it.kind === "audio" ? recordingApi.audioUrl(it.id, 0, true) : avApi.fileUrl(it.id, true);
        return (
          <div key={it.id} className="border-t border-white/[0.07] py-3">
            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[120px_minmax(0,1fr)_90px_auto]">
              <Thumb item={it} />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center">
                  <span className="mr-1.5 inline-flex h-[22px] shrink-0 items-center rounded-md bg-white/[0.07] px-2 font-pretendard text-xs font-bold text-white/75">
                    {it.kindName}
                  </span>
                  {editing?.id === it.id ? (
                    <form
                      className="min-w-0 flex-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        onRename(it, editing.label.trim());
                        setEditing(null);
                      }}
                    >
                      <input
                        autoFocus
                        value={editing.label}
                        maxLength={60}
                        onChange={(e) => setEditing({ id: it.id, label: e.target.value })}
                        onBlur={() => setEditing(null)}
                        className="h-8 w-full rounded-lg border border-white/15 bg-[#141414] px-2 font-pretendard text-[15px] font-bold text-white focus:outline-none"
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      disabled={!canOperate}
                      onClick={() => setEditing({ id: it.id, label: it.label })}
                      className="min-w-0 truncate text-left font-pretendard text-base font-bold text-white disabled:cursor-default"
                    >
                      {it.label || "이름 없음"}
                    </button>
                  )}
                </div>
                <div className="mt-0.5 font-pretendard text-[13.5px] text-white/50">
                  {[when(it.startedAt), it.source].filter(Boolean).join(" · ")}
                  {it.size > 0 && ready && <span className="ml-2 text-white/35">{gb(it.size)}</span>}
                </div>
                {busy(it) && (
                  <div className="mt-1 flex items-center gap-2 font-pretendard text-xs text-white/60">
                    {it.kind === "audio" ? "서버로 가져오는 중" : it.stageName || "만드는 중"} {Math.round(it.progress * 100)}%
                    <span className="h-1.5 w-20 overflow-hidden rounded bg-white/10">
                      <span className="block h-full bg-[#FF3B3B]" style={{ width: `${it.progress * 100}%` }} />
                    </span>
                  </div>
                )}
                {it.status === "error" && <p className="mt-1 font-pretendard text-xs text-[#ff9a9a]">{it.error}</p>}
                {it.warning && <p className="mt-1 font-pretendard text-xs text-white/45">{it.warning}</p>}
              </div>
              <span className="hidden font-mono text-sm text-white/50 tabular-nums sm:block">{duration(it.duration)}</span>
              <div className="col-span-2 flex flex-wrap justify-end gap-2 sm:col-span-1">
                {it.status === "error" && (
                  <button type="button" className={btn} disabled={!canOperate} onClick={() => onRetry(it)}>
                    {it.kind === "audio" ? "다시 가져오기" : "다시 만들기"}
                  </button>
                )}
                <button
                  type="button"
                  className={btn}
                  disabled={!playable}
                  onClick={() => play(it)}
                  aria-label={`${it.label || "녹음"} ${playing === it.id || watching === it.id ? "멈추기" : "재생"}`}
                >
                  {playing === it.id || watching === it.id ? (
                    <Pause className="h-3.5 w-3.5" fill="currentColor" />
                  ) : (
                    <Play className="h-3.5 w-3.5" fill="currentColor" />
                  )}
                </button>
                <a
                  href={playable ? downloadUrl : undefined}
                  aria-disabled={!playable}
                  className={cn(btn, !playable && "pointer-events-none opacity-35")}
                >
                  받기
                </a>
                {isAdmin && (
                  <button
                    type="button"
                    disabled={it.status === "recording"}
                    onClick={() => askRemove(it)}
                    className={cn(btn, "border-[#FF3B3B]/40 bg-[#FF3B3B]/[0.08] text-[#ff9a9a]")}
                  >
                    {confirmDel === it.id ? "정말 지우기" : "지우기"}
                  </button>
                )}
              </div>
            </div>
            {watching === it.id && (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
                <video src={avApi.fileUrl(it.id)} controls autoPlay playsInline className="aspect-video w-full" />
                {it.hasOutput && (
                  <div className="flex justify-end gap-3 px-3 py-2 font-pretendard text-xs text-white/45">
                    <a className="underline-offset-4 hover:text-white/80 hover:underline" href={avApi.fileUrl(it.id, true, "screen")}>
                      화면만
                    </a>
                    {it.audioId && (
                      <a
                        className="underline-offset-4 hover:text-white/80 hover:underline"
                        href={recordingApi.audioUrl(it.audioId, 0, true)}
                      >
                        콘솔 소리 WAV
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
