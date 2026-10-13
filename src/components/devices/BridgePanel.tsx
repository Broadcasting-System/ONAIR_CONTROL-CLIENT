"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import NotebookKit from "@/components/devices/NotebookKit";
import { hallApi } from "@/lib/hallApi";
import { cn } from "@/lib/utils";
import type { AnnouncedBridge, BridgeDevice, BridgeInfo } from "@/types/hall";

const USE_LABEL: Record<string, string> = { mixer: "오디오 믹서", matrix: "영상 매트릭스" };
const DEVICE_LABEL: Record<string, string> = { serial: "RS-232", midi: "MIDI" };

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function portText(d: BridgeDevice): string {
  if (d.kind === "serial") return [d.port, d.baud ? `${d.baud}bps` : null].filter(Boolean).join(" · ");
  if (d.kind === "midi") return [d.out && `출력 ${d.out}`, d.in && `입력 ${d.in}`].filter(Boolean).join(" · ");
  return "";
}

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "h-2.5 w-2.5 shrink-0 rounded-full",
        on ? "bg-[#00FF57] shadow-[0_0_10px_#00FF57]" : "bg-[#FF3B3B] shadow-[0_0_10px_#FF3B3B]",
      )}
    />
  );
}

function BridgeCard({ bridge }: { bridge: BridgeInfo }) {
  const devices = Object.entries(bridge.devices);
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-[#0a0a0a] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Dot on={bridge.online} />
          <div className="min-w-0">
            <h3 className="truncate font-mbc text-lg text-white">{bridge.name || hostOf(bridge.url)}</h3>
            <p className="truncate font-mono text-xs text-white/35">
              {bridge.url}
              {bridge.version ? ` · v${bridge.version}` : ""}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 font-orbitron text-[11px] tracking-[0.12em]",
            bridge.online
              ? "border-[#00FF57]/30 bg-[#00FF57]/10 text-[#7dffb0]"
              : "border-[#FF3B3B]/40 bg-[#FF3B3B]/10 text-[#ff8a8a]",
          )}
        >
          {bridge.online ? `ONLINE${bridge.latencyMs != null ? ` ${bridge.latencyMs}ms` : ""}` : "OFFLINE"}
        </span>
      </div>

      {/* 이 노트북을 쓰는 장비 */}
      <div className="flex flex-wrap gap-2">
        {bridge.users.map((u) => (
          <span
            key={`${u.hall}-${u.kind}`}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-pretendard text-xs text-white/65"
          >
            {u.hallName} · {USE_LABEL[u.kind] ?? u.kind}
            <span className="ml-1.5 font-mono text-white/30">{u.device}</span>
          </span>
        ))}
      </div>

      {!bridge.online && (
        <p className="rounded-lg border border-[#FF3B3B]/25 bg-[#FF3B3B]/[0.06] px-3.5 py-2.5 font-pretendard text-sm text-[#ffb3b3]">
          {bridge.detail || "브릿지에 연결할 수 없어요"}
        </p>
      )}

      {bridge.online && (
        <div className="overflow-hidden rounded-xl border border-white/5">
          <table className="w-full text-left font-pretendard text-sm">
            <thead className="bg-white/[0.03] text-white/40">
              <tr>
                <th className="px-4 py-2 font-mbc text-xs font-normal">장치</th>
                <th className="px-4 py-2 font-mbc text-xs font-normal">종류</th>
                <th className="px-4 py-2 font-mbc text-xs font-normal">포트</th>
                <th className="px-4 py-2 text-right font-mbc text-xs font-normal">상태</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(([name, d]) => (
                <tr key={name} className="border-t border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs text-white/80">{name}</td>
                  <td className="px-4 py-2.5 font-orbitron text-[11px] text-white/50">{DEVICE_LABEL[d.kind] ?? d.kind}</td>
                  <td className="px-4 py-2.5 text-xs text-white/50">{portText(d)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px]",
                        d.open ? "bg-[#00FF57]/10 text-[#7dffb0]" : "bg-[#FFD600]/10 text-[#ffe36b]",
                      )}
                    >
                      {d.open ? "열림" : "대기"}
                    </span>
                  </td>
                </tr>
              ))}
              {bridge.missing.map((name) => (
                <tr key={`missing-${name}`} className="border-t border-white/5 bg-[#FF3B3B]/[0.05]">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#ff8a8a]">{name}</td>
                  <td colSpan={3} className="px-4 py-2.5 text-right text-xs text-[#ff8a8a]">
                    노트북에 없음
                  </td>
                </tr>
              ))}
              {devices.length === 0 && bridge.missing.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-white/30">
                    장치가 없어요
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const setupLink =
  "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mbc text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white";

/** 켜져 있다고 알려 왔지만 아직 어떤 장비도 쓰지 않는 노트북 */
function AnnouncedCard({ a }: { a: AnnouncedBridge }) {
  const devices = Object.keys(a.devices).length;
  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-dashed border-white/15 bg-[#0a0a0a] px-5 py-4">
      <Dot on={a.online} />
      <div className="min-w-0">
        <h3 className="truncate font-mbc text-base text-white">{a.name || a.hostname || "노트북"}</h3>
        <p className="truncate font-mono text-xs text-white/35">
          {a.url}
          {a.version ? ` · v${a.version}` : ""}
          {a.hostname ? ` · ${a.hostname}` : ""}
        </p>
      </div>
      <span className="font-pretendard text-xs text-white/40">
        {a.online ? `${a.ago}초 전 알림` : `${Math.round(a.ago / 60)}분 전 마지막 알림`} · 장치 {devices}개
      </span>
      <div className="ml-auto flex gap-2">
        <Link href="/mixer/setup" className={setupLink}>
          믹서 현장 세팅
        </Link>
        <Link href="/matrix/setup" className={setupLink}>
          매트릭스 현장 세팅
        </Link>
      </div>
    </section>
  );
}

/** 기기 관리 › 강당 장비 — 노트북 설치 파일, 새로 켜진 노트북, 장비가 쓰는 노트북(브릿지)의 연결 상태 */
export default function BridgePanel() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["bridges"],
    queryFn: hallApi.bridges,
    refetchInterval: 5000,
  });

  const bridges = data?.bridges ?? [];
  const fresh = (data?.announced ?? []).filter((a) => !a.inUse);
  const online = bridges.filter((b) => b.online).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <NotebookKit />

      {bridges.length > 0 && (
        <div className="flex items-center justify-end gap-6">
          <div data-tour="bridges.count" className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2">
            <span className="font-mbc text-xs text-white/40">연결</span>
            <span className={cn("font-orbitron text-sm", online === bridges.length ? "text-emerald-300" : "text-amber-300")}>
              {online}/{bridges.length}
            </span>
          </div>
        </div>
      )}

      {data && !data.tokenConfigured && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-pretendard text-sm text-amber-100/90">
          브릿지 토큰을 만들지 못했어요
        </p>
      )}

      {error && !data && (
        <p className="font-pretendard text-sm text-white/40">상태를 불러오지 못했어요: {(error as Error).message}</p>
      )}
      {isLoading && <p className="font-pretendard text-sm text-white/30">확인하는 중…</p>}

      {fresh.length > 0 && (
        <div data-tour="bridges.announced" className="flex flex-col gap-3">
          <h3 className="font-mbc text-sm text-white/60">새로 켜진 노트북</h3>
          {fresh.map((a) => (
            <AnnouncedCard key={a.url} a={a} />
          ))}
        </div>
      )}

      {data && bridges.length === 0 && (
        <div className="rounded-2xl border border-white/5 bg-[#0a0a0a] px-6 py-8">
          <h3 className="font-mbc text-lg text-white">연결된 노트북이 없어요</h3>
        </div>
      )}

      {bridges.length > 0 && (
        <div data-tour="bridges.list" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {bridges.map((b) => (
            <BridgeCard key={b.url} bridge={b} />
          ))}
        </div>
      )}
    </div>
  );
}
