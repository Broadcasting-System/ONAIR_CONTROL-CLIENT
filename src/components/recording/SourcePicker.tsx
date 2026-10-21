"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { DisplayMirror } from "@/components/display/DisplayMirror";
import { cn } from "@/lib/utils";
import type { AvChannel } from "@/types/av";
import { channelName } from "@/constants/channels";

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

const card =
  "min-w-0 rounded-xl border p-1.5 text-left transition-[border-color,background-color] disabled:cursor-not-allowed";
const on = "border-white/80 bg-white/[0.06]";
const off = "border-white/[0.08] bg-black/30 enabled:hover:border-white/25";

/** 화면 고르기 카드 줄 — 소리만 · CH1~5. 송출 중이면 작은 미리보기와 LIVE, 꺼진 채널은 흐리게 */
export default function SourcePicker({
  channels,
  screen,
  locked,
  onScreen,
}: {
  channels: AvChannel[];
  screen: number | null;
  /** 녹음·녹화 중에는 바꿀 수 없다 */
  locked: boolean;
  onScreen: (channel: number | null) => void;
}) {
  return (
    <div data-tour="recording.screen" className="grid grid-cols-3 gap-2 md:grid-cols-6">
      <button
        type="button"
        disabled={locked}
        aria-pressed={screen === null}
        onClick={() => onScreen(null)}
        className={cn(card, screen === null ? on : off)}
      >
        <div className="grid aspect-video place-items-center rounded-[7px] bg-[#0b0b0d] text-white/30">
          <Mic size={20} strokeWidth={2} />
        </div>
        <div className="mt-1.5 truncate px-[3px] font-mbc text-[13px] text-white">소리만</div>
      </button>
      {channels.map((c) => {
        const picked = screen === c.channel;
        // 녹화는 서버 PC 가 채널 화면을 직접 띄워 찍으니 TV(송출 화면)가 붙어 있는지와 상관없다.
        // 아무것도 안 나가는(대기) 채널만 흐리게, 그래도 고를 수는 있다
        const dead = (c.type || "standby") === "standby";
        return (
          <button
            key={c.channel}
            type="button"
            disabled={locked}
            aria-pressed={picked}
            onClick={() => onScreen(c.channel)}
            title={c.name || undefined}
            className={cn(card, picked ? on : off, dead && "opacity-45")}
          >
            <div className="relative aspect-video overflow-hidden rounded-[7px] bg-[#0b0b0d]">
              {dead ? (
                <span className="absolute inset-0 grid place-items-center font-pretendard text-[11px] text-white/30">대기</span>
              ) : (
                <>
                  <ChannelThumb channel={c.channel} />
                  <span className="absolute right-[5px] top-[5px] z-30 rounded bg-[#ff3b3b] px-1 py-px font-orbitron text-[8.5px] font-bold tracking-[0.08em] text-white">
                    LIVE
                  </span>
                </>
              )}
            </div>
            <div className="mt-1.5 flex min-w-0 items-center gap-1.5 px-[3px]">
              <span className="truncate font-mbc text-[13px] text-white">{c.label || channelName(c.channel)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
