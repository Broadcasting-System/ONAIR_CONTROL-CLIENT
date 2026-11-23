"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 공고·지원서·내 지원이 같이 쓰는 무대 — 소리 워프, 빨간 지평선, 위 줄, 큰 지원 버튼 (시안 HeroD1·RecruitPage) */

type Pt = { style: CSSProperties };

function particles(count: number, soft: boolean): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i * 137.5) % 360;
    const len = 30 + ((i * 53) % (soft ? 80 : 90));
    const dur = soft ? 1.6 + ((i * 29) % 17) / 8 : 1.1 + ((i * 29) % 17) / 10;
    const del = soft ? -((i * 37) % 23) / 8 : -((i * 37) % 23) / 10;
    const red = i % 9 === 0;
    const bg = red
      ? "#FF3B3B"
      : soft
        ? "rgba(255,255,255,.5)"
        : `rgba(255,255,255,${(0.35 + ((i * 7) % 6) / 10).toFixed(2)})`;
    out.push({
      style: {
        "--a": `${a.toFixed(1)}deg`,
        width: len,
        background: bg,
        animationDuration: `${dur.toFixed(2)}s`,
        animationDelay: `${del.toFixed(2)}s`,
      } as CSSProperties,
    });
  }
  return out;
}

/** 가운데에서 바깥으로 빛줄기. soft = 지원서·내 지원 뒤 흐린 워프 */
export function Warp({
  soft,
  core,
  className,
  style,
}: {
  soft?: boolean;
  core?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const pts = useMemo(() => particles(soft ? 70 : 140, !!soft), [soft]);
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute left-1/2 top-1/2 h-0 w-0", className)}
      style={style}
    >
      {pts.map((p, i) => (
        <div key={i} className={cn("rc-pt", soft && "soft")} style={p.style} />
      ))}
      {core && (
        <div className="rc-core absolute -left-[7px] -top-[7px] h-[14px] w-[14px] rounded-full bg-[#FF3B3B] shadow-[0_0_30px_10px_rgba(255,59,59,0.6)]" />
      )}
    </div>
  );
}

/** 빨간 지평선 — 아주 큰 검은 원의 윗선. top 은 화면 위에서의 px */
export function Horizon({
  top,
  dim,
  inner,
  animate,
  className,
}: {
  top: number | string;
  dim?: boolean;
  inner?: boolean;
  animate?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-1/2 -ml-[1300px] h-[2600px] w-[2600px] rounded-full bg-black",
        className,
      )}
      style={{
        top,
        boxShadow: `0 -2px 0 rgba(255,59,59,${dim ? 0.3 : 0.9}),0 -30px 120px rgba(255,59,59,${dim ? 0.1 : 0.45})${inner ? ",inset 0 30px 80px rgba(255,59,59,.18)" : ""}`,
        transition: animate ? "top .9s cubic-bezier(.2,.8,.2,1), box-shadow .9s" : undefined,
      }}
    />
  );
}

/** 위 줄 — ONAIR · 가운데 제목 · 오른쪽 계정 */
export function PublicTop({
  center,
  right,
  className,
}: {
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "absolute inset-x-0 top-0 z-[5] flex h-[72px] items-center justify-between gap-4 border-b border-white/[0.08] bg-black/60 px-5 md:px-14",
        className,
      )}
    >
      <a
        href="/recruit"
        className="font-orbitron text-[16px] font-bold tracking-[0.22em] text-white"
      >
        ONAIR
      </a>
      {center && (
        <span className="truncate font-pretendard text-[15px] font-bold md:text-[17px]">
          {center}
        </span>
      )}
      <span className="hidden truncate font-pretendard text-[15px] text-white/50 tabular-nums sm:block">
        {right}
      </span>
    </header>
  );
}

export const EYEBROW = "font-orbitron text-[13px] tracking-[0.3em] text-[#FF3B3B]";
export const STAGE_H =
  "m-0 text-center font-mbc text-[36px] font-normal leading-[1.2] md:text-[56px]";
