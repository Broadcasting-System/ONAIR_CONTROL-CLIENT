"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import LedMeter from "@/components/common/LedMeter";
import OnairButton, { type OnairButtonState } from "@/components/common/OnairButton";
import Select from "@/components/common/Select";
import { clock, gb } from "@/components/recording/format";
import { cn } from "@/lib/utils";
import type { AvChannel, AvHall } from "@/types/av";

const field =
  "h-[38px] rounded-[11px] border border-white/[0.14] bg-black/20 font-pretendard text-[13.5px] font-medium text-white max-md:h-11";

/** 앞에 작은 이름(화면·소리)을 붙인 ONAIR 고르기 칸 */
function Picker<T extends string>({
  name,
  tour,
  ...props
}: {
  name: string;
  tour: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean; textValue?: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="relative min-w-0">
      <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 font-mbc text-[12px] text-white/45">
        {name}
      </span>
      <Select {...props} tour={tour} aria-label={name} className={cn(field, "w-full pl-[42px] pr-3 disabled:cursor-default disabled:opacity-80")} />
    </div>
  );
}

const sub = "font-pretendard text-[11.5px] font-medium text-white/40";

/** 녹화 데크 — 로고 녹화 버튼, 큰 시간, 화면·소리 고르기와 이름, 가로 LED 레벨 미터. 아래에 화면 카드 줄(children) */
export default function AvDeck({
  recording,
  busy,
  audioOnly,
  elapsed,
  fetchedAt,
  label,
  free,
  hoursLeft,
  ready,
  disabled,
  reason,
  error,
  channels,
  halls,
  screen,
  audio,
  locked,
  onScreen,
  onAudio,
  fps,
  fpsOptions,
  onFps,
  levels,
  onStart,
  onStop,
  children,
}: {
  recording: boolean;
  /** 시작·멈춤 요청 중 */
  busy: "starting" | "stopping" | null;
  /** 화면 없이 소리만 (글자를 '녹음'으로) */
  audioOnly: boolean;
  /** 서버가 알려 준 시간(초) — 그 사이는 이 기기 시계로 채운다 */
  elapsed: number;
  fetchedAt: number;
  /** 녹음·녹화 중인 것의 이름 */
  label: string;
  free: number | null;
  hoursLeft: number | null;
  /** 상태를 받아 왔는지 */
  ready: boolean;
  disabled: boolean;
  /** 누를 수 없는 까닭 — 버튼 아래 글자로 */
  reason: string;
  error?: string;
  channels: AvChannel[];
  halls: AvHall[];
  screen: number | null;
  audio: string | null;
  locked: boolean;
  onScreen: (channel: number | null) => void;
  onAudio: (hall: string | null) => void;
  fps: number;
  fpsOptions: number[];
  onFps: (fps: number) => void;
  /** 줄마다 dBFS — 없으면 미터를 숨긴다 */
  levels: (number | null)[] | null;
  onStart: (label: string) => void;
  onStop: () => void;
  children?: ReactNode;
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
  useEffect(() => {
    if (!recording) setConfirmStop(false);
  }, [recording]);
  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );

  const shown = recording ? elapsed + Math.max(0, (now - fetchedAt) / 1000) : 0;
  const word = audioOnly ? "녹음" : "녹화";

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

  // 버튼 상태와 아래 글자 (마이크 방송 버튼과 같은 방식)
  const [btn, caption] = ((): [OnairButtonState, string] => {
    if (busy === "starting") return ["waiting", "시작하는 중"];
    if (busy === "stopping") return ["waiting", "멈추는 중"];
    if (recording) return ["active", confirmStop ? "한 번 더 누르면 멈춰요" : "누르면 멈춰요"];
    if (!ready) return ["disabled", "확인 중"];
    if (disabled) return ["disabled", reason];
    return ["idle", `누르면 ${word}`];
  })();

  const side = recording
    ? `${label || "이름 없음"} · ${word} 중`
    : [free != null ? `남은 공간 ${gb(free).replace(" ", "")}` : "", hoursLeft != null ? `${Math.floor(hoursLeft)}시간` : ""]
        .filter(Boolean)
        .join(" · ");
  const nextFps = fpsOptions.find((f) => f !== fps) ?? fps;

  const screenValue = screen === null ? "none" : String(screen);
  const screenOptions = [
    { value: "none", label: "소리만" },
    ...channels.map((c) => ({
      value: String(c.channel),
      disabled: !c.live,
      textValue: `CH${c.channel} ${c.name}`,
      label: (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{`CH${c.channel}${c.name ? ` ${c.name}` : c.hallName ? ` ${c.hallName}` : ""}`}</span>
          {!c.live ? <small className={sub}>꺼짐</small> : c.name && c.hallName ? <small className={sub}>{c.hallName}</small> : null}
        </span>
      ),
    })),
  ];
  const audioOptions = [
    ...halls.map((h) => ({
      value: h.id,
      textValue: `${h.name} 콘솔`,
      label: (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{h.name} 콘솔</span>
          {!h.configured && <small className={sub}>설정 안 됨</small>}
        </span>
      ),
    })),
    { value: "", label: "소리 없음" },
  ];

  return (
    <section
      data-tour="recording.deck"
      className="rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-4 backdrop-blur-md md:rounded-[24px] md:border-sidebar-border md:bg-sidebar md:px-[22px] md:py-[18px] md:shadow-2xl"
    >
      <div
        className={cn(
          "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3",
          levels ? "[grid-template-areas:'btn_info''pick_pick''meter_meter']" : "[grid-template-areas:'btn_info''pick_pick']",
          "md:gap-x-[22px] md:gap-y-3 md:grid-cols-[150px_minmax(0,1fr)_auto] md:[grid-template-areas:'btn_info_meter''btn_pick_pick']",
        )}
      >
        <div className="[grid-area:btn]">
          <OnairButton state={btn} label={recording ? "멈추기" : `${word} 시작`} caption={caption} size="md" tour="recording.start" onPress={press} />
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-1 [grid-area:info]">
          <span
            className={cn(
              "font-orbitron text-[30px] font-bold leading-none tracking-[0.04em] tabular-nums md:text-[44px]",
              recording ? "text-[#ff4d55]" : "text-white",
            )}
          >
            {clock(shown)}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            {side && <span className="truncate font-pretendard text-[12.5px] font-medium text-white/45">{side}</span>}
            {screen !== null &&
              (!recording && !locked && fpsOptions.length > 1 ? (
                <button
                  data-tour="recording.fps"
                  type="button"
                  onClick={() => onFps(nextFps)}
                  className="h-6 rounded-md border border-white/[0.12] px-2 font-orbitron text-[10.5px] font-semibold text-white/60 hover:border-white/30 hover:text-white max-md:h-8"
                >
                  1080p {fps}fps
                </button>
              ) : (
                <span className="font-orbitron text-[10.5px] font-semibold text-white/40">1080p {fps}fps</span>
              ))}
          </span>
        </div>

        <div className="grid min-w-0 gap-2 [grid-area:pick]">
          <div
            data-tour="recording.sources"
            className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center"
          >
            <div className="md:w-[180px]">
              <Picker
                name="화면"
                tour="recording.screen-pick"
                value={screenValue}
                onChange={(v) => onScreen(v === "none" ? null : Number(v))}
                options={screenOptions}
                disabled={locked}
              />
            </div>
            <div className="md:w-[180px]">
              <Picker
                name="소리"
                tour="recording.audio"
                value={audio ?? ""}
                onChange={(v) => onAudio(v || null)}
                options={audioOptions}
                disabled={locked}
              />
            </div>
            {recording ? (
              <div className={cn(field, "col-span-2 flex min-w-0 items-center px-3.5 md:min-w-[220px] md:flex-1")}>
                <span className="truncate">{label || "이름 없음"}</span>
              </div>
            ) : (
              <input
                data-tour="recording.name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && press()}
                maxLength={60}
                disabled={disabled || !!busy}
                placeholder={`${word} 이름`}
                aria-label={`${word} 이름`}
                className={cn(
                  field,
                  "col-span-2 min-w-0 px-3.5 outline-none placeholder:text-white/35 focus:border-white/35 disabled:opacity-50 max-md:text-base md:min-w-[220px] md:flex-1",
                )}
              />
            )}
          </div>
          {error && <p className="font-pretendard text-[12.5px] text-[#ff8a8a]">{error}</p>}
        </div>

        {levels && (
          <div className="[grid-area:meter] md:self-start md:pt-1.5">
            <LedMeter levels={levels} tour="recording.meters" className="max-md:w-full" />
          </div>
        )}
      </div>

      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}
