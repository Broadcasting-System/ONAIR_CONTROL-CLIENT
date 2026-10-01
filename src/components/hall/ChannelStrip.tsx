"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { MixerChannel } from "@/types/hall";

// 드래그 중 장비로 보내는 최소 간격(ms) — 너무 잦으면 장비·네트워크가 밀린다.
const SEND_INTERVAL_MS = 150;
const KEY_STEP = 5;

// 페이더 눈금 — Si 계열 페이더의 대략적인 dB 위치 (0dB ≈ 75%)
const SCALE: { at: number; label: string; zero?: boolean }[] = [
  { at: 100, label: "10" },
  { at: 75, label: "0", zero: true },
  { at: 58, label: "10" },
  { at: 42, label: "20" },
  { at: 24, label: "40" },
  { at: 0, label: "∞" },
];
const METER_DOTS = 18;

// 한 채널은 한 색 — 종류별로 고르고, 뮤트되면 그 한 색이 빨강이 된다
const COLOR = {
  mic: "#5AC8FA",
  play: "#4ADE80",
  etc: "#F5B04A",
  fx: "#A98BFF",
  master: "#E6E8EE",
  muted: "#FF5A5A",
};

function channelColor(name: string, master?: boolean, fx?: boolean): string {
  if (master) return COLOR.master;
  if (fx) return COLOR.fx;
  if (/무선|유선|마이크|mic|강단|보컬|사회/i.test(name)) return COLOR.mic;
  if (/pc|음원|반주|bgm|노트북|영상|유튜브|재생/i.test(name)) return COLOR.play;
  return COLOR.etc;
}

interface ChannelStripProps {
  channel: MixerChannel;
  subLabel: string;
  disabled: boolean;
  master?: boolean;
  /** 이펙트 리턴 */
  fx?: boolean;
  /** SEL 키 — 누르면 위 처리 화면에 이 채널이 열린다 (입력 채널만) */
  selected?: boolean;
  onSelect?: () => void;
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

/** 점 미터 — 채널 색 하나로, 위로 갈수록 밝아지고 맨 위 두 칸(과입력)이 가장 밝다 */
function DotMeter({ value, peak, color }: { value: number; peak: number; color: string }) {
  return (
    <div className="flex flex-col-reverse justify-between py-[3px]" aria-hidden>
      {Array.from({ length: METER_DOTS }, (_, i) => {
        const at = ((i + 1) / METER_DOTS) * 100;
        const lit = value >= at || Math.abs(peak - at) < 100 / METER_DOTS / 2;
        const hot = at > 88;
        return (
          <span
            key={i}
            className="h-[5px] w-[5px] rounded-full transition-[background,box-shadow] duration-150"
            style={
              lit
                ? { background: color, opacity: hot ? 1 : 0.55 + at / 250, boxShadow: `0 0 ${hot ? 8 : 4}px ${color}` }
                : { background: "rgba(255,255,255,0.07)" }
            }
          />
        );
      })}
    </div>
  );
}

/** 미니 게인 링 — 처리 화면을 열지 않아도 게인이 얼마인지 보인다 */
function GainRing({ value, color }: { value: number | null; color: string }) {
  const known = value != null;
  const v = value ?? 0;
  const dots = Array.from({ length: 13 }, (_, i) => {
    const a = ((135 + (i / 12) * 270) * Math.PI) / 180;
    return { x: 23 + 19 * Math.cos(a), y: 23 + 19 * Math.sin(a), lit: known && (i / 12) * 100 <= v };
  });
  const a = ((135 + (v / 100) * 270) * Math.PI) / 180;
  return (
    <svg viewBox="0 0 46 46" className="h-[46px] w-[46px]" aria-hidden>
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={1.6}
          fill={d.lit ? color : "rgba(255,255,255,0.1)"}
          style={d.lit ? { filter: `drop-shadow(0 0 2px ${color})` } : undefined}
        />
      ))}
      <circle cx={23} cy={23} r={12} fill="#1c1c20" stroke="#000" />
      {known && (
        <line
          x1={23}
          y1={23}
          x2={23 + 10 * Math.cos(a)}
          y2={23 + 10 * Math.sin(a)}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function Key({
  label,
  on,
  color,
  disabled,
  onClick,
  ariaLabel,
}: {
  label: string;
  on: boolean;
  color: string;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={on}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "flex h-6 flex-1 items-center justify-center gap-1 rounded-[5px] border border-black font-orbitron text-[8.5px] tracking-[0.14em] transition-all",
        "bg-[linear-gradient(180deg,#303035,#1e1e22)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_3px_6px_rgba(0,0,0,0.55)]",
        "active:translate-y-px disabled:cursor-not-allowed",
        on ? "text-white" : "text-white/42 enabled:hover:text-white/75",
      )}
    >
      <span
        className="h-[5px] w-[5px] rounded-full transition-all"
        style={on ? { background: color, boxShadow: `0 0 8px ${color}` } : { background: "rgba(255,255,255,0.12)" }}
        aria-hidden
      />
      {label}
    </button>
  );
}

