"use client";

import CueRing from "@/components/common/CueRing";
import OnairMark from "@/components/common/OnairMark";
import { cn } from "@/lib/utils";
import { LevelMeter, fmtClock } from "./parts";

export type MicButtonState = "idle" | "waiting" | "active" | "disabled";

/**
 * 큰 마이크 버튼 — 쉴 때는 ONAIR 로고(반쪽 고리), 방송·녹음 중에는 꽉 찬 고리가 빙글빙글 돈다.
 * waiting(연결·스피커 켜는 중·마치는 중)은 고리가 흐리게 돈다.
 */
export default function MicButton({
  state,
  label,
  elapsed,
  analyser,
  onPress,
}: {
  state: MicButtonState;
  label: string;
  elapsed: number;
  analyser: AnalyserNode | null;
  onPress: () => void;
}) {
  const active = state === "active";
  const ring = active || state === "waiting";
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        data-tour="main.mic.button"
        aria-pressed={active}
        aria-label={label}
        disabled={state === "disabled"}
        onClick={onPress}
        className={cn(
          "relative flex h-[150px] w-[150px] items-center justify-center rounded-full border md:h-[170px] md:w-[170px]",
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
          <OnairMark size={104} className="md:h-[118px] md:w-[118px]" />
        </span>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center text-[#e5484d] transition-all duration-500 ease-out motion-reduce:transition-none",
            ring ? "scale-100" : "scale-50 opacity-0",
            state === "waiting" && "opacity-40",
          )}
        >
          {ring && <CueRing size={104} className="md:h-[118px] md:w-[118px]" />}
        </span>
      </button>

      {active ? (
        <>
          <p className="mt-4 font-orbitron text-[34px] font-bold leading-none tabular-nums text-[#ff4d55] md:text-[38px]">
            {fmtClock(elapsed)}
          </p>
          <p className="mt-2 font-pretendard text-[14px] font-semibold text-white/70">{label}</p>
          <LevelMeter analyser={analyser} className="mt-3" />
        </>
      ) : (
        <p className="mt-4 font-pretendard text-[15px] font-semibold text-white/75">{label}</p>
      )}
    </div>
  );
}
