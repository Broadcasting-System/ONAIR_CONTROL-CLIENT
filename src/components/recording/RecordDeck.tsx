"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { RecordingState } from "@/types/recording";

// 믹서 채널 색과 같게 — 통로 1 = 마이크(하늘), 통로 2 = 음악(초록)
export const LANE_COLORS = ["#5AC8FA", "#4ADE80"];
const SEGMENTS = 40;
const FLOOR_DB = -60;
const TICKS = [-60, -40, -20, -12, -6, 0];

// 믹서와 같은 콘솔 본체 판
const BOARD =
  "rounded-[24px] border border-black/80 bg-[linear-gradient(180deg,#1d1d20_0%,#141416_55%,#101012_100%)] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-1px_0_rgba(0,0,0,0.6),0_20px_40px_-16px_rgba(0,0,0,0.8)]";

const pct = (db: number) => Math.max(0, Math.min(100, ((db - FLOOR_DB) / -FLOOR_DB) * 100));

export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return [h, m, s % 60].map((v) => String(v).padStart(2, "0")).join(":");
}

/** 녹음 길이 — 1시간이 안 되면 분:초 */
export function duration(seconds: number): string {
  const c = clock(seconds);
  return seconds < 3600 ? c.slice(3) : c;
}

export function gb(bytes: number): string {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
}

/** 피크 홀드 — 올라가면 바로, 내려갈 때는 천천히 */
function usePeak(db: number) {
  const [peak, setPeak] = useState(db);
  useEffect(() => {
    setPeak((p) => (db >= p ? db : Math.max(db, p - 1.5)));
  }, [db]);
  return peak;
}

function LaneMeter({ name, index, db, clips }: { name: string; index: number; db: number; clips: number }) {
  const peak = usePeak(db);
  const color = LANE_COLORS[index % LANE_COLORS.length];
  const level = pct(db);
  const hold = pct(peak);
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)_64px] items-center gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-mbc text-base" style={{ color }}>
          {name}
        </span>
        <span className="font-orbitron text-[9px] tracking-[0.16em] text-white/35">INPUT {index + 1}</span>
      </div>
      <div className="flex h-[18px] items-center gap-[3px]" aria-hidden>
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const at = ((i + 1) / SEGMENTS) * 100;
          const lit = level >= at || Math.abs(hold - at) < 100 / SEGMENTS / 2;
          const c = at > 95 ? "#FF3B3B" : at > 85 ? "#FFD600" : color;
          return (
            <span
              key={i}
              className="h-3 flex-1 rounded-[2px] transition-[background,box-shadow] duration-100"
              style={lit ? { background: c, boxShadow: `0 0 6px ${c}` } : { background: "rgba(255,255,255,0.07)" }}
            />
          );
        })}
      </div>
      <span
        className={cn(
          "text-right font-orbitron text-xs tabular-nums",
          clips > 0 || db > -1 ? "text-[#FF3B3B]" : "text-white/60",
        )}
        title={clips > 0 ? `이번 녹음에서 소리가 ${clips}번 찢어졌어요 (0dB). 인터페이스 GAIN 을 조금 내려 주세요.` : undefined}
      >
        {db <= FLOOR_DB ? "-∞" : db.toFixed(0)} dB
      </span>
    </div>
  );
}

