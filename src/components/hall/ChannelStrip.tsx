"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { MixerChannel } from "@/types/hall";

// 드래그 중 장비로 보내는 최소 간격(ms) — 너무 잦으면 장비·네트워크가 밀린다.
const SEND_INTERVAL_MS = 150;
const KEY_STEP = 5;

// 페이더 눈금 — Si 계열 페이더의 대략적인 dB 위치 (0dB ≈ 75%). 숫자는 큰 눈금에만.
const MAJOR: { at: number; label: string; zero?: boolean }[] = [
  { at: 100, label: "10" },
  { at: 75, label: "0", zero: true },
  { at: 58, label: "10" },
  { at: 42, label: "20" },
  { at: 24, label: "40" },
  { at: 0, label: "∞" },
];
const MINOR = Array.from({ length: 21 }, (_, i) => i * 5);

// 미터 색 — 아래는 청록·초록, 0dB 부근 노랑, 맨 위 빨강
const METER_GRADIENT = "linear-gradient(to top,#14d9a4 0%,#00FF57 52%,#FFD600 76%,#FF3B3B 92%)";
// 가는 가로 줄로 칸을 나눠 하드웨어 LED 미터처럼
const METER_STRIPES = "repeating-linear-gradient(to top,transparent 0 3px,rgba(0,0,0,0.62) 3px 4px)";

/** 채널 종류별 손잡이 불빛 — 실제 콘솔처럼 색으로 구분 (마이크·재생·기타·마스터) */
function capColor(name: string, master?: boolean): string {
  if (master) return "#FF3B3B";
  if (/무선|유선|마이크|mic|강단|보컬|사회/i.test(name)) return "#5AC8FA";
  if (/pc|음원|반주|bgm|노트북|영상|유튜브|재생/i.test(name)) return "#00FF57";
  return "#FFB23F";
}

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

