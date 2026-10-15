"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import NeonButton from "@/components/common/NeonButton";
import StatusCard from "@/components/StatusCard";
import SectionHeader from "@/components/common/SectionHeader";

import { useSpeakers } from "@/hooks/useSpeakers";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { cn } from "@/lib/utils";
import { useHallsStatus } from "@/hooks/useHalls";
import { showLabel, useShowing } from "@/hooks/useShowing";
import { useMe } from "@/hooks/useMe";
import { DisplayMirror } from "@/components/display/DisplayMirror";
import BroadcastCard from "@/components/broadcast/BroadcastCard";

export default function MainPage() {
  const { zones, toggleSpeaker } = useSpeakers();
  const { summary: hallSummary, isError: hallError } = useHallsStatus();
  const { canOperate } = useMe();
  const router = useRouter();

  const net = useNetworkStatus();
  const showing = useShowing();

  // 네트워크 상태 카드 4개 — 위에 작은 이름, 아래 큰 값. 문제 있는 것만 빨강
  const speakerCard: NetItem = net.isError
    ? { name: "스피커 장비", value: "연결 안 됨", bad: true }
    : !net.data
      ? { name: "스피커 장비", value: "확인 중" }
      : net.data.speaker_controller === "online"
        ? { name: "스피커 장비", value: "연결됨" }
        : { name: "스피커 장비", value: "연결 안 됨", bad: true };

  const live = showing.data ?? [];
  const displayCard: NetItem = showing.failed
    ? { name: "송출 화면", value: "확인 안 됨", bad: true }
    : showing.isLoading
      ? { name: "송출 화면", value: "확인 중" }
      : live.length === 0
        ? { name: "송출 화면", value: "대기 중" }
        : live.length === 1
          ? { name: "송출 화면", value: `CH${live[0].ch} ${showLabel(live[0].type)}` }
          : {
              name: "송출 화면",
              value: `CH${live.map((s) => s.ch).join("·")} 송출 중`,
              title: live.map((s) => `CH${s.ch} ${showLabel(s.type)}`).join(" · "),
            };

  const ms = net.data ? Math.round(net.data.latency) : null;
  const latencyCard: NetItem = net.isError || ms === null
    ? { name: "응답 시간", value: net.isError ? "응답 없음" : "확인 중", bad: net.isError }
    : ms < 100
      ? { name: "응답 시간", value: `빠름 · ${ms}ms` }
      : ms < 300
        ? { name: "응답 시간", value: `보통 · ${ms}ms` }
        : { name: "응답 시간", value: `느림 · ${ms}ms`, bad: true };

  // 강당·홀 장비(믹서·매트릭스) 연결 요약 — 장비가 설정된 학교에서만 보인다
  const hallCard: NetItem | null = hallError
    ? { name: "강당·홀", value: "확인 안 됨", bad: true }
    : hallSummary && hallSummary.total > 0
      ? hallSummary.connected === hallSummary.total
        ? { name: "강당·홀", value: `${hallSummary.total}곳 연결` }
        : hallSummary.connected > 0
          ? { name: "강당·홀", value: `${hallSummary.connected}/${hallSummary.total}곳 연결`, bad: true }
          : { name: "강당·홀", value: "연결 안 됨", bad: true }
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
              <NetCard item={speakerCard} />
              <NetCard item={displayCard} />
              <NetCard item={latencyCard} />
              {hallCard && <NetCard item={hallCard} onClick={() => router.push("/mixer")} />}
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
                <NeonButton tone="white" size="lg" onClick={() => toggleSpeaker("all")} disabled={!canOperate} className="w-full" data-tour="main.speaker-all">
                  전체
                </NeonButton>
              </div>
              <div className="min-w-0 flex-1 md:w-[360px] md:min-w-[auto] md:flex-initial">
                <NeonButton tone="white" size="lg" onClick={() => toggleSpeaker("grade")} disabled={!canOperate} className="w-full" data-tour="main.speaker-grade">
                  학년 전체
                </NeonButton>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

type NetItem = { name: string; value: string; bad?: boolean; title?: string };

/** 네트워크 상태 카드 — 위에 작은 이름(점), 아래 큰 값. 문제 있으면 빨강, 아니면 흰 점 */
function NetCard({ item, onClick }: { item: NetItem; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      title={item.title}
      className={cn(
        "flex h-[92px] flex-col justify-between rounded-[8px] bg-black/40 px-[7px] py-[4px] transition-all md:px-3 md:py-2",
        onClick && "cursor-pointer hover:bg-white/10",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-[13px] w-[13px] shrink-0 rounded-full md:h-[15px] md:w-[15px]",
            item.bad ? "bg-[#FF3B3B] shadow-[0_0_10px_#FF3B3B]" : "bg-white shadow-[0_0_8px_rgba(255,255,255,0.55)]",
          )}
        />
        <span className="truncate font-pretendard text-[13px] font-medium leading-none text-white/70 md:text-[16px]">{item.name}</span>
      </div>
      <div
        className={cn(
          "w-full truncate pb-1 text-center font-wooju text-[20px] leading-none md:text-[34px]",
          item.bad ? "text-[#ff8a84]" : "text-white",
        )}
      >
        {item.value}
      </div>
    </div>
  );
}
