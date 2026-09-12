"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { MixerChannel } from "@/types/hall";

// 드래그 중 장비로 보내는 최소 간격(ms) — 너무 잦으면 장비·네트워크가 밀린다.
const SEND_INTERVAL_MS = 150;
const KEY_STEP = 5;

// LED 미터 칸 수. 62% 위는 노랑, 84% 위는 빨강 (콘솔 미터와 같은 구간)
const SEGMENTS = 24;
const segColor = (at: number) => (at > 84 ? "#FF3B3B" : at > 62 ? "#FFD600" : "#00FF57");

// 페이더 옆 눈금 — Si 계열 페이더의 대략적인 dB 위치 (0dB ≈ 75%)
const SCALE: { at: number; label: string; zero?: boolean }[] = [
  { at: 100, label: "+10" },
  { at: 75, label: "0", zero: true },
  { at: 58, label: "-10" },
  { at: 42, label: "-20" },
  { at: 24, label: "-40" },
  { at: 0, label: "-∞" },
];

interface ChannelStripProps {
  channel: MixerChannel;
  subLabel: string;
  disabled: boolean;
  master?: boolean;
  onLevel: (level: number) => void;
  onMute: (muted: boolean) => void;
}

/** 피크 홀드 — 올라가면 바로 따라가고, 내려갈 때는 천천히 떨어진다 */
function usePeak(value: number) {
  const [peak, setPeak] = useState(value);
  useEffect(() => {
    setPeak((p) => (value >= p ? value : Math.max(value, p - 7)));
  }, [value]);
  return peak;
}

