"use client";

import { useEffect, useState } from "react";
import SectionHeader from "@/components/common/SectionHeader";
import { HallSwitcher, Notice, Panel, StatusChip } from "@/components/hall/HallControls";
import MergePanel from "@/components/recording/MergePanel";
import RecordDeck from "@/components/recording/RecordDeck";
import RecordingList from "@/components/recording/RecordingList";
import RecordingSettings from "@/components/recording/RecordingSettings";
import { useHalls } from "@/hooks/useHalls";
import { useMe } from "@/hooks/useMe";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useMerge, useRecording, useRecordings } from "@/hooks/useRecording";

export default function RecordingPage() {
  const { halls, isLoading: hallsLoading } = useHalls();
  const [hallId, setHallId] = usePersistentState<string | null>("onair.recording.hall", null);
  // 녹음이 설정된 공간을 먼저 (강당)
  const current = halls.find((h) => h.id === hallId) ?? halls.find((h) => h.hasRecording) ?? halls[0];

  useEffect(() => {
    if (current && current.id !== hallId) setHallId(current.id);
  }, [current, hallId, setHallId]);

  const { state, error, fetchedAt, start, stop, isStarting, isStopping } = useRecording(current?.id ?? null);
  const { recordings, retry, remove, rename } = useRecordings();
  const { videos, jobs, refreshVideos, merge, isMerging, removeJob } = useMerge();
  const { canOperate, isAdmin } = useMe();
  const [picked, setPicked] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const configured = !!state?.configured;
  const connected = !!state?.connected;
  // 가장 최근의 받아 온 녹음을 기본으로
  const pickedId = picked ?? recordings.find((r) => r.status === "ready")?.id ?? null;

  if (!hallsLoading && halls.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader>녹음</SectionHeader>
        <Notice tone="info">설정된 공간(강당·다목적홀)이 없습니다.</Notice>
      </div>
    );
  }

  const chipLabel = !configured
    ? "설정 안 됨"
    : `${state?.driver === "mock" ? "모의 장비" : state?.inputDevice || "녹음"} ${connected ? "online" : "offline"}`;

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="flex flex-wrap items-center gap-5">
        <SectionHeader className="mb-0">녹음</SectionHeader>
        <HallSwitcher halls={halls} value={current?.id} onChange={setHallId} />
        <div className="ml-auto flex items-center gap-2.5">
          <StatusChip tone={connected ? (state?.recording ? "warn" : "good") : "off"} label={chipLabel} />
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="flex h-9 items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 font-mbc text-sm text-white/60 hover:bg-white/5 hover:text-white/85"
            >
              {showSettings ? "설정 닫기" : "녹음 설정"}
            </button>
          )}
        </div>
      </header>

      {error && <Notice>{error.message}</Notice>}
      {state && configured && !connected && <Notice>녹음 장치에 연결되지 않았습니다 — {state.detail}</Notice>}
      {state && !configured && (
        <Notice tone="info">
          {current?.name}에는 아직 녹음이 설정되어 있지 않습니다.{" "}
          {isAdmin
            ? "오른쪽 위 '녹음 설정'에서 노트북과 USB 오디오 인터페이스를 고르세요."
            : "관리자가 녹음 설정에서 켜면 여기서 녹음할 수 있어요."}
        </Notice>
      )}
      {!canOperate && <Notice tone="info">보기 전용 기기입니다. 녹음·합치기는 운영 권한이 있는 기기에서 가능합니다.</Notice>}

      {isAdmin && state && current && (showSettings || !configured) && (
        <Panel title="녹음 설정" hint="관리자만 보여요">
          <RecordingSettings key={`${current.id}-${configured}`} hallId={current.id} state={state} />
        </Panel>
      )}

      {state && configured && (
        <RecordDeck
          state={state}
          fetchedAt={fetchedAt}
          disabled={!canOperate || !connected}
          busy={isStarting || isStopping}
          onStart={start}
          onStop={() => stop()}
        />
      )}

      <div className="grid items-start gap-[18px] xl:grid-cols-2">
        <Panel title="최근 녹음" hint="누르면 바로 들어요 · 통로 이름을 누르면 그 소리만 받아요">
          <RecordingList
            recordings={recordings}
            selected={pickedId}
            canOperate={canOperate}
            isAdmin={isAdmin}
            onPick={setPicked}
            onRetry={retry}
            onRemove={remove}
            onRename={(id, label) => rename({ id, label })}
          />
        </Panel>
        <Panel title="영상 합치기" hint="휴대폰 영상 + 콘솔 녹음 → 깨끗한 소리의 영상">
          <MergePanel
            recordings={recordings}
            recordingId={pickedId}
            onRecording={(id) => setPicked(id || null)}
            videos={videos}
            jobs={jobs}
            canOperate={canOperate}
            onUploaded={refreshVideos}
            onMerge={merge}
            isMerging={isMerging}
            onRemoveJob={removeJob}
          />
        </Panel>
      </div>
    </div>
  );
}
