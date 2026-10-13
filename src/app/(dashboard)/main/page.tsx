"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import StatusCard from "@/components/StatusCard";
import SectionHeader from "@/components/common/SectionHeader";

import { useSpeakers } from "@/hooks/useSpeakers";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useHallsStatus } from "@/hooks/useHalls";
import { useMe } from "@/hooks/useMe";
import { DisplayMirror } from "@/components/display/DisplayMirror";
import BroadcastCard from "@/components/broadcast/BroadcastCard";

export default function MainPage() {
  const { zones, toggleSpeaker } = useSpeakers();
  const { statuses } = useNetworkStatus();
  const { summary: hallSummary, isError: hallError } = useHallsStatus();
  const { canOperate } = useMe();
  const router = useRouter();

  // 강당·홀 장비(믹서·매트릭스) 연결 요약 — 장비가 설정된 학교에서만 보인다
  const hallCard = hallError
    ? { status: "critical" as const, text: "ERROR" }
    : hallSummary && hallSummary.total > 0
      ? {
          status:
            hallSummary.connected === hallSummary.total
              ? ("good" as const)
              : hallSummary.connected > 0
                ? ("caution" as const)
                : ("critical" as const),
          text: `${hallSummary.connected}/${hallSummary.total}`,
        }
      : null;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-16 md:h-full">
      <div className="flex flex-col gap-6 md:col-span-5 md:gap-10 md:h-full">
        <BroadcastCard />

        <section className="flex-1 flex flex-col" data-tour="main.monitor">
          <SectionHeader>방송 모니터링</SectionHeader>
          <div className="flex-1 flex flex-col gap-6 rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-4 backdrop-blur-md shadow-2xl md:rounded-[24px] md:border-sidebar-border md:bg-sidebar md:p-8">
            <div className="aspect-video w-full rounded-xl bg-black flex items-center justify-center border border-white/10 relative overflow-hidden shadow-inner">
              <div className="absolute inset-0 bg-gradient-to-t from-red-900/10 to-transparent" />
              <DisplayMirror />
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%] pointer-events-none" />
            </div>
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-6 md:col-span-7 md:gap-14 md:h-full">
        <section data-tour="main.network">
          <SectionHeader>네트워크 상태</SectionHeader>
          <div className="rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-4 backdrop-blur-md shadow-2xl md:rounded-[24px] md:border-sidebar-border md:bg-sidebar bg-gradient-to-br from-white/5 to-transparent md:p-8">
            <div className="grid grid-cols-2 gap-3 md:gap-8">
              {statuses.map((item) => (
                <StatusCard key={item.label} label={item.label} status={item.status} variant="network" labelClassName="text-[28px] md:text-[40px]" />
              ))}
              {hallCard && (
                <StatusCard
                  label="강당·홀"
                  status={hallCard.status}
                  text={hallCard.text}
                  variant="network"
                  labelClassName="text-[28px] md:text-[40px]"
                  onClick={() => router.push("/mixer")}
                />
              )}
            </div>
          </div>
        </section>

        <section className="flex-1 flex flex-col" data-tour="main.speakers">
          <div className="flex items-center justify-between">
            <SectionHeader>스피커 관리</SectionHeader>
            {/* 지도·분류 표는 '스피커 지도' 페이지에 따로 있다 */}
            <Link
              href="/speakers"
              data-tour="main.speaker-map-link"
              className="mb-4 rounded-lg bg-white/5 px-4 py-3 font-mbc md:py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              지도로 보기 →
            </Link>
          </div>
          <div className="flex-1 flex flex-col rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-4 backdrop-blur-md shadow-2xl md:rounded-[24px] md:border-sidebar-border md:bg-sidebar md:p-6">
            <div className="min-h-0 flex-1">
              <div className="grid grid-cols-3 gap-2 md:grid-cols-5 md:gap-4" data-tour="main.speaker-list">
                {zones.map((zone) => (
                  <StatusCard
                    key={zone.id}
                    label={zone.name}
                    status={zone.status}
                    variant="speaker"
                    labelClassName="text-[18px] md:text-[22px]"
                    onClick={canOperate ? () => toggleSpeaker(zone.id) : undefined}
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-center md:gap-12">
              <div className="min-w-0 flex-1 md:w-[360px] md:min-w-[auto] md:flex-initial">
                <Button
                  label="전체"
                  onClick={() => toggleSpeaker("all")}
                  disabled={!canOperate}
                  className="h-[64px]"
                  tour="main.speaker-all"
                />
              </div>
              <div className="min-w-0 flex-1 md:w-[360px] md:min-w-[auto] md:flex-initial">
                <Button
                  label="학년 전체"
                  color="#1e3a8a"
                  onClick={() => toggleSpeaker("grade")}
                  disabled={!canOperate}
                  className="h-[64px]"
                  tour="main.speaker-grade"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
