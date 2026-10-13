"use client";

import { useEffect, useRef, useState } from "react";
import { clock } from "@/components/recording/format";
import { cn } from "@/lib/utils";

// VU 바늘 — 0 VU = -18 dBFS (방송 기준). 왼쪽 끝 -20 VU, 오른쪽 끝 +3 VU
const VU_REF_DBFS = -18;
const VU_MIN = -20;
const VU_MAX = 3;
const NEEDLE_MIN_DEG = -42;
const NEEDLE_MAX_DEG = 42;

function needleDeg(dbfs: number | null): number {
  if (dbfs == null || !Number.isFinite(dbfs)) return NEEDLE_MIN_DEG;
  const vu = Math.max(VU_MIN, Math.min(VU_MAX, dbfs - VU_REF_DBFS));
  return NEEDLE_MIN_DEG + ((vu - VU_MIN) / (VU_MAX - VU_MIN)) * (NEEDLE_MAX_DEG - NEEDLE_MIN_DEG);
}

/** 바늘 VU 미터 (어두운 판 · 흰 바늘 · 오른쪽 끝 빨간 구간) */
export function VuMeter({ name, dbfs }: { name: string; dbfs: number | null }) {
  return (
    <div
      className="relative h-[86px] w-[150px] overflow-hidden rounded-[10px] border border-black bg-[radial-gradient(ellipse_at_50%_120%,#26272c,#141518_70%)] shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]"
      role="meter"
      aria-label={`${name} 레벨`}
      aria-valuemin={-60}
      aria-valuemax={0}
      aria-valuenow={dbfs ?? -60}
    >
      <span className="absolute left-[15px] right-[15px] top-[18px] h-[100px] rounded-[50%] border-t-2 border-white/35" />
      <span className="absolute right-[26px] top-5 h-3 w-[34px] rounded-tr-[40px] border-t-[3px] border-[#FF3B3B]" />
      <span
        className="absolute -bottom-2.5 left-1/2 -ml-px h-[82px] w-0.5 origin-bottom bg-[#f4f4f4] shadow-[0_0_6px_rgba(255,255,255,0.4)] transition-transform duration-300 ease-out"
        style={{ transform: `rotate(${needleDeg(dbfs)}deg)` }}
      />
      <span className="absolute bottom-1.5 left-2.5 font-orbitron text-[10px] font-bold tracking-[0.1em] text-white/60">VU</span>
      <span className="absolute bottom-1.5 right-2.5 max-w-[96px] truncate font-pretendard text-xs font-bold text-white/60">
        {name}
      </span>
    </div>
  );
}

const tag = "inline-flex h-7 items-center gap-2 rounded-lg bg-white/[0.06] px-2.5 font-pretendard text-[13px] text-white/80";

