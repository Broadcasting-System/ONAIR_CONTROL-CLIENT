"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import ConfirmModal from "@/components/common/ConfirmModal";
import SectionHeader from "@/components/common/SectionHeader";
import ChannelStrip from "@/components/hall/ChannelStrip";
import { ConfigButton } from "@/components/hall/HallConfigModal";
import { HallSwitcher, LockToggle, Notice, Panel, StatusChip } from "@/components/hall/HallControls";
import { useHalls } from "@/hooks/useHalls";
import { useMe } from "@/hooks/useMe";
import { useMixer } from "@/hooks/useMixer";
import { usePersistentState } from "@/hooks/usePersistentState";
import { cn } from "@/lib/utils";
import { DRIVER_LABEL, type MixerScene } from "@/types/hall";

export default function MixerPage() {
  const { halls: allHalls, isLoading: hallsLoading } = useHalls();
  const halls = allHalls.filter((h) => h.hasMixer);
  const [hallId, setHallId] = usePersistentState<string | null>("onair.mixer.hall", null);
  // 페이지를 열 때마다 잠긴 상태로 시작한다 — 들어오자마자 실수로 페이더를 건드리지 않게
  const [locked, setLocked] = useState(true);
  const current = halls.find((h) => h.id === hallId) ?? halls[0];

  useEffect(() => {
    if (current && current.id !== hallId) setHallId(current.id);
  }, [current, hallId, setHallId]);

  const { state, error, recallScene, isRecalling, setLevel, setMute } = useMixer(current?.id ?? null);
  const { canOperate, isAdmin } = useMe();
  const router = useRouter();
  // '확인' 표시한 씬은 누르면 한 번 더 묻는다
  const [pendingScene, setPendingScene] = useState<MixerScene | null>(null);

  const connected = !!state?.connected;
  // 관리자가 '씬 전환만'으로 정했으면 채널 조작 칸 자체를 보여주지 않는다
  const scenesOnly = state?.mode === "scenes";
  const channelMode = connected && !scenesOnly && !!state?.capabilities.includes("channel");
  const operable = canOperate && !locked;
  const channels = (state?.channels ?? []).filter((c) => !c.hidden);

  const pressScene = (scene: MixerScene) => {
    if (scene.confirm) setPendingScene(scene);
    else recallScene(scene.pc);
  };

  if (!hallsLoading && halls.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader>오디오 믹서</SectionHeader>
        <Notice tone="info">설정된 오디오 믹서가 없습니다. 서버의 config/halls.json 에 추가하세요.</Notice>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="flex flex-wrap items-center gap-5">
        <SectionHeader className="mb-0">오디오 믹서</SectionHeader>
        <HallSwitcher halls={halls} value={current?.id} onChange={setHallId} />
        <div className="ml-auto flex items-center gap-2.5">
          {isAdmin && <ConfigButton label="현장 세팅" onClick={() => router.push("/mixer/setup")} />}
          <StatusChip
            tone={connected ? "good" : "off"}
            label={`${DRIVER_LABEL[state?.driver ?? ""] ?? state?.driver ?? "-"} ${connected ? "online" : "offline"}`}
          />
          <StatusChip
            tone={channelMode ? "good" : connected ? "warn" : "off"}
            label={channelMode ? "채널 제어" : "씬 전환만"}
          />
          <LockToggle checked={locked} onChange={setLocked} />
        </div>
      </header>

      {error && <Notice>{error.message}</Notice>}
      {state && !connected && <Notice>믹서에 연결되지 않았습니다 — {state.detail}</Notice>}
      {!canOperate && <Notice tone="info">보기 전용 기기입니다. 조작은 운영 권한이 있는 기기에서 가능합니다.</Notice>}
      {canOperate && locked && (
        <Notice tone="info">잠겨 있어요. 조작하려면 오른쪽 위 잠금을 푸세요 — 페이지를 다시 열면 다시 잠깁니다.</Notice>
      )}

      <Panel title="씬" hint="누르면 콘솔 전체가 저장된 씬으로 바뀝니다 · 콘솔에서 바꿔도 여기 반영됩니다">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3.5">
          {(state?.scenes ?? []).map((scene) => {
            const active = state?.currentScene === scene.pc;
            return (
              <button
                key={scene.pc}
                type="button"
                disabled={!operable || !connected || isRecalling}
                onClick={() => pressScene(scene)}
                title={scene.confirm ? "누르면 한 번 더 확인합니다" : undefined}
                className={cn(
                  "flex h-[100px] flex-col justify-between rounded-2xl border px-4 py-3.5 text-left transition-all disabled:cursor-not-allowed",
                  active
                    ? "border-red-400/50 bg-red-400/15 shadow-[0_0_18px_-6px_#ff5a5a]"
                    : "border-transparent bg-black/40 enabled:hover:bg-white/[0.07]",
                )}
              >
                <span className="flex items-center gap-2 font-orbitron text-[11px] tracking-[0.14em] text-white/35">
                  <span className={cn(active && "text-red-400")}>PC {String(scene.pc).padStart(2, "0")}</span>
                  {active && (
                    <span className="rounded bg-red-500 px-1.5 py-px text-[10px] text-white">NOW</span>
                  )}
                  {scene.confirm && (
                    <ShieldAlert size={13} className="ml-auto text-[#FFB23F]/80" aria-label="확인 필요" />
                  )}
                </span>
                <span className="font-mbc text-xl text-white">{scene.name}</span>
              </button>
            );
          })}
        </div>
      </Panel>

      {scenesOnly ? (
        <Notice tone="info">
          이 믹서는 <b>씬 전환만</b> 쓰도록 설정되어 있어요. 채널 음량·뮤트는 콘솔에서 직접 조작하세요.
        </Notice>
      ) : (
        <Panel
          title="채널"
          hint="페이더를 끌거나 방향키로 조절 · MUTE로 즉시 차단 · 빨간 선 위로는 올릴 수 없습니다"
          className="flex min-h-[640px] flex-1 flex-col"
        >
          <div className="relative flex min-h-0 flex-1">
            {/* 콘솔 본체 — 채널 스트립이 한 장의 매트한 판 위에 칸막이로 나뉜다 */}
            <div
              className={cn(
                "flex min-h-0 flex-1 overflow-x-auto rounded-2xl border border-black/80 px-2 py-4",
                "bg-[linear-gradient(180deg,#1d1d20_0%,#141416_55%,#101012_100%)]",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-1px_0_rgba(0,0,0,0.6),0_20px_40px_-16px_rgba(0,0,0,0.8)]",
                !channelMode && "opacity-30",
              )}
            >
              <div className="flex divide-x divide-white/[0.05]">
                {channels.map((ch) => (
                  <ChannelStrip
                    key={ch.id}
                    channel={ch}
                    subLabel={`CH ${ch.id.padStart(2, "0")}`}
                    disabled={!operable || !channelMode}
                    onLevel={(v) => setLevel(ch.id, v)}
                    onMute={(m) => setMute(ch.id, m)}
                  />
                ))}
              </div>
              <div className="min-w-4 flex-1" />
              {state?.master && (
                // 마스터 구획 — 굵은 칸막이로 채널과 분리
                <div className="flex border-l-2 border-black/80 pl-2 shadow-[-1px_0_0_rgba(255,255,255,0.05)]">
                  <ChannelStrip
                    master
                    channel={state.master}
                    subLabel={state.master.label ?? "MASTER"}
                    disabled={!operable || !channelMode}
                    onLevel={(v) => setLevel(state.master!.id, v)}
                    onMute={(m) => setMute(state.master!.id, m)}
                  />
                </div>
              )}
            </div>
            {!channelMode && state && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="rounded-xl bg-black/70 px-6 py-4 text-center font-pretendard text-sm text-white/70">
                  {connected
                    ? "현재 연결 방식은 씬 전환만 지원합니다. 채널 조작은 HiQnet 연결 시 사용할 수 있습니다."
                    : "믹서가 연결되면 채널을 조작할 수 있습니다."}
                </p>
              </div>
            )}
          </div>
        </Panel>
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
            ? `${state?.hall.name ?? "믹서"} 콘솔 전체가 '${pendingScene.name}' 씬으로 바뀝니다.\n진행 중인 행사가 있으면 소리가 바로 달라집니다.`
            : ""
        }
        confirmText="씬 전환"
      />

    </div>
  );
}
