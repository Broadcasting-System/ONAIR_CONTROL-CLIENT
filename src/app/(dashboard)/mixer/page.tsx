"use client";

import { useEffect, useState } from "react";
import SectionHeader from "@/components/common/SectionHeader";
import ChannelStrip from "@/components/hall/ChannelStrip";
import { ConfigButton, MixerConfigModal } from "@/components/hall/HallConfigModal";
import { HallSwitcher, LockToggle, Notice, Panel, StatusChip } from "@/components/hall/HallControls";
import { useHalls } from "@/hooks/useHalls";
import { useMe } from "@/hooks/useMe";
import { useMixer } from "@/hooks/useMixer";
import { usePersistentState } from "@/hooks/usePersistentState";
import { cn } from "@/lib/utils";
import { DRIVER_LABEL } from "@/types/hall";

export default function MixerPage() {
  const { halls: allHalls, isLoading: hallsLoading } = useHalls();
  const halls = allHalls.filter((h) => h.hasMixer);
  const [hallId, setHallId] = usePersistentState<string | null>("onair.mixer.hall", null);
  const [locked, setLocked] = usePersistentState("onair.mixer.locked", false);
  const current = halls.find((h) => h.id === hallId) ?? halls[0];

  useEffect(() => {
    if (current && current.id !== hallId) setHallId(current.id);
  }, [current, hallId, setHallId]);

  const { state, error, recallScene, isRecalling, setLevel, setMute } = useMixer(current?.id ?? null);
  const { canOperate, isAdmin } = useMe();
  const [editing, setEditing] = useState(false);

  const connected = !!state?.connected;
  const channelMode = connected && !!state?.capabilities.includes("channel");
  const operable = canOperate && !locked;

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
          {isAdmin && state && <ConfigButton onClick={() => setEditing(true)} />}
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
      {canOperate && locked && <Notice tone="info">조작 잠금이 켜져 있습니다. 행사가 끝나면 잠금을 풀어주세요.</Notice>}

      <Panel title="씬" hint="누르면 콘솔 전체가 저장된 씬으로 바뀝니다 · 콘솔에서 바꿔도 여기 반영됩니다">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3.5">
          {(state?.scenes ?? []).map((scene) => {
            const active = state?.currentScene === scene.pc;
            return (
              <button
                key={scene.pc}
                type="button"
                disabled={!operable || !connected || isRecalling}
                onClick={() => recallScene(scene.pc)}
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
                </span>
                <span className="font-mbc text-xl text-white">{scene.name}</span>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel
        title="채널"
        hint="페이더를 끌거나 방향키로 조절 · MUTE로 즉시 차단"
        className="flex min-h-[420px] flex-1 flex-col"
      >
        <div className="relative flex min-h-0 flex-1">
          <div className={cn("flex min-h-0 flex-1 gap-2.5 overflow-x-auto", !channelMode && "opacity-30")}>
            {(state?.channels ?? []).map((ch) => (
              <ChannelStrip
                key={ch.id}
                channel={ch}
                subLabel={`CH ${ch.id.padStart(2, "0")}`}
                disabled={!operable || !channelMode}
                onLevel={(v) => setLevel(ch.id, v)}
                onMute={(m) => setMute(ch.id, m)}
              />
            ))}
            <div className="flex-1" />
            {state?.master && (
              <ChannelStrip
                master
                channel={state.master}
                subLabel={state.master.label ?? "MASTER"}
                disabled={!operable || !channelMode}
                onLevel={(v) => setLevel(state.master!.id, v)}
                onMute={(m) => setMute(state.master!.id, m)}
              />
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

      {editing && state && current && (
        <MixerConfigModal hallId={current.id} state={state} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
