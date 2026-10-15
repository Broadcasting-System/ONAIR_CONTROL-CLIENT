"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "@/lib/apiBase";
import { useMe } from "@/hooks/useMe";
import { useHalls, useHallsStatus } from "@/hooks/useHalls";
import { useAvState } from "@/hooks/useAv";
import { useSpeakers } from "@/hooks/useSpeakers";
import { showLabel, useShowing } from "@/hooks/useShowing";
import { GlassCard, KV, Dot, MobileHeader, SectionLabel, fmtElapsed } from "@/components/mobile/ui";
import { useMobileOnly } from "@/components/mobile/useMobileOnly";
import ConfirmModal from "@/components/common/ConfirmModal";
import { ROLE_DOT } from "@/components/devices/roleStyle";
import { cn } from "@/lib/utils";

type Bell = { time: string; label: string };
type TimeTable = Record<string, { isSpecialActive?: boolean; schedules?: { dayType: string; bells: Bell[] }[] }>;
const DAY = ["", "M", "T", "W", "TH", "F", "", ""]; // getDay(): 0=일

/** 지금 울리는 그룹과 오늘 남은 다음 시보 */
function useBellSummary() {
  return useQuery({
    queryKey: ["mobile", "bells"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const base = getApiBase();
      const [active, table] = await Promise.all([
        fetch(`${base}/time/active`).then((r) => r.json()),
        fetch(`${base}/time`).then((r) => r.json()),
      ]);
      const live: string | null = active.activeGroupId ?? null;
      const special = !!active.special;
      const g = live ? (table.data as TimeTable)[live] : undefined;
      const now = new Date();
      const day = special ? "P" : DAY[now.getDay() === 0 ? 7 : now.getDay()];
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const bells = (g?.schedules?.find((s) => s.dayType === day)?.bells ?? [])
        .filter((b) => b.time > hhmm)
        .sort((a, b) => a.time.localeCompare(b.time));
      return { live, special, next: bells[0] ?? null };
    },
  });
}

export default function MobileHomePage() {
  useMobileOnly("/main");
  const { me, role } = useMe();
  const bells = useBellSummary();
  const showing = useShowing();
  const { halls } = useHalls();
  const { summary } = useHallsStatus();
  const av = useAvState();
  const { allOff } = useSpeakers();
  const [confirmOff, setConfirmOff] = useState(false);
  const session = av.state?.session ?? null;

  const hallOk = (id: string) => {
    const devs = summary?.devices.filter((d) => d.hall === id) ?? [];
    return devs.length ? devs.every((d) => d.connected) : null;
  };
  const b = bells.data;

  return (
    <div className="flex flex-col">
      <MobileHeader
        title="홈"
        right={
          <span className="flex items-center gap-2 font-pretendard text-[13px] text-white/60">
            <span className={cn("h-2 w-2 rounded-full", ROLE_DOT[role])} />
            {me?.name ?? "…"} · {me?.roleLabel ?? ""}
          </span>
        }
      />

      <GlassCard href="/time" className="flex items-center justify-between" tour="home.bells">
        <KV k="시보" v={b?.live ? `GROUP ${b.live} 송출 중${b.special ? " · 특별" : ""}` : "송출 중인 그룹 없음"} />
        <KV k="다음" v={b?.next ? `${b.next.time} ${b.next.label}` : "오늘 없음"} align="right" />
      </GlassCard>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5" data-tour="home.halls">
        {halls.map((h) => {
          const ok = hallOk(h.id);
          const rec = session && session.hall === h.id ? session : null;
          return (
            <GlassCard key={h.id} href={`/hall?h=${h.id}`}>
              <p className="font-pretendard text-[12px] text-white/50">{h.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 font-pretendard text-[16px] font-semibold">
                <Dot ok={ok} /> {ok === null ? "장비 없음" : ok ? "연결" : "끊김"}
              </p>
              {rec && (
                <p className="mt-1.5 font-pretendard text-[12px] text-[#FF3B3B]">● {rec.kindName} {fmtElapsed(rec.elapsed)}</p>
              )}
            </GlassCard>
          );
        })}
      </div>

      <GlassCard href="/media" className="mt-2.5 flex items-center justify-between" tour="home.display">
        <KV
          k="송출"
          v={
            showing.data?.length
              ? showing.data.map((s) => `CH${s.ch} ${showLabel(s.type)}`).join(" · ")
              : "모든 채널 대기"
          }
        />
      </GlassCard>

      <SectionLabel>QUICK</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5" data-tour="home.quick">
        <QuickLink href="/main" label="방송" />
        <QuickLink href="/main?mic=1" label="마이크 방송" />
        <button
          type="button"
          onClick={() => setConfirmOff(true)}
          className="flex h-16 items-center rounded-2xl border border-white/[0.09] bg-white/[0.05] px-4 text-left font-pretendard text-[15px] font-semibold active:bg-white/[0.1]"
        >
          스피커 모두 끄기
        </button>
        <QuickLink href="/recording" label={session ? `● ${session.kindName} 중` : "녹음·녹화"} live={!!session} />
        <QuickLink href="/cue" label="CUE에게 묻기" className="col-span-2" />
      </div>

      <ConfirmModal
        isOpen={confirmOff}
        onClose={() => setConfirmOff(false)}
        onConfirm={async () => {
          await allOff();
          setConfirmOff(false);
        }}
        title="스피커 모두 끄기"
        message="켜져 있는 교실 스피커를 모두 꺼요"
        confirmText="끄기"
        isDestructive
      />
    </div>
  );
}

function QuickLink({ href, label, live, className }: { href: string; label: string; live?: boolean; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-16 items-center rounded-2xl border border-white/[0.09] bg-white/[0.05] px-4 font-pretendard text-[15px] font-semibold active:bg-white/[0.1]",
        live && "text-[#FF3B3B]",
        className,
      )}
    >
      {label}
    </Link>
  );
}
