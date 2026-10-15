"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface LiveBell {
  time: string;
  label: string;
  /** 울리는 시각 (ms) */
  at: number;
}

interface LiveBellStatusProps {
  /** 울리는 그룹 이름 (없으면 울리는 시보 없음) */
  liveName: string | null;
  next: LiveBell | null;
  /** 그다음 시보 */
  after?: LiveBell | null;
  /** 직전 시보 시각 (ms). 남은 시간 막대의 시작점 */
  prevAt?: number | null;
  special: boolean;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
function left(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

/** 시보 화면 오른쪽 위: 다음 시보까지 남은 시간 + 다음 시보 + 남은 시간 막대 */
export default function LiveBellStatus({ liveName, next, after, prevAt, special, className }: LiveBellStatusProps) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!liveName || !next) {
    return (
      <div data-tour="time.live-badge" className={cn("font-mbc text-[14px] text-white/35", className)}>
        울리는 시보 없음
      </div>
    );
  }

  const t = now ?? next.at;
  const span = prevAt != null ? next.at - prevAt : 0;
  const ratio = span > 0 ? Math.min(1, Math.max(0, (t - prevAt!) / span)) : 0;
  const title = `${liveName} 울리는 중${after ? ` · 그다음 ${after.time} ${after.label}` : ""}`;

  return (
    <div data-tour="time.live-badge" title={title} className={cn("flex min-w-0 items-center gap-3.5", className)}>
      <div className="flex shrink-0 items-baseline gap-1.5">
        <span className="font-orbitron text-[24px] font-bold tabular-nums tracking-[0.02em] text-white md:text-[26px]">
          {now == null ? "--:--" : left(next.at - t)}
        </span>
        <small className="font-mbc text-[13px] text-white/50">뒤</small>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-[7px] font-pretendard text-[13.5px] font-medium text-white/75">
          {special && (
            <span className="shrink-0 self-center rounded-[5px] border border-[#FF3B3B]/50 bg-[#FF3B3B]/10 px-1.5 py-px font-mbc text-[11px] text-[#ff8a8a]">
              특별
            </span>
          )}
          <span className="shrink-0 font-orbitron text-[13px] font-semibold text-white">{next.time}</span>
          <span className="truncate">{next.label}</span>
        </div>
        <div className="mt-[7px] h-[3px] w-[170px] max-w-full overflow-hidden rounded-sm bg-white/10">
          <i className="block h-full bg-[#FF3B3B] transition-[width] duration-1000 ease-linear" style={{ width: `${ratio * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
