"use client";

import { useCallback, useEffect, useState } from "react";
import SectionHeader from "@/components/common/SectionHeader";
import { getApiBase } from "@/lib/apiBase";
import { cn } from "@/lib/utils";

interface LogEntry {
  ts: string;
  ip: string;
  device: string;
  owner: string;
  role: string;
  method: string;
  path: string;
  status: number;
}

const METHOD_COLOR: Record<string, string> = {
  POST: "text-emerald-300",
  PUT: "text-sky-300",
  PATCH: "text-amber-300",
  DELETE: "text-red-300",
};

// 경로 → 사람이 읽을 동작명
function describe(path: string, method: string): string {
  if (path.startsWith("/api/display/timer")) return "타이머 송출";
  if (path.startsWith("/api/display/show")) return "미디어 송출";
  if (path.startsWith("/api/display/clear")) return "송출 끄기";
  if (path.startsWith("/api/display/screen")) return "화면 공유";
  if (path.startsWith("/api/display/player")) return "재생 제어";
  if (path.startsWith("/api/display")) return "송출 제어";
  if (path.startsWith("/api/banner/clear")) return "현수막 끄기";
  if (path.startsWith("/api/banner")) return "현수막 변경";
  if (path.startsWith("/api/broadcast/execute")) return "방송 송출";
  if (path.startsWith("/api/broadcast")) return "방송/예약";
  if (path.startsWith("/api/speakers")) return "스피커 제어";
  if (path.startsWith("/api/time")) return "시보 설정";
  if (path.startsWith("/api/files")) return method === "DELETE" ? "파일 삭제" : "파일 변경";
  if (path.startsWith("/api/devices")) return "기기 관리";
  return path;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [denied, setDenied] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/logs?limit=300`);
      if (res.status === 403) {
        setDenied(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        setDenied(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const id = setInterval(fetchLogs, 3000);
    return () => clearInterval(id);
  }, [fetchLogs]);

  return (
    <div className="flex h-full flex-col gap-5">
      <SectionHeader>접근 로그</SectionHeader>

      {denied ? (
        <p className="font-pretendard text-white/40">관리자만 볼 수 있습니다.</p>
      ) : (
        <div className="flex-1 overflow-auto rounded-2xl border border-white/5 bg-[#0a0a0a]">
          <table className="w-full text-left font-pretendard text-sm">
            <thead className="sticky top-0 bg-[#0a0a0a] text-white/40">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 font-mbc font-normal">시각</th>
                <th className="px-4 py-3 font-mbc font-normal">기기</th>
                <th className="px-4 py-3 font-mbc font-normal">역할</th>
                <th className="px-4 py-3 font-mbc font-normal">동작</th>
                <th className="px-4 py-3 font-mbc font-normal">결과</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-white/30">
                    기록이 없습니다.
                  </td>
                </tr>
              ) : (
                logs.map((l, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-2.5 font-orbitron text-xs text-white/50">
                      {l.ts.replace("T", " ")}
                    </td>
                    <td className="px-4 py-2.5 text-white/80">
                      {l.device || l.ip}
                      {l.owner ? <span className="text-white/30"> · {l.owner}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-white/50">{l.role}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("font-orbitron text-[11px]", METHOD_COLOR[l.method] ?? "text-white/40")}>
                        {l.method}
                      </span>{" "}
                      <span className="text-white/80">{describe(l.path, l.method)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "font-orbitron text-xs",
                          l.status < 300 ? "text-emerald-300" : l.status === 403 ? "text-amber-300" : "text-red-300",
                        )}
                      >
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