/** 채널 한 칸 — 처리 화면과 같은 모듈 틀 + 실제 콘솔의 검정 페이더. 한 채널은 한 색. */
export default function ChannelStrip({
  channel,
  subLabel,
  disabled,
  master,
  fx,
  selected,
  onSelect,
  onLevel,
  onMute,
}: ChannelStripProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lastSent = useRef(0);
  const [dragLevel, setDragLevel] = useState<number | null>(null);

  const level = dragLevel ?? channel.level ?? 0;
  // HiQnet 등은 콘솔이 값을 알려주기 전까지 레벨을 모른다 — 0%로 오해하지 않게 따로 표시
  const known = dragLevel !== null || channel.level != null;
  const muted = !!channel.mute;
  const meter = muted ? 0 : channel.meter ?? 0;
  const peak = usePeak(meter);
  const color = muted ? COLOR.muted : channelColor(channel.name, master, fx);
  // 관리자가 정한 최대 레벨 — 이 위로는 끌어도, 방향키로도 못 올린다 (서버도 막는다)
  const limit = Math.max(0, Math.min(100, channel.max ?? 100));
  const gain = typeof channel.params?.gain === "number" ? channel.params.gain : null;
  const inputChannel = !master && !fx;

  const levelAt = (clientY: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return level;
    return Math.min(limit, Math.round(Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height)) * 100));
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
        "relative flex shrink-0 flex-col items-center gap-2.5 rounded-xl border border-black/80 px-[9px] pb-2.5 pt-3",
        "bg-[linear-gradient(180deg,#141418,#0d0d10)] transition-shadow",
        master ? "w-[124px]" : "w-[110px]",
      )}
      style={{
        boxShadow: selected
          ? `inset 0 0 0 1px ${color}99, 0 0 20px -6px ${color}`
          : "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.025)",
      }}
    >
      {/* 위쪽 색 헤어라인 */}
      <span
        className="absolute inset-x-2.5 top-0 h-px"
        style={{ background: `linear-gradient(90deg,${color},transparent)` }}
        aria-hidden
      />

      {/* 머리줄 — 채널 번호와 상태 */}
      <div className="flex h-3.5 w-full items-center gap-[5px]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <span className="whitespace-nowrap font-orbitron text-[9px] tracking-[0.16em] text-white/60">{subLabel}</span>
        {(selected || muted) && (
          <span
            className="ml-auto shrink-0 rounded-[3px] border px-[3px] font-orbitron text-[7px] leading-[11px]"
            style={{ color, borderColor: `${color}80` }}
          >
            {muted ? "MUTE" : "SEL"}
          </span>
        )}
      </div>

      {/* 미니 게인 링 (입력 채널) — 누르면 처리 화면이 열린다 */}
      {inputChannel ? (
        <button
          type="button"
          onClick={onSelect}
          disabled={!onSelect}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-default"
          title={gain != null ? `GAIN ${Math.round(gain)}` : "GAIN — 처리 화면에서 조절"}
          aria-label={`${channel.name} 게인 · 처리 화면 열기`}
        >
          <GainRing value={gain} color={color} />
        </button>
      ) : (
        <div className="grid h-[46px] place-items-center font-orbitron text-[8px] tracking-[0.2em] text-white/28">
          {fx ? "RETURN" : channel.label ?? "STEREO"}
        </div>
      )}

      {/* 점 미터 · 눈금 · 페이더 (실제 콘솔의 검정 손잡이) */}
      <div className="flex h-[220px] w-full shrink-0 justify-center gap-[5px]">
        <DotMeter value={meter} peak={peak} color={color} />

        <div className="relative w-3.5" aria-hidden>
          {SCALE.map((s) => (
            <span
              key={s.at}
              className={cn(
                "absolute right-0 translate-y-1/2 font-orbitron text-[7px] leading-none tabular-nums",
                s.zero ? "text-white/75" : "text-white/32",
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
          aria-valuemax={limit}
          aria-valuenow={level}
          aria-disabled={disabled}
          className={cn(
            "relative w-9 touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/30",
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
            send(Math.max(0, Math.min(limit, level + delta)), true);
          }}
        >
          {/* 페이더 홈 */}
          <div className="absolute inset-y-[-2px] left-1/2 w-1 -translate-x-1/2 rounded-sm bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.06)]" />

          {/* 최대 레벨 — 흰 점선 위로는 못 올린다 */}
          {limit < 100 && (
            <div
              className="pointer-events-none absolute inset-x-[-6px] border-t border-dashed border-white/55"
              style={{ bottom: `${limit}%` }}
              aria-hidden
            >
              <span className="absolute -top-[11px] right-[-2px] font-orbitron text-[6.5px] tracking-[0.1em] text-white/55">
                MAX
              </span>
            </div>
          )}

          {/* 손잡이 — 검정 몸통 + 흰 줄 */}
          <div
            className={cn(
              "absolute left-1/2 h-[38px] w-[34px] -translate-x-1/2 translate-y-1/2 rounded border border-black transition-transform",
              "bg-[linear-gradient(180deg,#3a3a3e_0%,#1f1f22_45%,#141416_55%,#2a2a2e_100%)]",
              "shadow-[0_8px_12px_-4px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.2)]",
              dragLevel !== null && "scale-[1.04]",
            )}
            style={{ bottom: `${level}%` }}
          >
            <span
              className="absolute inset-x-1 top-1/2 h-[2px] -translate-y-1/2 rounded-[1px]"
              style={{ background: muted || !known ? "rgba(255,255,255,0.35)" : "#f2f2f2" }}
            />
          </div>
        </div>

        {master && <DotMeter value={Math.max(0, meter - 5)} peak={Math.max(0, peak - 5)} color={color} />}
      </div>

      {/* 값 창 */}
      <div
        className="min-w-[58px] rounded-[3px] border border-black bg-[#07090b] px-1.5 py-[3px] text-center font-orbitron text-xs leading-none tabular-nums shadow-[inset_0_1px_4px_#000]"
        style={{ color: known || muted ? color : `${color}40`, textShadow: known || muted ? `0 0 6px ${color}b3` : "none" }}
        title={known ? undefined : "콘솔에서 아직 값을 받지 못했습니다"}
      >
        {muted ? "MUTE" : known ? String(level).padStart(2, "0") : "--"}
      </div>

      {/* SEL · MUTE */}
      <div className="flex w-full gap-[5px]">
        {inputChannel && onSelect && (
          <Key
            label="SEL"
            on={!!selected}
            color={color}
            onClick={onSelect}
            ariaLabel={`${channel.name} 채널 선택 (게인·EQ·컴프·이펙트)`}
          />
        )}
        <Key label="MUTE" on={muted} color={color} disabled={disabled} onClick={() => onMute(!muted)} />
      </div>

      <span
        className={cn("max-w-full truncate font-mbc text-[15px] leading-tight", muted ? "text-white/55" : "text-white")}
        title={channel.name}
      >
        {channel.name}
      </span>
    </div>
  );
}
