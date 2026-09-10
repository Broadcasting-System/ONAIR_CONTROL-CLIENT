"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { MixerChannel } from "@/types/hall";

// 드래그 중 장비로 보내는 최소 간격(ms) — 너무 잦으면 장비·네트워크가 밀린다.
const SEND_INTERVAL_MS = 150;
const KEY_STEP = 5;

interface ChannelStripProps {
  channel: MixerChannel;
  subLabel: string;
  disabled: boolean;
  master?: boolean;
  onLevel: (level: number) => void;
  onMute: (muted: boolean) => void;
}

function Meter({ value, wide }: { value: number; wide?: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full bg-[linear-gradient(to_top,#00FF57_0_62%,#FFD600_62%_84%,#FF3B3B_84%)]",
        wide ? "w-2.5" : "w-2",
      )}
    >
      <div
        className="absolute inset-x-0 top-0 bg-[#141414] transition-[height] duration-150"
        style={{ height: `${100 - value}%` }}
      />
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
  const meter = channel.meter ?? 0;

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
        "flex flex-col items-center gap-2.5 rounded-2xl bg-black/40 px-2.5 py-3",
        master ? "w-[150px] border border-white/10" : "w-[104px]",
      )}
    >
      <span className="whitespace-nowrap font-mbc text-[15px] text-white">{channel.name}</span>
      <span className="-mt-2 font-orbitron text-[10px] tracking-[0.14em] text-white/30">{subLabel}</span>

      <div className="flex min-h-0 w-full flex-1 items-stretch justify-center gap-3">
        <Meter value={meter} wide={master} />
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
            "relative w-10 touch-none outline-none",
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
          <div className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-white/10" />
          {/* 0dB 근처 기준선 */}
          <div className="absolute bottom-[75%] left-1/2 h-px w-5 -translate-x-1/2 bg-white/30" />
          <div
            className={cn(
              "absolute left-1/2 h-[18px] w-[34px] -translate-x-1/2 translate-y-1/2 rounded-[5px] bg-gradient-to-b from-[#e7e7e7] to-[#9a9a9a] shadow-[0_2px_6px_rgba(0,0,0,0.6)]",
              (muted || !known) && "opacity-40",
            )}
            style={{ bottom: `${level}%` }}
          >
            <div className="absolute inset-x-1 top-2 h-0.5 bg-[#333]" />
          </div>
        </div>
        {master && <Meter value={Math.max(0, meter - 6)} wide />}
      </div>

      <span
        className={cn("font-orbitron text-sm text-white", (muted || !known) && "opacity-40")}
        title={known ? undefined : "콘솔에서 아직 값을 받지 못했습니다"}
      >
        {known ? `${level}%` : "—"}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onMute(!muted)}
        className={cn(
          "h-8 w-full rounded-lg border font-orbitron text-[11px] tracking-[0.14em] transition-all disabled:cursor-not-allowed",
          muted
            ? "border-[#FF3B3B] bg-[#FF3B3B] text-white shadow-[0_0_12px_-2px_#FF3B3B]"
            : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white/80",
        )}
      >
        MUTE
      </button>
    </div>
  );
}