function LedMeter({ value, peak }: { value: number; peak: number }) {
  const peakSeg = Math.ceil((peak / 100) * SEGMENTS) - 1;
  return (
    <div className="flex h-full w-[7px] flex-col-reverse gap-[2px]" aria-hidden>
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const at = ((i + 1) / SEGMENTS) * 100;
        const lit = value >= at - 100 / SEGMENTS / 2 || (i === peakSeg && peak > 4);
        const color = segColor(at);
        return (
          <span
            key={i}
            className="min-h-0 flex-1 rounded-[1.5px] transition-opacity duration-100"
            style={{
              background: color,
              opacity: lit ? 1 : 0.09,
              boxShadow: lit ? `0 0 6px ${color}80` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

export default function ChannelStrip({ channel, subLabel, disabled, master, onLevel, onMute }: ChannelStripProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lastSent = useRef(0);
  const [dragLevel, setDragLevel] = useState<number | null>(null);

  const level = dragLevel ?? channel.level ?? 0;
  // HiQnet 등은 콘솔이 값을 알려주기 전까지 레벨을 모른다 — 0%로 오해하지 않게 따로 표시
  const known = dragLevel !== null || channel.level != null;
  const muted = !!channel.mute;
  const meter = muted ? 0 : channel.meter ?? 0;
  const peak = usePeak(meter);
  // 소리가 실제로 나가는 채널 — 위쪽 불빛
  const live = known && !muted && meter > 6;

  const levelAt = (clientY: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return level;
    return Math.round(Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height)) * 100);
  };

  const send = (value: number, force = false) => {
    const now = Date.now();
    if (force || now - lastSent.current >= SEND_INTERVAL_MS) {
      lastSent.current = now;
      onLevel(value);
    }
  };

  return (
    <div
      className={cn(
        "relative flex shrink-0 flex-col items-center gap-3 overflow-hidden rounded-[18px] border px-3 pb-3 pt-4 transition-colors",
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(0,0,0,0.32)_34%,rgba(0,0,0,0.5)_100%)]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        muted ? "border-[#FF3B3B]/30" : master ? "border-white/15" : "border-white/[0.07]",
        master ? "w-[172px]" : "w-[112px]",
      )}
    >
      {/* 위쪽 불빛: 신호가 나가는 중 */}
      <span
        className={cn(
          "absolute inset-x-5 top-0 h-[2px] rounded-b-full bg-[#00FF57] shadow-[0_0_12px_#00FF57] transition-opacity duration-300",
          live ? "opacity-100" : "opacity-0",
        )}
      />

      <div className="flex w-full flex-col items-center gap-1">
        <span className="max-w-full truncate font-mbc text-[16px] leading-tight text-white" title={channel.name}>
          {channel.name}
        </span>
        <span
          className={cn(
            "rounded-[4px] px-1.5 py-px font-orbitron text-[9.5px] tracking-[0.18em]",
            master ? "bg-[#FF3B3B]/15 text-[#ff8a8a]" : "bg-white/[0.05] text-white/35",
          )}
        >
          {subLabel}
        </span>
      </div>

      {/* 미터 · 눈금 · 페이더 */}
      <div className={cn("flex min-h-0 w-full flex-1 items-stretch justify-center gap-1.5 py-1", muted && "opacity-60")}>
        <LedMeter value={meter} peak={peak} />

        <div className="relative w-[22px]" aria-hidden>
          {SCALE.map((s) => (
            <span
              key={s.at}
              className={cn(
                "absolute right-0 translate-y-1/2 font-orbitron text-[8px] leading-none tabular-nums",
                s.zero ? "text-white/75" : "text-white/25",
              )}
              style={{ bottom: `${s.at}%` }}
            >
              {s.label}
            </span>
          ))}
        </div>

        <div
          ref={trackRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={`${channel.name} 레벨`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={level}
          aria-disabled={disabled}
          className={cn(
            "relative w-11 touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-red-400/50",
            disabled ? "cursor-not-allowed" : "cursor-ns-resize",
          )}
          onPointerDown={(e) => {
            if (disabled) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const v = levelAt(e.clientY);
            setDragLevel(v);
            send(v, true);
          }}
          onPointerMove={(e) => {
            if (dragLevel === null) return;
            const v = levelAt(e.clientY);
            setDragLevel(v);
            send(v);
          }}
          onPointerUp={(e) => {
            if (dragLevel === null) return;
            const v = levelAt(e.clientY);
            setDragLevel(null);
            send(v, true);
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            const delta = e.key === "ArrowUp" ? KEY_STEP : e.key === "ArrowDown" ? -KEY_STEP : 0;
            if (!delta) return;
            e.preventDefault();
            send(Math.max(0, Math.min(100, level + delta)), true);
          }}
        >
          {/* 눈금선 */}
          {SCALE.map((s) => (
            <span
              key={s.at}
              className={cn(
                "absolute left-1 right-1 h-px translate-y-1/2",
                s.zero ? "bg-white/35" : "bg-white/[0.07]",
              )}
              style={{ bottom: `${s.at}%` }}
            />
          ))}
          {/* 페이더 홈 */}
          <div className="absolute inset-y-0 left-1/2 w-[6px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.07)]" />
          {/* 올라온 만큼 */}
          <div
            className={cn(
              "absolute bottom-0 left-1/2 w-[2px] -translate-x-1/2 rounded-full",
              master ? "bg-gradient-to-t from-transparent to-[#ff6a6a]" : "bg-gradient-to-t from-transparent to-white/60",
              (!known || muted) && "opacity-30",
            )}
            style={{ height: `${level}%` }}
          />
          {/* 손잡이 */}
          <div
            className={cn(
              "absolute left-1/2 h-[28px] -translate-x-1/2 translate-y-1/2 rounded-[6px] border border-white/50",
              "bg-[linear-gradient(180deg,#fafafa_0%,#c9c9c9_42%,#8c8c8c_50%,#bdbdbd_58%,#e6e6e6_100%)]",
              "shadow-[0_6px_14px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.95)] transition-shadow",
              master ? "w-[46px]" : "w-[40px]",
              dragLevel !== null && "shadow-[0_0_0_2px_rgba(255,90,90,0.55),0_8px_20px_rgba(0,0,0,0.8)]",
              (muted || !known) && "opacity-45",
            )}
            style={{ bottom: `${level}%` }}
          >
            <span className="absolute inset-x-[6px] top-[6px] h-px bg-black/20" />
            <span
              className={cn(
                "absolute inset-x-[5px] top-1/2 h-[2px] -translate-y-1/2 rounded-full",
                master ? "bg-[#d83a3a]" : "bg-[#262626]",
              )}
            />
            <span className="absolute inset-x-[6px] bottom-[6px] h-px bg-black/20" />
          </div>
        </div>

        {master && <LedMeter value={Math.max(0, meter - 5)} peak={Math.max(0, peak - 5)} />}
      </div>

      {/* 값 표시 */}
      <div
        className={cn(
          "flex h-7 w-full items-baseline justify-center gap-0.5 rounded-md border border-black/80 bg-black/70 pt-[5px] font-orbitron tabular-nums shadow-[inset_0_1px_4px_rgba(0,0,0,0.9)]",
          muted ? "text-[#ff6b6b]" : known ? "text-[#9EFAE1]" : "text-white/30",
        )}
        title={known ? undefined : "콘솔에서 아직 값을 받지 못했습니다"}
      >
        <span className="text-[14px] leading-none">{known ? level : "—"}</span>
        {known && <span className="text-[9px] leading-none opacity-60">%</span>}
      </div>

      <button
        type="button"
        disabled={disabled}
        aria-pressed={muted}
        onClick={() => onMute(!muted)}
        className={cn(
          "h-9 w-full rounded-lg border font-orbitron text-[11px] font-semibold tracking-[0.2em] transition-all disabled:cursor-not-allowed",
          muted
            ? "border-[#FF3B3B] bg-[#FF3B3B] text-white shadow-[0_0_18px_-2px_#FF3B3B,inset_0_1px_0_rgba(255,255,255,0.35)]"
            : "border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] text-white/45 enabled:hover:border-white/25 enabled:hover:text-white/85",
        )}
      >
        MUTE
      </button>
    </div>
  );
}
