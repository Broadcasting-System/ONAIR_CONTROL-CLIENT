"use client";

import { useEffect, useRef, useState } from "react";
import { DisplayMirror } from "@/components/display/DisplayMirror";
import { cn } from "@/lib/utils";
import type { AvChannel, AvHall } from "@/types/av";

const NOW_PLAYING: Record<string, string> = {
  standby: "대기 화면",
  image: "이미지",
  video: "영상",
  presentation: "PPT",
  screen: "화면 공유",
  timer: "타이머",
  youtube: "유튜브",
  audio: "오디오",
};

// 미러를 640x360 으로 그린 뒤 카드 너비에 맞춰 줄인다 (작은 칸에서도 송출 화면과 같은 배치)
const MIRROR_W = 640;
const MIRROR_H = 360;

/** 지금 그 채널에 나가는 화면 — 컨트롤의 송출 모니터(DisplayMirror, LIVE 로 세지 않음)를 줄여서 */
function ChannelThumb({ channel }: { channel: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / MIRROR_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="absolute inset-0">
      <div
        className="pointer-events-none absolute left-0 top-0 origin-top-left"
        style={{ width: MIRROR_W, height: MIRROR_H, transform: `scale(${scale})` }}
      >
        <DisplayMirror channel={channel} badge={false} />
      </div>
    </div>
  );
}

const cardCls =
  "grid content-start gap-2.5 rounded-[14px] border p-2.5 text-left transition-[border-color,box-shadow] disabled:cursor-not-allowed";
const cardOn = "border-red-400/60 shadow-[0_0_0_1px_rgba(248,113,113,0.35)]";
const cardOff = "border-white/[0.08] bg-black/30";

/** 화면(없음·CH1~5)과 소리(홀 콘솔·없음) 고르기 */
export default function SourcePicker({
  channels,
  halls,
  screen,
  audio,
  laneNames,
  recordingChannel,
  locked,
  onScreen,
  onAudio,
}: {
  channels: AvChannel[];
  halls: AvHall[];
  screen: number | null;
  audio: string | null;
  /** 고른 홀 콘솔의 통로 이름 (예: 마이크·음악) */
  laneNames: string[];
  /** 지금 녹화 중인 채널 — 썸네일에 빨간 점 */
  recordingChannel: number | null;
  /** 녹음·녹화 중에는 바꿀 수 없다 */
  locked: boolean;
  onScreen: (channel: number | null) => void;
  onAudio: (hall: string | null) => void;
}) {
  return (
    <section className="grid gap-[18px] rounded-[24px] border border-sidebar-border bg-sidebar p-7 shadow-2xl backdrop-blur-md">
      <div className="grid gap-[18px] lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="pt-1 font-pretendard text-sm font-bold text-white/60">
          화면
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <button
            type="button"
            disabled={locked}
            onClick={() => onScreen(null)}
            className={cn(cardCls, screen === null ? cardOn : cardOff, screen === null && "bg-black/30")}
          >
            <div className="grid aspect-video place-items-center rounded-lg bg-[#0a0a0c] font-pretendard text-[13px] text-white/45">
              화면 없음
            </div>
            <div>
              <div className="font-pretendard text-[15px] font-bold text-white">소리만</div>
              <div className="font-pretendard text-[12.5px] text-white/50">콘솔 녹음</div>
            </div>
          </button>
          {channels.map((c) => {
            const on = screen === c.channel;
            const off = !c.live;
            const now = NOW_PLAYING[c.type] ?? c.type;
            return (
              <button
                key={c.channel}
                type="button"
                disabled={locked || off}
                onClick={() => onScreen(c.channel)}
                className={cn(cardCls, on ? cardOn : cardOff, on && "bg-black/30", off && "opacity-45")}
              >
                <div className="relative aspect-video overflow-hidden rounded-lg bg-[#0a0a0c]">
                  {off ? (
                    <span className="absolute inset-0 grid place-items-center font-pretendard text-[13px] text-white/40">
                      꺼짐
                    </span>
                  ) : (
                    <ChannelThumb channel={c.channel} />
                  )}
                  <span className="absolute left-2 top-2 z-30 inline-flex h-5 items-center rounded-[5px] bg-black/65 px-[7px] font-mono text-[11px] font-bold text-white">
                    CH{c.channel}
                  </span>
                  {recordingChannel === c.channel && (
                    <span className="absolute right-2 top-2 z-30 h-2 w-2 rounded-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-pretendard text-[15px] font-bold text-white">{c.name || c.label}</div>
                  <div className="line-clamp-2 font-pretendard text-[12.5px] text-white/50">
                    {off ? "연결된 화면 없음" : [c.hallName, now].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-[18px] border-t border-white/[0.07] pt-[18px] lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="pt-1 font-pretendard text-sm font-bold text-white/60">
          소리
        </div>
        <div className="flex flex-wrap gap-2.5">
          {halls.map((h) => {
            const on = audio === h.id;
            const sub = !h.configured ? "설정 안 됨" : on && laneNames.length ? `${laneNames.join("·")} ${laneNames.length}통로` : "2통로";
            return (
              <button
                key={h.id}
                type="button"
                disabled={locked}
                onClick={() => onAudio(h.id)}
                className={cn(
                  "inline-flex h-[46px] items-center gap-2.5 rounded-xl border bg-black/30 px-4 font-pretendard text-[15px] font-bold transition-[border-color,box-shadow] disabled:cursor-not-allowed",
                  on ? cn(cardOn, "text-white") : "border-white/10 text-white/75",
                )}
              >
                {h.name} 콘솔
                <small className="text-[12.5px] font-medium text-white/45">{sub}</small>
              </button>
            );
          })}
          <button
            type="button"
            disabled={locked}
            onClick={() => onAudio(null)}
            className={cn(
              "inline-flex h-[46px] items-center rounded-xl border bg-black/30 px-4 font-pretendard text-[15px] font-bold transition-[border-color,box-shadow] disabled:cursor-not-allowed",
              audio === null ? cn(cardOn, "text-white") : "border-white/10 text-white/75",
            )}
          >
            소리 없음
          </button>
        </div>
      </div>
    </section>
  );
}
