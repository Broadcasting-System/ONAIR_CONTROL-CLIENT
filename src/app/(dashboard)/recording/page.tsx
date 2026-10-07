"use client";

import { useState } from "react";
import SectionHeader from "@/components/common/SectionHeader";
import { Notice, Panel, StatusChip } from "@/components/hall/HallControls";
import AvDeck from "@/components/recording/AvDeck";
import AvList from "@/components/recording/AvList";
import ChannelSettings, { RecorderInfo } from "@/components/recording/ChannelSettings";
import MergePanel from "@/components/recording/MergePanel";
import SourcePicker from "@/components/recording/SourcePicker";
import { useAvLibrary, useAvState } from "@/hooks/useAv";
import { useMe } from "@/hooks/useMe";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useMerge, useRecording, useRecordings } from "@/hooks/useRecording";

const topBtn =
  "flex h-9 items-center rounded-xl border border-white/10 bg-white/[0.05] px-3.5 font-mbc text-sm text-white/70 hover:bg-white/10 hover:text-white";

/** 녹음·녹화 — 화면(없음·CH1~5)과 소리(홀 콘솔·없음)를 골라 한 번에. 목록 하나, 휴대폰 영상 합치기는 맨 아래 */
export default function RecordingPage() {
  const { state, error, fetchedAt, start, stop, isStarting, isStopping, recheck } = useAvState();
  const library = useAvLibrary();
  const { recordings } = useRecordings();
  const { videos, jobs, refreshVideos, merge, isMerging, removeJob } = useMerge();
  const { canOperate, isAdmin } = useMe();

  const [pickScreen, setPickScreen] = usePersistentState<number | null>("onair.av.screen", null);
  const [pickAudio, setPickAudio] = usePersistentState<string | null>("onair.av.audio", null);
  const [fpsPick, setFpsPick] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeRec, setMergeRec] = useState<string | null>(null);

  const session = state?.session ?? null;
  const channels = state?.channels ?? [];
  const halls = state?.halls ?? [];
  const recorder = state?.recorder;

  // 녹음·녹화 중이면 그때 고른 것을 보여 주고 바꿀 수 없다
  const screen = session ? session.channel : channels.some((c) => c.channel === pickScreen) ? pickScreen : null;
  // pickAudio: null = 아직 안 고름(콘솔 녹음이 설정된 첫 홀) · "" = 소리 없음 · 홀 id
  const defaultHall = (halls.find((h) => h.configured) ?? null)?.id ?? null;
  const audio = session
    ? session.hall
    : pickAudio === ""
      ? null
      : halls.some((h) => h.id === pickAudio)
        ? pickAudio
        : defaultHall;

  // 고른 홀 콘솔의 레벨(바늘) — 이 화면 밖(말로 하는 조작 등)에서 시작한 콘솔 녹음도 여기서 보인다
  const { state: hallState, fetchedAt: hallFetchedAt } = useRecording(audio);
  const external = !session && !!hallState?.recording;
  const recording = !!session || external;

  const channel = channels.find((c) => c.channel === screen) ?? null;
  const hall = halls.find((h) => h.id === audio) ?? null;

  const onScreen = (n: number | null) => {
    setPickScreen(n);
    if (n !== null) {
      // 채널을 고르면 그 채널에 연결된 홀 콘솔이 소리로 (바꿀 수 있다)
      setPickAudio(channels.find((c) => c.channel === n)?.hall ?? "");
    } else if (!audio) {
      // 소리만인데 소리가 없으면 콘솔 하나를 먼저 골라 둔다
      setPickAudio((halls.find((h) => h.configured) ?? halls[0])?.id ?? "");
    }
  };

  const what = session
    ? session.source
    : [channel ? `CH${channel.channel} ${channel.name}`.trim() : "", hall ? `${hall.name} 콘솔` : ""]
        .filter(Boolean)
        .join(" + ") || "고른 것 없음";
  const fps = session?.fps ?? fpsPick ?? recorder?.fps ?? 30;
  const mbPerHour = (screen !== null ? state?.mbPerHour.video ?? 0 : 0) + (audio ? state?.mbPerHour.audio ?? 0 : 0);
  const free = state?.disk.free ?? null;
  const hoursLeft = free != null && mbPerHour > 0 ? free / (mbPerHour * 1e6) : null;

  let reason = "";
  if (!canOperate) reason = "보기 전용 기기예요. 녹음·녹화는 운영 권한이 있는 기기에서 할 수 있어요.";
  else if (screen === null && !audio) reason = "화면이나 소리를 골라 주세요.";
  else if (screen !== null && recorder && !recorder.ready) reason = `서버 PC 녹화기가 준비되지 않았어요 — ${recorder.detail}`;
  else if (channel && !channel.live) reason = `CH${channel.channel}에 연결된 송출 화면이 없어요.`;
  else if (hall && !hall.configured)
    reason = `${hall.name}에는 콘솔 녹음이 설정되어 있지 않아요.${isAdmin ? " 오른쪽 위 '채널 설정'에서 켜 주세요." : ""}`;
  else if (hall && hallState && hallState.configured && !hallState.connected)
    reason = `${hall.name} 녹음 장치에 연결되지 않았어요 — ${hallState.detail}`;

  const chipLabel = !recorder ? "확인 중" : recorder.ready ? "준비됨 · 서버 PC" : "준비 안 됨 · 서버 PC";
  const lanes = hallState?.lanes.map((l) => l.name) ?? [];
  const levels = hallState?.configured ? hallState.levels : [];
  const showMerge = mergeOpen || videos.length > 0 || jobs.length > 0;
  const mergeRecordingId = mergeRec ?? recordings.find((r) => r.status === "ready")?.id ?? null;

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="flex flex-wrap items-center gap-5">
        <SectionHeader className="mb-0">녹음·녹화</SectionHeader>
        <div className="relative ml-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            title={recorder ? `${recorder.encoder ?? ""} · ${recorder.fps}fps` : undefined}
            aria-expanded={showInfo}
          >
            <StatusChip tone={recorder?.ready ? "good" : "off"} label={chipLabel} />
          </button>
          {isAdmin && (
            <button type="button" onClick={() => setShowSettings((v) => !v)} className={topBtn}>
              {showSettings ? "설정 닫기" : "채널 설정"}
            </button>
          )}
          {showInfo && recorder && (
            <div className="absolute right-0 top-11 z-40 w-[300px] rounded-2xl border border-white/10 bg-[#161618] p-4 shadow-2xl">
              <RecorderInfo recorder={recorder} onRecheck={recheck} />
            </div>
          )}
        </div>
      </header>

      {error && <Notice>{error.message}</Notice>}
      {!canOperate && <Notice tone="info">보기 전용 기기입니다. 녹음·녹화·합치기는 운영 권한이 있는 기기에서 가능합니다.</Notice>}

      {isAdmin && showSettings && state && (
        <Panel title="채널 설정" hint="관리자만 보여요">
          <ChannelSettings channels={channels} halls={halls} />
        </Panel>
      )}

      <SourcePicker
        channels={channels}
        halls={halls}
        screen={screen}
        audio={audio}
        laneNames={lanes}
        recordingChannel={session?.channel ?? null}
        locked={recording || !canOperate}
        onScreen={onScreen}
        onAudio={(h) => setPickAudio(h ?? "")}
      />

      <AvDeck
        recording={recording}
        elapsed={session ? session.elapsed : (hallState?.elapsed ?? 0)}
        fetchedAt={session ? fetchedAt : hallFetchedAt}
        what={what}
        hasScreen={screen !== null}
        hasAudio={!!audio}
        fps={fps}
        fpsOptions={recorder?.fpsOptions ?? [30, 60]}
        onFps={setFpsPick}
        hoursLeft={hoursLeft}
        label={session?.label ?? hallState?.label ?? ""}
        disabled={!!reason || !state}
        reason={reason}
        busy={isStarting || isStopping}
        error={session?.error}
        lanes={lanes}
        levels={levels}
        onStart={(label) =>
          start({ channel: screen, hall: audio, label, ...(screen !== null ? { fps } : {}) })
        }
        onStop={() => stop(session ? null : audio)}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="목록" hint="녹음·녹화가 한곳에">
          <AvList
            items={library.items}
            canOperate={canOperate}
            isAdmin={isAdmin}
            onRename={library.rename}
            onRetry={library.retry}
            onRemove={library.remove}
          />
        </Panel>
        <Panel title="휴대폰 영상 합치기" hint="휴대폰으로 찍은 영상에 콘솔 소리를 입혀요">
          {showMerge ? (
            <MergePanel
              recordings={recordings}
              recordingId={mergeRecordingId}
              onRecording={(id) => setMergeRec(id || null)}
              videos={videos}
              jobs={jobs}
              canOperate={canOperate}
              onUploaded={refreshVideos}
              onMerge={merge}
              isMerging={isMerging}
              onRemoveJob={removeJob}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                disabled={!canOperate}
                onClick={() => setMergeOpen(true)}
                className="inline-flex h-[38px] items-center rounded-[10px] border border-white/12 bg-white/5 px-3.5 font-pretendard text-sm font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
              >
                + 휴대폰 영상 올리기
              </button>
              <span className="font-pretendard text-sm text-white/50">소리만 녹음한 것과 시간을 자동으로 맞춰요</span>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
