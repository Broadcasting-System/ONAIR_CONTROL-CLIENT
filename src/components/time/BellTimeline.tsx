"use client";

import { useEffect, useMemo, useRef } from "react";
import { MonitorOff, Plus, Router } from "lucide-react";
import { Bell } from "@/types/time";
import { cn } from "@/lib/utils";
import NeonButton from "@/components/common/NeonButton";
import EmptyState from "@/components/common/EmptyState";
import { sortBells, summarizeSpeakers, type SpeakerSection } from "./bellUtils";
import { deviceGroupName, hasPcBackup } from "@/constants/deviceBell";
import { useDeviceBell } from "@/hooks/useDeviceBell";

interface BellTimelineProps {
  bells: Bell[];
  selectedId: string | null;
  /** 안 보낸 변경이 있는 시보 id */
  changed: Set<string>;
  sections: SpeakerSection[];
  /** 지금 시각 'HH:MM' — 오늘 요일을 볼 때만 준다 */
  nowHM: string | null;
  /** 이 값이 바뀌면 지금 시각 쪽으로 굴린다 (그룹·요일) */
  scrollKey: string;
  adding: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  className?: string;
}

function NowLine({ hm }: { hm: string }) {
  return (
    <div data-now className="ml-2 grid h-[18px] grid-cols-[64px_14px_1fr] items-center md:grid-cols-[74px_14px_1fr]">
      <span className="pr-0.5 text-right font-orbitron text-[11px] font-bold text-[#FF3B3B]">{hm}</span>
      <i className="relative z-[1] h-[7px] w-[7px] justify-self-center rounded-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" />
      <em className="ml-1.5 h-[1.5px] bg-[linear-gradient(90deg,#FF3B3B,rgba(255,59,59,0))]" />
    </div>
  );
}

/** 하루 흐름 — 시간순 시보 목록. 오늘이면 지금 시각에 빨간 선, 지난 시보는 흐리게. */
export default function BellTimeline({
  bells,
  selectedId,
  changed,
  sections,
  nowHM,
  scrollKey,
  adding,
  onSelect,
  onAdd,
  className,
}: BellTimelineProps) {
  const rows = useMemo(() => sortBells(bells), [bells]);
  const deviceGroups = useDeviceBell().info.groups;
  const scrollRef = useRef<HTMLDivElement>(null);
  const nowAt = nowHM == null ? -2 : rows.findIndex((b) => b.time > nowHM);
  const hasRows = rows.length > 0;

  // 그룹·요일을 바꾸면 지금 시각이 보이게 (목록이 따로 굴러갈 때만)
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || box.scrollHeight <= box.clientHeight) return;
    const el = box.querySelector<HTMLElement>("[data-now]");
    box.scrollTop = el ? Math.max(0, el.offsetTop - box.clientHeight / 3) : 0;
  }, [scrollKey, hasRows]);

  return (
    <div className={cn("relative flex min-h-0 flex-col rounded-[20px] border border-white/[0.08] bg-[rgba(8,8,10,0.55)]", className)}>
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto pb-[64px] pr-2 pt-2.5 [scrollbar-width:thin]">
        {rows.length === 0 ? (
          <EmptyState>이 요일은 시보가 없어요</EmptyState>
        ) : (
          <div data-tour="time.bells" className="relative">
            <span className="pointer-events-none absolute bottom-[22px] left-[78px] top-[22px] w-[2px] bg-white/[0.08] md:left-[88px]" />
            {rows.map((b, i) => {
              const sel = b.id === selectedId;
              const past = !sel && nowHM != null && b.time <= nowHM;
              const place = summarizeSpeakers(b.speakers, sections);
              const vol = b.volume ?? 100;
              const device = b.ringBy === "device";
              return (
                <div key={b.id}>
                    {i === nowAt && <NowLine hm={nowHM!} />}
                    <button
                      type="button"
                      onClick={() => onSelect(b.id)}
                      aria-pressed={sel}
                      className={cn(
                        "ml-2 grid h-12 w-[calc(100%-8px)] grid-cols-[64px_14px_minmax(0,1fr)_auto] items-center rounded-xl pr-3 text-left transition-colors md:h-11 md:grid-cols-[74px_14px_minmax(0,1fr)_auto] md:pr-3.5",
                        sel ? "bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]" : "hover:bg-white/[0.03]",
                      )}
                    >
                      <span
                        className={cn(
                          "pr-0.5 text-right font-orbitron text-[14px] font-semibold tabular-nums md:text-[15px]",
                          past ? "text-white/[0.38]" : "text-white/85",
                        )}
                      >
                        {b.time}
                      </span>
                      <span
                        className={cn(
                          "relative z-[1] h-[9px] w-[9px] justify-self-center rounded-full border-2",
                          sel ? "border-white bg-white" : "border-white/35 bg-[#0e0e11]",
                        )}
                      />
                      <span
                        className={cn(
                          "flex min-w-0 items-center gap-2 pl-3 font-pretendard text-[14.5px] font-semibold md:pl-3.5",
                          past ? "text-white/[0.38]" : "text-white",
                        )}
                      >
                        <span className="truncate">{b.label}</span>
                        {changed.has(b.id) && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#ff8080]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B3B]" />
                            바뀜
                          </span>
                        )}
                      </span>
                      <span className="flex min-w-0 items-center justify-end gap-2 pl-2">
                        {device ? (
                          <span
                            title="장비"
                            className={cn(
                              "inline-flex items-center gap-1.5 whitespace-nowrap font-pretendard text-[12px] font-medium",
                              past ? "text-white/30" : "text-white/45",
                            )}
                          >
                            <Router size={13} strokeWidth={2} className="shrink-0" aria-label="장비" />
                            {deviceGroupName(deviceGroups, b.deviceGroup)}
                            {!hasPcBackup(b) && (
                              <span title="PC로 대신 못 울려요" className="ml-0.5 inline-flex shrink-0 text-white/30">
                                <MonitorOff size={12} strokeWidth={2} aria-label="PC로 대신 못 울려요" />
                              </span>
                            )}
                          </span>
                        ) : (
                        <>
                        {vol !== 100 && (
                          <span className="shrink-0 font-orbitron text-[11px] font-semibold text-white/45">{vol}%</span>
                        )}
                        {place.all ? (
                          <span className="whitespace-nowrap font-pretendard text-[12px] font-medium text-white/40">{place.text}</span>
                        ) : (
                          <span
                            title={place.text}
                            className={cn(
                              "inline-flex h-[22px] max-w-[120px] items-center truncate rounded-md border px-2 font-pretendard text-[12px] font-medium md:max-w-[180px]",
                              place.none ? "border-dashed border-white/15 text-white/35" : "border-white/[0.14] text-white/70",
                            )}
                          >
                            <span className="truncate">{place.text}</span>
                          </span>
                        )}
                        </>
                        )}
                      </span>
                    </button>
                </div>
              );
            })}
            {nowAt === -1 && <NowLine hm={nowHM!} />}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 rounded-b-[20px] bg-[linear-gradient(transparent,rgba(14,14,17,0.95))]" />
      <NeonButton
        tone="white"
        data-tour="time.add"
        aria-pressed={adding}
        onClick={onAdd}
        icon={<Plus strokeWidth={2.4} />}
        className="absolute bottom-3 left-1/2 h-10 -translate-x-1/2 md:h-[38px]"
      >
        시보 추가
      </NeonButton>
    </div>
  );
}
