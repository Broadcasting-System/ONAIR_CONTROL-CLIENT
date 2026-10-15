"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Popover as P } from "radix-ui";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ONAIR 날짜·시간 고르기 — 브라우저 기본 date/time 칸 대신 쓴다.
 *
 * - DatePicker: 칸을 누르면 달력. 날짜를 누르면 바로 정해지고 닫힌다. min 앞 날짜는 못 고른다.
 * - DatesPicker: 여러 날을 고르는 달력 (누를 때마다 넣고 빼기, [확인]으로 닫기). 칸 모양은 children 으로.
 * - TimePicker: 칸을 누르면 시·분 휠(1분 단위). 굴리거나 누르거나 ↑↓ 로 고르고 [확인].
 * 값은 기본 칸과 같은 글자('YYYY-MM-DD', 'HH:MM')로 주고받는다. 목록은 포털로 띄워 모달 안에서도 위에 뜬다.
 */

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (s?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** 2026-10-15 → 10월 15일 목요일 (올해가 아니면 연도도) */
export function longDate(s?: string): string {
  const d = parseIso(s);
  if (!d) return "";
  const y = d.getFullYear() === new Date().getFullYear() ? "" : `${d.getFullYear()}년 `;
  return `${y}${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}요일`;
}

const fieldBase =
  "inline-flex h-11 w-full min-w-0 items-center gap-2.5 rounded-xl border border-white/10 bg-[#141414] px-4 text-left font-pretendard text-[15px] text-white outline-none transition-colors focus-visible:border-white/30 data-[state=open]:border-white/50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer";

const popBase =
  "z-[900] rounded-[18px] border border-white/[0.12] bg-[#141416] p-4 text-white shadow-[0_24px_60px_rgba(0,0,0,0.65)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]";

function Field({ icon, text, placeholder, className, tour, ariaLabel, invalid, disabled }: {
  icon: ReactNode;
  text: string;
  placeholder: string;
  className?: string;
  tour?: string;
  ariaLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <P.Trigger
      data-tour={tour}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      disabled={disabled}
      className={cn(fieldBase, invalid && "border-red-500/60", className)}
    >
      <span className="shrink-0 text-white/55">{icon}</span>
      <span className={cn("min-w-0 flex-1 truncate tabular-nums", !text && "text-white/35")}>{text || placeholder}</span>
      <ChevronDown size={16} className="shrink-0 text-white/40" />
    </P.Trigger>
  );
}

// ---------------------------------------------------------------- 달력

function Calendar({ selected, min, max, onPick }: {
  selected: string[];
  min?: string;
  max?: string;
  onPick: (iso: string) => void;
}) {
  const first = parseIso(selected[0]) ?? parseIso(min) ?? new Date();
  const [view, setView] = useState({ y: first.getFullYear(), m: first.getMonth() });
  const todayIso = isoOf(new Date());
  const cells = useMemo(() => {
    const start = new Date(view.y, view.m, 1).getDay();
    const days = new Date(view.y, view.m + 1, 0).getDate();
    return [...Array<null>(start).fill(null), ...Array.from({ length: days }, (_, i) => isoOf(new Date(view.y, view.m, i + 1)))];
  }, [view]);
  const move = (dm: number) => setView((v) => {
    const d = new Date(v.y, v.m + dm, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const prevOff = !!min && isoOf(new Date(view.y, view.m, 0)) < min;
  const nextOff = !!max && isoOf(new Date(view.y, view.m + 1, 1)) > max;
  const navCls = "flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-white/10 text-white/70 hover:bg-white/[0.06] disabled:opacity-25 disabled:hover:bg-transparent";
  return (
    <div className="w-[min(322px,calc(100vw-56px))]">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} disabled={prevOff} className={navCls} aria-label="이전 달">
          <ChevronLeft size={17} />
        </button>
        <b className="font-orbitron text-[15px] tracking-[0.12em] tabular-nums">
          {view.y} · {pad(view.m + 1)}
        </b>
        <button type="button" onClick={() => move(1)} disabled={nextOff} className={navCls} aria-label="다음 달">
          <ChevronRight size={17} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DOW.map((w) => (
          <div key={w} className="flex h-[26px] items-center justify-center font-pretendard text-[12.5px] font-bold text-white/40">
            {w}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} />;
          const off = (!!min && iso < min) || (!!max && iso > max);
          const on = selected.includes(iso);
          const today = iso === todayIso;
          return (
            <button
              key={iso}
              type="button"
              disabled={off}
              onClick={() => onPick(iso)}
              aria-pressed={on}
              aria-label={longDate(iso)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-xl font-pretendard text-[15px] font-semibold tabular-nums transition-colors",
                on
                  ? selected.length > 1
                    ? "border border-white/60 bg-white/[0.14] text-white"
                    : "bg-white font-extrabold text-[#0a0a0c]"
                  : "text-white hover:bg-white/[0.07]",
                off && "cursor-default text-white/[0.18] hover:bg-transparent",
              )}
            >
              {Number(iso.slice(8))}
              {today && (
                <span className={cn("absolute bottom-[5px] h-1 w-1 rounded-full", on && selected.length === 1 ? "bg-[#d9201e]" : "bg-[#FF3B3B] shadow-[0_0_6px_#FF3B3B]")} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePicker({ value, onChange, min, max, placeholder = "날짜", className, tour, "aria-label": ariaLabel, disabled }: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  tour?: string;
  "aria-label"?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <Field icon={<CalendarDays size={18} />} text={longDate(value)} placeholder={placeholder} className={className} tour={tour} ariaLabel={ariaLabel ?? "날짜 고르기"} disabled={disabled} />
      <P.Portal>
        <P.Content side="bottom" align="start" sideOffset={8} collisionPadding={12} className={popBase}>
          <Calendar
            selected={value ? [value] : []}
            min={min}
            max={max}
            onPick={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

/** 여러 날 — 누를 때마다 넣고 빼고, 하나는 남긴다 */
export function DatesPicker({ values, onChange, min, max, children }: {
  values: string[];
  onChange: (isos: string[]) => void;
  min?: string;
  max?: string;
  /** 여는 버튼 모양 (button 하나) */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger asChild>{children}</P.Trigger>
      <P.Portal>
        <P.Content side="bottom" align="start" sideOffset={8} collisionPadding={12} className={popBase}>
          <Calendar
            selected={values}
            min={min}
            max={max}
            onPick={(iso) =>
              onChange(values.includes(iso) ? (values.length > 1 ? values.filter((v) => v !== iso) : values) : [...values, iso].sort())
            }
          />
          <button type="button" onClick={() => setOpen(false)} className={cn(okBtn, "mt-3")}>
            확인
          </button>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

// ---------------------------------------------------------------- 시간 휠

const ROW = 44;
const okBtn =
  "flex h-11 w-full items-center justify-center rounded-xl border border-black bg-[linear-gradient(180deg,#ff5a52,#d9201e)] font-pretendard text-[15px] font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_3px_0_#5c0b0b] active:translate-y-0.5";

function Wheel({ count, value, onChange, label }: { count: number; value: number; onChange: (v: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const rolling = useRef(false);
  const [pos, setPos] = useState(value);

  // 바깥에서 값이 바뀌면(처음 열 때 포함) 그 자리로 — 사용자가 굴리는 중이면 건드리지 않는다
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || rolling.current) return;
    if (Math.round(el.scrollTop / ROW) !== value) el.scrollTop = value * ROW;
    setPos(value);
  }, [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const go = (i: number) => {
    const n = Math.max(0, Math.min(count - 1, i));
    ref.current?.scrollTo({ top: n * ROW, behavior: "smooth" });
  };

  // 마우스로 잡고 끌어도 돈다 (폰처럼). 스크롤 칸은 마우스 끌기로는 안 움직여서 직접 옮긴다.
  // 조금이라도 끌어야 잡는다 — 그냥 누르면 숫자 누르기(go)로 간다
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = { y: e.clientY, top: e.currentTarget.scrollTop, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const el = e.currentTarget;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(dy) < 4) return;
      d.moved = true;
      el.style.scrollSnapType = "none";
      el.setPointerCapture(e.pointerId);
    }
    el.scrollTop = d.top - dy;
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    e.currentTarget.style.scrollSnapType = "";
    go(Math.round(e.currentTarget.scrollTop / ROW));
  };
  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`${label}-${value}`}
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop;
        setPos(top / ROW);
        rolling.current = true;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          rolling.current = false;
          const i = Math.max(0, Math.min(count - 1, Math.round(top / ROW)));
          if (i !== value) onChange(i);
        }, 80);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          go(value + (e.key === "ArrowUp" ? -1 : 1));
        }
      }}
      className="relative z-10 h-[220px] w-[84px] cursor-grab select-none snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl py-[88px] outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {Array.from({ length: count }, (_, i) => {
        const dist = Math.abs(i - pos);
        return (
          <button
            key={i}
            id={`${label}-${i}`}
            type="button"
            tabIndex={-1}
            role="option"
            aria-selected={i === value}
            onClick={() => go(i)}
            style={{ opacity: Math.max(0.15, 1 - dist * 0.32) }}
            className="flex h-11 w-full snap-center items-center justify-center font-orbitron text-[21px] tabular-nums text-white"
          >
            {pad(i)}
          </button>
        );
      })}
    </div>
  );
}

const parseTime = (s?: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(s ?? "");
  return m ? { h: Math.min(23, Number(m[1])), m: Math.min(59, Number(m[2])) } : null;
};

export function TimePicker({ value, onChange, placeholder = "시간", className, tour, "aria-label": ariaLabel, invalid, disabled }: {
  value: string;
  onChange: (hhmm: string) => void;
  placeholder?: string;
  className?: string;
  tour?: string;
  "aria-label"?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState({ h: 8, m: 0 });
  const cur = parseTime(value);
  return (
    <P.Root
      open={open}
      onOpenChange={(o) => {
        if (o) setTemp(cur ?? { h: 8, m: 0 });
        setOpen(o);
      }}
    >
      <Field icon={<Clock size={18} />} text={cur ? `${pad(cur.h)}:${pad(cur.m)}` : ""} placeholder={placeholder} className={className} tour={tour} ariaLabel={ariaLabel ?? "시간 고르기"} invalid={invalid} disabled={disabled} />
      <P.Portal>
        <P.Content side="bottom" align="start" sideOffset={8} collisionPadding={12} className={cn(popBase, "w-[248px]")}>
          <div className="relative flex items-center justify-center gap-1.5">
            <div className="pointer-events-none absolute inset-x-0 top-[88px] h-11 rounded-xl border border-white/[0.14] bg-white/[0.08]" />
            <Wheel count={24} value={temp.h} onChange={(h) => setTemp((t) => ({ ...t, h }))} label="시" />
            <span className="relative z-10 font-orbitron text-[22px] text-white/70">:</span>
            <Wheel count={60} value={temp.m} onChange={(m) => setTemp((t) => ({ ...t, m }))} label="분" />
          </div>
          <button
            type="button"
            className={cn(okBtn, "mt-3")}
            onClick={() => {
              onChange(`${pad(temp.h)}:${pad(temp.m)}`);
              setOpen(false);
            }}
          >
            확인
          </button>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

/** 타이머 길이 — 시·분·초 휠 (칸 안에 바로 펼쳐 둔다). value·onChange 는 초 */
export function DurationWheel({ value, onChange, maxHours = 23, className }: {
  value: number;
  onChange: (sec: number) => void;
  maxHours?: number;
  className?: string;
}) {
  const v = Math.max(0, Math.floor(value));
  const h = Math.min(maxHours, Math.floor(v / 3600));
  const m = Math.floor((v % 3600) / 60);
  const s = v % 60;
  const set = (nh: number, nm: number, ns: number) => onChange(nh * 3600 + nm * 60 + ns);
  const col = (label: string, node: ReactNode) => (
    <div className="flex flex-col items-center gap-1">
      {node}
      <span className="font-mbc text-[12px] text-white/40">{label}</span>
    </div>
  );
  return (
    <div className={cn("relative flex items-start justify-center gap-1.5 rounded-2xl border border-white/10 bg-[#0c0d0f] px-3 pt-1 pb-2 shadow-[inset_0_2px_8px_rgba(0,0,0,0.7)]", className)}>
      <div className="pointer-events-none absolute inset-x-3 top-[92px] h-11 rounded-xl border border-white/[0.14] bg-white/[0.08]" />
      {col("시간", <Wheel count={maxHours + 1} value={h} onChange={(x) => set(x, m, s)} label="시간" />)}
      <span className="relative z-10 mt-[96px] font-orbitron text-[22px] text-white/60">:</span>
      {col("분", <Wheel count={60} value={m} onChange={(x) => set(h, x, s)} label="분" />)}
      <span className="relative z-10 mt-[96px] font-orbitron text-[22px] text-white/60">:</span>
      {col("초", <Wheel count={60} value={s} onChange={(x) => set(h, m, x)} label="초" />)}
    </div>
  );
}
