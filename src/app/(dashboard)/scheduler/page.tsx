"use client";

import { useCallback, useEffect, useState } from "react";
import SectionHeader from "@/components/common/SectionHeader";
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
  jobs: SchedulerJob[];
}

// 스피커 목록을 사람이 읽기 좋게 요약
function summarizeSpeakers(speakers: string[]): string {
  if (!speakers || speakers.length === 0) return "-";
  if (speakers.includes("전체") || speakers.includes("학교 전체")) return "학교 전체";
  if (speakers.length > 4) return `${speakers.slice(0, 4).join(", ")} 외 ${speakers.length - 4}`;
  return speakers.join(", ");
}

export default function SchedulerPage() {
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
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader>시보 스케줄</SectionHeader>
        <p className="font-pretendard text-white/40">관리자만 볼 수 있습니다.</p>
      </div>
    );
  }

  const jobs = status?.jobs ?? [];

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-center justify-between">
        <SectionHeader>시보 스케줄 (실제 예약 현황)</SectionHeader>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2">
          <span className="font-mbc text-xs text-white/40">현재 송출 그룹</span>
          <span className="font-orbitron text-sm text-emerald-300">
            {status?.activeGroupId ? `GROUP ${status.activeGroupId}` : "없음"}
          </span>
        </div>
      </div>

      <p className="font-pretendard text-xs text-white/30">
        지금 스케줄러에 실제로 등록되어 울리도록 예약된 시보만 표시됩니다. 시보를 전송하면 이전
        스케줄은 모두 비워지고 전송한 그룹만 남습니다.
      </p>

      <div className="flex-1 overflow-auto rounded-2xl border border-white/5 bg-[#0a0a0a]">
        <table className="w-full text-left font-pretendard text-sm">
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
                  등록된 시보가 없습니다.
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
                        j.dayType === "P"
                          ? "bg-violet-500/20 text-violet-200"
                          : "bg-white/5 text-white/60",
                      )}
                    >
                      {j.dayLabel || j.dayType}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-white/80">{j.label || "(이름 없음)"}</td>
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
