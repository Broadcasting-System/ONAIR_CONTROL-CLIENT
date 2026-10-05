"use client";

import { useRef, useState } from "react";
import { Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLOR_PRESETS, type ColorPreset, type Fixture, type LightColor } from "@/types/lighting";

const SEND_INTERVAL_MS = 150;
const KEY_STEP = 5;
const SCALE = [100, 75, 50, 25, 0];
// 밝기만 되는 조명(조광기)의 전구 색
const WARM = "#FFD49A";
const MASTER = "#FF3B3B";

/** 지금 색과 같은 색 버튼 (빨·초·파가 같으면 같은 색으로 본다) */
export function presetOf(color: LightColor | undefined): ColorPreset | null {
  if (!color) return null;
  return (
    COLOR_PRESETS.find((p) => (["r", "g", "b"] as const).every((k) => (p.value[k] ?? 0) === (color[k] ?? 0))) ?? null
  );
}

const hex = (n: number | undefined) => Math.max(0, Math.min(255, n ?? 0)).toString(16).padStart(2, "0");

/** 화면에 보일 조명 색 */
export function lightColor(f: Fixture): string {
  if (!f.hasColor) return WARM;
  const c = f.value.color;
  const preset = presetOf(c);
  if (preset) return preset.swatch;
  return c ? `#${hex(c.r)}${hex(c.g)}${hex(c.b)}` : WARM;
}

