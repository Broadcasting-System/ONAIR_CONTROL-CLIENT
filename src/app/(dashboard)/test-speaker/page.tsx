"use client";

import SectionHeader from "@/components/common/SectionHeader";
import LedMeter from "@/components/common/LedMeter";
import { TEST_SPEAKER_LABEL } from "@/constants/testSpeaker";
import { useMe } from "@/hooks/useMe";
import { useTestSpeaker, type TestSpeakerConn, type TestSpeakerPlaying } from "@/hooks/useTestSpeaker";
import { cn } from "@/lib/utils";

const CONN_TEXT: Record<TestSpeakerConn, string> = {
  connecting: "연결하는 중",
  open: "연결됨",
  retry: "다시 연결하는 중",
  denied: "권한이 없어요",
};

const PLAYING_TEXT: Record<TestSpeakerPlaying, string> = {
  idle: "대기",
  clip: "음원 재생 중",
  mic: "마이크 받는 중",
};

function clock(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${Math.floor(d.getMilliseconds() / 100)}`;
}

function TestSpeakerView() {
  const { conn, on, enabled, playing, level, events, enable, disable } = useTestSpeaker();
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader className="mb-0 max-md:mt-1 max-md:text-[26px] max-md:leading-none">{TEST_SPEAKER_LABEL}</SectionHeader>

      <section className="flex max-w-[640px] flex-col gap-6 rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-5 shadow-2xl backdrop-blur-md md:rounded-[24px] md:border-sidebar-border md:bg-sidebar md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "h-[9px] w-[9px] shrink-0 rounded-full",
                  on ? "bg-[#00FF57] shadow-[0_0_7px_#00FF57]" : "bg-[#585858]",
                )}
              />
              <span className="font-orbitron text-[11px] tracking-wider text-white/45">{on ? "ON" : "OFF"}</span>
            </span>
            <span className="mt-1 font-mbc text-[26px] leading-tight text-white">{TEST_SPEAKER_LABEL}</span>
          </div>
          <div className="flex flex-col items-end gap-1 pt-0.5 font-pretendard text-[13px]">
            <span className={conn === "open" ? "text-white/70" : "text-white/40"}>{CONN_TEXT[conn]}</span>
            <span className="text-white/40">{PLAYING_TEXT[playing]}</span>
          </div>
        </div>

        <LedMeter levels={[level]} labels={["", ""]} className="w-full" />

        <button
          type="button"
          onClick={() => void (enabled ? disable() : enable())}
          className={cn(
            "h-12 w-full rounded-xl font-pretendard text-[15px] font-semibold transition-colors md:w-[200px]",
            enabled
              ? "border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/10"
              : "bg-[#FF3B3B] text-white hover:bg-[#ff5252]",
          )}
        >
          {enabled ? "소리 끄기" : "소리 켜기"}
        </button>

        {events.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-white/[0.08] pt-4">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex items-center gap-3 font-pretendard text-[13px]">
                <span className="w-[92px] shrink-0 font-orbitron text-[11px] tabular-nums text-white/35">{clock(e.at)}</span>
                <span className="text-white/70">{e.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** 시험 스피커 — 학교 스피커 대신 이 기기에서 방송 소리를 낸다 (최고 관리자만) */
export default function TestSpeakerPage() {
  const { isSuperadmin, loading } = useMe();
  if (isSuperadmin) return <TestSpeakerView />;
  if (loading) return null;
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader className="mb-0 max-md:mt-1 max-md:text-[26px] max-md:leading-none">{TEST_SPEAKER_LABEL}</SectionHeader>
      <p className="font-pretendard text-white/40">권한이 없어요</p>
    </div>
  );
}
