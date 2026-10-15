"use client";

import type { ReactNode } from "react";
import CueRing from "@/components/common/CueRing";
import OnairMark from "@/components/common/OnairMark";
import { cn } from "@/lib/utils";

export type OnairButtonState = "idle" | "waiting" | "active" | "disabled";
export type OnairButtonSize = "lg" | "md";

// lg = 메인 마이크 방송 · md = 녹음·녹화 데크
const SIZE: Record<OnairButtonSize, { box: string; mark: number; markCls: string }> = {
  lg: { box: "h-[150px] w-[150px] md:h-[170px] md:w-[170px]", mark: 104, markCls: "md:h-[118px] md:w-[118px]" },
  md: { box: "h-[96px] w-[96px] md:h-[130px] md:w-[130px]", mark: 66, markCls: "md:h-[92px] md:w-[92px]" },
};

/**
 * ONAIR 로고 버튼 — 마이크 방송과 녹음·녹화가 같이 쓴다.
 * 쉴 때는 ONAIR 로고(반쪽 고리), 켜진 동안(active)은 꽉 찬 고리가 빙글빙글 돌고 빨간 빛.
 * waiting(연결·시작·마치는 중)은 고리가 흐리게 돈다. 끝나면 다시 로고.
 * caption 을 주면 버튼 아래에 같은 글씨로 보여 준다 (켜진 동안은 빨갛게).
 */
export default function OnairButton({
  state,
  label,
  caption,
  size = "lg",
  tour,
  onPress,
}: {
  state: OnairButtonState;
  /** 화면 읽기 프로그램용 이름 */
  label: string;
  caption?: ReactNode;
  size?: OnairButtonSize;
  /** CUE 튜토리얼 이름표 (data-tour) */
  tour?: string;
  onPress: () => void;
}) {
  const active = state === "active";
  const ring = active || state === "waiting";
  const s = SIZE[size];
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        data-tour={tour}
        aria-pressed={active}
        aria-label={label}
        disabled={state === "disabled"}
        onClick={onPress}
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full border",
          s.box,
          "bg-[radial-gradient(circle_at_50%_40%,#26262a_0%,#18181b_70%)] transition-[border-color,box-shadow] duration-300 motion-reduce:transition-none",
          active
            ? "border-[#e5484d]/80 shadow-[0_0_44px_-2px_rgba(229,72,77,0.6),inset_0_0_24px_-12px_rgba(229,72,77,0.6)]"
            : "border-white/15 hover:border-white/30",
          state === "disabled" && "cursor-not-allowed opacity-45 hover:border-white/15",
        )}
      >
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center text-[#e5484d] transition-all duration-500 ease-out motion-reduce:transition-none",
            ring ? "scale-75 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
          )}
        >
          <OnairMark size={s.mark} className={s.markCls} />
        </span>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center text-[#e5484d] transition-all duration-500 ease-out motion-reduce:transition-none",
            ring ? "scale-100" : "scale-50 opacity-0",
            state === "waiting" && "opacity-40",
          )}
        >
          {ring && <CueRing size={s.mark} className={s.markCls} />}
        </span>
      </button>
      {caption != null && (
        <p
          className={cn(
            "font-pretendard font-semibold",
            size === "lg" ? "mt-4 text-[15px]" : "mt-2.5 max-w-[150px] text-center text-[13px] leading-snug",
            active ? "text-[#ff8a8a]" : "text-white/75",
          )}
        >
          {caption}
        </p>
      )}
    </div>
  );
}