/** 실제 콘솔처럼 검은 손잡이 세로 페이더 (0~100%) */
function Fader({
  value,
  color,
  label,
  disabled,
  onChange,
}: {
  value: number;
  color: string;
  label: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lastSent = useRef(0);
  const [drag, setDrag] = useState<number | null>(null);
  const v = drag ?? value;

  const at = (clientY: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return v;
    return Math.round(Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height)) * 100);
  };
  // 끄는 동안은 띄엄띄엄, 놓을 때는 꼭 마지막 값을 보낸다
  const send = (next: number, force = false) => {
    const now = Date.now();
    if (force || now - lastSent.current >= SEND_INTERVAL_MS) {
      lastSent.current = now;
      onChange(next);
    }
  };

  return (
    <div className="flex h-[200px] w-full shrink-0 justify-center gap-[5px]">
      <div className="relative w-4" aria-hidden>
        {SCALE.map((s) => (
          <span
            key={s}
            className="absolute right-0 translate-y-1/2 font-orbitron text-[7px] leading-none tabular-nums text-white/32"
            style={{ bottom: `${s}%` }}
          >
            {s}
          </span>
        ))}
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${label} 밝기`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        aria-disabled={disabled}
        className={cn(
          "relative w-9 touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/30",
          disabled ? "cursor-not-allowed" : "cursor-ns-resize",
        )}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const next = at(e.clientY);
          setDrag(next);
          send(next, true);
        }}
        onPointerMove={(e) => {
          if (drag === null) return;
          const next = at(e.clientY);
          setDrag(next);
          send(next);
        }}
        onPointerUp={(e) => {
          if (drag === null) return;
          const next = at(e.clientY);
          setDrag(null);
          send(next, true);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          const delta = e.key === "ArrowUp" ? KEY_STEP : e.key === "ArrowDown" ? -KEY_STEP : 0;
          if (!delta) return;
          e.preventDefault();
          send(Math.max(0, Math.min(100, v + delta)), true);
        }}
      >
        <div className="absolute inset-y-[-2px] left-1/2 w-1 -translate-x-1/2 rounded-sm bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.06)]" />
        {/* 켜진 만큼 조명 색으로 */}
        <div
          className="absolute bottom-0 left-1/2 w-1 -translate-x-1/2 rounded-sm opacity-75"
          style={{ height: `${v}%`, background: color }}
          aria-hidden
        />
        <div
          className={cn(
            "absolute left-1/2 h-[38px] w-[34px] -translate-x-1/2 translate-y-1/2 rounded border border-black transition-transform",
            "bg-[linear-gradient(180deg,#3a3a3e_0%,#1f1f22_45%,#141416_55%,#2a2a2e_100%)]",
            "shadow-[0_8px_12px_-4px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.2)]",
            drag !== null && "scale-[1.04]",
          )}
          style={{ bottom: `${v}%` }}
        >
          <span className="absolute inset-x-1 top-1/2 h-[2px] -translate-y-1/2 rounded-[1px] bg-[#f2f2f2]" />
        </div>
      </div>
    </div>
  );
}

/** 믹서 SEL·MUT 와 같은 검은 버튼 — 색 LED 점과 색 이름 */
function ColorKeys({
  selected,
  disabled,
  label,
  onPick,
}: {
  selected: ColorPreset | null;
  disabled?: boolean;
  label: string;
  onPick: (p: ColorPreset) => void;
}) {
  return (
    <div className="grid w-full grid-cols-2 gap-1">
      {COLOR_PRESETS.map((p) => {
        const on = selected?.name === p.name;
        return (
          <button
            key={p.name}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            aria-label={`${label} ${p.name}`}
            onClick={() => onPick(p)}
            className={cn(
              "flex h-[22px] items-center gap-[5px] rounded-[5px] border border-black px-[5px] font-pretendard text-[10px] transition-all",
              "bg-[linear-gradient(180deg,#303035,#1e1e22)] active:translate-y-px disabled:cursor-not-allowed",
              on ? "text-white" : "text-white/45 enabled:hover:text-white/80",
            )}
            style={{
              boxShadow: on
                ? `inset 0 0 0 1px ${p.swatch}, 0 3px 6px rgba(0,0,0,0.55)`
                : "inset 0 1px 0 rgba(255,255,255,0.1), 0 3px 6px rgba(0,0,0,0.55)",
            }}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: p.swatch, opacity: on ? 1 : 0.45, boxShadow: on ? `0 0 7px ${p.swatch}` : "none" }}
              aria-hidden
            />
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

function Key({ on, color, disabled, onClick, label }: { on: boolean; color: string; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={on}
      aria-label={`${label} ${on ? "끄기" : "켜기"}`}
      onClick={onClick}
      className={cn(
        "flex h-6 w-full items-center justify-center gap-1 rounded-[5px] border border-black font-orbitron text-[8.5px] tracking-[0.14em] transition-all",
        "bg-[linear-gradient(180deg,#303035,#1e1e22)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_3px_6px_rgba(0,0,0,0.55)]",
        "active:translate-y-px disabled:cursor-not-allowed",
        on ? "text-white" : "text-white/42 enabled:hover:text-white/75",
      )}
    >
      <span
        className="h-[5px] w-[5px] rounded-full"
        style={on ? { background: color, boxShadow: `0 0 8px ${color}` } : { background: "rgba(255,255,255,0.12)" }}
        aria-hidden
      />
      {on ? "ON" : "OFF"}
    </button>
  );
}

/** 값 창 — 콘솔의 작은 숫자 창 */
function ValueWindow({ value, color }: { value: number; color: string }) {
  return (
    <div
      className="min-w-[58px] rounded-[3px] border border-black bg-[#07090b] px-1.5 py-[3px] text-center font-orbitron text-xs leading-none tabular-nums shadow-[inset_0_1px_4px_#000]"
      style={{ color, textShadow: `0 0 6px ${color}b3` }}
    >
      {value}%
    </div>
  );
}

const FRAME =
  "relative flex shrink-0 flex-col items-center gap-2.5 rounded-xl border border-black/80 px-[9px] pb-2.5 pt-3 bg-[linear-gradient(180deg,#141418,#0d0d10)]";

/** 조명 한 줄 — 믹서 채널 띠와 같은 틀. 색 LED 면 색 버튼, 아니면 '밝기만 되는 조명' */
export default function LightStrip({
  fixture,
  master,
  blackout,
  disabled,
  onIntensity,
  onColor,
}: {
  fixture: Fixture;
  master: number;
  blackout: boolean;
  disabled?: boolean;
  onIntensity: (v: number) => void;
  onColor: (c: LightColor) => void;
}) {
  const color = lightColor(fixture);
  const intensity = fixture.value.intensity;
  // 실제로 나가는 밝기 — 전체 밝기·암전까지 반영해 전구 그림에 쓴다
  const out = blackout ? 0 : Math.round((intensity * master) / 100);
  const on = out > 0;

  return (
    <div
      className={cn(FRAME, "w-[108px]")}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.025)" }}
    >
      <span
        className="absolute inset-x-2.5 top-0 h-px"
        style={{ background: `linear-gradient(90deg,${on ? color : "#444"},transparent)` }}
        aria-hidden
      />
      <div className="flex h-3.5 w-full items-center gap-[5px]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <span className="whitespace-nowrap font-orbitron text-[9px] tracking-[0.16em] text-white/60">
          DMX {String(fixture.address).padStart(3, "0")}
        </span>
      </div>

      {/* 전구 — 지금 나가는 색·밝기 */}
      <div className="grid h-[46px] w-[46px] place-items-center rounded-full border border-black bg-[#0a0a0c] shadow-[inset_0_2px_6px_#000]" aria-hidden>
        <span
          className="h-7 w-7 rounded-full transition-all duration-150"
          style={{
            background: `radial-gradient(circle,${color} 0%,${color}cc 45%,transparent 72%)`,
            opacity: 0.12 + (out / 100) * 0.88,
            boxShadow: `0 0 ${out / 3}px ${color}`,
          }}
        />
      </div>

      <Fader value={intensity} color={color} label={fixture.name} disabled={disabled} onChange={onIntensity} />
      <ValueWindow value={intensity} color={color} />

      {fixture.hasColor ? (
        <ColorKeys
          selected={presetOf(fixture.value.color)}
          disabled={disabled}
          label={fixture.name}
          onPick={(p) => onColor(p.value)}
        />
      ) : (
        // 색 버튼 자리 높이를 맞춰 이름 줄이 나란히 오게
        <div className="grid h-[100px] place-items-center text-center font-pretendard text-[11px] leading-snug text-white/30">
          밝기만
          <br />
          되는 조명
        </div>
      )}

      <Key on={intensity > 0} color={color} disabled={disabled} label={fixture.name} onClick={() => onIntensity(intensity > 0 ? 0 : 100)} />
      {/* 이름이 길면 두 줄까지 — 줄마다 높이를 맞춘다 */}
      <span
        className="flex h-9 max-w-full items-center break-keep text-center font-mbc text-[14px] leading-[1.15] text-white"
        title={fixture.name}
      >
        <span className="line-clamp-2">{fixture.name}</span>
      </span>
    </div>
  );
}

/** 맨 끝 '전체' 줄 — 전체 밝기 페이더, 색 LED 전체 색, 암전 */
export function LightMasterStrip({
  master,
  blackout,
  allColor,
  hasColor,
  disabled,
  onMaster,
  onAllColor,
  onBlackout,
}: {
  master: number;
  blackout: boolean;
  allColor: ColorPreset | null;
  hasColor: boolean;
  disabled?: boolean;
  onMaster: (v: number) => void;
  onAllColor: (c: LightColor) => void;
  onBlackout: (on: boolean) => void;
}) {
  return (
    <div
      className={cn(FRAME, "w-[124px]")}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,59,59,0.18)" }}
    >
      <span className="absolute inset-x-2.5 top-0 h-px" style={{ background: `linear-gradient(90deg,${MASTER},transparent)` }} aria-hidden />
      <div className="flex h-3.5 w-full items-center gap-[5px]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: MASTER, boxShadow: `0 0 8px ${MASTER}` }} />
        <span className="font-orbitron text-[9px] tracking-[0.16em] text-white/60">MASTER</span>
      </div>
      <div className="grid h-[46px] place-items-center font-orbitron text-[8px] tracking-[0.2em] text-white/28">ALL</div>

      <Fader value={master} color={MASTER} label="전체" disabled={disabled} onChange={onMaster} />
      <ValueWindow value={master} color={MASTER} />

      {hasColor ? (
        <ColorKeys selected={allColor} disabled={disabled} label="전체" onPick={(p) => onAllColor(p.value)} />
      ) : (
        <div className="h-[100px]" />
      )}

      <button
        type="button"
        disabled={disabled}
        aria-pressed={blackout}
        onClick={() => onBlackout(!blackout)}
        className={cn(
          "flex h-[42px] w-full items-center justify-center gap-1.5 rounded-[10px] border font-mbc text-[15px] transition-all disabled:cursor-not-allowed",
          blackout
            ? "border-[#FF3B3B] bg-[#FF3B3B] text-white shadow-[0_0_24px_rgba(255,59,59,0.55)]"
            : "border-[#FF3B3B]/35 bg-[#FF3B3B]/[0.08] text-[#ff8a8a] enabled:hover:bg-[#FF3B3B]/15",
        )}
      >
        <Power size={15} aria-hidden />
        {blackout ? "암전 중" : "암전"}
      </button>
      <span className="flex h-9 items-center font-mbc text-[14px] leading-tight text-[#ff9a9a]">전체</span>
    </div>
  );
}
