"use client";

import { useEffect, useState } from "react";
import SectionHeader from "@/components/common/SectionHeader";
import { AutoLog, AutoSettings, ChannelTable, FeatureCard } from "@/components/hall/AutoAudio";
import { ConfigButton } from "@/components/hall/HallConfigModal";
import { HallSwitcher, Notice, Panel, StatusChip } from "@/components/hall/HallControls";
import { useAutoAudio } from "@/hooks/useAutoAudio";
import { useHalls } from "@/hooks/useHalls";
import { useMe } from "@/hooks/useMe";
import { usePersistentState } from "@/hooks/usePersistentState";
import { AUTO_FEATURES } from "@/types/autoAudio";

const METER_LABEL: Record<string, string> = {
  none: "미터 없음",
  demo: "미터 · 시연",
  console: "미터 · 콘솔",
  bridge: "미터 · 노트북",
};

export default function AutoAudioPage() {
  const { halls: allHalls, isLoading: hallsLoading } = useHalls();
  const halls = allHalls.filter((h) => h.hasMixer);
  const [hallId, setHallId] = usePersistentState<string | null>("onair.autoAudio.hall", null);
  const current = halls.find((h) => h.id === hallId) ?? halls[0];

  useEffect(() => {
    if (current && current.id !== hallId) setHallId(current.id);
  }, [current, hallId, setHallId]);

  const {
    state,
    error,
    setEnabled,
    saveParams,
    isSavingParams,
    saveSettings,
    isSavingSettings,
    resume,
  } = useAutoAudio(current?.id ?? null);
  const { canOperate, isAdmin } = useMe();
  const [showSettings, setShowSettings] = useState(false);

  if (!hallsLoading && halls.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader>자동 음향</SectionHeader>
        <Notice tone="info">설정된 오디오 믹서가 없습니다.</Notice>
      </div>
    );
  }

  const anyOn = !!state && AUTO_FEATURES.some((f) => state.features[f].enabled);

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="flex flex-wrap items-center gap-5">
        <SectionHeader className="mb-0">자동 음향</SectionHeader>
        <HallSwitcher halls={halls} value={current?.id} onChange={setHallId} />
        <div className="ml-auto flex items-center gap-2.5">
          {isAdmin && (
            <ConfigButton label="미터·사람 우선" onClick={() => setShowSettings((v) => !v)} />
          )}
          <StatusChip
            tone={state?.meter.ok ? (state.meter.source === "demo" ? "warn" : "good") : "off"}
            label={METER_LABEL[state?.meter.source ?? "none"]}
          />
          <StatusChip
            tone={state?.running ? "good" : "off"}
            label={state?.running ? "자동 동작 중" : "쉬는 중"}
          />
        </div>
      </header>

      <Notice tone="info">
        정해 둔 규칙대로만 움직여요 (AI 아님). 사람이 채널을 만지면 그 채널은{" "}
        <b>{state?.overrideS ?? 30}초</b> 동안 자동이 손을 떼고, 기능을 끄면 사람이 맞춘 높이로
        돌아가요.
      </Notice>
      {error && <Notice>{error.message}</Notice>}
      {state?.warnings.map((w) => (
        <Notice key={w}>{w}</Notice>
      ))}
      {state && anyOn && !state.meter.ok && <Notice>{state.meter.detail}</Notice>}
      {state?.meter.source === "demo" && (
        <Notice>시연용 가짜 미터를 쓰고 있어요 — 실제 소리와 상관없이 페이더가 움직입니다.</Notice>
      )}
      {state?.error && <Notice>{state.error}</Notice>}
      {!canOperate && (
        <Notice tone="info">
          보기 전용 기기입니다. 켜고 끄기는 운영 권한이 있는 기기에서 가능합니다.
        </Notice>
      )}

      {isAdmin && showSettings && state && (
        <Panel title="미터·사람 우선" hint="관리자">
          <AutoSettings
            key={state.hall.id}
            state={state}
            saving={isSavingSettings}
            onSave={saveSettings}
          />
        </Panel>
      )}

      {state && (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 2xl:grid-cols-4">
          {AUTO_FEATURES.map((f) => (
            <FeatureCard
              key={`${state.hall.id}-${f}`}
              feature={f}
              state={state}
              canOperate={canOperate}
              isAdmin={isAdmin}
              saving={isSavingParams}
              onToggle={(on) => setEnabled(f, on)}
              onSave={(params) => saveParams(f, params)}
            />
          ))}
        </div>
      )}

      {state && (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Panel title="채널" hint="막대 = 지금 입력 · 흰 선 = 기준">
            <ChannelTable state={state} canOperate={canOperate} onResume={resume} />
          </Panel>
          <Panel title="최근 동작" hint="무엇을 왜 바꿨는지">
            <AutoLog log={state.log} />
          </Panel>
        </div>
      )}
    </div>
  );
}
