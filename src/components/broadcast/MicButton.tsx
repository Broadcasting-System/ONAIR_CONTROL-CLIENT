"use client";

import OnairButton, { type OnairButtonState } from "@/components/common/OnairButton";
import { LevelMeter, fmtClock } from "./parts";

export type MicButtonState = OnairButtonState;

/**
 * 큰 마이크 버튼 — 쉴 때는 ONAIR 로고(반쪽 고리), 방송·녹음 중에는 꽉 찬 고리가 빙글빙글 돈다.
 * waiting(연결·스피커 켜는 중·마치는 중)은 고리가 흐리게 돈다. 모양은 녹음·녹화 버튼과 같은 OnairButton.
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
  return (
    <div className="flex flex-col items-center">
      <OnairButton state={state} label={label} caption={active ? undefined : label} tour="main.mic.button" onPress={onPress} />
      {active && (
        <>
          <p className="mt-4 font-orbitron text-[34px] font-bold leading-none tabular-nums text-[#ff4d55] md:text-[38px]">
            {fmtClock(elapsed)}
          </p>
          <p className="mt-2 font-pretendard text-[14px] font-semibold text-white/70">{label}</p>
          <LevelMeter analyser={analyser} className="mt-3" />
        </>
      )}
    </div>
  );
}
