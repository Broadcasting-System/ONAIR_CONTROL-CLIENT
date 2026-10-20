"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, LockOpen } from "lucide-react";
import { useHalls, useHallsStatus } from "@/hooks/useHalls";
import { useMixer } from "@/hooks/useMixer";
import { useLighting } from "@/hooks/useLighting";
import { useAvState } from "@/hooks/useAv";
import { useMe } from "@/hooks/useMe";
import { Chip, Dot, GlassCard, MobileHeader, fmtElapsed } from "@/components/mobile/ui";
import { useMobileOnly } from "@/components/mobile/useMobileOnly";
import ConfirmModal from "@/components/common/ConfirmModal";
import EmptyState from "@/components/common/EmptyState";
import type { HallSummary } from "@/types/hall";
import { cn } from "@/lib/utils";

/** 폰 홀 탭 — 강당·다목적홀 카드를 옆으로 밀어 바꾸고, 항목 이름을 누르면 그 화면 전체로 */
export default function MobileHallPage() {
  return (
    <Suspense>
      <HallPager />
    </Suspense>
  );
}

function HallPager() {
  useMobileOnly("/mixer");
  const { halls } = useHalls();
  const params = useSearchParams();
  const pager = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // 홈에서 공간 카드를 눌러 왔으면 그 공간부터
  useEffect(() => {
    const want = params.get("h");
    const i = halls.findIndex((h) => h.id === want);
    if (i > 0 && pager.current) pager.current.scrollTo({ left: i * pager.current.clientWidth });
  }, [params, halls]);

  return (
    <div className="flex flex-col">
      <MobileHeader title="홀" />
      <div
        ref={pager}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto"
        data-tour="hall.cards"
      >
        {halls.map((h) => (
          <div key={h.id} className="w-full shrink-0 snap-center px-4">
            <HallCard hall={h} />
          </div>
        ))}
      </div>
      {halls.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {halls.map((h, i) => (
            <span key={h.id} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-[18px] bg-white" : "w-1.5 bg-white/25")} />
          ))}
        </div>
      )}
    </div>
  );
}

