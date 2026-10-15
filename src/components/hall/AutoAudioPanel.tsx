"use client";

import { useState, type ReactNode } from "react";
import { AutoSettings, ChannelMatrix, FeatureCard, FeatureParamsModal } from "@/components/hall/AutoAudio";
import { ConfigButton } from "@/components/hall/HallConfigModal";
import { Notice, Panel } from "@/components/hall/HallControls";
import { useAutoAudio } from "@/hooks/useAutoAudio";
import { useMe } from "@/hooks/useMe";
import { cn } from "@/lib/utils";
import { AUTO_FEATURES, type AutoFeature } from "@/types/autoAudio";

const METER_LABEL: Record<string, string> = {
  none: "미터 없음",
  demo: "미터 · 시연",
  console: "미터 · 콘솔",
  bridge: "미터 · 노트북",
};

/** 위 줄 상태 칩 — 흰 점, 문제가 있을 때만 빨간 점 */
function Chip({ tour, alert, dim, label, title }: { tour: string; alert?: boolean; dim?: boolean; label: string; title?: string }) {
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

/** 문제 알림 줄 (빨강) */
function Alert({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#FF3B3B]/35 bg-[#FF3B3B]/[0.08] px-4 py-2.5 font-pretendard text-sm text-white/85">
      {children}
    </div>
  );
}

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
  // 숫자 설정 창을 연 기능
  const [editing, setEditing] = useState<AutoFeature | null>(null);

  const anyOn = !!state && AUTO_FEATURES.some((f) => state.features[f].enabled);
  // 기능이 켜졌는데 미터가 없으면 문제
  const meterProblem = !!state && anyOn && !state.meter.ok;

  return (
    <div className="flex h-full flex-col gap-4 md:gap-3.5">
      <header className="flex flex-wrap items-center gap-3 md:gap-5">
        {lead}
        <div className="ml-auto flex items-center gap-2.5 max-md:ml-0 max-md:flex-wrap">
          {isAdmin && (
            <ConfigButton tour="auto.settings-toggle" label="미터·사람 우선" onClick={() => setShowSettings((v) => !v)} />
          )}
          <Chip
            tour="auto.meter"
            alert={meterProblem}
            dim={!state?.meter.ok && !meterProblem}
            label={METER_LABEL[state?.meter.source ?? "none"]}
            title={state?.meter.detail || undefined}
          />
          <Chip
            tour="auto.running"
            alert={!!state?.error}
            dim={!state?.running}
            label={state?.running ? "자동 동작 중" : "쉬는 중"}
          />
        </div>
      </header>

      {error && <Alert>{error.message}</Alert>}
      {state?.warnings.map((w) => (
        <Alert key={w}>{w}</Alert>
      ))}
      {meterProblem && state.meter.detail && <Alert>{state.meter.detail}</Alert>}
      {state?.error && <Alert>{state.error}</Alert>}
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
        <div data-tour="auto.features" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {AUTO_FEATURES.map((f) => (
            <FeatureCard
              key={`${state.hall.id}-${f}`}
              feature={f}
              state={state}
              canOperate={canOperate}
              onToggle={(on) => setEnabled(f, on)}
              onOpen={() => setEditing(f)}
            />
          ))}
        </div>
      )}

      {state && (
        <section
          data-tour="auto.channels"
          className="md:rounded-[20px] md:border md:border-white/[0.08] md:bg-[rgba(14,14,17,0.74)] md:px-1.5 md:py-2 md:backdrop-blur-md"
        >
          <h3 className="mb-3 font-mbc text-[20px] text-white md:hidden">채널</h3>
          <ChannelMatrix
            state={state}
            canOperate={canOperate}
            isAdmin={isAdmin}
            saving={isSavingParams}
            onSaveParams={(f, params) => saveParams(f, params, true)}
            onResume={resume}
          />
        </section>
      )}

      {state && editing && (
        <FeatureParamsModal
          key={`${state.hall.id}-${editing}`}
          feature={editing}
          state={state}
          isAdmin={isAdmin}
          saving={isSavingParams}
          onClose={() => setEditing(null)}
          onSave={(params) => saveParams(editing, params)}
        />
      )}
    </div>
  );
}
