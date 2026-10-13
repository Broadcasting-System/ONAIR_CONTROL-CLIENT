"use client";

import SectionHeader from "@/components/common/SectionHeader";
import { SpeakerPanel } from "@/components/speaker/SpeakerPanel";
import { useSpeakers } from "@/hooks/useSpeakers";
import { useMe } from "@/hooks/useMe";

/** 스피커 지도 — 학교 도면 위에서 스피커를 켜고 끈다. 오른쪽은 분류·검색되는 표.
 *  메인 세팅의 스피커 표와 같은 상태를 쓰므로 어느 쪽에서 바꿔도 같이 반영된다. */
export default function SpeakersPage() {
  const { zones, toggleSpeaker } = useSpeakers();
  const { canOperate } = useMe();

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="flex flex-wrap items-center gap-5">
        <SectionHeader className="mb-0">스피커 지도</SectionHeader>
        {!canOperate && (
          <span className="font-pretendard text-[13px] text-white/40" data-tour="speakers.view-only">
            보기 전용
          </span>
        )}
      </header>

      <div className="rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-4 backdrop-blur-md shadow-2xl md:rounded-[24px] md:border-sidebar-border md:bg-sidebar md:p-6">
        <SpeakerPanel
          zones={zones}
          onToggle={toggleSpeaker}
          canOperate={canOperate}
        />
      </div>
    </div>
  );
}
