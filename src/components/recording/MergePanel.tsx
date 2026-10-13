"use client";

import { useRef, useState } from "react";
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
  "h-[34px] rounded-[10px] border border-white/12 bg-white/5 px-3 font-mbc text-[13px] text-white/75 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35";

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
      <span
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full border font-orbitron text-xs",
          done ? "border-white/40 bg-white/[0.14] text-white" : "border-white/12 bg-white/[0.06] text-white/60",
        )}
      >
        {n}
      </span>
      <div className="min-w-0">
        <h4 className="mb-2 mt-[3px] font-mbc text-[17px] text-white">{title}</h4>
        {children}
      </div>
    </div>
  );
}

function Seg<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-white/10">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 px-3.5 font-mbc text-sm transition-colors disabled:cursor-not-allowed",
            i > 0 && "border-l border-white/[0.08]",
            value === o.value ? "bg-red-400/[0.18] text-white" : "bg-white/[0.03] text-white/50 enabled:hover:text-white/80",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 영상 합치기 — 휴대폰 영상 올리기 → 녹음 고르기 → 소리 고르기 → 합치기·받기 */
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
    const { done, abort } = recordingApi.uploadVideo(file, (ratio) =>
      setUpload((u) => (u ? { ...u, ratio } : u)),
    );
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

  return (
    <div className="flex flex-col gap-3.5">
      <Step n={1} done={!!video} title="휴대폰 영상 올리기">
        {upload ? (
          <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5">
            <div className="flex items-center gap-2 font-pretendard text-[13px] text-white/70">
              <span className="truncate font-mbc text-[15px] text-white">{upload.name}</span>
              <span className="ml-auto shrink-0">올리는 중 {Math.round(upload.ratio * 100)}%</span>
              <button type="button" className={btn} onClick={upload.abort}>
                멈추기
              </button>
            </div>
            <div className="h-2 overflow-hidden rounded bg-white/[0.07]">
              <div className="h-full bg-[linear-gradient(90deg,#ff6b6b,#FF3B3B)]" style={{ width: `${upload.ratio * 100}%` }} />
            </div>
          </div>
        ) : video ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 font-pretendard text-[13px]">
            <span className="truncate font-mbc text-[15px] text-white">{video.name}</span>
            <span className="shrink-0 text-xs text-white/40">
              {gb(video.size)} · {duration(video.duration)}
              {!video.hasAudio && " · 소리 없음"}
            </span>
            <button type="button" className={cn(btn, "ml-auto")} onClick={() => setVideoId(null)} disabled={running}>
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
                "rounded-[14px] border border-dashed px-4 py-[18px] text-center font-pretendard text-[13px] text-white/50 disabled:cursor-not-allowed disabled:opacity-40",
                dragOver ? "border-red-400/60 bg-red-400/[0.06]" : "border-white/20",
              )}
            >
              <b className="mb-1 block font-mbc text-base font-normal text-white/80">영상 고르기</b>
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
                placeholder="전에 올린 영상"
                options={videos.map((v) => ({
                  value: v.id,
                  label: `${v.name} · ${duration(v.duration)} · ${when(v.uploadedAt)}`,
                }))}
                className="rounded-xl"
              />
            )}
          </div>
        )}
      </Step>

      <Step n={2} done={!!recording} title="녹음 고르기">
        <Select
          tour="recording.merge-recording"
          value={recording?.id ?? ""}
          onChange={onRecording}
          disabled={running || !ready.length}
          placeholder={ready.length ? "녹음 고르기" : "녹음이 없어요"}
          options={ready.map((r) => ({
            value: r.id,
            label: `${r.label || "이름 없는 녹음"} · ${r.hallName} · ${when(r.startedAt)} · ${duration(r.duration)}`,
          }))}
          className="w-full rounded-xl"
        />
      </Step>

      <Step n={3} done={false} title="소리 고르기">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="min-w-[76px] font-pretendard text-[13px] text-white/55">녹음에서</span>
          <Seg
            value={lanes}
            onChange={setLanes}
            disabled={running}
            options={[
              { value: "both", label: "둘 다" },
              { value: "1", label: `${laneNames[0] ?? "통로 1"}만` },
              ...((recording?.channels ?? 2) > 1 ? [{ value: "2" as LaneMode, label: `${laneNames[1] ?? "통로 2"}만` }] : []),
            ]}
          />
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="min-w-[76px] font-pretendard text-[13px] text-white/55">현장음 섞기</span>
          <Seg
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
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <span className="min-w-[76px] font-pretendard text-[13px] text-white/55">미세 조정</span>
          <input
            type="number"
            step={10}
            min={-1000}
            max={1000}
            value={nudge}
            disabled={running}
            onChange={(e) => setNudge(Math.max(-1000, Math.min(1000, Math.round(Number(e.target.value) || 0))))}
            className="h-9 w-20 rounded-xl border border-white/10 bg-[#141414] px-2 text-center font-orbitron text-sm text-white focus:outline-none"
          />
          <span className="font-pretendard text-xs text-white/40">ms</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            data-tour="recording.merge-start"
            type="button"
            onClick={start}
            disabled={!canOperate || !video || !recording || !video.hasAudio || running || isMerging || !!upload}
            className="h-12 rounded-[10px] border border-[#FF3B3B]/55 bg-[linear-gradient(180deg,rgba(255,59,59,0.28),rgba(255,59,59,0.12))] px-[22px] font-mbc text-base text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            영상 합치기
          </button>
          {done && job && (
            <>
              <a href={recordingApi.jobFileUrl(job.id, true)} className={cn(btn, "flex h-12 items-center px-4 text-[15px]")}>
                MP4 받기 · {gb(job.size)}
              </a>
              <a
                href={recordingApi.jobFileUrl(job.id)}
                target="_blank"
                rel="noreferrer"
                className="font-pretendard text-sm text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
              >
                새 창에서 보기
              </a>
            </>
          )}
        </div>

        {job && (
          <div className="mt-3">
            <div className="h-2.5 overflow-hidden rounded-[5px] bg-white/[0.07]">
              <div
                className={cn(
                  "h-full transition-[width] duration-300",
                  job.status === "error"
                    ? "bg-white/30"
                    : "bg-[linear-gradient(90deg,#ff6b6b,#FF3B3B)] shadow-[0_0_10px_rgba(255,59,59,0.6)]",
                )}
                style={{ width: `${Math.round(job.progress * 100)}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-3.5 font-pretendard text-xs">
              {job.status === "queued" && <span className="text-white/60">대기 중</span>}
              {STAGES.map((s, i) => {
                const ok = done || (stageIndex >= 0 && i < stageIndex);
                const on = !done && i === stageIndex;
                return (
                  <span key={s.key} className={ok ? "text-white/75" : on ? "text-white" : "text-white/35"}>
                    {ok ? "✓ " : ""}
                    {s.name}
                  </span>
                );
              })}
            </div>
            {job.status === "error" && (
              <div className="mt-3 rounded-xl border border-[#FF3B3B]/35 bg-[#FF3B3B]/[0.08] px-3.5 py-3 font-pretendard text-[13px] text-[#ffb3b3]">
                {job.error}
              </div>
            )}
            {done && job.summary && (
              <div className="mt-3 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-3 font-pretendard text-[13px] leading-relaxed text-white/80">
                {job.summary.start}
                <br />
                {job.summary.drift}
                {job.sync && !job.sync.precise && (
                  <>
                    <br />
                    <span className="text-[#ff9a9a]">
                      0.01초 단위로 맞춤
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Step>

      {others.length > 0 && (
        <div className="mt-1 border-t border-white/[0.06] pt-3">
          <p className="mb-2 font-mbc text-sm text-white/55">전에 합친 영상</p>
          <div className="flex flex-col gap-1.5">
            {others.map((j) => (
              <div key={j.id} className="flex items-center gap-2 font-pretendard text-[13px] text-white/60">
                <span className="truncate text-white/80">{j.name}</span>
                <span className="shrink-0 text-xs text-white/35">{when(j.createdAt)}</span>
                <a href={recordingApi.jobFileUrl(j.id, true)} className={cn(btn, "ml-auto flex shrink-0 items-center")}>
                  받기
                </a>
                <button type="button" className={cn(btn, "shrink-0")} disabled={!canOperate} onClick={() => onRemoveJob(j.id)}>
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
