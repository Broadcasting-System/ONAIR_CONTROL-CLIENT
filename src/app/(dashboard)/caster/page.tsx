"use client";

import { useMemo, useState } from "react";
import SectionHeader from "@/components/common/SectionHeader";
import StatusCard from "@/components/StatusCard";
import { cn } from "@/lib/utils";
import {
  Caster,
  CASTERS,
  groupCastersByCohort,
  casterSubtitle,
} from "@/constants/casters";

export default function CasterPage() {
  const groups = useMemo(() => groupCastersByCohort(), []);
  const [selected, setSelected] = useState<Caster>(
    () => CASTERS.find((c) => c.name === "류승찬") ?? CASTERS[0],
  );

  return (
    // 페이지를 뷰포트 높이에 고정 → 좌/우 각각 독립 스크롤
    <div className="flex h-[calc(100dvh-80px)] w-full gap-14 px-[20px]">
      {/* 좌측: 기수별 부원 목록 (독립 스크롤) */}
      <div className="flex w-[460px] shrink-0 flex-col gap-6 overflow-y-auto pr-2">
        <SectionHeader>방송부</SectionHeader>

        {groups.map((g) => (
          <div key={g.cohort} className="flex flex-col gap-3">
            <h3 className="font-mbc text-lg text-white/90">방송부 {g.cohort}기</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {g.members.map((m) => {
                const active =
                  selected.name === m.name && selected.cohort === m.cohort;
                return (
                  <StatusCard
                    key={`${g.cohort}-${m.name}`}
                    label={m.name}
                    status={m.role === "leader" ? "error" : "good"}
                    text={`${m.cohort}기`}
                    variant="network"
                    labelClassName="text-[30px] text-left pl-1"
                    onClick={() => setSelected(m)}
                    className={cn(
                      "h-[86px] cursor-pointer gap-1 px-5 py-3",
                      active &&
                        "bg-white/10 ring-1 ring-white/30 shadow-[0_0_18px_-6px_rgba(255,255,255,0.3)]",
                    )}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 우측: 선택된 부원 상세 (넓게, 독립 스크롤) */}
      <div className="flex flex-1 flex-col overflow-y-auto pr-4 pt-1">
        <h1 className="font-mbc text-5xl font-bold leading-none text-white">
          {selected.name}
        </h1>
        <p className="mt-4 font-mbc text-xl text-white/70">
          {casterSubtitle(selected)}
        </p>

        <div className="mt-10 max-w-[1000px] whitespace-pre-line font-pretendard text-[18px] leading-relaxed text-white/75">
          {selected.bio ?? "소개를 준비 중입니다."}
        </div>
      </div>
    </div>
  );
}
