"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { duration, gb, LANE_COLORS } from "@/components/recording/RecordDeck";
import { recordingApi } from "@/lib/recordingApi";
import { cn } from "@/lib/utils";
import type { RecordingItem } from "@/types/recording";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} (${WEEKDAYS[d.getDay()]}) ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const btn =
  "h-[34px] rounded-[10px] border border-white/12 bg-white/5 px-3 font-mbc text-[13px] text-white/75 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35";

/** 최근 녹음 — 눌러서 바로 듣기, 받기(통로 이름을 누르면 그 통로만), 영상에 쓰기, 지우기(관리자) */
export default function RecordingList({
  recordings,
  selected,
  canOperate,
  isAdmin,
  onPick,
  onRetry,
  onRemove,
  onRename,
}: {
  recordings: RecordingItem[];
  selected: string | null;
  canOperate: boolean;
  isAdmin: boolean;
  onPick: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, label: string) => void;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  const toggle = (item: RecordingItem) => {
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

  const askRemove = (id: string) => {
    if (confirmDel !== id) {
      setConfirmDel(id);
      setTimeout(() => setConfirmDel((c) => (c === id ? null : c)), 4000);
      return;
    }
    if (playing === id) {
      audio.current?.pause();
      setPlaying(null);
    }
    setConfirmDel(null);
    onRemove(id);
  };

  if (recordings.length === 0) {
    return <p className="font-pretendard text-sm text-white/40">아직 녹음이 없어요. 위의 빨간 버튼으로 시작하세요.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {recordings.map((r) => {
        const ready = r.status === "ready";
        return (
          <div
            key={r.id}
            className={cn(
              "grid grid-cols-[36px_minmax(0,1fr)] items-center gap-3 rounded-[14px] border px-3 py-2.5 sm:grid-cols-[36px_minmax(0,1fr)_auto]",
              selected === r.id ? "border-[#FF3B3B]/45 bg-[#FF3B3B]/[0.08]" : "border-white/[0.06] bg-black/25",
            )}
          >
            <button
              type="button"
              onClick={() => toggle(r)}
              disabled={!ready}
              aria-label={`${r.label || "녹음"} ${playing === r.id ? "멈추기" : "듣기"}`}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/5 text-white/80 hover:bg-white/10 disabled:opacity-30"
            >
              {playing === r.id ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
            </button>

            <div className="min-w-0">
              {editing?.id === r.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onRename(r.id, editing.label.trim());
                    setEditing(null);
                  }}
                >
                  <input
                    autoFocus
                    value={editing.label}
                    maxLength={60}
                    onChange={(e) => setEditing({ id: r.id, label: e.target.value })}
                    onBlur={() => setEditing(null)}
                    className="h-8 w-full rounded-lg border border-white/15 bg-[#141414] px-2 font-mbc text-[15px] text-white focus:outline-none"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  disabled={!canOperate}
                  onClick={() => setEditing({ id: r.id, label: r.label })}
                  title={canOperate ? "눌러서 이름 바꾸기" : undefined}
                  className="block max-w-full truncate text-left font-mbc text-base text-white disabled:cursor-default"
                >
                  {r.label || "이름 없는 녹음"}
                </button>
              )}
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-pretendard text-xs text-white/45">
                <span>{r.hallName}</span>
                <span>{when(r.startedAt)}</span>
                <span>{duration(r.duration)}</span>
                {r.size > 0 && ready && <span>{gb(r.size)}</span>}
                {ready &&
                  r.lanes.map((name, i) => (
                    <a
                      key={i}
                      href={recordingApi.audioUrl(r.id, i + 1, true)}
                      title={`${name}만 받기 (모노 WAV)`}
                      className="rounded-md border px-1.5 text-[11px] hover:bg-white/5"
                      style={{ color: LANE_COLORS[i % 2], borderColor: `${LANE_COLORS[i % 2]}55` }}
                    >
                      {name}
                    </a>
                  ))}
                {r.status === "importing" && (
                  <span className="flex items-center gap-2 text-white/60">
                    서버로 가져오는 중 {Math.round(r.progress * 100)}%
                    <span className="h-1.5 w-20 overflow-hidden rounded bg-white/10">
                      <span className="block h-full bg-[#FF3B3B]" style={{ width: `${r.progress * 100}%` }} />
                    </span>
                  </span>
                )}
                {r.status === "error" && <span className="text-amber-200/90">{r.error}</span>}
                {r.warning && <span className="text-amber-200/80">{r.warning}</span>}
              </div>
            </div>

            <div className="col-span-2 flex flex-wrap justify-end gap-1.5 sm:col-span-1">
              {r.status === "error" ? (
                <button type="button" className={btn} disabled={!canOperate} onClick={() => onRetry(r.id)}>
                  다시 가져오기
                </button>
              ) : (
                <>
                  <button type="button" className={btn} disabled={!ready} onClick={() => onPick(r.id)}>
                    영상에 쓰기
                  </button>
                  <a
                    href={ready ? recordingApi.audioUrl(r.id, 0, true) : undefined}
                    aria-disabled={!ready}
                    className={cn(btn, "flex items-center", !ready && "pointer-events-none opacity-35")}
                  >
                    받기
                  </a>
                </>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => askRemove(r.id)}
                  className={cn(btn, "border-[#FF3B3B]/40 bg-[#FF3B3B]/[0.08] text-[#ff9a9a]")}
                >
                  {confirmDel === r.id ? "정말 지우기" : "지우기"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
