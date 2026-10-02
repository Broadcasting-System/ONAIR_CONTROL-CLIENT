"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// 돌리는 중 장비로 보내는 최소 간격(ms) — 페이더와 같은 이유로 너무 잦으면 밀린다
const SEND_INTERVAL_MS = 120;
// 실제 콘솔 인코더처럼 아래쪽이 비는 270° 회전. SVG 각도(오른쪽 0°, 시계방향)로 135°에서 시작
const START = 135;
const SWEEP = 270;
// 손잡이 둘레 LED 칸 수
const DOTS = 19;
// 손잡이를 잡고 원을 그리듯 돌린다 — 마우스가 중심을 도는 각도만큼 같이 돈다 (Shift 는 1/4 속도)
const FINE = 0.25;
// 중심에 너무 가까우면 각도가 튀니 이 반지름 안의 움직임은 무시한다
const DEAD_RADIUS = 6;
// 손잡이 옆면 홈 — 값이 바뀌면 같이 돌아 실제로 돌리는 느낌을 준다
const KNURLS = 18;

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const angleOf = (v: number) => START + (clamp(v) / 100) * SWEEP;

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  if (Math.abs(to - from) < 0.01) return "";
  const [a, b] = from < to ? [from, to] : [to, from];
  const [x1, y1] = polar(cx, cy, r, a);
  const [x2, y2] = polar(cx, cy, r, b);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export interface KnobProps {
  label: string;
  /** 0~100 (콘솔 백분율). 장비가 아직 알려 주지 않았으면 null */
  value: number | null;
  color: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** 가운데(50)가 0 인 손잡이 — EQ 처럼 올리고 내리는 값 */
  bipolar?: boolean;
  /** 두 번 누르면 돌아갈 값 */
  defaultValue?: number;
  format?: (value: number) => string;
  size?: number;
  /** 콘솔 주소가 연결되지 않은 칸 */
  unlinked?: boolean;
  /** 손잡이 아래 붙는 것 ('찾기' 버튼 등) */
  footer?: ReactNode;
  title?: string;
}

export interface Turn {
  cx: number;
  cy: number;
  /** 직전 포인터 각도(도) */
  last: number;
  v: number;
}

/** 손잡이를 잡은 순간 — 중심과 지금 각도를 기억한다 */
export function beginTurn(el: Element, x: number, y: number, v: number): Turn {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  return { cx, cy, last: (Math.atan2(y - cy, x - cx) * 180) / Math.PI, v };
}

/** 포인터가 중심을 돈 만큼 값을 바꾼다. 손잡이 270° 회전 = 0~100. 끝에 닿으면 실제 손잡이처럼 멈춘다 */
export function turnTo(t: Turn, x: number, y: number, fine: boolean): number {
  if (Math.hypot(x - t.cx, y - t.cy) < DEAD_RADIUS) return t.v;
  const a = (Math.atan2(y - t.cy, x - t.cx) * 180) / Math.PI;
  let d = a - t.last;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  t.last = a;
  t.v = clamp(t.v + (d / SWEEP) * 100 * (fine ? FINE : 1));
  return t.v;
}

