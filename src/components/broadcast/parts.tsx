"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 폰: 글래스 카드 한 칸 · PC: 큰 카드 안의 맨 구역 */
export function Block({ children, className, tour }: { children: ReactNode; className?: string; tour?: string }) {
  return (
    <div
      data-tour={tour}
      className={cn(
        "flex flex-col gap-4 rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-4 backdrop-blur-md",
        "md:rounded-none md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Label({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mbc text-sm text-white/50">{children}</span>
      {right}
    </div>
  );
}

/** 둘·셋 중 하나 고르기 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
  big,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; tour?: string }[];
  disabled?: boolean;
  big?: boolean;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex rounded-xl border border-white/[0.06] bg-white/[0.06] p-1", className)}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            data-tour={o.tour}
            disabled={disabled && !on}
            onClick={() => !on && onChange(o.value)}
            className={cn(
              "rounded-[9px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              big ? "min-w-[64px] px-4 py-1.5 font-mbc text-[15px]" : "px-4 py-1.5 font-pretendard text-[14px] font-semibold",
              on ? "bg-white/[0.16] text-white shadow-sm" : "text-white/45 hover:text-white/80",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-40 motion-reduce:transition-none",
        checked ? "bg-white" : "bg-white/15",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-6 w-6 rounded-full transition-all motion-reduce:transition-none",
          checked ? "left-[25px] bg-black" : "left-[3px] bg-white",
        )}
      />
    </button>
  );
}

/** 01:24 */
export function fmtClock(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** 시작 시각부터 흐른 시간 (0.25초마다) */
export function useElapsed(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, (now - startedAt) / 1000);
}

/** 마이크 소리 크기 막대 — AnalyserNode 주파수 (말소리 대역, 로그 간격) */
export function LevelMeter({
  analyser,
  bars = 24,
  className,
  barClassName = "bg-[#3ddc84]",
}: {
  analyser: AnalyserNode | null;
  bars?: number;
  className?: string;
  /** 막대 색 (선생님 화면은 흰색) */
  barClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const spans = Array.from(box.children) as HTMLElement[];
    if (!analyser) {
      spans.forEach((s) => (s.style.height = "3px"));
      return;
    }
    const data = new Uint8Array(analyser.frequencyBinCount);
    const hz = analyser.context.sampleRate / analyser.fftSize;
    const lo = Math.log(120);
    const hi = Math.log(6000);
    const edges = Array.from({ length: bars + 1 }, (_, i) => Math.max(1, Math.round(Math.exp(lo + ((hi - lo) * i) / bars) / hz)));
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      for (let i = 0; i < bars; i++) {
        let m = 0;
        for (let j = edges[i]; j <= Math.max(edges[i], edges[i + 1] - 1) && j < data.length; j++) m = Math.max(m, data[j]);
        const v = Math.max(0, (m - 70) / 150);
        spans[i].style.height = `${Math.max(3, Math.round(Math.min(1, v) * 30))}px`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser, bars]);
  return (
    <div ref={ref} aria-hidden className={cn("flex h-[30px] items-end justify-center gap-[4px]", className)}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className={cn("w-[5px] rounded-full", barClassName)} style={{ height: 3 }} />
      ))}
    </div>
  );
}

/** 녹음한 소리 파형 (가운데 대칭 막대) */
export function Waveform({ peaks, className }: { peaks: number[]; className?: string }) {
  return (
    <div aria-hidden className={cn("flex h-[48px] items-center justify-center gap-[3px]", className)}>
      {peaks.map((p, i) => (
        <span key={i} className="w-[3px] rounded-full bg-white/85" style={{ height: `${Math.max(4, Math.round(p * 46))}px` }} />
      ))}
    </div>
  );
}
