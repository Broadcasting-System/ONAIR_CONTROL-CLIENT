"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import ConfirmModal from "@/components/common/ConfirmModal";
import ChannelProcessing from "@/components/hall/ChannelProcessing";
import ChannelStrip from "@/components/hall/ChannelStrip";
import { ConfigButton } from "@/components/hall/HallConfigModal";
import { LockToggle, Notice } from "@/components/hall/HallControls";
import { useMe } from "@/hooks/useMe";
import { useMixer } from "@/hooks/useMixer";
import { cn } from "@/lib/utils";
import { DRIVER_LABEL, type MixerScene } from "@/types/hall";

// 콘솔 본체 판 (매트한 금속판 느낌) — 입력·FX 리턴 띠와 오른쪽 MAIN 이 한 판에 놓인다
const BOARD =
  "rounded-2xl border border-black/80 bg-[linear-gradient(180deg,#1d1d20_0%,#141416_55%,#101012_100%)] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-1px_0_rgba(0,0,0,0.6),0_20px_40px_-16px_rgba(0,0,0,0.8)]";
// 채널 한 칸은 스스로 모듈 틀을 갖는다 — 감싸는 칸은 자리만 잡는다
const STRIP_BOX = "flex snap-start";
// 폰에서만 카드로 감싸는 칸 (PC 는 판 없이 바로 놓는다)
const PHONE_PANEL =
  "max-md:rounded-[20px] max-md:border max-md:border-white/[0.09] max-md:bg-white/[0.045] max-md:p-3 max-md:backdrop-blur-md";
// 콘솔 위 무리 이름 (INPUT · FX RETURN · MAIN)
const GROUP_LABEL =
  "mb-1.5 hidden border-b border-white/[0.12] pb-1 font-orbitron text-[10px] tracking-[0.2em] text-white/35 md:block";
// 마지막으로 고른 채널 — 공간마다 { hallId: channelId }
const SEL_KEY = "onair.mixer.sel";

