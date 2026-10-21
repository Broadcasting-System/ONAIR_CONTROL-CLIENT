"use client";

/* eslint-disable @next/next/no-img-element -- 썸네일·미리보기는 서버·유튜브가 주는 임의 주소 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_CHANNELS } from "@/stores/channelStore";
import { useDisplaySync, type DisplayContent, type ImageOverlay } from "@/hooks/useDisplaySync";
import type { Health } from "@/hooks/useHealth";
import { SlotPreview, SwitchMirror } from "@/components/switcher/SlotPreview";
import type { SwitchLayout } from "@/lib/switchApi";
import type { UploadedFile } from "@/types/file";
import { channelName } from "@/constants/channels";

/** 송출 화면의 작은 조각들 — 시안 Desktop/ONAIR-송출-시안/merge.html */

export const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export const fmtSize = (b: number) =>
  !b ? "" : b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)}GB` : b >= 1024 ** 2 ? `${Math.round(b / 1024 ** 2)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`;

export const TYPE_LABEL: Record<string, string> = {
  video: "영상",
  image: "사진",
  presentation: "PPT",
  audio: "음원",
  youtube: "유튜브",
  timer: "타이머",
  screen: "화면 공유",
};

export const LAYOUT_LABEL: Record<SwitchLayout, string> = { one: "한 화면", two: "2분할", four: "4분할", pip: "PIP" };

export const PANEL = "rounded-[20px] border border-white/[0.08] bg-[rgba(14,14,17,0.74)] backdrop-blur-[10px]";

/** 옵션 칩 (반복 · 화면 맞춤 · 꽉 채움 …) — 켜지면 흰 바탕 */
export function Chip({
  on,
  children,
  className,
  ...rest
}: { on?: boolean; children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={on}
      {...rest}
      className={cn(
        "flex h-10 shrink-0 items-center whitespace-nowrap rounded-[9px] border px-3 font-mbc text-[13.5px] transition-colors disabled:opacity-40 md:h-[34px]",
        on ? "border-white bg-white text-[#0b0b0d]" : "border-white/12 text-white/60 hover:text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** 송출 끄기 */
export function OffButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ml-auto flex h-10 shrink-0 items-center whitespace-nowrap rounded-xl border border-[#FF3B3B]/45 px-3.5 font-mbc text-[13.5px] text-[#ff7b7b] transition-colors hover:bg-[#FF3B3B]/10 disabled:opacity-40 md:h-[38px]"
    >
      송출 끄기
    </button>
  );
}

export function IconBox({ children, className, ...rest }: { children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-white/12 text-white transition-colors hover:bg-white/[0.06] disabled:opacity-40 md:h-[38px] md:w-[38px]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** 칸 번호 상자 */
export function SlotNo({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border border-white/35 font-orbitron text-[11px] font-bold text-white", className)}>
      {n}
    </span>
  );
}

/** 흰 막대 슬라이더 (진행바·소리) */
export function Fader({
  value,
  max = 100,
  step = 1,
  dim,
  label,
  disabled,
  onChange,
  onCommit,
}: {
  value: number;
  max?: number;
  step?: number;
  dim?: boolean;
  label: string;
  disabled?: boolean;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <input
      type="range"
      min={0}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
      style={{ background: `linear-gradient(90deg, ${dim ? "rgba(255,255,255,.25)" : "#fff"} ${pct}%, rgba(255,255,255,.1) ${pct}%)` }}
      className={cn(
        "h-[5px] min-w-[60px] flex-1 cursor-pointer appearance-none rounded-full outline-none disabled:cursor-default",
        "[&::-webkit-slider-thumb]:h-[15px] [&::-webkit-slider-thumb]:w-[15px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(0,0,0,0.45)]",
        "[&::-moz-range-thumb]:h-[15px] [&::-moz-range-thumb]:w-[15px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0",
        dim ? "[&::-webkit-slider-thumb]:bg-[#6b6c72] [&::-moz-range-thumb]:bg-[#6b6c72]" : "[&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:bg-white",
      )}
    />
  );
}

/** 진행바 — 재생/일시정지(있으면) · 지금 · 막대 · 길이 */
export function PlayBar({
  pos,
  duration,
  playing,
  onToggle,
  onSeek,
  disabled,
}: {
  pos: number;
  duration: number;
  playing?: boolean;
  onToggle?: () => void;
  onSeek?: (sec: number) => void;
  disabled?: boolean;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? Math.min(pos, duration || pos);
  return (
    <div className="flex items-center gap-2.5">
      {onToggle && (
        <IconBox onClick={onToggle} disabled={disabled} aria-label={playing ? "일시정지" : "재생"}>
          {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </IconBox>
      )}
      <span className="w-[42px] shrink-0 font-orbitron text-[12px] tabular-nums text-white">{duration ? fmt(shown) : "--:--"}</span>
      <Fader
        value={duration ? shown : 0}
        max={duration || 1}
        step={0.1}
        label="재생 위치"
        disabled={disabled || !duration || !onSeek}
        onChange={setDrag}
        onCommit={() => {
          if (drag != null && onSeek) {
            onSeek(drag);
            setTimeout(() => setDrag(null), 400);
          }
        }}
      />
      <span className="w-[42px] shrink-0 text-right font-orbitron text-[12px] tabular-nums text-white/40">{duration ? fmt(duration) : "--:--"}</span>
    </div>
  );
}

/** 소리 줄 — [칸 번호 · 이름] · 음소거 · 막대 · 값 (값은 0~100) */
export function SoundRow({
  n,
  name,
  mute,
  volume,
  disabled,
  onMute,
  onVolume,
  onCommit,
}: {
  n?: number;
  name?: string;
  mute: boolean;
  volume: number;
  disabled?: boolean;
  onMute: () => void;
  onVolume: (v: number) => void;
  onCommit?: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {n != null && <SlotNo n={n} className="max-md:hidden" />}
      {name != null && (
        <span className="min-w-0 max-w-[150px] flex-[0_1_150px] truncate max-md:hidden font-pretendard text-[13.5px] font-bold text-white">{name}</span>
      )}
      <IconBox onClick={onMute} disabled={disabled} aria-pressed={mute} aria-label={mute ? "소리 켜기" : "음소거"} className={cn(mute && "text-white/50")}>
        {mute ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </IconBox>
      <Fader value={volume} dim={mute} label="소리 크기" disabled={disabled} onChange={onVolume} onCommit={onCommit} />
      <span className={cn("w-[30px] shrink-0 text-right font-orbitron text-[12.5px] font-semibold tabular-nums", mute && "text-white/30")}>{volume}</span>
    </div>
  );
}

/** 배치 아이콘 */
export function LayoutIcon({ k }: { k: SwitchLayout }) {
  return (
    <span className="relative h-[13px] w-[19px] shrink-0 rounded-[3px] border-[1.5px] border-current">
      {(k === "two" || k === "four") && <i className="absolute inset-y-0 left-1/2 border-l-[1.5px] border-current" />}
      {k === "four" && <i className="absolute inset-x-0 top-1/2 border-t-[1.5px] border-current" />}
      {k === "pip" && <i className="absolute bottom-[1.5px] right-[1.5px] h-[4px] w-[7px] rounded-[1px] bg-current" />}
    </span>
  );
}

export function LayoutSelect({ value, onChange, disabled }: { value: SwitchLayout; onChange: (l: SwitchLayout) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-1 rounded-xl bg-white/5 p-1" data-tour="media.layout">
      {(["one", "two", "four", "pip"] as const).map((k) => (
        <button
          key={k}
          type="button"
          disabled={disabled}
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={cn(
            "flex h-9 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[9px] font-mbc text-[13.5px] transition-colors disabled:opacity-40 md:h-8",
            value === k ? "bg-white/12 text-white" : "text-white/50 hover:text-white/80",
          )}
        >
          <LayoutIcon k={k} />
          {LAYOUT_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

/** CH1~5 — 빨간 점 = 지금 송출 중 (유일한 송출 표시) */
export function ChannelChips({ channel, health, onPick }: { channel: number; health: Health | null; onPick: (ch: number) => void }) {
  return (
    <div className="flex gap-1.5" data-tour="media.channel-select">
      {Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1).map((ch) => {
        const h = health?.channels[String(ch)];
        const onAir = !!h?.type && h.type !== "standby";
        const names = h?.displays.map((d) => d.name).join(", ");
        return (
          <button
            key={ch}
            type="button"
            onClick={() => onPick(ch)}
            aria-pressed={channel === ch}
            title={[h?.live ? `송출 화면 연결됨: ${names}` : "송출 화면 없음", onAir ? `송출 중: ${TYPE_LABEL[h!.type!] ?? h!.type}` : "꺼짐"].join(" · ")}
            className={cn(
              "flex h-[42px] min-w-0 flex-auto items-center justify-center gap-[6px] rounded-[11px] border px-2 font-mbc text-[12px] md:text-[13px] transition-colors md:h-10 md:min-w-16 md:flex-none md:px-3",
              channel === ch ? "border-white/85 bg-white/[0.08] text-white" : "border-white/10 text-white/60 hover:text-white",
            )}
          >
            {onAir && <i className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#FF3B3B] shadow-[0_0_7px_#FF3B3B]" />}
            <span className="min-w-0 truncate whitespace-nowrap">{channelName(ch)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** 파일 · 유튜브 · 사진 카드 (썸네일 + 이름 + 작은 글) */
export function SourceCard({
  thumb,
  name,
  sub,
  on,
  slot,
  badge,
  disabled,
  dashed,
  onClick,
  onDoubleClick,
  children,
}: {
  thumb: ReactNode;
  name: string;
  sub?: ReactNode;
  on?: boolean;
  /** 칸에 들어가 있으면 그 칸 번호 (흰 번호표) */
  slot?: number;
  /** 오른쪽 아래 (영상 길이 등) */
  badge?: string;
  disabled?: boolean;
  dashed?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  children?: ReactNode;
}) {
  const press = onClick && !disabled ? onClick : undefined;
  return (
    <div
      {...(onClick
        ? {
            role: "button",
            tabIndex: disabled ? -1 : 0,
            "aria-disabled": disabled || undefined,
            "aria-pressed": on,
            onClick: press,
            onDoubleClick: disabled ? undefined : onDoubleClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                press?.();
              }
            },
          }
        : {})}
      className={cn(
        "flex min-w-0 flex-col rounded-xl p-[7px] text-left transition-colors",
        onClick && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/70",
        onClick && disabled && "cursor-default opacity-50",
        dashed ? "border border-dashed border-white/[0.18]" : on ? "bg-white/[0.08] shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.75)]" : "bg-white/[0.035]",
        onClick && !on && !dashed && "hover:bg-white/[0.06]",
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#0d0e11]">
        {thumb}
        {slot != null && slot >= 0 && (
          <span className="absolute left-[5px] top-[5px] flex h-5 w-5 items-center justify-center rounded-md bg-white font-orbitron text-[11px] font-bold text-[#0b0b0d]">
            {slot + 1}
          </span>
        )}
        {badge && (
          <span className="absolute bottom-[5px] right-[5px] rounded-[5px] bg-black/75 px-[5px] py-px font-orbitron text-[10px] font-semibold text-white">{badge}</span>
        )}
      </div>
      <b className="mx-[3px] mb-px mt-[7px] truncate font-pretendard text-[13px] font-bold text-white">{name}</b>
      {sub != null && <span className="mx-[3px] truncate font-pretendard text-[11.5px] text-white/40">{sub}</span>}
      {children}
    </div>
  );
}

export function FileThumb({ file }: { file: UploadedFile }) {
  if (file.thumbnailUrl) return <img src={file.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  if (file.type === "image") return <img src={file.fileUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  if (file.type === "presentation" && file.urls?.[0]) return <img src={file.urls[0]} alt="" className="absolute inset-0 h-full w-full object-contain" />;
  return (
    <div className="absolute inset-0 flex items-center justify-center font-orbitron text-[10px] tracking-widest text-white/30">
      {file.type === "audio" ? "AUDIO" : file.type.toUpperCase()}
    </div>
  );
}

/** 화면 공유 중 내 화면 (소리 없이) */
export function LocalStream({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = stream;
    if (stream) v.play().catch(() => {});
  }, [stream]);
  return <video ref={ref} autoPlay muted playsInline className="absolute inset-0 h-full w-full bg-black object-contain" />;
}

/* ---------------- 다른 채널 ---------------- */

function MiniLive({ ch, files }: { ch: number; files: UploadedFile[] }) {
  const { content } = useDisplaySync(ch);
  const what =
    content?.type === "switch" ? LAYOUT_LABEL[content.layout ?? "four"] : content && content.type !== "standby" ? (TYPE_LABEL[content.type] ?? content.type) : "";
  return (
    <>
      <div className="relative aspect-video overflow-hidden rounded-lg bg-[#0b0b0d]">
        <MiniContent content={content} files={files} />
      </div>
      <div className="mt-[5px] truncate whitespace-nowrap font-mbc text-[12px] text-white/60">
        {channelName(ch)}
        {what && ` · ${what}`}
      </div>
    </>
  );
}

function MiniContent({ content, files }: { content: DisplayContent | null; files: UploadedFile[] }) {
  if (!content || content.type === "standby") return null;
  if (content.type === "switch" && content.slots) return <SwitchMirror layout={content.layout ?? "four"} slots={content.slots} />;
  const file = content.fileId ? files.find((f) => f.id === content.fileId) : undefined;
  if (content.type === "video") {
    if (file) return <FileThumb file={file} />;
    return content.url && !content.url.includes(".m3u8") ? (
      <SlotPreview source={{ kind: "video", url: content.url, name: "" }} startedAt={content.serverTimestamp} />
    ) : null;
  }
  if (content.type === "image" && content.url) return <img src={content.url} alt="" className="absolute inset-0 h-full w-full object-contain" />;
  if (content.type === "presentation" && content.urls?.length) {
    const i = Math.max(0, Math.min(typeof content.slideIndex === "number" ? content.slideIndex : 0, content.urls.length - 1));
    return <img src={content.urls[i]} alt="" className="absolute inset-0 h-full w-full object-contain" />;
  }
  if (content.type === "youtube" && content.videoId)
    return <SlotPreview source={{ kind: "youtube", videoId: content.videoId, name: "" }} />;
  if (content.type === "timer")
    return (
      <SlotPreview
        source={{ kind: "timer", durationSec: content.durationSec ?? 0, mode: content.mode ?? "down", label: content.label ?? "", name: "" }}
        startedAt={content.serverTimestamp}
      />
    );
  return (
    <div className="absolute inset-0 flex items-center justify-center font-pretendard text-[11px] text-white/40">
      {TYPE_LABEL[content.type] ?? content.type}
    </div>
  );
}

export function OtherChannels({
  channel,
  health,
  files,
  onPick,
}: {
  channel: number;
  health: Health | null;
  files: UploadedFile[];
  onPick: (ch: number) => void;
}) {
  const others = Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1).filter((c) => c !== channel);
  return (
    <div className="mt-auto hidden pt-1 md:block" data-tour="media.other-channels">
      <p className="mb-2 font-mbc text-[14px] text-white">다른 채널</p>
      <div className="grid grid-cols-4 gap-2">
        {others.map((ch) => {
          const h = health?.channels[String(ch)];
          const onAir = !!h?.type && h.type !== "standby";
          return (
            <button key={ch} type="button" onClick={() => onPick(ch)} className="min-w-0 text-left">
              {onAir ? (
                <MiniLive ch={ch} files={files} />
              ) : (
                <>
                  <div className="relative flex aspect-video items-center justify-center rounded-lg bg-[#0b0b0d] font-pretendard text-[11px] text-white/30">꺼짐</div>
                  <div className="mt-[5px] truncate whitespace-nowrap font-mbc text-[12px] text-white/60">{channelName(ch)}</div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- 한 화면 — PPT · 사진 글자 ---------------- */

export function PresentationNav({ total, current, onGo, disabled }: { total: number; current: number; onGo: (i: number) => void; disabled?: boolean }) {
  const idx = Math.max(0, Math.min(current, total - 1));
  return (
    <div className="flex items-center gap-2.5">
      <IconBox onClick={() => onGo(0)} disabled={disabled || idx <= 0} aria-label="처음" className="font-mbc text-[12px]">
        처음
      </IconBox>
      <IconBox onClick={() => onGo(idx - 1)} disabled={disabled || idx <= 0} aria-label="이전" className="text-lg">
        ‹
      </IconBox>
      <span className="w-[64px] shrink-0 text-center font-orbitron text-[13px] tabular-nums text-white">
        {idx + 1} <span className="text-white/40">/ {total}</span>
      </span>
      <Fader value={idx} max={Math.max(1, total - 1)} label="슬라이드" disabled={disabled || total <= 1} onChange={(v) => onGo(Math.round(v))} />
      <IconBox onClick={() => onGo(idx + 1)} disabled={disabled || idx >= total - 1} aria-label="다음" className="text-lg">
        ›
      </IconBox>
    </div>
  );
}

const OVERLAY_COLORS = ["#ffffff", "#000000", "#ffe14d", "#ff3b3b", "#7dffb0", "#5ab8ff"];
const OVERLAY_POSITIONS: { key: "top" | "center" | "bottom"; label: string }[] = [
  { key: "top", label: "위" },
  { key: "center", label: "가운데" },
  { key: "bottom", label: "아래" },
];

/** 사진 위 글자 */
export function ImageOverlayEditor({
  overlay,
  onChange,
  disabled,
}: {
  overlay?: ImageOverlay;
  onChange: (patch: Partial<ImageOverlay>) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(overlay?.text ?? "");
  const [size, setSize] = useState(overlay?.size ?? 6);
  const [color, setColor] = useState(overlay?.color ?? "#ffffff");
  const [position, setPosition] = useState<"top" | "center" | "bottom">(overlay?.position ?? "bottom");
  const [visible, setVisible] = useState(overlay?.visible ?? true);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <input
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            onChange({ text: e.target.value });
          }}
          placeholder="사진 위 글자"
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0c0d0f] px-3.5 font-pretendard text-[16px] text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none md:text-[14px]"
        />
        <Chip
          on={visible}
          disabled={disabled}
          onClick={() => {
            setVisible(!visible);
            onChange({ visible: !visible });
          }}
        >
          글자 보이기
        </Chip>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="flex min-w-[150px] flex-1 items-center gap-2.5">
          <span className="shrink-0 font-mbc text-[13px] text-white/50">크기</span>
          <Fader
            value={size}
            max={20}
            step={0.5}
            label="글자 크기"
            disabled={disabled}
            onChange={(v) => {
              setSize(v);
              onChange({ size: v });
            }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {OVERLAY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              aria-label={c}
              onClick={() => {
                setColor(c);
                onChange({ color: c });
              }}
              style={{ backgroundColor: c }}
              className={cn("h-6 w-6 rounded-full border transition-transform", color === c ? "scale-110 border-white ring-2 ring-white/40" : "border-white/20")}
            />
          ))}
        </div>
        <div className="flex gap-1">
          {OVERLAY_POSITIONS.map((p) => (
            <Chip
              key={p.key}
              on={position === p.key}
              disabled={disabled}
              onClick={() => {
                setPosition(p.key);
                onChange({ position: p.key });
              }}
            >
              {p.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
