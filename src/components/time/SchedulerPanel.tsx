"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiBase } from "@/lib/apiBase";
import { cn } from "@/lib/utils";

interface SchedulerJob {
  id: string;
  group: string;
  dayType: string;
  dayLabel: string;
  label: string;
  time: string;
  speakers: string[];
  nextRun: string | null;
}

interface SchedulerStatus {
  activeGroupId: string | null;
  /** 붙인 그룹 이름 (없거나 서버가 아직 안 주면 GROUP n) */
  activeGroupName?: string | null;
  jobs: SchedulerJob[];
}

// 스피커 목록을 사람이 읽기 좋게 요약
function summarizeSpeakers(speakers: string[]): string {
  if (!speakers || speakers.length === 0) return "-";
  if (speakers.includes("전체") || speakers.includes("학교 전체")) return "학교 전체";
  if (speakers.length > 4) return `${speakers.slice(0, 4).join(", ")} 외 ${speakers.length - 4}`;
  return speakers.join(", ");
}

/** 스케줄러에 실제로 등록된 시보 (관리자 전용, 시보 설정의 '예약 현황' 탭) */
export default function SchedulerPanel() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [denied, setDenied] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/time/scheduler`);
      if (res.status === 403) {
        setDenied(true);
        return;
      }
      if (res.ok) {
        setStatus((await res.json()) as SchedulerStatus);
        setDenied(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  if (denied) {
    return <p className="font-pretendard text-white/40">권한이 없어요</p>;
  }

  const jobs = status?.jobs ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-center gap-6 md:justify-end">
        <div data-tour="schedule.live-group" className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2">
          <span className="font-mbc text-xs text-white/40">현재 송출 그룹</span>
          {status?.activeGroupId ? (
            <span className="flex items-center gap-2 font-mbc text-sm text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B3B] shadow-[0_0_6px_#FF3B3B]" />
              {status.activeGroupName?.trim() || `GROUP ${status.activeGroupId}`}
            </span>
          ) : (
            <span className="font-mbc text-sm text-white/40">없음</span>
          )}
        </div>
      </div>

      <div data-tour="schedule.table" className="flex-1 overflow-auto rounded-[20px] border border-white/[0.09] bg-white/[0.03] md:rounded-2xl md:border-white/5 md:bg-[#0a0a0a]">
        {/* 폰 — 표 대신 한 줄씩 */}
        <div className="divide-y divide-white/[0.06] font-pretendard md:hidden">
          {jobs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-white/30">시보가 없어요</p>
          ) : (
            jobs.map((j) => (
              <div key={j.id} className="flex items-start gap-3 px-4 py-3">
                <span className="w-[52px] shrink-0 font-orbitron text-base text-white">{j.time || "--:--"}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 font-mbc text-xs",
                        j.dayType === "P" ? "border border-[#FF3B3B]/40 bg-[#FF3B3B]/10 text-[#ff8a8a]" : "bg-white/5 text-white/60",
                      )}
                    >
                      {j.dayLabel || j.dayType}
                    </span>
                    <span className="truncate text-[15px] text-white/85">{j.label || "이름 없음"}</span>
                  </p>
                  <p className="mt-1 truncate text-[13px] text-white/50">{summarizeSpeakers(j.speakers)}</p>
                  <p className="mt-0.5 font-orbitron text-[11px] text-white/35">
                    {j.nextRun ? j.nextRun.replace("T", " ").slice(0, 19) : "-"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        <table className="hidden w-full text-left font-pretendard text-sm md:table">
          <thead className="sticky top-0 bg-[#0a0a0a] text-white/40">
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 font-mbc font-normal">시각</th>
              <th className="px-4 py-3 font-mbc font-normal">요일</th>
              <th className="px-4 py-3 font-mbc font-normal">이름</th>
              <th className="px-4 py-3 font-mbc font-normal">대상 스피커</th>
              <th className="px-4 py-3 font-mbc font-normal">다음 실행</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-white/30">
                  시보가 없어요
                </td>
              </tr>
            ) : (
              jobs.map((j) => (
                <tr key={j.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap px-4 py-2.5 font-orbitron text-base text-white">
                    {j.time || "--:--"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "rounded-md px-2 py-1 font-mbc text-xs",
                        j.dayType === "P" ? "border border-[#FF3B3B]/40 bg-[#FF3B3B]/10 text-[#ff8a8a]" : "bg-white/5 text-white/60",
                      )}
                    >
                      {j.dayLabel || j.dayType}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-white/80">{j.label || "이름 없음"}</td>
                  <td className="px-4 py-2.5 text-white/50">{summarizeSpeakers(j.speakers)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-orbitron text-xs text-white/40">
                    {j.nextRun ? j.nextRun.replace("T", " ").slice(0, 19) : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
