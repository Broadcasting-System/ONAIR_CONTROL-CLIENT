"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * 가로 LED 스테레오 미터 (시안: Desktop/ONAIR-녹음-시안/meter.html 의 M1).
 * L·R 두 줄, 줄마다 28칸. 평소 소리는 흰색, -6dB 부터 분홍, 0dB 근처는 빨강.
 * 최고점은 빨간 테두리 빈 칸으로 1.5초 남았다가 한 칸씩 내려온다. 아래 눈금 -40 -20 -12 -6 -3 0.
 * 값은 dBFS. 하나만 주면(모노) 두 줄에 같은 값을 쓴다.
 */

const SEGMENTS = 28;
// 눈금은 고르게 놓고, 그 사이는 dB 로 곧게 잇는다 (큰 소리 쪽을 넓게)
const SCALE = [-40, -20, -12, -6, -3, 0];
const WARM_DB = -6;
const HOT_DB = -1.5;
const HOLD_MS = 1500;
const FALL_MS = 70;

/** dBFS → 0~1 (눈금 위치) */
export function dbToPos(db: number | null | undefined): number {
  if (db == null || !Number.isFinite(db) || db <= SCALE[0]) return 0;
  if (db >= 0) return 1;
  const n = SCALE.length - 1;
  for (let i = 0; i < n; i++) {
    if (db <= SCALE[i + 1]) return (i + (db - SCALE[i]) / (SCALE[i + 1] - SCALE[i])) / n;
  }
  return 1;
}

/** 0~1 (눈금 위치) → dBFS — 퍼센트로만 레벨을 주는 장비(콘솔 미터 등)를 같은 미터에 올릴 때 */
export function posToDb(pos: number): number {
  const p = Math.max(0, Math.min(1, pos));
  if (p <= 0) return -90;
  const n = SCALE.length - 1;
  const i = Math.min(n - 1, Math.floor(p * n));
  return SCALE[i] + (p * n - i) * (SCALE[i + 1] - SCALE[i]);
}

// 칸 i 가 켜지는 소리 크기 (칸 오른쪽 끝)
const SEG_TOP = Array.from({ length: SEGMENTS }, (_, i) => posToDb((i + 1) / SEGMENTS));
const tone = (i: number) => (SEG_TOP[i] > HOT_DB ? "hot" : SEG_TOP[i] > WARM_DB ? "warm" : "on");
const lit = (db: number | null) => Math.round(dbToPos(db) * SEGMENTS);

const SEG_CLS = {
  off: "bg-white/[0.07]",
  on: "bg-[#f2f2f2] shadow-[0_0_6px_rgba(255,255,255,0.45)]",
  warm: "bg-[#ffb1ac] shadow-[0_0_6px_rgba(255,140,130,0.6)]",
  hot: "bg-[#ff3b3b] shadow-[0_0_8px_#ff3b3b]",
  peak: "bg-transparent shadow-[inset_0_0_0_1.5px_#ff6a62]",
} as const;

type Hold = { seg: number; at: number };

/** 줄마다 최고점 — 1.5초 머물다 한 칸씩 내려온다 */
function usePeakHold(levels: number[]): number[] {
  const holds = useRef<Hold[]>([]);
  const latest = useRef(levels);
  const [, tick] = useState(0);
  const now = Date.now();
  latest.current = levels;
  holds.current = levels.map((n, i) => {
    const h = holds.current[i];
    if (!h || n >= h.seg) return { seg: n, at: now };
    return h;
  });
  useEffect(() => {
    const t = setInterval(() => {
      const t0 = Date.now();
      let changed = false;
      holds.current = holds.current.map((h, i) => {
        if (t0 - h.at < HOLD_MS || h.seg <= (latest.current[i] ?? 0)) return h;
        changed = true;
        return { seg: h.seg - 1, at: t0 - HOLD_MS + FALL_MS };
      });
      if (changed) tick((x) => x + 1);
    }, FALL_MS);
    return () => clearInterval(t);
  }, []);
  return holds.current.map((h) => h.seg);
}

export default function LedMeter({
  levels,
  labels = ["L", "R"],
  className,
  tour,
}: {
  /** 줄마다 dBFS (소리 없음 = null). 하나면 두 줄에 같이 */
  levels: (number | null)[];
  labels?: string[];
  className?: string;
  /** CUE 튜토리얼 이름표 (data-tour) */
  tour?: string;
}) {
  const rows = levels.length === 1 ? [levels[0], levels[0]] : levels.slice(0, 2);
  const segs = rows.map(lit);
  const holds = usePeakHold(segs);
  return (
    <div
      data-tour={tour}
      role="meter"
      aria-label="소리 크기"
      aria-valuemin={-60}
      aria-valuemax={0}
      aria-valuenow={Math.round(Math.max(-60, ...rows.map((d) => d ?? -60)))}
      className={cn("flex w-[300px] flex-col gap-[7px]", className)}
    >
      {segs.map((n, r) => (
        <div key={r} className="flex items-center gap-2">
          <span className="w-2 font-orbitron text-[9px] font-semibold text-white/40">{labels[r] ?? ""}</span>
          <div className="flex flex-1 gap-[2px]">
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <i
                key={i}
                className={cn(
                  "h-2.5 flex-1 rounded-[2px]",
                  SEG_CLS[i < n ? tone(i) : i === holds[r] - 1 && holds[r] > n ? "peak" : "off"],
                )}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-between pl-4 font-orbitron text-[8.5px] font-semibold text-white/30">
        {SCALE.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </div>
  );
}