/** 콘솔 인코더 — LED 링 + 매트 금속 손잡이. 잡고 원을 그리듯 돌리거나 방향키로 돌린다. */
export default function Knob({
  label,
  value,
  color,
  onChange,
  disabled,
  bipolar,
  defaultValue,
  format,
  size = 64,
  unlinked,
  footer,
  title,
}: KnobProps) {
  const gid = useId().replace(/:/g, "");
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<Turn | null>(null);
  const lastSent = useRef(0);

  const known = drag !== null || value != null;
  const v = drag ?? value ?? (bipolar ? 50 : 0);
  const inactive = disabled || unlinked;

  const send = (next: number, force = false) => {
    const now = Date.now();
    if (force || now - lastSent.current >= SEND_INTERVAL_MS) {
      lastSent.current = now;
      onChange(Math.round(next * 10) / 10);
    }
  };

  const c = size / 2;
  const ringR = c - 3;
  const trackR = c - 9;
  const bodyR = c - 14;
  const valueAngle = angleOf(v);
  const fromAngle = bipolar ? START + SWEEP / 2 : START;
  const [px, py] = polar(c, c, bodyR - 4, valueAngle);
  const [ix, iy] = polar(c, c, bodyR * 0.35, valueAngle);

  const dots = Array.from({ length: DOTS }, (_, i) => {
    const at = START + (i / (DOTS - 1)) * SWEEP;
    const lo = Math.min(fromAngle, valueAngle) - 0.5;
    const hi = Math.max(fromAngle, valueAngle) + 0.5;
    const [x, y] = polar(c, c, ringR, at);
    return { x, y, lit: known && at >= lo && at <= hi };
  });

  const shown = !known ? "--" : format ? format(v) : String(Math.round(v)).padStart(2, "0");

  return (
    <div className={cn("flex flex-col items-center gap-1.5", inactive && "opacity-45")} title={title}>
      <span className="font-orbitron text-[9px] tracking-[0.2em] text-white/45">{label}</span>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={known ? Math.round(v) : undefined}
        aria-disabled={disabled}
        className={cn(
          "relative touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#7CF5D4]/50",
          disabled ? "cursor-not-allowed" : drag !== null ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{ width: size, height: size }}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = beginTurn(e.currentTarget, e.clientX, e.clientY, v);
          setDrag(v);
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const next = turnTo(start.current, e.clientX, e.clientY, e.shiftKey);
          setDrag(next);
          send(next);
        }}
        onPointerUp={() => {
          if (!start.current) return;
          start.current = null;
          if (drag !== null) send(drag, true);
          setDrag(null);
        }}
        onDoubleClick={() => {
          if (!disabled && defaultValue != null) send(defaultValue, true);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          const step = e.shiftKey ? 10 : 2;
          const delta =
            e.key === "ArrowUp" || e.key === "ArrowRight" ? step : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -step : 0;
          let next: number | null = delta ? clamp(v + delta) : null;
          if (e.key === "Home") next = 0;
          if (e.key === "End") next = 100;
          if (next === null) return;
          e.preventDefault();
          send(next, true);
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <defs>
            <radialGradient id={`body-${gid}`} cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#4a4a50" />
              <stop offset="55%" stopColor="#202024" />
              <stop offset="100%" stopColor="#0c0c0e" />
            </radialGradient>
            <filter id={`glow-${gid}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* LED 링 */}
          {dots.map((d, i) => (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={1.5}
              fill={d.lit ? color : "rgba(255,255,255,0.09)"}
              filter={d.lit ? `url(#glow-${gid})` : undefined}
            />
          ))}

          {/* 홈 + 값 호 */}
          <path d={arcPath(c, c, trackR, START, START + SWEEP)} stroke="rgba(0,0,0,0.85)" strokeWidth={4} fill="none" strokeLinecap="round" />
          {known && (
            <path
              d={arcPath(c, c, trackR, fromAngle, valueAngle)}
              stroke={color}
              strokeWidth={2.4}
              fill="none"
              strokeLinecap="round"
              filter={`url(#glow-${gid})`}
            />
          )}
          {bipolar && (
            <line
              x1={c}
              y1={c - trackR - 3}
              x2={c}
              y2={c - trackR + 2}
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={1}
            />
          )}

          {/* 손잡이 몸통 */}
          <circle cx={c} cy={c + 1.5} r={bodyR} fill="rgba(0,0,0,0.7)" />
          <circle cx={c} cy={c} r={bodyR} fill={`url(#body-${gid})`} stroke="rgba(0,0,0,0.9)" strokeWidth={1} />
          <circle cx={c} cy={c} r={bodyR - 1.5} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          {/* 옆면 홈 — 값만큼 같이 돈다 */}
          <g
            style={{
              transform: `rotate(${valueAngle}deg)`,
              transformOrigin: `${c}px ${c}px`,
              transition: drag !== null ? "none" : "transform 160ms ease-out",
            }}
          >
            {Array.from({ length: KNURLS }, (_, i) => {
              const [x1, y1] = polar(c, c, bodyR - 3.2, (i / KNURLS) * 360);
              const [x2, y2] = polar(c, c, bodyR - 0.8, (i / KNURLS) * 360);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.13)" strokeWidth={1} />;
            })}
          </g>
          {known && (
            <line
              x1={ix}
              y1={iy}
              x2={px}
              y2={py}
              stroke={drag !== null ? "#fff" : color}
              strokeWidth={2}
              strokeLinecap="round"
              filter={`url(#glow-${gid})`}
            />
          )}
        </svg>
      </div>
      <span
        className={cn(
          "min-w-[44px] rounded border border-black bg-[#07100d] px-1.5 py-0.5 text-center font-orbitron text-[11px] leading-none tabular-nums shadow-[inset_0_1px_4px_rgba(0,0,0,0.9)]",
          known ? "text-white/85" : "text-white/25",
        )}
        style={known ? { color, textShadow: `0 0 6px ${color}99` } : undefined}
      >
        {unlinked ? "N/L" : shown}
      </span>
      {footer}
    </div>
  );
}

/** 켜기/끄기 키 — 실제 콘솔의 불 들어오는 버튼 */
export function LedKey({
  label,
  on,
  color,
  onToggle,
  disabled,
  unlinked,
}: {
  label: string;
  on: boolean | null;
  color: string;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  unlinked?: boolean;
}) {
  const lit = on === true;
  return (
    <button
      type="button"
      disabled={disabled || unlinked}
      aria-pressed={lit}
      onClick={() => onToggle(!lit)}
      title={unlinked ? "콘솔 주소가 아직 연결되지 않았어요" : on == null ? "콘솔에서 아직 값을 받지 못했어요" : undefined}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md border border-black px-2.5 font-orbitron text-[10px] font-semibold tracking-[0.18em] transition-all",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_3px_6px_rgba(0,0,0,0.55)] active:translate-y-px disabled:cursor-not-allowed",
        lit ? "bg-[linear-gradient(180deg,#26313a,#141b21)] text-white" : "bg-[linear-gradient(180deg,#34343a,#202024)] text-white/45",
        (disabled || unlinked) && "opacity-45",
      )}
    >
      <span
        className="h-[6px] w-[6px] rounded-full transition-all"
        style={{ background: lit ? color : "rgba(255,255,255,0.12)", boxShadow: lit ? `0 0 8px 1px ${color}` : "none" }}
        aria-hidden
      />
      {label}
    </button>
  );
}