/** 녹음대 — 큰 녹음 버튼과 시간, 통로마다 가로 미터 */
export default function RecordDeck({
  state,
  fetchedAt,
  disabled,
  busy,
  onStart,
  onStop,
}: {
  state: RecordingState;
  fetchedAt: number;
  disabled: boolean;
  busy: boolean;
  onStart: (label: string) => void;
  onStop: () => void;
}) {
  const recording = state.recording;
  const [label, setLabel] = useState("");
  const [confirmStop, setConfirmStop] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 서버 시간 사이를 이 기기 시계로 채워 1초씩 매끄럽게
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [recording]);
  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);
  useEffect(() => {
    if (!recording) setConfirmStop(false);
    else setLabel(""); // 다음 녹음은 빈 이름에서
  }, [recording]);

  const elapsed = recording ? (state.elapsed ?? 0) + Math.max(0, (now - fetchedAt) / 1000) : 0;
  const lanes = state.lanes.length ? state.lanes : [{ name: "통로 1", sends: [] }];
  const clips = state.clips ?? [];

  const press = () => {
    if (disabled || busy) return;
    if (!recording) {
      onStart(label.trim());
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

  const sizeLine = recording
    ? `지금까지 ${gb(state.bytes ?? 0)} · 1시간에 약 ${(state.mbPerHour / 1000).toFixed(1)} GB (48kHz 24bit ${lanes.length}채널)`
    : state.disk.hoursLeft != null && state.disk.free != null
      ? `서버 남은 공간 ${gb(state.disk.free)} · 약 ${Math.floor(state.disk.hoursLeft)}시간 녹음 가능 — 행사 시작 전에 미리 눌러 두세요`
      : "행사 시작 전에 미리 눌러 두세요";

  return (
    <section className={cn(BOARD, "grid items-center gap-7 px-7 py-6 md:grid-cols-[auto_minmax(0,1fr)]")}>
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={press}
          disabled={disabled || busy}
          aria-label={recording ? "녹음 멈추기" : "녹음 시작"}
          className={cn(
            "grid h-[120px] w-[120px] place-items-center rounded-full border border-black transition-shadow disabled:cursor-not-allowed disabled:opacity-40",
            "bg-[radial-gradient(circle_at_50%_35%,#2c2c31,#151518_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_24px_rgba(0,0,0,0.6)]",
            recording && "shadow-[0_0_0_3px_rgba(255,59,59,0.5),0_0_40px_rgba(255,59,59,0.45)]",
          )}
        >
          <span
            className={cn(
              "bg-[#FF3B3B] shadow-[0_0_14px_rgba(255,59,59,0.6)] transition-all",
              recording ? "h-[38px] w-[38px] animate-pulse rounded-lg" : "h-[46px] w-[46px] rounded-full",
            )}
          />
        </button>
        <span className={cn("h-4 font-pretendard text-xs", confirmStop ? "text-[#ff9a9a]" : "text-white/35")}>
          {confirmStop ? "한 번 더 누르면 멈춰요" : recording ? "누르면 멈추기" : "누르면 녹음"}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-[18px]">
          <span
            className={cn(
              "font-orbitron text-[44px] leading-none tracking-[0.06em] tabular-nums",
              recording ? "text-white [text-shadow:0_0_18px_rgba(255,59,59,0.45)]" : "text-white/35",
            )}
          >
            {clock(elapsed)}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 font-orbitron text-[10px] tracking-[0.2em]",
              recording ? "text-[#ff8a8a]" : "text-white/30",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                recording ? "bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" : "bg-[#585858]",
              )}
            />
            {recording ? "REC" : "STANDBY"}
          </span>
          {recording ? (
            <span className="min-w-[180px] flex-1 truncate font-mbc text-lg text-white/85">
              {state.label || "이름 없는 녹음"}
            </span>
          ) : (
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && press()}
              maxLength={60}
              disabled={disabled}
              placeholder="녹음 이름 (예: 2학기 학예회 1부)"
              className="h-10 min-w-[180px] flex-1 rounded-xl border border-white/10 bg-[#141414] px-3 font-pretendard text-sm text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none disabled:opacity-40"
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          {lanes.map((lane, i) => (
            <LaneMeter key={i} name={lane.name} index={i} db={state.levels[i] ?? FLOOR_DB} clips={clips[i] ?? 0} />
          ))}
          <div className="grid grid-cols-[92px_minmax(0,1fr)_64px] gap-3" aria-hidden>
            <span />
            <div className="relative h-3">
              {TICKS.map((d) => (
                <span
                  key={d}
                  className="absolute -translate-x-1/2 font-orbitron text-[8px] text-white/30"
                  style={{ left: `${pct(d)}%` }}
                >
                  {d}
                </span>
              ))}
            </div>
            <span />
          </div>
        </div>

        <p className="font-pretendard text-xs text-white/40">
          {sizeLine}
          {clips.some((c) => c > 0) && (
            <span className="ml-2 text-[#ff9a9a]">· 소리가 찢어진 곳이 있어요 — 인터페이스 GAIN 을 조금 내려 주세요</span>
          )}
          {state.recError && <span className="ml-2 text-amber-200/90">· {state.recError}</span>}
        </p>
      </div>
    </section>
  );
}