/** 캡슐 안에 줄무늬로 차오르는 미터 (꺼진 칸도 희미하게 보인다) */
function TubeMeter({ value, peak }: { value: number; peak: number }) {
  const layer: CSSProperties = { backgroundImage: `${METER_STRIPES},${METER_GRADIENT}` };
  return (
    <div
      className="relative w-[9px] overflow-hidden rounded-full bg-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.06)]"
      aria-hidden
    >
      <div className="absolute inset-0 opacity-[0.13]" style={layer} />
      <div
        className="absolute inset-0 transition-[clip-path] duration-150 [filter:drop-shadow(0_0_4px_rgba(0,255,120,0.55))]"
        style={{ ...layer, clipPath: `inset(${100 - value}% 0 0 0)` }}
      />
      {peak > 3 && (
        <div
          className="absolute inset-x-0 h-[2px] bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.9)] transition-[bottom] duration-300"
          style={{ bottom: `${peak}%` }}
        />
      )}
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
  const live = known && !muted && meter > 6;
  const color = capColor(channel.name, master);

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
    <div className={cn("flex shrink-0 flex-col items-center gap-3 px-3 py-1", master ? "w-[150px]" : "w-[108px]")}>
      {/* MUTE — 위에 LED */}
      <div className="flex w-full flex-col items-center gap-1.5">
        <span
          className={cn(
            "h-[5px] w-[5px] rounded-full transition-all",
            muted ? "bg-[#FF3B3B] shadow-[0_0_8px_2px_rgba(255,59,59,0.8)]" : "bg-[#3a1414]",
          )}
          aria-hidden
        />
        <button
          type="button"
          disabled={disabled}
          aria-pressed={muted}
          onClick={() => onMute(!muted)}
          className={cn(
            "h-8 w-full rounded-md border border-black font-orbitron text-[10.5px] font-semibold tracking-[0.2em] transition-all",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_3px_6px_rgba(0,0,0,0.55)] active:translate-y-px disabled:cursor-not-allowed",
            muted
              ? "bg-[linear-gradient(180deg,#5a1c1c,#3a1010)] text-[#ff8a8a]"
              : "bg-[linear-gradient(180deg,#3b3b3f,#242427)] text-white/55 enabled:hover:text-white/85",
          )}
        >
          MUTE
        </button>
      </div>

      {/* 값 LCD */}
      <div
        className={cn(
          "flex h-10 w-full flex-col items-center justify-center rounded-md border border-black bg-[#07100d] shadow-[inset_0_2px_6px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.06)]",
          muted && "bg-[#140707]",
        )}
        title={known ? undefined : "콘솔에서 아직 값을 받지 못했습니다"}
      >
        <span
          className={cn(
            "font-orbitron text-[17px] leading-none tabular-nums",
            muted
              ? "text-[#ff6b6b] [text-shadow:0_0_8px_rgba(255,59,59,0.7)]"
              : known
                ? "text-[#7CF5D4] [text-shadow:0_0_8px_rgba(124,245,212,0.6)]"
                : "text-[#7CF5D4]/25",
          )}
        >
          {known ? String(level).padStart(2, "0") : "--"}
        </span>
      </div>

      {/* 미터 · 눈금 · 페이더 */}
      <div className={cn("flex min-h-0 w-full flex-1 items-stretch justify-center gap-1.5 py-2", muted && "opacity-55")}>
        <TubeMeter value={meter} peak={peak} />

        {/* dB 숫자 */}
        <div className="relative w-4" aria-hidden>
          {MAJOR.map((s) => (
            <span
              key={s.at}
              className={cn(
                "absolute right-0 translate-y-1/2 font-orbitron text-[8px] leading-none tabular-nums",
                s.zero ? "text-white/80" : "text-white/25",
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
            "relative w-12 touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-red-400/50",
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
          {/* 홈 양쪽 눈금 대시 — 큰 눈금은 길게 */}
          {MINOR.map((at) => {
            const major = MAJOR.find((m) => m.at === at || Math.abs(m.at - at) < 1.5);
            return (
              <span key={at} className="absolute inset-x-0 flex translate-y-1/2 justify-between" style={{ bottom: `${at}%` }} aria-hidden>
                <span className={cn("h-px", major?.zero ? "w-3 bg-white/60" : major ? "w-2.5 bg-white/30" : "w-1.5 bg-white/12")} />
                <span className={cn("h-px", major?.zero ? "w-3 bg-white/60" : major ? "w-2.5 bg-white/30" : "w-1.5 bg-white/12")} />
              </span>
            );
          })}
          {/* 페이더 홈 */}
          <div className="absolute inset-y-[-4px] left-1/2 w-[5px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_1px_3px_rgba(0,0,0,1),0_0_0_1px_rgba(255,255,255,0.08),0_1px_0_rgba(255,255,255,0.06)]" />

          {/* 손잡이 — 매트 금속 몸통 + 가운데 빛나는 색 띠 */}
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 translate-y-1/2 rounded-[5px] border border-black/70",
              "bg-[linear-gradient(180deg,#f4f4f5_0%,#dcdcde_30%,#b4b4b8_48%,#8d8d92_52%,#c2c2c6_70%,#9a9a9f_100%)]",
              "shadow-[0_10px_16px_-4px_rgba(0,0,0,0.85),0_2px_3px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-2px_0_rgba(0,0,0,0.25)]",
              master ? "h-[36px] w-[54px]" : "h-[32px] w-[44px]",
              dragLevel !== null && "scale-[1.04]",
              (muted || !known) && "saturate-0",
            )}
            style={{ bottom: `${level}%` }}
          >
            <span className="absolute inset-x-[5px] top-[5px] h-px bg-black/15" />
            <span
              className="absolute inset-x-[4px] top-1/2 h-[4px] -translate-y-1/2 rounded-full transition-shadow"
              style={{
                background: color,
                boxShadow: live || dragLevel !== null ? `0 0 10px 1px ${color}, 0 0 2px ${color}` : `0 0 3px ${color}66`,
                opacity: muted || !known ? 0.35 : 1,
              }}
            />
            <span className="absolute inset-x-[5px] bottom-[5px] h-px bg-black/20" />
          </div>
        </div>

        {master && <TubeMeter value={Math.max(0, meter - 5)} peak={Math.max(0, peak - 5)} />}
      </div>

      {/* 이름표 */}
      <div
        className={cn(
          "flex w-full flex-col items-center gap-0.5 rounded-md border px-1.5 py-1.5",
          master ? "border-[#FF3B3B]/35 bg-[#FF3B3B]/[0.08]" : "border-white/[0.06] bg-black/45",
        )}
      >
        <span className="max-w-full truncate font-mbc text-[15px] leading-tight text-white" title={channel.name}>
          {channel.name}
        </span>
        <span className="flex items-center gap-1 font-orbitron text-[9px] tracking-[0.16em] text-white/35">
          <span
            className="h-[5px] w-[5px] rounded-full transition-shadow"
            style={{ background: color, boxShadow: live ? `0 0 6px ${color}` : "none", opacity: live ? 1 : 0.35 }}
            aria-hidden
          />
          {subLabel}
        </span>
      </div>
    </div>
  );
}