function HallCard({ hall }: { hall: HallSummary }) {
  const router = useRouter();
  const { canOperate } = useMe();
  const { summary } = useHallsStatus();
  const mixer = useMixer(hall.hasMixer ? hall.id : null);
  const light = useLighting(hall.hasLighting ? hall.id : null);
  const av = useAvState();
  // PC 믹서처럼 열 때마다 잠긴 상태로 시작 — 주머니 속 실수 방지
  const [locked, setLocked] = useState(true);
  const [ask, setAsk] = useState<{ pc: number; name: string } | null>(null);
  const operable = canOperate && !locked;

  const devs = summary?.devices.filter((d) => d.hall === hall.id) ?? [];
  const ok = devs.length ? devs.every((d) => d.connected) : null;
  const m = mixer.state;
  const l = light.state;
  const session = av.state?.session && av.state.session.hall === hall.id ? av.state.session : null;

  // 항목 이름을 누르면 PC 화면이 기억하는 공간을 이 공간으로 맞추고 그 화면 전체로
  const open = (key: string, href: string) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(hall.id));
    } catch {
      /* 저장 못 하면 그 화면이 기억하는 공간으로 */
    }
    router.push(href);
  };

  return (
    <GlassCard className="px-4 pb-4 pt-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mbc text-[24px] leading-none">{hall.name}</p>
          <p className="mt-1.5 flex items-center gap-1.5 font-pretendard text-[12px] text-white/50">
            <Dot ok={ok} /> {ok === null ? "장비 없음" : ok ? "연결" : "연결 끊김"}
          </p>
        </div>
        {canOperate && (
          <button
            type="button"
            data-tour="hall.lock"
            onClick={() => setLocked((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3 py-2 font-pretendard text-[13px] font-semibold",
              locked ? "border-white/10 bg-white/[0.06] text-white/70" : "border-white bg-white text-black",
            )}
          >
            {locked ? <Lock size={14} /> : <LockOpen size={14} />}
            {locked ? "잠김" : "잠금 풀림"}
          </button>
        )}
      </div>

      {hall.hasMixer && (
        <>
          <button type="button" className="mb-2 mt-4 block" onClick={() => open("onair.mixer.hall", "/mixer")}>
            <SectionLabelInline>AUDIO · 씬</SectionLabelInline>
          </button>
          <div className="flex flex-wrap gap-2" data-tour="hall.scenes">
            {(m?.scenes ?? []).map((s) => (
              <Chip
                key={s.pc}
                active={m?.currentScene === s.pc}
                disabled={!operable || !m?.connected}
                onClick={() => (s.confirm ? setAsk({ pc: s.pc, name: s.name }) : mixer.recallScene(s.pc))}
              >
                {s.name}
              </Chip>
            ))}
            {!m?.scenes?.length && (
              <EmptyState size="sm" className="py-1 text-left">
                씬이 없어요
              </EmptyState>
            )}
          </div>
          {!!m?.channels?.length && m.mode !== "scenes" && (
            <button
              type="button"
              onClick={() => open("onair.mixer.hall", "/mixer")}
              className="mt-3 flex h-[92px] w-full items-end gap-3"
              data-tour="hall.levels"
            >
              {m.channels.filter((c) => !c.hidden).slice(0, 6).map((c) => (
                <span key={c.id} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="relative h-[64px] w-2 rounded bg-white/10">
                    <span
                      className={cn("absolute -left-[7px] h-2.5 w-[22px] rounded-[3px]", c.mute ? "bg-[#FF3B3B]/80" : "bg-white/85")}
                      style={{ bottom: `${Math.round(((c.level ?? 0) / 100) * 54)}px` }}
                    />
                  </span>
                  <span className="max-w-full truncate font-pretendard text-[11px] text-white/55">{c.name}</span>
                </span>
              ))}
            </button>
          )}
        </>
      )}

      {hall.hasLighting && (
        <>
          <button type="button" className="mb-2 mt-4 block" onClick={() => open("onair.lighting.hall", "/lighting")}>
            <SectionLabelInline>LIGHT · 장면</SectionLabelInline>
          </button>
          <div className="flex flex-wrap gap-2" data-tour="hall.light">
            {(l?.scenes ?? []).map((s) => (
              <Chip key={s.id} active={l?.current === s.id && !l?.blackout} disabled={!operable} onClick={() => light.recallScene(s.id)}>
                {s.name}
              </Chip>
            ))}
            <Chip danger active={!!l?.blackout} disabled={!operable} onClick={() => light.setBlackout(!l?.blackout)}>
              암전
            </Chip>
          </div>
        </>
      )}

      <button type="button" className="mb-2 mt-4 block" onClick={() => router.push("/recording")}>
        <SectionLabelInline>REC</SectionLabelInline>
      </button>
      <div className="flex items-center justify-between" data-tour="hall.rec">
        {session ? (
          <>
            <span className="font-orbitron text-[20px] text-[#FF3B3B]">● {fmtElapsed(session.elapsed)}</span>
            <Chip disabled={!canOperate || av.isStopping} onClick={() => av.stop(hall.id)}>
              멈추기
            </Chip>
          </>
        ) : (
          <>
            <span className="font-pretendard text-[14px] text-white/45">대기</span>
            <Chip onClick={() => router.push("/recording")}>녹음·녹화</Chip>
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={!!ask}
        onClose={() => setAsk(null)}
        onConfirm={() => {
          if (ask) mixer.recallScene(ask.pc);
          setAsk(null);
        }}
        title={`${ask?.name ?? ""} 씬`}
        message={`${hall.name} 콘솔을 이 씬으로 바꿔요`}
        confirmText="바꾸기"
      />
    </GlassCard>
  );
}

function SectionLabelInline({ children }: { children: React.ReactNode }) {
  return <span className="font-orbitron text-[11px] tracking-[0.25em] text-white/35">{children} ›</span>;
}

