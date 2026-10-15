"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { posToDb } from "@/components/common/LedMeter";
import SectionHeader from "@/components/common/SectionHeader";
import { Panel } from "@/components/hall/HallControls";
import AvDeck from "@/components/recording/AvDeck";
import AvList from "@/components/recording/AvList";
import ChannelSettings, { RecorderInfo } from "@/components/recording/ChannelSettings";
import MergePanel from "@/components/recording/MergePanel";
import SourcePicker from "@/components/recording/SourcePicker";
import { useAvLibrary, useAvState } from "@/hooks/useAv";
import { useMe } from "@/hooks/useMe";
import { useMixer } from "@/hooks/useMixer";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useMerge, useRecording, useRecordings } from "@/hooks/useRecording";
import { cn } from "@/lib/utils";

const topBtn =
  "flex h-9 items-center rounded-xl border border-white/10 bg-white/[0.05] px-3.5 font-mbc text-sm text-white/70 hover:bg-white/10 hover:text-white max-md:h-11";

const card =
  "rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-4 backdrop-blur-md md:rounded-[24px] md:border-sidebar-border md:bg-sidebar md:px-[18px] md:py-4 md:shadow-2xl";

/** 녹음·녹화 (시안 A) — 위 녹화 데크와 화면 카드 줄, 아래 왼쪽 목록 카드, 오른쪽 휴대폰 영상 합치기 */
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

  // 고른 홀 콘솔의 녹음 상태(레벨·시간) — 이 화면 밖(말로 하는 조작 등)에서 시작한 콘솔 녹음도 여기서 보인다
  const { state: hallState, fetchedAt: hallFetchedAt } = useRecording(audio);
  const { state: mixer } = useMixer(audio);
  const external = !session && !!hallState?.recording;
  const recording = !!session || external;

  const hall = halls.find((h) => h.id === audio) ?? null;

  const onScreen = (n: number | null) => {
    setPickScreen(n);
    if (n !== null) {
      // 채널을 고르면 그 채널에 연결된 홀 콘솔이 소리로 (연결된 홀이 없으면 소리 없음, 바꿀 수 있다)
      setPickAudio(channels.find((c) => c.channel === n)?.hall ?? "");
    } else if (!audio) {
      // 소리만인데 소리가 없으면 콘솔 하나를 먼저 골라 둔다
      setPickAudio((halls.find((h) => h.configured) ?? halls[0])?.id ?? "");
    }
  };

  const fps = session?.fps ?? fpsPick ?? recorder?.fps ?? 30;
  const mbPerHour = (screen !== null ? state?.mbPerHour.video ?? 0 : 0) + (audio ? state?.mbPerHour.audio ?? 0 : 0);
  const free = state?.disk.free ?? null;
  const hoursLeft = free != null && mbPerHour > 0 ? free / (mbPerHour * 1e6) : null;

  let reason = "";
  if (!canOperate) reason = "보기 전용";
  else if (screen === null && !audio) reason = "화면이나 소리를 골라 주세요";
  else if (screen !== null && recorder && !recorder.ready) reason = "서버 PC 녹화기 준비 안 됨";
  else if (hall && !hall.configured) reason = `${hall.name} 콘솔 녹음 꺼짐`;
  else if (hall && hallState && hallState.configured && !hallState.connected) reason = `${hall.name} 녹음 장치 연결 안 됨`;

  // 레벨 — 고른 홀의 녹음 입력(콘솔에서 들어오는 통로) → 콘솔 미터(MAIN) → 없으면 숨김
  const masterMeter = mixer?.connected && mixer.capabilities.includes("meter") ? mixer.master?.meter ?? null : null;
  const levels: (number | null)[] | null =
    hallState?.configured && hallState.connected && hallState.levels.length
      ? hallState.levels
      : masterMeter != null
        ? [posToDb(masterMeter / 100)]
        : null;

  const mergeRecordingId = mergeRec ?? recordings.find((r) => r.status === "ready")?.id ?? null;
  const statusLabel = !recorder ? "서버 PC 확인 중" : recorder.ready ? "서버 PC 준비됨" : "서버 PC 준비 안 됨";

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3 md:gap-5">
        <SectionHeader className="mb-0 max-md:text-[26px]">녹음·녹화</SectionHeader>
        <div className="relative ml-auto flex items-center gap-2.5">
          <button
            data-tour="recording.status"
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            title={recorder ? [recorder.encoder, `${recorder.fps}fps`, recorder.detail].filter(Boolean).join(" · ") : undefined}
            aria-expanded={showInfo}
            className="flex h-9 items-center gap-[7px] rounded-xl px-2 font-pretendard text-[13px] font-medium text-white/75 hover:text-white max-md:h-11"
          >
            <i
              className={cn(
                "h-[7px] w-[7px] rounded-full",
                !recorder
                  ? "bg-white/30"
                  : recorder.ready
                    ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]"
                    : "bg-[#ff3b3b] shadow-[0_0_6px_#ff3b3b]",
              )}
            />
            {statusLabel}
          </button>
          {isAdmin && (
            <button data-tour="recording.settings-toggle" type="button" onClick={() => setShowSettings((v) => !v)} className={topBtn}>
              {showSettings ? "설정 닫기" : "채널 설정"}
            </button>
          )}
          {showInfo && recorder && (
            <div className="absolute right-0 top-11 z-40 w-[300px] rounded-2xl border border-white/10 bg-[#161618] p-4 shadow-2xl max-md:top-12">
              <RecorderInfo recorder={recorder} onRecheck={recheck} />
            </div>
          )}
        </div>
      </header>

      {error && <p className="font-pretendard text-[13px] text-[#ff8a8a]">{error.message}</p>}

      {isAdmin && showSettings && state && (
        <Panel tour="recording.settings" title="채널 설정">
          <ChannelSettings channels={channels} halls={halls} />
        </Panel>
      )}

      <AvDeck
        recording={recording}
        busy={isStarting ? "starting" : isStopping ? "stopping" : null}
        audioOnly={screen === null}
        elapsed={session ? session.elapsed : (hallState?.elapsed ?? 0)}
        fetchedAt={session ? fetchedAt : hallFetchedAt}
        label={session?.label ?? hallState?.label ?? ""}
        free={free}
        hoursLeft={hoursLeft}
        ready={!!state}
        disabled={!!reason || !state}
        reason={reason}
        error={session?.error}
        channels={channels}
        halls={halls}
        screen={screen}
        audio={audio}
        locked={recording || !canOperate}
        onScreen={onScreen}
        onAudio={(h) => setPickAudio(h ?? "")}
        fps={fps}
        fpsOptions={recorder?.fpsOptions ?? [30, 60]}
        onFps={setFpsPick}
        levels={levels}
        onStart={(label) => start({ channel: screen, hall: audio, label, ...(screen !== null ? { fps } : {}) })}
        onStop={() => stop(session ? null : audio)}
      >
        <SourcePicker channels={channels} screen={screen} locked={recording || !canOperate} onScreen={onScreen} />
      </AvDeck>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section data-tour="recording.list" className={card}>
          <AvList
            items={library.items}
            canOperate={canOperate}
            isAdmin={isAdmin}
            onRename={library.rename}
            onRetry={library.retry}
            onRemove={library.remove}
          />
        </section>
        <section data-tour="recording.merge" className={card}>
          {/* 폰에서는 접어 둔다 — 제목을 누르면 펼침 */}
          <button
            data-tour="recording.merge-open"
            type="button"
            aria-expanded={mergeOpen}
            onClick={() => setMergeOpen((v) => !v)}
            className="flex w-full items-center gap-2 text-left md:pointer-events-none"
          >
            <h3 className="font-mbc text-[17px] text-white md:text-[18px]">휴대폰 영상 합치기</h3>
            <ChevronDown size={18} className={cn("ml-auto text-white/50 transition-transform md:hidden", mergeOpen && "rotate-180")} />
          </button>
          <div className={cn("mt-1", !mergeOpen && "max-md:hidden")}>
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
          </div>
        </section>
      </div>
    </div>
  );
}
