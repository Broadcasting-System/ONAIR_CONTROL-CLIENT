"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SectionHeader from "@/components/common/SectionHeader";
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/apiBase";
import { useFiles } from "@/hooks/useFiles";
import { useDisplay } from "@/hooks/useDisplay";
import { useDisplaySync, ImageOverlay } from "@/hooks/useDisplaySync";
import { usePlayer } from "@/hooks/usePlayer";
import { useScreenShare } from "@/hooks/useScreenShare";
import { DisplayMirror } from "@/components/display/DisplayMirror";
import { useChannelStore, MAX_CHANNELS } from "@/stores/channelStore";
import { useMe } from "@/hooks/useMe";
import { useHealth } from "@/hooks/useHealth";
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
  const channel = useChannelStore((s) => s.channel);
  const setChannel = useChannelStore((s) => s.setChannel);
  const { canOperate } = useMe();
  const { files, fetchFiles, isLoading } = useFiles();
  const { showMedia, showTimer, isSending } = useDisplay();
  const { content } = useDisplaySync(channel);
  const { toggle, seek, setVolume, setMuted, setFit, setLoop, setSlide, setOverlay } =
    usePlayer(channel);
  const { isSharing, start: startShare, stop: stopShare, localStream } =
    useScreenShare(channel);

  const [tab, setTab] = useState<FileType>("video");
  const [timerMode, setTimerMode] = useState(false);
  const [, setTick] = useState(0);
  const [dragPos, setDragPos] = useState<number | null>(null);
  const { health } = useHealth();

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
  const rawPos = pb
    ? pb.playing
      ? pb.offset + (Date.now() - pb.anchorTs) / 1000
      : pb.offset
    : 0;
  // 반복 재생 중엔 서버 시계가 계속 늘어나므로 길이로 나눈 나머지로 환산
  const livePos =
    pb?.loop && duration > 0 ? rawPos % duration : rawPos;
  const pos = dragPos ?? Math.min(livePos, duration || livePos);

  const clearDisplay = useCallback(async () => {
    try {
      const qs = channel > 1 ? `?channel=${channel}` : "";
      await fetch(`${getApiBase()}/display/clear${qs}`, { method: "POST" });
    } catch {
      /* ignore */
    }
  }, [channel]);

  const activeFiles = files[tab] ?? [];

  return (
    <div className="flex h-full w-full gap-10 px-[20px]">
      {/* 좌측: 미디어 목록 */}
      <div className="flex w-[420px] shrink-0 flex-col gap-5">
        <SectionHeader>미디어 선택</SectionHeader>

        {!canOperate && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-pretendard text-xs text-amber-200/80">
            보기 전용 권한입니다. 송출하려면 관리자에게 운영 권한을 요청하세요.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setTimerMode(false);
              }}
              className={cn(
                "rounded-xl border px-4 py-2 font-mbc text-sm transition-all",
                tab === t.key && !timerMode
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/5",
              )}
            >
              {t.label}
            </button>
          ))}
          {/* 타이머 — 파일이 아니라 카운트다운/업 송출 */}
          <button
            onClick={() => setTimerMode((v) => !v)}
            disabled={!canOperate}
            className={cn(
              "rounded-xl border px-4 py-2 font-mbc text-sm transition-all disabled:opacity-40",
              timerMode
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/5",
            )}
          >
            타이머
          </button>
          {/* 화면 공유 — 파일 종류 옆에 탭처럼 (선택이 아니라 시작/중지 동작) */}
          <button
            onClick={isSharing ? stopShare : startShare}
            disabled={!canOperate && !isSharing}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2 font-mbc text-sm transition-all disabled:opacity-40",
              isSharing
                ? "border-red-500/50 bg-red-500/15 text-red-200 hover:bg-red-500/25"
                : "border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/5",
            )}
          >
            {isSharing && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            )}
            {isSharing ? "공유 중지" : "화면 공유"}
          </button>
        </div>

        {timerMode ? (
          <TimerComposer
            disabled={!canOperate}
            onSend={(opts) =>
              showTimer(channel, opts).catch(() => {
                /* 서버가 403 등 → 무시(권한은 상단 안내) */
              })
            }
            onClear={clearDisplay}
          />
        ) : (
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
                disabled={isSending || !canOperate}
                onSelect={() => showMedia(f, channel)}
              />
            ))
          )}
        </div>
        )}
      </div>

      {/* 우측: 미리보기 + 재생 제어 */}
      <div className="flex flex-1 flex-col gap-5 overflow-hidden">
        <div className="flex items-center justify-between">
          <SectionHeader>송출 미리보기</SectionHeader>
          {/* 채널 선택 — 채널마다 독립 송출(CH1=기본). 송출 화면 연결되면 초록 점 */}
          <div className="flex items-center gap-2">
            {/* 스피커 매트릭스 연결 상태 */}
            {health && !health.matrix.connected && (
              <span
                title={`스피커 매트릭스(${health.matrix.host}) 연결 끊김`}
                className="mr-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1 font-mbc text-[11px] text-amber-200"
              >
                ⚠️ 매트릭스
              </span>
            )}
            <span className="font-mbc text-xs text-white/40">채널</span>
            {Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1).map((ch) => {
              const chHealth = health?.channels[String(ch)];
              const live = chHealth?.live ?? false;
              const names = chHealth?.displays.map((d) => d.name).join(", ");
              return (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  title={live ? `송출 화면 연결됨: ${names}` : "송출 화면 없음"}
                  className={cn(
                    "relative flex h-9 w-12 items-center justify-center rounded-xl border font-orbitron text-sm transition-all",
                    channel === ch
                      ? "border-red-400/50 bg-red-400/15 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/5",
                  )}
                >
                  {ch}
                  <span
                    className={cn(
                      "absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-black",
                      live ? "bg-emerald-400" : "bg-white/20",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* 미리보기 (높이 고정) — 화면 공유 중이면 내 화면 로컬 프리뷰 */}
        <div className="relative h-[48vh] w-full shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black">
          {isSharing ? (
            <ScreenLocalPreview stream={localStream} />
          ) : (
            <DisplayMirror channel={channel} />
          )}
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
          ) : content?.type === "image" ? (
            <ImageOverlayEditor
              key={content.url}
              overlay={content.overlay}
              onChange={setOverlay}
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

/** 타이머(카운트다운/업) 송출 입력 */
function TimerComposer({
  disabled,
  onSend,
  onClear,
}: {
  disabled?: boolean;
  onSend: (opts: { label?: string; durationSec: number; mode: "down" | "up" }) => void;
  onClear: () => void;
}) {
  const [min, setMin] = useState(5);
  const [sec, setSec] = useState(0);
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"down" | "up">("down");

  const durationSec = Math.max(0, Math.floor(min) * 60 + Math.floor(sec));

  return (
    <div className="flex flex-1 flex-col gap-5 rounded-2xl border border-white/5 bg-[#0a0a0a] p-5">
      {/* 모드 */}
      <div className="flex overflow-hidden rounded-xl border border-white/10">
        {(["down", "up"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 py-2.5 font-mbc text-sm transition-colors",
              mode === m ? "bg-white/15 text-white" : "bg-transparent text-white/40 hover:bg-white/5",
            )}
          >
            {m === "down" ? "카운트다운" : "카운트업(경과)"}
          </button>
        ))}
      </div>

      {/* 라벨 */}
      <div className="flex flex-col gap-1.5">
        <span className="font-mbc text-xs text-white/40">라벨 (선택)</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="예: 시험 종료까지"
          className="h-11 rounded-xl border border-white/10 bg-[#141414] px-4 font-pretendard text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
        />
      </div>

      {/* 시간 (카운트다운일 때만) */}
      {mode === "down" && (
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="font-mbc text-xs text-white/40">분</span>
            <input
              type="number"
              min={0}
              value={min}
              onChange={(e) => setMin(Math.max(0, Number(e.target.value)))}
              className="h-11 w-24 rounded-xl border border-white/10 bg-[#141414] px-4 font-orbitron text-white focus:border-white/30 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-mbc text-xs text-white/40">초</span>
            <input
              type="number"
              min={0}
              max={59}
              value={sec}
              onChange={(e) => setSec(Math.min(59, Math.max(0, Number(e.target.value))))}
              className="h-11 w-24 rounded-xl border border-white/10 bg-[#141414] px-4 font-orbitron text-white focus:border-white/30 focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="mt-auto flex gap-3">
        <button
          onClick={() => onSend({ label: label.trim() || undefined, durationSec, mode })}
          disabled={disabled || (mode === "down" && durationSec <= 0)}
          className="h-12 flex-1 rounded-xl border border-white/15 bg-white/10 font-mbc text-white hover:bg-white/15 disabled:opacity-40"
        >
          타이머 송출
        </button>
        <button
          onClick={onClear}
          className="h-12 rounded-xl border border-white/10 bg-white/5 px-5 font-mbc text-sm text-white/60 hover:bg-white/10"
        >
          끄기
        </button>
      </div>
    </div>
  );
}

/** 화면 공유 중 내 화면 로컬 프리뷰 (음소거) */
function ScreenLocalPreview({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = stream;
    if (stream) v.play().catch(() => {});
  }, [stream]);
  return (
    <div className="relative h-full w-full bg-black">
      <video ref={ref} autoPlay muted playsInline className="h-full w-full object-contain" />
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-full border border-red-500/50 bg-red-600/90 px-3 py-1.5 shadow-lg">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        <span className="text-[10px] font-black uppercase tracking-tighter text-white">
          화면 공유 중
        </span>
      </div>
    </div>
  );
}

const OVERLAY_COLORS = [
  "#ffffff",
  "#000000",
  "#ffe14d",
  "#ff3b3b",
  "#7dffb0",
  "#5ab8ff",
];
const OVERLAY_POSITIONS: { key: "top" | "center" | "bottom"; label: string }[] = [
  { key: "top", label: "위" },
  { key: "center", label: "가운데" },
  { key: "bottom", label: "아래" },
];

function ImageOverlayEditor({
  overlay,
  onChange,
  onClear,
}: {
  overlay?: ImageOverlay;
  onChange: (patch: Partial<ImageOverlay>) => void;
  onClear: () => void;
}) {
  const [text, setText] = useState(overlay?.text ?? "");
  const [size, setSize] = useState(overlay?.size ?? 6);
  const [color, setColor] = useState(overlay?.color ?? "#ffffff");
  const [position, setPosition] = useState<"top" | "center" | "bottom">(
    overlay?.position ?? "bottom",
  );
  const [visible, setVisible] = useState(overlay?.visible ?? true);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange({ text: e.target.value });
          }}
          rows={2}
          placeholder="이미지 위에 표시할 텍스트를 입력하세요 (줄바꿈 가능)"
          className="flex-1 resize-none rounded-xl border border-white/10 bg-[#141414] px-4 py-3 font-pretendard text-[15px] text-white placeholder:text-white/25 focus:border-white/25 focus:outline-none"
        />
        <button
          onClick={() => {
            const v = !visible;
            setVisible(v);
            onChange({ visible: v });
          }}
          className={cn(
            "h-[60px] w-24 shrink-0 whitespace-nowrap rounded-xl border font-mbc text-sm transition-colors",
            visible
              ? "border-green-500/40 bg-green-500/15 text-green-300 hover:bg-green-500/25"
              : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10",
          )}
        >
          표시 {visible ? "ON" : "OFF"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* 글자 크기 */}
        <div className="flex items-center gap-3">
          <span className="font-mbc text-sm text-white/50">크기</span>
          <input
            type="range"
            min={2}
            max={20}
            step={0.5}
            value={size}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSize(v);
              onChange({ size: v });
            }}
            className="w-40 accent-white"
          />
          <span className="w-8 font-orbitron text-xs text-white/40">
            {size.toFixed(1)}
          </span>
        </div>

        {/* 색상 */}
        <div className="flex items-center gap-2">
          <span className="font-mbc text-sm text-white/50">색상</span>
          {OVERLAY_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                onChange({ color: c });
              }}
              style={{ backgroundColor: c }}
              className={cn(
                "h-7 w-7 rounded-full border transition-transform",
                color === c
                  ? "scale-110 border-white ring-2 ring-white/40"
                  : "border-white/20 hover:scale-105",
              )}
              aria-label={c}
            />
          ))}
        </div>

        {/* 위치 */}
        <div className="flex items-center gap-2">
          <span className="font-mbc text-sm text-white/50">위치</span>
          <div className="flex overflow-hidden rounded-lg border border-white/10">
            {OVERLAY_POSITIONS.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setPosition(p.key);
                  onChange({ position: p.key });
                }}
                className={cn(
                  "px-3 py-2 font-mbc text-sm transition-colors",
                  position === p.key
                    ? "bg-white/15 text-white"
                    : "bg-transparent text-white/40 hover:bg-white/5",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClear}
          className="ml-auto shrink-0 whitespace-nowrap rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mbc text-sm text-white/60 hover:bg-white/10"
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