function readSel(hallId: string | null): string | null {
  if (!hallId) return null;
  try {
    const raw = window.localStorage.getItem(SEL_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return typeof map[hallId] === "string" ? map[hallId] : null;
  } catch {
    return null;
  }
}

function writeSel(hallId: string | null, id: string) {
  if (!hallId) return;
  try {
    const raw = window.localStorage.getItem(SEL_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[hallId] = id;
    window.localStorage.setItem(SEL_KEY, JSON.stringify(map));
  } catch {
    /* 저장소를 못 쓰면 기억하지 않는다 */
  }
}

/** 위 줄 상태 칩 — 흰 점, 연결이 끊기면 빨간 점 */
function MixerChip({ tour, alert, dim, label, title }: { tour: string; alert?: boolean; dim?: boolean; label: string; title?: string }) {
  return (
    <span
      data-tour={tour}
      title={title}
      className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border border-white/10 px-3 font-pretendard text-[13px] text-white/70"
    >
      <span
        className={cn(
          "h-[7px] w-[7px] rounded-full",
          alert
            ? "bg-[#FF3B3B] shadow-[0_0_6px_#FF3B3B]"
            : dim
              ? "bg-white/25"
              : "bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]",
        )}
      />
      {label}
    </span>
  );
}

/** 오디오 › 믹서 탭. 공간은 페이지가 고른다 (자동 음향 탭과 같은 공간). lead = 페이지 제목·공간·탭 */
export default function MixerPanel({ hallId, lead }: { hallId: string | null; lead: ReactNode }) {
  // 탭을 열 때마다 잠긴 상태로 시작한다 — 들어오자마자 실수로 페이더를 건드리지 않게
  const [locked, setLocked] = useState(true);

  const { state, error, recallScene, isRecalling, setLevel, setMute, setParam, refresh } = useMixer(hallId);
  const { canOperate, isAdmin } = useMe();
  const router = useRouter();
  // '확인' 표시한 씬은 누르면 한 번 더 묻는다
  const [pendingScene, setPendingScene] = useState<MixerScene | null>(null);
  // SEL 로 고른 입력 채널 — 아래 처리 판에 열린다. 공간마다 마지막으로 고른 채널을 기억하고, 없으면 첫 채널
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setSelected(readSel(hallId)), [hallId]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const procRef = useRef<HTMLElement>(null);
  // 콘솔 가로 위치 — 얇은 막대(PC)와 오른쪽 흐림 가장자리에 쓴다. 비율 0~1
  const [bar, setBar] = useState({ from: 0, size: 1 });
  const barDrag = useRef<{ x: number; left: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const moreRight = bar.from + bar.size < 0.999;

  const connected = !!state?.connected;
  // 관리자가 '씬 전환만'으로 정했으면 채널 조작 칸 자체를 보여주지 않는다
  const scenesOnly = state?.mode === "scenes";
  const channelMode = connected && !scenesOnly && !!state?.capabilities.includes("channel");
  const operable = canOperate && !locked;
  const channels = (state?.channels ?? []).filter((c) => !c.hidden);
  const fxReturns = state?.fx ?? [];
  const processing = channelMode && !!state?.capabilities.includes("processing") && !!state?.processingRoles?.length;
  const selectedChannel = processing ? (channels.find((c) => c.id === selected) ?? channels[0] ?? null) : null;

  // 세로 휠로 콘솔을 가로로 넘긴다. 끝에 닿으면 페이지가 그대로 스크롤된다.
  // 휠을 스스로 쓰는 조작부(data-wheel)가 생기면 그 위에서는 건드리지 않는다
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.scrollWidth || 1;
      setBar({ from: el.scrollLeft / w, size: Math.min(1, el.clientWidth / w) });
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.defaultPrevented) return;
      if ((e.target as Element | null)?.closest?.("[data-wheel]")) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      if ((e.deltaY > 0 && el.scrollLeft >= max - 1) || (e.deltaY < 0 && el.scrollLeft <= 0)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
      el.removeEventListener("wheel", onWheel);
    };
  }, [scenesOnly, channels.length, fxReturns.length]);

  const pressScene = (scene: MixerScene) => {
    if (scene.confirm) setPendingScene(scene);
    else recallScene(scene.pc);
  };

  // SEL — 처리 판을 그 채널로 바꾸고, 판이 화면 밖이면 보이게 내린다
  const selectChannel = (id: string, from: "strip" | "panel") => {
    setSelected(id);
    writeSel(hallId, id);
    if (from === "strip") {
      const box = procRef.current;
      if (!box) return;
      requestAnimationFrame(() => {
        const r = box.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) box.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } else {
      // 처리 판에서 넘기면 콘솔도 그 띠가 보이게 옆으로 넘긴다
      const strip = scrollerRef.current?.querySelector<HTMLElement>(`[data-strip="${CSS.escape(id)}"]`);
      const scroller = scrollerRef.current;
      if (!strip || !scroller) return;
      const s = scroller.getBoundingClientRect();
      const r = strip.getBoundingClientRect();
      if (r.left < s.left) scroller.scrollBy({ left: r.left - s.left - 8, behavior: "smooth" });
      else if (r.right > s.right) scroller.scrollBy({ left: r.right - s.right + 8, behavior: "smooth" });
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 md:gap-3">
      <header className="flex flex-wrap items-center gap-3 md:gap-5">
        {lead}
        <div className="ml-auto flex items-center gap-2.5 max-md:contents">
          {isAdmin && <ConfigButton tour="mixer.setup" label="현장 세팅" onClick={() => router.push("/mixer/setup")} />}
          <MixerChip
            tour="mixer.status"
            alert={!!state && !connected}
            dim={!state}
            label={connected ? "믹서 연결됨" : "연결 안 됨"}
            title={DRIVER_LABEL[state?.driver ?? ""] ?? state?.driver}
          />
          <MixerChip tour="mixer.mode" dim={!channelMode} label={channelMode ? "채널 제어" : "씬 전환만"} />
          <div className="ml-auto max-md:order-[-1] md:ml-0 md:contents">
            <LockToggle tour="mixer.lock" checked={locked} onChange={setLocked} />
          </div>
          <span className="hidden max-md:order-[-1] max-md:block max-md:basis-full" aria-hidden />
        </div>
      </header>

      {error && <Notice>{error.message}</Notice>}
      {state && !connected && <Notice>믹서 연결 안 됨 · {state.detail}</Notice>}
      {!canOperate && <Notice tone="info">보기 전용</Notice>}

      {/* 씬 — PC 는 납작한 한 줄, 폰은 2열 카드 */}
      <section data-tour="mixer.scenes" className={PHONE_PANEL}>
        <h3 className="mb-3 font-mbc text-[20px] text-white md:hidden">씬</h3>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] md:gap-2">
          {(state?.scenes ?? []).map((scene) => {
            const active = state?.currentScene === scene.pc;
            return (
              <button
                key={scene.pc}
                type="button"
                disabled={!operable || !connected || isRecalling}
                onClick={() => pressScene(scene)}
                className={cn(
                  "flex h-[80px] min-w-0 flex-col justify-between rounded-2xl border px-3.5 py-3 text-left transition-all disabled:cursor-not-allowed",
                  "md:h-[54px] md:flex-row md:items-center md:justify-start md:gap-2.5 md:rounded-[14px] md:px-3.5 md:py-0",
                  active
                    ? "border-red-400/50 bg-red-400/15 shadow-[0_0_18px_-6px_#ff5a5a]"
                    : "border-transparent bg-black/40 enabled:hover:bg-white/[0.07] md:border-white/[0.06]",
                )}
              >
                <span className="flex shrink-0 items-center gap-2 font-orbitron text-[11px] tracking-[0.14em] text-white/35 md:text-[10px]">
                  <span className={cn("whitespace-nowrap", active && "text-red-400")}>PC {String(scene.pc).padStart(2, "0")}</span>
                  {active && (
                    <span className="rounded bg-red-500 px-1.5 py-px text-[10px] text-white md:text-[9.5px]">NOW</span>
                  )}
                  {scene.confirm && (
                    <ShieldAlert size={13} className="ml-auto text-[#FFB23F]/80 md:ml-0" aria-label="확인 필요" />
                  )}
                </span>
                <span className="min-w-0 truncate font-mbc text-[18px] text-white md:ml-auto md:text-[17px]">{scene.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {!scenesOnly && (
        <section data-tour="mixer.channels" className={PHONE_PANEL}>
          <h3 className="mb-3 font-mbc text-[20px] text-white md:hidden">채널</h3>
          <div className={cn(BOARD, "relative flex md:rounded-[20px]")}>
            {/* 입력 채널과 FX 리턴을 한 줄로 — 옆으로 넘긴다 */}
            <div className={cn("relative min-w-0 flex-1", !channelMode && "opacity-30")}>
              <div
                ref={scrollerRef}
                data-tour="mixer.faders"
                className="no-scrollbar snap-x snap-mandatory overflow-x-auto overflow-y-hidden p-1.5 max-md:scroll-px-1.5 md:snap-none md:px-3 md:pb-0 md:pt-2.5"
              >
                <div className="flex w-max gap-1.5">
                  <div>
                    <div className={GROUP_LABEL}><span className="sticky left-0">INPUT</span></div>
                    <div className="flex gap-1.5 md:gap-1">
                      {channels.map((ch) => (
                        <div key={ch.id} data-strip={ch.id} className={STRIP_BOX}>
                          <ChannelStrip
                            channel={ch}
                            subLabel={`CH ${ch.id.padStart(2, "0")}`}
                            disabled={!operable || !channelMode}
                            selected={!!selectedChannel && selectedChannel.id === ch.id}
                            onSelect={processing ? () => selectChannel(ch.id, "strip") : undefined}
                            onGain={
                              processing && operable && ch.roles?.includes("gain")
                                ? (v) => setParam(ch.id, "gain", v)
                                : undefined
                            }
                            onLevel={(v) => setLevel(ch.id, v)}
                            onMute={(m) => setMute(ch.id, m)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {fxReturns.length > 0 && (
                    // 이펙트 리턴 — 에코·울림 전체 양. 채널마다 보내는 양은 아래 처리 판의 FX SEND
                    <>
                      <span className="mx-1.5 hidden w-px shrink-0 self-stretch bg-white/10 md:block" aria-hidden />
                      <div className="flex shrink-0 gap-1.5 md:block">
                        <div className="flex w-6 items-center justify-center self-stretch md:hidden" aria-hidden>
                          <span className="font-orbitron text-[9px] tracking-[0.32em] text-[#B48CFF]/60 [writing-mode:vertical-rl]">
                            FX RETURN
                          </span>
                        </div>
                        <div className={cn(GROUP_LABEL, "text-[#B48CFF]/60")}><span className="sticky left-0">FX RETURN</span></div>
                        <div className="flex gap-1.5 md:gap-1">
                          {fxReturns.map((f, i) => (
                            <div key={f.id} className={STRIP_BOX}>
                              <ChannelStrip
                                fx
                                channel={f}
                                subLabel={`FX ${i + 1}`}
                                disabled={!operable || !channelMode}
                                onLevel={(v) => setLevel(f.id, v)}
                                onMute={(m) => setMute(f.id, m)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {moreRight && (
                <span
                  className="pointer-events-none absolute bottom-5 right-0 top-0 hidden w-14 bg-[linear-gradient(90deg,transparent,#141416)] md:block"
                  aria-hidden
                />
              )}
              {/* 얇은 가로 막대 — 운영체제가 스크롤바를 숨겨도 늘 보이게 직접 그린다. 끌거나 눌러 넘긴다 */}
              {bar.size < 1 && (
                <div
                  ref={trackRef}
                  className="relative mx-3 mb-2.5 mt-2 hidden h-1 cursor-pointer rounded-full bg-white/[0.06] md:block"
                  onPointerDown={(e) => {
                    const el = scrollerRef.current;
                    const track = trackRef.current;
                    if (!el || !track || e.target !== e.currentTarget) return;
                    const r = track.getBoundingClientRect();
                    const at = (e.clientX - r.left) / r.width;
                    el.scrollTo({ left: (at - bar.size / 2) * el.scrollWidth, behavior: "smooth" });
                  }}
                  aria-hidden
                >
                  <span
                    className="absolute inset-y-[-3px] cursor-grab touch-none py-[3px] active:cursor-grabbing"
                    style={{ left: `${bar.from * 100}%`, width: `${bar.size * 100}%` }}
                    onPointerDown={(e) => {
                      const el = scrollerRef.current;
                      if (!el) return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      barDrag.current = { x: e.clientX, left: el.scrollLeft };
                    }}
                    onPointerMove={(e) => {
                      const el = scrollerRef.current;
                      const track = trackRef.current;
                      if (!el || !track || !barDrag.current) return;
                      const ratio = el.scrollWidth / track.clientWidth;
                      el.scrollLeft = barDrag.current.left + (e.clientX - barDrag.current.x) * ratio;
                    }}
                    onPointerUp={() => (barDrag.current = null)}
                    onPointerCancel={() => (barDrag.current = null)}
                  >
                    <span className="block h-full rounded-full bg-white/30 hover:bg-white/45" />
                  </span>
                </div>
              )}
            </div>
            {state?.master && (
              // 마스터는 따로 떼어 오른쪽에 고정 — 몇 채널을 넘기든 항상 같은 자리
              <div
                data-tour="mixer.master"
                className={cn(
                  "flex shrink-0 flex-col border-l border-white/[0.08] p-1.5 md:px-3 md:pb-2 md:pt-2.5",
                  !channelMode && "opacity-30",
                )}
              >
                <div className={GROUP_LABEL}><span className="sticky left-0">MAIN</span></div>
                <div className={STRIP_BOX}>
                  <ChannelStrip
                    master
                    channel={state.master}
                    subLabel="MAIN"
                    disabled={!operable || !channelMode}
                    onLevel={(v) => setLevel(state.master!.id, v)}
                    onMute={(m) => setMute(state.master!.id, m)}
                  />
                </div>
              </div>
            )}
            {!channelMode && state && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="rounded-xl bg-black/70 px-6 py-4 text-center font-pretendard text-sm text-white/70">
                  {connected
                    ? "씬 전환만 지원"
                    : "믹서 연결 안 됨"}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 채널 처리 — 콘솔 바로 아래에 늘 붙어 있다 */}
      {processing && state && hallId && selectedChannel && (
        <section
          ref={procRef}
          data-tour="mixer.processing"
          className="scroll-mb-24 rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-3 backdrop-blur-md md:scroll-mb-4 md:border-white/[0.08] md:bg-[rgba(14,14,17,0.74)] md:px-4 md:pb-3 md:pt-3"
        >
          <ChannelProcessing
            hallId={hallId}
            state={state}
            channel={selectedChannel}
            channels={channels}
            onSelect={(id) => selectChannel(id, "panel")}
            canOperate={operable}
            canAdmin={operable}
            isAdmin={isAdmin}
            onParam={(role, value) => setParam(selectedChannel.id, role, value)}
            onRefresh={refresh}
          />
        </section>
      )}

      <ConfirmModal
        isOpen={!!pendingScene}
        onClose={() => setPendingScene(null)}
        onConfirm={() => {
          if (pendingScene) recallScene(pendingScene.pc);
        }}
        title="씬을 바꿀까요?"
        message={
          pendingScene
            ? `${state?.hall.name ?? "믹서"} 콘솔 전체가 '${pendingScene.name}' 씬으로 바뀌어요`
            : ""
        }
        confirmText="씬 전환"
      />

    </div>
  );
}
