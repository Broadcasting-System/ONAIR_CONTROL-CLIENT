"use client";

import { useEffect } from "react";
import PageTabs from "@/components/common/PageTabs";
import SectionHeader from "@/components/common/SectionHeader";
import AutoAudioPanel from "@/components/hall/AutoAudioPanel";
import { HallSwitcher, Notice } from "@/components/hall/HallControls";
import MixerPanel from "@/components/hall/MixerPanel";
import { useHalls } from "@/hooks/useHalls";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useTabParam } from "@/hooks/useTabParam";

// 믹서 = 씬·페이더·채널 처리, 자동 음향 = 규칙대로 페이더를 움직이는 기능 (옛 /auto-audio → ?tab=auto)
const AUDIO_TAB_KEYS = ["mixer", "auto"] as const;
const AUDIO_TABS = [
  { key: "mixer" as const, label: "믹서" },
  { key: "auto" as const, label: "자동 음향" },
];

export default function AudioPage() {
  const { halls: allHalls, isLoading: hallsLoading } = useHalls();
  const halls = allHalls.filter((h) => h.hasMixer);
  // 두 탭이 같은 공간을 본다 — 믹서 현장 세팅과도 같은 저장값
  const [hallId, setHallId] = usePersistentState<string | null>("onair.mixer.hall", null);
  const current = halls.find((h) => h.id === hallId) ?? halls[0];
  const [tab, setTab] = useTabParam(AUDIO_TAB_KEYS, "mixer");

  useEffect(() => {
    if (current && current.id !== hallId) setHallId(current.id);
  }, [current, hallId, setHallId]);

  if (!hallsLoading && halls.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader>오디오</SectionHeader>
        <Notice tone="info">오디오 믹서 없음</Notice>
      </div>
    );
  }

  const lead = (
    <>
      <SectionHeader className="mb-0">오디오</SectionHeader>
      <HallSwitcher tour="mixer.hall-select" halls={halls} value={current?.id} onChange={setHallId} />
      <PageTabs tour="mixer.tab" tabs={AUDIO_TABS} value={tab} onChange={setTab} />
    </>
  );

  return tab === "auto" ? (
    <AutoAudioPanel hallId={current?.id ?? null} lead={lead} />
  ) : (
    <MixerPanel hallId={current?.id ?? null} lead={lead} />
  );
}