/** 녹음대 — 라디오 버튼 같은 둥근 REC 버튼, 큰 시간, 무엇을 녹음하는지, 이름, 바늘 VU */
export default function AvDeck({
  recording,
  elapsed,
  fetchedAt,
  what,
  hasScreen,
  hasAudio,
  fps,
  fpsOptions,
  onFps,
  hoursLeft,
  label,
  disabled,
  reason,
  busy,
  error,
  lanes,
  levels,
  onStart,
  onStop,
}: {
  recording: boolean;
  /** 서버가 알려 준 녹음·녹화 시간(초) — 그 사이는 이 기기 시계로 채운다 */
  elapsed: number;
  fetchedAt: number;
  what: string;
  hasScreen: boolean;
  hasAudio: boolean;
  fps: number;
  fpsOptions: number[];
  /** 녹화 전에만 — 누르면 30 ↔ 60 */
  onFps?: (fps: number) => void;
  hoursLeft: number | null;
  /** 녹음·녹화 중인 것의 이름 */
  label: string;
  disabled: boolean;
  /** 누를 수 없는 까닭 (녹화 전) */
  reason?: string;
  busy: boolean;
  error?: string;
  lanes: string[];
  /** 통로마다 dBFS (없으면 바늘이 쉰다) */
  levels: (number | null)[];
  onStart: (label: string) => void;
  onStop: () => void;
}) {
  const [name, setName] = useState("");
  const [confirmStop, setConfirmStop] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [recording]);
  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );

  const shown = recording ? elapsed + Math.max(0, (now - fetchedAt) / 1000) : 0;

  const press = () => {
    if (busy) return;
    if (!recording) {
      if (disabled) return;
      onStart(name.trim());
      setName("");
      return;
    }
    // 행사 중 잘못 눌러 멈추는 일이 없게 — 한 번 더 눌러야 멈춘다
    if (!confirmStop) {
      setConfirmStop(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmStop(false), 4000);
      return;
    }
    setConfirmStop(false);
    onStop();
  };

  const canPress = recording ? !busy : !disabled && !busy;
  const nextFps = fpsOptions.find((f) => f !== fps) ?? fps;

  return (
    <section data-tour="recording.deck" className="grid items-center gap-7 rounded-[24px] border border-sidebar-border bg-sidebar p-7 shadow-2xl backdrop-blur-md md:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1fr)_auto]">
      <div className="flex flex-col items-center gap-2">
        <button
          data-tour="recording.start"
          type="button"
          onClick={press}
          disabled={!canPress}
          aria-label={recording ? "멈추기" : "녹음·녹화 시작"}
          className={cn(
            "grid h-24 w-24 place-items-center rounded-full border border-black transition-shadow disabled:cursor-not-allowed disabled:opacity-40",
            "bg-[radial-gradient(circle_at_50%_38%,#3b3e44,#1d1f23_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_0_#08090a]",
          )}
        >
          <span
            className={cn(
              "h-[30px] w-[30px] bg-[radial-gradient(circle_at_40%_35%,#ff7c70,#e3201f)] shadow-[0_0_22px_rgba(255,59,59,0.8)] transition-[border-radius]",
              recording ? "rounded-md" : "rounded-full",
            )}
          />
        </button>
        <span className={cn("h-4 font-pretendard text-xs", confirmStop ? "text-[#ff9a9a]" : "text-white/35")}>
          {confirmStop ? "한 번 더 누르면 멈춰요" : ""}
        </span>
      </div>

      <div className="grid min-w-0 gap-3">
        <div className="flex items-center gap-3.5">
          <span className="font-mono text-[40px] font-bold leading-none tracking-[0.02em] text-white tabular-nums">
            {clock(shown)}
          </span>
          {recording && (
            <span className="inline-flex h-7 items-center rounded-lg border border-red-400/50 bg-red-400/15 px-2.5 font-orbitron text-[11px] tracking-[0.15em] text-white">
              REC
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={tag}>{what}</span>
          {hasScreen &&
            (onFps && !recording && fpsOptions.length > 1 ? (
              <button
                data-tour="recording.fps"
                type="button"
                onClick={() => onFps(nextFps)}
                className={cn(tag, "hover:bg-white/10")}
              >
                1080p · {fps}fps
              </button>
            ) : (
              <span className={tag}>1080p · {fps}fps</span>
            ))}
          {hasAudio && <span className={tag}>48kHz · 24비트</span>}
          {hoursLeft != null && <span className={tag}>남은 공간 {Math.floor(hoursLeft)}시간</span>}
        </div>
        {recording ? (
          <div className="flex h-[42px] max-w-[420px] items-center rounded-[10px] border border-white/12 bg-[#0c0d0f] px-3.5 font-pretendard text-base text-white">
            <span className="truncate">{label || "이름 없음"}</span>
          </div>
        ) : (
          <input
            data-tour="recording.name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && press()}
            maxLength={60}
            disabled={disabled}
            placeholder="예: 2학기 학예회 1부"
            className="h-[42px] w-full max-w-[420px] rounded-[10px] border border-white/12 bg-[#0c0d0f] px-3.5 font-pretendard text-base text-white outline-none placeholder:text-white/35 focus:border-white/35 disabled:opacity-50"
          />
        )}
        {(error || (!recording && reason)) && (
          <p className={cn("font-pretendard text-[13px]", error ? "text-[#ff9a9a]" : "text-white/45")}>{error || reason}</p>
        )}
      </div>

      {hasAudio && (
        <div data-tour="recording.meters" className="flex gap-3 md:col-span-2 xl:col-span-1">
          {(lanes.length ? lanes : ["마이크", "음악"]).slice(0, 2).map((n, i) => (
            <VuMeter key={i} name={`${i + 1} ${n}`} dbfs={levels[i] ?? null} />
          ))}
        </div>
      )}
    </section>
  );
}
