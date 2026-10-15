"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import NeonButton from "@/components/common/NeonButton";
import Select from "@/components/common/Select";
import { toast } from "@/components/common/Toast";
import { duration, gb, when } from "@/components/recording/format";
import { recordingApi } from "@/lib/recordingApi";
import { cn } from "@/lib/utils";
import type { AmbientMode, LaneMode, MergeJob, RecordingItem, UploadedVideo } from "@/types/recording";

const STAGES: { key: MergeJob["stage"]; name: string }[] = [
  { key: "extract", name: "영상 소리 꺼내기" },
  { key: "prepare", name: "녹음 소리 준비" },
  { key: "sync", name: "시작 위치·시계 차이 찾기" },
  { key: "render", name: "합치기" },
];

const btn =
  "inline-flex h-[34px] shrink-0 items-center rounded-[10px] border border-white/12 bg-white/5 px-3 font-mbc text-[13px] text-white/75 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 max-md:h-11 max-md:px-3.5";

type StepState = "done" | "cur" | "todo";

/** 단계 — 끝난 단계는 흰 원, 지금 단계는 빨간 빛 원 */
function Step({ n, state, title, last, children }: { n: number; state: StepState; title: string; last?: boolean; children?: React.ReactNode }) {
  return (
    <div className={cn("grid grid-cols-[28px_minmax(0,1fr)] gap-3 py-2.5", !last && "border-b border-white/[0.05]")}>
      <span
        className={cn(
          "grid h-[26px] w-[26px] place-items-center rounded-full border-[1.5px] font-orbitron text-[11px] font-bold",
          state === "done" && "border-white bg-white text-[#0b0b0d]",
          state === "cur" && "border-[#ff4a43] text-white shadow-[0_0_10px_-2px_#ff3b3b]",
          state === "todo" && "border-white/25 text-white/60",
        )}
      >
        {n}
      </span>
      <div className="min-w-0">
        <b className="block pt-[3px] font-mbc text-[14.5px] font-normal text-white">{title}</b>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}

/** 하나 고르기 칩 — 고른 것은 흰 칩 */
function Chips<T extends string>({
  value,
  options,
  onChange,
  disabled,
  tour,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  tour?: string;
}) {
  return (
    <div data-tour={tour} className="flex flex-wrap gap-[5px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-[34px] rounded-[10px] border px-3 font-mbc text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 max-md:h-11 max-md:px-3.5",
            value === o.value ? "border-white bg-white text-[#0b0b0d]" : "border-white/12 bg-white/[0.04] text-white/70 enabled:hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const optLabel = "w-[64px] shrink-0 font-pretendard text-[12.5px] text-white/45";

/** 휴대폰 영상 합치기 — 1 영상 올리기 → 2 녹음 고르기 → 3 소리 고르기 → 4 합치기·받기. 네 단계가 늘 보인다 */
export default function MergePanel({
  recordings,
  recordingId,
  onRecording,
  videos,
  jobs,
  canOperate,
  onUploaded,
  onMerge,
  isMerging,
  onRemoveJob,
}: {
  recordings: RecordingItem[];
  recordingId: string | null;
  onRecording: (id: string) => void;
  videos: UploadedVideo[];
  jobs: MergeJob[];
  canOperate: boolean;
  onUploaded: () => void;
  onMerge: (body: { videoId: string; recordingId: string; lanes: LaneMode; ambient: AmbientMode; nudgeMs: number }) => Promise<MergeJob>;
  isMerging: boolean;
  onRemoveJob: (id: string) => void;
}) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ name: string; ratio: number; abort: () => void } | null>(null);
  const [lanes, setLanes] = useState<LaneMode>("both");
  const [ambient, setAmbient] = useState<AmbientMode>("off");
  const [nudge, setNudge] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const ready = recordings.filter((r) => r.status === "ready");
  const recording = ready.find((r) => r.id === recordingId) ?? null;
  const video = videos.find((v) => v.id === videoId) ?? null;
  const job = jobs.find((j) => j.id === jobId) ?? null;
  const running = !!job && (job.status === "queued" || job.status === "running");
  const laneNames = recording?.lanes ?? ["통로 1", "통로 2"];

  const send = (file: File) => {
    if (!canOperate || upload) return;
    const { done, abort } = recordingApi.uploadVideo(file, (ratio) => setUpload((u) => (u ? { ...u, ratio } : u)));
    setUpload({ name: file.name, ratio: 0, abort });
    done
      .then((v) => {
        setVideoId(v.id);
        onUploaded();
        if (!v.hasAudio) toast.error("영상에 소리가 없어요");
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setUpload(null));
  };

  const start = async () => {
    if (!video || !recording) return;
    onRecording(recording.id); // 새 녹음이 들어와도 고른 녹음이 바뀌지 않게
    try {
      const j = await onMerge({ videoId: video.id, recordingId: recording.id, lanes, ambient, nudgeMs: nudge });
      setJobId(j.id);
    } catch {
      /* 알림은 훅에서 */
    }
  };

  const stageIndex = job ? STAGES.findIndex((s) => s.key === job.stage) : -1;
  const done = job?.status === "done";
  const others = jobs.filter((j) => j.id !== jobId && j.status === "done").slice(0, 3);

  // 지금 단계 — 끝난 단계는 흰 원, 처음으로 남은 단계에 빨간 빛
  const finished = [!!video, !!recording, !!video && !!recording, done];
  const cur = finished.indexOf(false);
  const st = (i: number): StepState => (finished[i] ? "done" : i === cur ? "cur" : "todo");

  return (
    <div className="flex flex-col">
      <Step n={1} state={st(0)} title="휴대폰 영상 올리기">
        {upload ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 font-pretendard text-[12.5px] text-white/60">
              <span className="min-w-0 truncate text-[13px] font-semibold text-white">{upload.name}</span>
              <span className="ml-auto shrink-0 font-orbitron text-[11px]">{Math.round(upload.ratio * 100)}%</span>
              <button type="button" className={btn} onClick={upload.abort}>
                멈추기
              </button>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-white/[0.07]">
              <div className="h-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" style={{ width: `${upload.ratio * 100}%` }} />
            </div>
          </div>
        ) : video ? (
          <div className="flex items-center gap-2.5">
            <p className="min-w-0 flex-1 truncate font-pretendard text-[12.5px] font-medium text-white/45">
              {[video.name, duration(video.duration), gb(video.size), !video.hasAudio ? "소리 없음" : ""].filter(Boolean).join(" · ")}
            </p>
            <button type="button" className={btn} onClick={() => setVideoId(null)} disabled={running}>
              바꾸기
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              data-tour="recording.merge-upload"
              type="button"
              disabled={!canOperate}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) send(f);
              }}
              className={cn(
                "flex h-16 items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed font-pretendard text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                dragOver ? "border-white/60 bg-white/[0.06] text-white" : "border-white/[0.18] text-white/55 enabled:hover:text-white/80",
              )}
            >
              <Upload size={16} />
              영상을 끌어다 놓거나 고르기
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) send(f);
                e.target.value = "";
              }}
            />
            {videos.length > 0 && (
              <Select
                value=""
                onChange={(id) => id && setVideoId(id)}
                placeholder="올린 영상에서 고르기"
                aria-label="올린 영상"
                options={videos.map((v) => ({
                  value: v.id,
                  label: `${v.name} · ${duration(v.duration)} · ${when(v.uploadedAt)}`,
                }))}
                className="h-[38px] w-full rounded-[11px] max-md:h-11"
              />
            )}
          </div>
        )}
      </Step>

      <Step n={2} state={st(1)} title="녹음 고르기">
        <Select
          tour="recording.merge-recording"
          value={recording?.id ?? ""}
          onChange={onRecording}
          disabled={running || !ready.length}
          placeholder={ready.length ? "녹음 고르기" : "녹음이 없어요"}
          aria-label="녹음"
          options={ready.map((r) => ({
            value: r.id,
            label: `${r.label || "이름 없는 녹음"} · ${r.hallName} · ${when(r.startedAt)} · ${duration(r.duration)}`,
          }))}
          className="h-[38px] w-full rounded-[11px] max-md:h-11"
        />
      </Step>

      <Step n={3} state={st(2)} title="소리 고르기">
        <div className="flex flex-col gap-2">
          <Chips
            tour="recording.merge-lanes"
            value={lanes}
            onChange={setLanes}
            disabled={running}
            options={[
              { value: "both", label: "둘 다" },
              { value: "1", label: `${laneNames[0] ?? "통로 1"}만` },
              ...((recording?.channels ?? 2) > 1 ? [{ value: "2" as LaneMode, label: `${laneNames[1] ?? "통로 2"}만` }] : []),
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className={optLabel}>현장음 섞기</span>
            <Chips
              value={ambient}
              onChange={setAmbient}
              disabled={running}
              options={[
                { value: "off", label: "끔" },
                { value: "low", label: "약하게" },
                { value: "mid", label: "보통" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className={optLabel}>미세 조정</span>
            <input
              type="number"
              step={10}
              min={-1000}
              max={1000}
              value={nudge}
              disabled={running}
              aria-label="미세 조정 ms"
              onChange={(e) => setNudge(Math.max(-1000, Math.min(1000, Math.round(Number(e.target.value) || 0))))}
              className="h-[34px] w-20 rounded-[10px] border border-white/12 bg-black/20 px-2 text-center font-orbitron text-[13px] text-white focus:border-white/35 focus:outline-none max-md:h-11 max-md:text-base"
            />
            <span className="font-orbitron text-[11px] text-white/40">ms</span>
          </div>
        </div>
      </Step>

      <Step n={4} state={done ? "done" : st(3)} title="합치기" last>
        {job && (
          <div>
            <div className="h-1.5 overflow-hidden rounded bg-white/[0.07]">
              <div
                className={cn(
                  "h-full transition-[width] duration-300",
                  job.status === "error" ? "bg-white/30" : "bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]",
                )}
                style={{ width: `${Math.round(job.progress * 100)}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-pretendard text-[12px]">
              {job.status === "queued" && <span className="text-white/60">기다리는 중</span>}
              {STAGES.map((s, i) => {
                const ok = done || (stageIndex >= 0 && i < stageIndex);
                const now = !done && i === stageIndex;
                return (
                  <span key={s.key} className={ok ? "text-white/70" : now ? "text-white" : "text-white/30"}>
                    {ok ? "✓ " : ""}
                    {s.name}
                  </span>
                );
              })}
            </div>
            {job.status === "error" && <p className="mt-2 font-pretendard text-[12.5px] text-[#ff8a8a]">{job.error}</p>}
            {done && job.summary && (
              <p className="mt-2 font-pretendard text-[12.5px] leading-relaxed text-white/70">
                {job.summary.start}
                <br />
                {job.summary.drift}
                {job.sync && !job.sync.precise && (
                  <>
                    <br />
                    <span className="text-[#ff8a8a]">0.01초 단위로 맞춤</span>
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </Step>

      <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
        {done && job && (
          <>
            <a
              href={recordingApi.jobFileUrl(job.id)}
              target="_blank"
              rel="noreferrer"
              className="font-pretendard text-[13px] text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
            >
              새 창에서 보기
            </a>
            <a href={recordingApi.jobFileUrl(job.id, true)} className={cn(btn, "h-[42px] px-4 text-[14px] text-white")}>
              MP4 받기 · {gb(job.size)}
            </a>
          </>
        )}
        <NeonButton
          data-tour="recording.merge-start"
          onClick={start}
          disabled={!canOperate || !video || !recording || !video.hasAudio || running || isMerging || !!upload}
          className="min-w-[140px] max-md:w-full"
        >
          {running ? "합치는 중" : "합치기"}
        </NeonButton>
      </div>

      {others.length > 0 && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="mb-2 font-mbc text-[13px] text-white/55">전에 합친 영상</p>
          <div className="flex flex-col gap-1.5">
            {others.map((j) => (
              <div key={j.id} className="flex items-center gap-2 font-pretendard text-[13px] text-white/60">
                <span className="min-w-0 truncate text-white/80">{j.name}</span>
                <span className="shrink-0 text-xs text-white/35">{when(j.createdAt)}</span>
                <a href={recordingApi.jobFileUrl(j.id, true)} className={cn(btn, "ml-auto")}>
                  받기
                </a>
                <button type="button" className={btn} disabled={!canOperate} onClick={() => onRemoveJob(j.id)}>
                  지우기
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
