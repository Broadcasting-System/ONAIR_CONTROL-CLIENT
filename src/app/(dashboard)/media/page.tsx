"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SectionHeader from "@/components/common/SectionHeader";
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/apiBase";
import { useFiles } from "@/hooks/useFiles";
import { useDisplay } from "@/hooks/useDisplay";
import { useDisplaySync } from "@/hooks/useDisplaySync";
import { usePlayer } from "@/hooks/usePlayer";
import { DisplayMirror } from "@/components/display/DisplayMirror";
import { FileType, UploadedFile } from "@/types/file";

const TYPE_TABS: { key: FileType; label: string }[] = [
  { key: "video", label: "영상" },
  { key: "image", label: "이미지" },
  { key: "presentation", label: "PPT" },
  { key: "audio", label: "오디오" },
];

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export default function MediaPage() {
  const { files, fetchFiles, isLoading } = useFiles();
  const { showMedia, isSending } = useDisplay();
  const { content } = useDisplaySync();
  const { toggle, seek, setVolume, setMuted, setFit, setLoop, setSlide } =
    usePlayer();

  const [tab, setTab] = useState<FileType>("video");
  const [, setTick] = useState(0);
  const [dragPos, setDragPos] = useState<number | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // 진행바 부드럽게 갱신
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  const pb = content?.type === "video" ? content.playback : undefined;
  const duration = pb?.duration ?? content?.duration ?? 0;
  const livePos = pb
    ? pb.playing
      ? pb.offset + (Date.now() - pb.anchorTs) / 1000
      : pb.offset
    : 0;
  const pos = dragPos ?? Math.min(livePos, duration || livePos);

  const clearDisplay = useCallback(async () => {
    try {
      await fetch(`${getApiBase()}/display/clear`, { method: "POST" });
    } catch {
      /* ignore */
    }
  }, []);

  const activeFiles = files[tab] ?? [];

  return (
    <div className="flex h-full w-full gap-10 px-[20px]">
      {/* 좌측: 미디어 목록 */}
      <div className="flex w-[420px] shrink-0 flex-col gap-5">
        <SectionHeader>미디어 선택</SectionHeader>

        <div className="flex gap-2">
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-xl border px-4 py-2 font-mbc text-sm transition-all",
                tab === t.key
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/5",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-auto rounded-2xl border border-white/5 bg-[#0a0a0a] p-3">
          {isLoading ? (
            <p className="p-4 font-pretendard text-white/40">불러오는 중…</p>
          ) : activeFiles.length === 0 ? (
            <p className="p-4 font-pretendard text-white/30">
              해당 종류의 파일이 없습니다.
            </p>
          ) : (
            activeFiles.map((f) => (
              <MediaRow
                key={f.id}
                file={f}
                active={content?.url?.includes(
                  (f.id.startsWith("file_") ? f.id.slice(5) : f.id).split(".")[0],
                )}
                disabled={isSending}
                onSelect={() => showMedia(f)}
              />
            ))
          )}
        </div>
      </div>

      {/* 우측: 미리보기 + 재생 제어 */}
      <div className="flex flex-1 flex-col gap-5 overflow-hidden">
        <SectionHeader>송출 미리보기</SectionHeader>

        {/* 미리보기 (높이 고정) */}
        <div className="relative h-[48vh] w-full shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black">
          <DisplayMirror />
        </div>

        {/* 재생 제어 바: 하단 고정 */}
        <div className="shrink-0 rounded-2xl border border-white/5 bg-[#0a0a0a] p-6">
          {content?.type === "video" && pb ? (
            <div className="flex flex-col gap-4">
              {/* 진행바 */}
              <div className="flex items-center gap-4">
                <span className="w-14 text-right font-orbitron text-sm text-white/60">
                  {fmt(pos)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={Math.min(pos, duration || pos)}
                  disabled={!duration}
                  onChange={(e) => setDragPos(Number(e.target.value))}
                  onPointerUp={() => {
                    if (dragPos != null) {
                      seek(dragPos);
                      setTimeout(() => setDragPos(null), 400);
                    }
                  }}
                  className="flex-1 accent-red-400"
                />
                <span className="w-14 font-orbitron text-sm text-white/40">
                  {duration ? fmt(duration) : "--:--"}
                </span>
              </div>

              {/* 버튼 + 볼륨 */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => toggle()}
                  className="flex h-11 w-24 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-white/15 bg-white/10 font-mbc text-white hover:bg-white/15"
                >
                  {pb.playing ? "일시정지" : "재생"}
                </button>

                <button
                  onClick={() => setLoop(!pb.loop)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-xl border px-4 py-2 font-mbc text-sm transition-colors",
                    pb.loop
                      ? "border-green-500/40 bg-green-500/15 text-green-300 hover:bg-green-500/25"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                  )}
                >
                  반복 {pb.loop ? "ON" : "OFF"}
                </button>

                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() => setMuted(!pb.muted)}
                    className={cn(
                      "shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 font-mbc text-sm transition-colors",
                      pb.muted
                        ? "border-red-400/40 bg-red-400/10 text-red-300"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                    )}
                  >
                    {pb.muted ? "음소거됨" : "소리"}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={pb.muted ? 0 : pb.volume}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setVolume(v);
                      if (v > 0 && pb.muted) setMuted(false);
                    }}
                    className="w-36 accent-white"
                  />
                  <span className="w-9 shrink-0 font-orbitron text-xs text-white/40">
                    {Math.round((pb.muted ? 0 : pb.volume) * 100)}
                  </span>
                </div>

                {/* 화면 채움 모드 */}
                <div className="ml-auto flex shrink-0 overflow-hidden rounded-lg border border-white/10">
                  {(["contain", "cover"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setFit(m)}
                      className={cn(
                        "whitespace-nowrap px-3 py-2 font-mbc text-sm transition-colors",
                        (pb.fit ?? "contain") === m
                          ? "bg-white/15 text-white"
                          : "bg-transparent text-white/40 hover:bg-white/5",
                      )}
                    >
                      {m === "contain" ? "여백맞춤" : "꽉채움"}
                    </button>
                  ))}
                </div>

                <button
                  onClick={clearDisplay}
                  className="shrink-0 whitespace-nowrap rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mbc text-sm text-white/60 hover:bg-white/10"
                >
                  송출 끄기
                </button>
              </div>
            </div>
          ) : content?.type === "presentation" && content.urls?.length ? (
            <PresentationNav
              total={content.urls.length}
              current={
                typeof content.slideIndex === "number" ? content.slideIndex : 0
              }
              onGo={(i) => setSlide(i)}
              onClear={clearDisplay}
            />
          ) : content && content.type !== "standby" ? (
            <div className="flex items-center justify-between">
              <p className="font-pretendard text-white/50">
                현재 송출: {content.type} (재생 제어는 영상·PDF만 지원)
              </p>
              <button
                onClick={clearDisplay}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mbc text-sm text-white/60 hover:bg-white/10"
              >
                송출 끄기
              </button>
            </div>
          ) : (
            <p className="font-pretendard text-white/30">
              왼쪽에서 영상을 선택하면 재생 제어가 활성화됩니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PresentationNav({
  total,
  current,
  onGo,
  onClear,
}: {
  total: number;
  current: number;
  onGo: (index: number) => void;
  onClear: () => void;
}) {
  const idx = Math.max(0, Math.min(current, total - 1));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => onGo(idx - 1)}
          disabled={idx <= 0}
          className="flex h-12 w-16 items-center justify-center rounded-xl border border-white/15 bg-white/10 font-mbc text-xl text-white hover:bg-white/15 disabled:opacity-30"
        >
          ‹
        </button>
        <span className="min-w-[120px] text-center font-orbitron text-2xl text-white">
          {idx + 1} <span className="text-white/40">/ {total}</span>
        </span>
        <button
          onClick={() => onGo(idx + 1)}
          disabled={idx >= total - 1}
          className="flex h-12 w-16 items-center justify-center rounded-xl border border-white/15 bg-white/10 font-mbc text-xl text-white hover:bg-white/15 disabled:opacity-30"
        >
          ›
        </button>
      </div>
      {/* 슬라이드 점프 슬라이더 */}
      <input
        type="range"
        min={0}
        max={total - 1}
        value={idx}
        onChange={(e) => onGo(Number(e.target.value))}
        className="w-full accent-red-400"
      />
      <div className="flex justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => onGo(0)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mbc text-sm text-white/70 hover:bg-white/10"
          >
            처음
          </button>
          <button
            onClick={() => onGo(total - 1)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mbc text-sm text-white/70 hover:bg-white/10"
          >
            마지막
          </button>
        </div>
        <button
          onClick={onClear}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mbc text-sm text-white/60 hover:bg-white/10"
        >
          송출 끄기
        </button>
      </div>
    </div>
  );
}

function MediaRow({
  file,
  active,
  disabled,
  onSelect,
}: {
  file: UploadedFile;
  active?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 text-left transition-all disabled:opacity-50",
        active
          ? "border-red-400/40 bg-red-400/10"
          : "border-white/5 bg-white/[0.02] hover:bg-white/5",
      )}
    >
      {file.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.thumbnailUrl}
          alt=""
          className="h-12 w-20 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-white/5 font-orbitron text-[10px] text-white/30">
          {file.type.toUpperCase()}
        </div>
      )}
      <span className="truncate font-pretendard text-sm text-white/80">
        {file.fileName}
      </span>
    </button>
  );
}
