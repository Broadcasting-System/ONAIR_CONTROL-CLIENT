"use client";

import { useState, type ReactNode } from "react";
import { AutoLog, AutoSettings, ChannelTable, FeatureCard } from "@/components/hall/AutoAudio";
import { ConfigButton } from "@/components/hall/HallConfigModal";
import { Notice, Panel, StatusChip } from "@/components/hall/HallControls";
import { useAutoAudio } from "@/hooks/useAutoAudio";
import { useMe } from "@/hooks/useMe";
import { AUTO_FEATURES } from "@/types/autoAudio";

const METER_LABEL: Record<string, string> = {
  none: "미터 없음",
  demo: "미터 · 시연",
  console: "미터 · 콘솔",
  bridge: "미터 · 노트북",
};

/** 오디오 › 자동 음향 탭. 공간은 페이지가 고른다 (믹서 탭과 같은 공간). lead = 페이지 제목·공간·탭 */
export default function AutoAudioPanel({ hallId, lead }: { hallId: string | null; lead: ReactNode }) {
  const {
    state,
    error,
    setEnabled,
    saveParams,
    isSavingParams,
    saveSettings,
    isSavingSettings,
    resume,
  } = useAutoAudio(hallId);
  const { canOperate, isAdmin } = useMe();
  const [showSettings, setShowSettings] = useState(false);

  const anyOn = !!state && AUTO_FEATURES.some((f) => state.features[f].enabled);

  return (
    <div className="flex h-full flex-col gap-4 md:gap-6">
      <header className="flex flex-wrap items-center gap-3 md:gap-5">
        {lead}
        <div className="ml-auto flex items-center gap-2.5 max-md:ml-0 max-md:flex-wrap">
          {isAdmin && (
            <ConfigButton tour="auto.settings-toggle" label="미터·사람 우선" onClick={() => setShowSettings((v) => !v)} />
          )}
          <StatusChip
            tour="auto.meter"
            tone={state?.meter.ok ? (state.meter.source === "demo" ? "warn" : "good") : "off"}
            label={METER_LABEL[state?.meter.source ?? "none"]}
          />
          <StatusChip
            tour="auto.running"
            tone={state?.running ? "good" : "off"}
            label={state?.running ? "자동 동작 중" : "쉬는 중"}
          />
        </div>
      </header>

      {error && <Notice>{error.message}</Notice>}
      {state?.warnings.map((w) => (
        <Notice key={w}>{w}</Notice>
      ))}
      {state && anyOn && !state.meter.ok && <Notice>{state.meter.detail}</Notice>}
      {state?.error && <Notice>{state.error}</Notice>}
      {!canOperate && <Notice tone="info">보기 전용</Notice>}

      {isAdmin && showSettings && state && (
        <Panel tour="auto.settings" title="미터·사람 우선">
          <AutoSettings
            key={state.hall.id}
            state={state}
            saving={isSavingSettings}
            onSave={saveSettings}
          />
        </Panel>
      )}

      {state && (
        <div data-tour="auto.features" className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-2 2xl:grid-cols-4">
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
          <Panel tour="auto.channels" title="채널">
            <ChannelTable state={state} canOperate={canOperate} onResume={resume} />
          </Panel>
          <Panel tour="auto.log" title="최근 동작">
            <AutoLog log={state.log} />
          </Panel>
        </div>
      )}
    </div>
  );
}
