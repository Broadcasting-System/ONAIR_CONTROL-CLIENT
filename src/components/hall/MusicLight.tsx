"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Notice, Panel } from "@/components/hall/HallControls";
import { OnSwitch } from "@/components/hall/AutoAudio";
import Select from "@/components/common/Select";
import { lightColor } from "@/components/hall/LightStrip";
import { useMusicLight, useMusicShow } from "@/hooks/useMusicLight";
import { musicLightApi } from "@/lib/autoAudioApi";
import { lightingApi } from "@/lib/lightingApi";
import { cn } from "@/lib/utils";
import { WARM_SWATCH, swatchOf, type Fixture } from "@/types/lighting";
import {
  LANE_INFO,
  type MusicLightSettings,
  type MusicLightState,
  type ShowDetail,
  type ShowStyle,
} from "@/types/autoAudio";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const STYLE_HINT: Record<ShowStyle, string> = {
  basic: "신나는 구간에 박자",
  calm: "깜빡임 없이 천천히",
  party: "중간 구간도 박자",
};

function ChoiceButton({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 rounded-xl border px-3 font-mbc text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        on
          ? "border-red-400/50 bg-red-400/15 text-white"
          : "border-white/10 bg-white/[0.03] text-white/50 enabled:hover:bg-white/5",
      )}
    >
      {children}
    </button>
  );
}

/** 재생 위치 — 서버가 틀고 있으면 서버 위치를 이어서 세고, 아니면 미리 듣기 위치 */
function usePlayhead(
  state: MusicLightState | undefined,
  showId: string | null,
  audio: HTMLAudioElement | null,
) {
  const [now, setNow] = useState(0);
  const base = useRef<{ pos: number; at: number } | null>(null);
  const playing = state?.playing && state.playing.showId === showId ? state.playing : null;
  useEffect(() => {
    base.current = playing ? { pos: playing.position, at: performance.now() } : null;
  }, [playing]);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (base.current) setNow(base.current.pos + (performance.now() - base.current.at) / 1000);
      else if (audio && !audio.paused) setNow(audio.currentTime);
    }, 100);
    return () => window.clearInterval(id);
  }, [audio]);
  return { position: playing || (audio && !audio.paused) ? now : 0, playing };
}

/** 화면 파형 — 서버가 준 봉우리, 예전 쇼는 크기 곡선으로 대신 */
function wavePeaks(show: ShowDetail): number[] {
  const p = show.analysis.peaks;
  if (p && p.length) return p;
  return show.analysis.energy;
}

/** 시간순 파형 · 재생 위치(빨간 선) · 아래 '그 시간에 나가는 색' 띠 · 시간 눈금 */
function Waveform({
  show,
  position,
  onSeek,
}: {
  show: ShowDetail;
  position: number;
  onSeek?: (t: number) => void;
}) {
  const L = Math.max(1, show.analysis.duration);
  const canvas = useRef<HTMLCanvasElement>(null);
  const peaks = useMemo(() => wavePeaks(show), [show]);
  const ratio = Math.min(1, Math.max(0, position / L));

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const draw = () => {
      const w = c.clientWidth;
      const h = c.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      c.width = w * dpr;
      c.height = h * dpr;
      const g = c.getContext("2d");
      if (!g || !peaks.length) return;
      g.scale(dpr, dpr);
      const bw = 2;
      const step = 3;
      const n = Math.floor(w / step);
      const mid = h / 2;
      const px = ratio * w;
      for (let i = 0; i < n; i++) {
        // 칸마다 봉우리 중 가장 큰 값
        const a = Math.floor((i / n) * peaks.length);
        const b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length));
        let v = 0;
        for (let k = a; k < b; k++) v = Math.max(v, peaks[k] ?? 0);
        const amp = Math.max(1, v * (mid - 6));
        const x = i * step;
        g.fillStyle = x < px ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.22)";
        g.fillRect(x, mid - amp, bw, amp * 2);
      }
      g.fillStyle = "rgba(255,255,255,0.08)";
      g.fillRect(0, mid, w, 1);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [peaks, ratio]);

  const ribbon = useMemo(() => colorRibbon(show), [show]);
  const ticks: number[] = [];
  const every = L > 600 ? 120 : L > 240 ? 60 : 30;
  for (let t = 0; L - t > every * 0.6; t += every) ticks.push(t);
  ticks.push(L);
  const pct = (t: number) => `${(t / L) * 100}%`;

  return (
    <div className="flex flex-col gap-1.5 select-none">
      <div
        className={cn("relative h-[120px] rounded-lg bg-white/[0.03]", onSeek && "cursor-pointer")}
        onClick={(e) => {
          if (!onSeek) return;
          const r = e.currentTarget.getBoundingClientRect();
          onSeek(Math.max(0, Math.min(L - 0.5, ((e.clientX - r.left) / r.width) * L)));
        }}
        title={onSeek ? "누르면 그 자리부터 틀어요" : undefined}
      >
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />
        {position > 0 && (
          <span
            className="pointer-events-none absolute -bottom-1 -top-1 -ml-px w-0.5 bg-[#FF3B3B] shadow-[0_0_8px_rgba(255,59,59,0.7)]"
            style={{ left: pct(position) }}
          />
        )}
      </div>
      {ribbon.length > 0 && (
        <div className="relative h-1.5" aria-label="그 시간에 나가는 조명 색">
          {ribbon.map((r, i) => {
            const now = position >= r.start && position < r.end;
            return (
              <i
                key={i}
                className={cn(
                  "absolute rounded-sm",
                  now ? "top-0 h-1.5 opacity-100" : "top-px h-1",
                  !now && (position > r.end ? "opacity-[0.18]" : "opacity-45"),
                )}
                style={{
                  left: pct(r.start),
                  width: `calc(${pct(r.end - r.start)} - 2px)`,
                  background: r.color,
                }}
              />
            );
          })}
        </div>
      )}
      <div className="relative h-4 font-mono text-xs tabular-nums text-white/40">
        {ticks.map((t, i) => (
          <span
            key={t}
            className="absolute"
            style={{
              left: pct(t),
              transform: i === 0 ? "none" : i === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {fmt(t)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 색 큐 → 띠 조각 (다음 색 큐까지). 색 큐가 없으면 할로겐 밝기 큐로 */
function colorRibbon(show: ShowDetail): { start: number; end: number; color: string }[] {
  const L = show.analysis.duration;
  const on = show.cueList.filter((c) => c.enabled).sort((a, b) => a.t - b.t);
  const color = on.filter((c) => c.lane === "color" && c.color);
  const cues = color.length ? color : on.filter((c) => c.lane === "dimmer");
  return cues.map((c, i) => ({
    start: c.t,
    end: cues[i + 1]?.t ?? L,
    color:
      c.lane === "color"
        ? swatchOf(c.color)
        : (c.intensity ?? 0) > 0
          ? WARM_SWATCH
          : "#3a3b40",
  }));
}

/** 큐 편집 (접어 둠) — 큐 하나 또는 줄 전체를 끄고 켜기 */
function CueEditor({
  show,
  operable,
  onToggleCue,
  onToggleLane,
}: {
  show: ShowDetail;
  operable: boolean;
  onToggleCue: (id: string, on: boolean) => void;
  onToggleLane: (ids: string[], on: boolean) => void;
}) {
  const L = Math.max(1, show.analysis.duration);
  const lanes = LANE_INFO.filter((l) => show.cueList.some((c) => c.lane === l.lane));
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[86px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1.5">
        {lanes.map((l) => {
          const cues = show.cueList.filter((c) => c.lane === l.lane);
          const allOn = cues.every((c) => c.enabled);
          return (
            <div key={l.lane} className="contents">
              <button
                type="button"
                disabled={!operable}
                onClick={() =>
                  onToggleLane(
                    cues.map((c) => c.id),
                    !allOn,
                  )
                }
                title="누르면 이 줄 전체를 켜고 꺼요"
                className={cn(
                  "text-right font-pretendard text-xs enabled:hover:text-white",
                  allOn ? "text-white/55" : "text-white/30 line-through",
                )}
              >
                {l.label}
              </button>
              <div className="relative h-[22px] rounded-md bg-black/35">
                {cues.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!operable}
                    onClick={() => onToggleCue(c.id, !c.enabled)}
                    title={`${fmt(c.t)} · ${c.label}${c.enabled ? "" : " (꺼짐)"}`}
                    className={cn(
                      "absolute top-[3px] h-4 min-w-[4px] rounded-[3px] border border-black/60 disabled:cursor-default",
                      !c.enabled && "opacity-20",
                    )}
                    style={{
                      left: `${(c.t / L) * 100}%`,
                      width: `${(Math.max(c.fade, 0.4) / L) * 100}%`,
                      background: c.strobe ? "#ffffff" : c.color ? swatchOf(c.color) : l.color,
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="font-pretendard text-[11.5px] text-white/35">
        큐를 누르면 그 큐만, 줄 이름을 누르면 줄 전체를 끄고 켤 수 있어요
      </p>
    </div>
  );
}

const SEGMENTS = 18;

/** 콘솔 입력 미터처럼 LED 칸 — 켜진 칸 수가 밝기, 칸 색이 지금 색 */
function LedMeter({ level, color, label, wide }: { level: number; color: string; label?: string; wide?: boolean }) {
  const lit = Math.round((Math.max(0, Math.min(100, level)) / 100) * SEGMENTS);
  return (
    <div className="flex w-[30px] flex-col items-center gap-[5px]" title={label ? `${label} ${level}%` : `${level}%`}>
      <div className={cn("grid gap-0.5", wide ? "w-[18px]" : "w-3.5")}>
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const k = SEGMENTS - i;
          const on = k <= lit;
          return (
            <i
              key={i}
              className="h-1 rounded-[1px] bg-[#1b1c20]"
              style={
                on
                  ? { background: color, boxShadow: `0 0 6px ${color}66`, opacity: 0.55 + (0.45 * k) / SEGMENTS }
                  : undefined
              }
            />
          );
        })}
      </div>
      <b className="font-mono text-[11px] font-semibold tabular-nums text-white/70">{level}</b>
      {label !== undefined && (
        <span className="-mt-1 max-w-[30px] truncate font-pretendard text-[10.5px] text-white/40">{label}</span>
      )}
    </div>
  );
}

/** 지금 나가는 조명 — 묶음별 LED 미터 + 전체 밝기 */
function MeterBridge({ hallId, fast }: { hallId: string; fast: boolean }) {
  const { data } = useQuery({
    queryKey: ["lighting", hallId],
    queryFn: () => lightingApi.state(hallId),
    refetchInterval: fast ? 1000 : 3000,
  });
  if (!data || !data.fixtures.length) return null;
  const master = data.blackout ? 0 : data.master;
  const groups = new Map<string, Fixture[]>();
  for (const f of data.fixtures) {
    const g = f.group || "묶음 없음";
    groups.set(g, [...(groups.get(g) ?? []), f]);
  }
  return (
    <div className="flex gap-3.5 overflow-x-auto rounded-xl border border-black bg-[#0a0a0c] px-[18px] pb-3 pt-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.9)]">
      {[...groups].map(([g, fx]) => (
        <div
          key={g}
          className="flex flex-col gap-2 border-r border-white/[0.06] pr-3.5"
          style={{ flex: `${fx.length} 0 auto` }}
        >
          <div className="flex justify-around gap-2.5">
            {fx.map((f) => (
              <LedMeter
                key={f.id}
                level={Math.round((f.value.intensity * master) / 100)}
                color={lightColor(f)}
                label={shortName(f.name, g)}
              />
            ))}
          </div>
          <div className="border-t border-white/[0.08] pt-1.5 text-center font-pretendard text-xs font-bold text-white/50">
            {g}
          </div>
        </div>
      ))}
      <div className="flex shrink-0 flex-col items-center gap-2">
        <LedMeter level={master} color="#ECEEF2" wide />
        <div className="w-full border-t border-white/[0.08] pt-1.5 text-center font-pretendard text-xs font-bold text-white/50">
          전체
        </div>
      </div>
    </div>
  );
}

/** 미터 아래 이름 — 묶음 이름으로 시작하면 떼고 짧게 */
function shortName(name: string, group: string) {
  const n = name.startsWith(group) ? name.slice(group.length).trim() : name;
  return n || name;
}

/** MR 올리기 — 고르기 → 이름·분위기 → 분석 */
function UploadBox({
  disabled,
  uploading,
  onUpload,
}: {
  disabled: boolean;
  uploading: boolean;
  onUpload: (file: File, name: string, style: ShowStyle) => Promise<unknown>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [style, setStyle] = useState<ShowStyle>("basic");

  if (!file) {
    return (
      <>
        <input
          ref={input}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setName(f.name.replace(/\.[^.]+$/, "").slice(0, 30));
            }
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          className="rounded-[14px] border border-dashed border-white/20 p-3.5 text-center font-mbc text-[15px] text-white/50 enabled:hover:text-white/80 disabled:opacity-40"
        >
          + MR 올리기
          <span className="mt-1 block font-pretendard text-[11.5px] text-white/35">
            mp3·wav · 올리면 박자·구간을 찾아 쇼를 만들어요
          </span>
        </button>
      </>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-white/15 bg-black/30 p-3">
      <span className="truncate font-pretendard text-xs text-white/45">{file.name}</span>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        placeholder="쇼 이름"
        className="h-9 rounded-lg border border-white/10 bg-[#141414] px-2.5 font-pretendard text-sm text-white focus:border-white/30 focus:outline-none"
      />
      <div className="flex flex-wrap gap-1.5">
        {(["basic", "calm", "party"] as ShowStyle[]).map((s) => (
          <ChoiceButton key={s} on={style === s} onClick={() => setStyle(s)}>
            {{ basic: "기본", calm: "차분하게", party: "신나게" }[s]}
          </ChoiceButton>
        ))}
      </div>
      <span className="font-pretendard text-[11px] text-white/35">{STYLE_HINT[style]}</span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() =>
            onUpload(file, name, style)
              .then(() => setFile(null))
              .catch(() => undefined)
          }
          className="h-9 flex-1 rounded-lg border border-red-400/50 bg-red-400/15 font-mbc text-sm text-white disabled:opacity-50"
        >
          {uploading ? "분석하는 중…" : "분석해서 쇼 만들기"}
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => setFile(null)}
          className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 font-mbc text-sm text-white/60"
        >
          취소
        </button>
      </div>
    </div>
  );
}

/** 관리자 — 스트로브 허용·깜빡임 상한·소리 입력 */
function MusicSettings({
  settings,
  onSave,
}: {
  settings: MusicLightSettings;
  onSave: (s: Partial<MusicLightSettings>) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const field =
    "h-8 rounded-lg border border-white/10 bg-[#141414] px-2.5 font-pretendard text-sm text-white focus:border-white/30 focus:outline-none";
  return (
    <div className="flex flex-col gap-3 font-pretendard text-sm text-white/65">
      <div className="flex items-center gap-3">
        <OnSwitch
          checked={draft.allowStrobe}
          onChange={(v) => setDraft({ ...draft, allowStrobe: v })}
          label="스트로브 허용"
        />
        <span>
          스트로브(켰다 껐다) 허용{" "}
          <span className="text-white/40">— 허용해도 쇼마다 따로 켜야 나가요</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 text-white/50">1초에 깜빡임</span>
        {[1, 2, 3].map((n) => (
          <ChoiceButton
            key={n}
            on={draft.maxFlashPerSec === n}
            onClick={() => setDraft({ ...draft, maxFlashPerSec: n })}
          >
            {n}번까지
          </ChoiceButton>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 text-white/50">실시간 소리 입력</span>
        {(
          [
            ["none", "없음"],
            ["demo", "시연 박자"],
            ["bridge", "강당 노트북 녹음"],
          ] as const
        ).map(([v, label]) => (
          <ChoiceButton
            key={v}
            on={draft.feed.source === v}
            onClick={() => setDraft({ ...draft, feed: { ...draft.feed, source: v } })}
          >
            {label}
          </ChoiceButton>
        ))}
        {draft.feed.source === "demo" && (
          <label className="flex items-center gap-1.5">
            <input
              type="number"
              min={60}
              max={200}
              value={draft.feed.bpm}
              onChange={(e) =>
                setDraft({ ...draft, feed: { ...draft.feed, bpm: Number(e.target.value) || 120 } })
              }
              className={cn(field, "w-20 text-center font-orbitron")}
            />
            BPM
          </label>
        )}
        {draft.feed.source === "bridge" && (
          <>
            <input
              value={draft.feed.url ?? ""}
              onChange={(e) => setDraft({ ...draft, feed: { ...draft.feed, url: e.target.value } })}
              placeholder="http://100.x.x.x:8765"
              className={cn(field, "w-52")}
            />
            <input
              value={draft.feed.name ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, feed: { ...draft.feed, name: e.target.value } })
              }
              placeholder="녹음 장치 이름"
              className={cn(field, "w-32")}
            />
          </>
        )}
      </div>
      {draft.feed.source === "bridge" && (
        <p className="text-xs text-white/45">
          노트북 녹음 소리 받기는 아직 준비 중이에요 (브릿지 소리 스트림 필요).
        </p>
      )}
      <button
        type="button"
        onClick={() => onSave(draft)}
        className="h-9 w-fit rounded-lg border border-white/15 bg-white/10 px-4 font-mbc text-[13px] text-white hover:bg-white/15"
      >
        저장
      </button>
    </div>
  );
}

/** 조명 화면의 '음악 조명' 탭 — 위 재생(파형·색 띠·LED 미터·실시간) | 아래 쇼 목록·올리기 */
export default function MusicLightPanel({
  hallId,
  operable,
  isAdmin,
}: {
  hallId: string;
  operable: boolean;
  isAdmin: boolean;
}) {
  const { state, error, upload, isUploading, update, remove, start, stop, setLive, saveSettings } =
    useMusicLight(hallId);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setSelected(null), [hallId]);
  const showId =
    (selected && state?.shows.some((s) => s.id === selected) ? selected : null) ??
    state?.playing?.showId ??
    state?.shows[state.shows.length - 1]?.id ??
    null;
  const { data: show } = useMusicShow(hallId, showId);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [withAudio, setWithAudio] = useState(false);
  const { position, playing } = usePlayhead(state, showId, audio);
  const [showSettings, setShowSettings] = useState(false);
  const [editCues, setEditCues] = useState(false);

  if (!state) {
    return error ? <Notice>{error.message}</Notice> : null;
  }

  const live = state.live;
  const summary = state.shows.find((s) => s.id === showId) ?? null;
  const noFixtures = state.fixtures.led + state.fixtures.dimmer === 0;
  const anyPlaying = !!state.playing;

  const press = () => {
    if (!summary) return;
    if (playing) {
      stop();
      audio?.pause();
      return;
    }
    start(summary.id, 0);
    if (withAudio && audio) {
      audio.currentTime = 0;
      void audio.play();
    }
  };

  const seek =
    summary && playing && operable
      ? (t: number) => {
          start(summary.id, t);
          if (withAudio && audio) audio.currentTime = t;
        }
      : audio && !audio.paused
        ? (t: number) => {
            audio.currentTime = t;
          }
        : undefined;

  const safety = [
    `깜빡임 초당 ${state.settings.maxFlashPerSec}번까지`,
    state.settings.allowStrobe ? "스트로브 허용됨 (쇼에서 켜야 나감)" : "스트로브 꺼짐",
    `할로겐은 ${state.dimmerMinFade}초 넘게 천천히`,
  ].join(" · ");

  return (
    <div className="flex flex-col gap-5">
      {noFixtures && (
        <Notice tone="info">
          조명 목록이 비어 있어요. 관리자가 조명 세팅에서 조명을 넣으면 쇼를 만들 수 있어요.
        </Notice>
      )}
      {state.lastError && <Notice>{state.lastError}</Notice>}
      {(playing?.error || live?.error) && <Notice>{playing?.error || live?.error}</Notice>}

      <section className="flex flex-col gap-5 rounded-[24px] border border-sidebar-border bg-sidebar p-7 shadow-2xl backdrop-blur-md">
        {!summary || !show ? (
          <p className="font-pretendard text-sm text-white/45">
            MR 을 올리면 빠르기·박자·구간을 찾아 조명 큐를 만들어요. 아래 &apos;조명 쇼&apos;에서 올려 주세요.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-[18px]">
              <button
                type="button"
                disabled={!operable}
                onClick={press}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-xl border px-4 font-pretendard text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40",
                  playing
                    ? "border-red-400/60 bg-red-400/25 shadow-[0_0_18px_rgba(255,59,59,0.35)]"
                    : "border-red-400/50 bg-red-400/15 enabled:hover:bg-red-400/20",
                )}
              >
                {playing ? "■ 멈춤" : "▶ 시작"}
              </button>
              <div className="min-w-0">
                <div className="truncate font-pretendard text-xl font-extrabold text-white">
                  {summary.name}
                </div>
                <div className="font-pretendard text-sm text-white/55">
                  {state.styles[summary.options.style ?? "basic"]} · 조명 큐 {summary.enabledCues}개
                  {summary.enabledCues !== summary.cues && ` (전체 ${summary.cues})`}
                </div>
              </div>
              <div className="ml-auto flex gap-[26px] text-right">
                <div className="grid gap-0.5">
                  <b className="font-mono text-xl font-bold tabular-nums text-white">{fmt(position)}</b>
                  <span className="font-pretendard text-xs text-white/50">/ {fmt(summary.duration)}</span>
                </div>
                <div className="grid gap-0.5">
                  <b className="font-mono text-xl font-bold tabular-nums text-white">
                    {Math.round(summary.bpm)}
                  </b>
                  <span className="font-pretendard text-xs text-white/50">BPM</span>
                </div>
              </div>
            </div>

            <Waveform show={show} position={position} onSeek={seek} />

            {summary.hasAudio && (
              <div className="flex flex-wrap items-center gap-3 font-pretendard text-[12.5px] text-white/50">
                <audio
                  ref={setAudio}
                  key={summary.id}
                  src={musicLightApi.audioUrl(hallId, summary.id)}
                  controls
                  preload="none"
                  className="h-8 w-60 [color-scheme:dark]"
                />
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={withAudio}
                    onChange={(e) => setWithAudio(e.target.checked)}
                    className="accent-[#FF3B3B]"
                  />
                  시작할 때 이 컴퓨터에서 음악도 같이 틀기
                </label>
              </div>
            )}
          </>
        )}

        <MeterBridge hallId={hallId} fast={anyPlaying || !!live} />

        {playing && (playing.skipped.flash > 0 || playing.skipped.strobe > 0) && (
          <p className="font-pretendard text-xs text-white/40">
            안전 규칙으로 건너뜀 — 깜빡임 {playing.skipped.flash}번 · 스트로브 {playing.skipped.strobe}번
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.07] pt-4 font-pretendard text-sm">
          <OnSwitch
            checked={!!live}
            disabled={!operable || (!live && !state.feed)}
            onChange={(on) => setLive(on)}
            label="실시간 박자 따라가기"
          />
          <b className="text-white">박자 따라가기 (라이브)</b>
          <span className="text-white/50">
            {live
              ? live.bpm
                ? `${Math.round(live.bpm)} BPM · 박자 ${live.beats}번`
                : "박자를 듣는 중…"
              : state.feed
                ? "MR 없이 들어오는 소리에 맞춰요"
                : "소리 입력이 없어요 (관리자 설정)"}
          </span>
          <span className="ml-auto text-white/50">{safety}</span>
        </div>

        {summary && show && (
          <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-4">
            <div className="flex flex-wrap items-center gap-2 font-pretendard text-[13px] text-white/55">
              <span className="mr-1">분위기</span>
              {(["basic", "calm", "party"] as ShowStyle[]).map((s) => (
                <ChoiceButton
                  key={s}
                  on={(summary.options.style ?? "basic") === s}
                  disabled={!operable || !!playing}
                  onClick={() => update(summary.id, { options: { style: s } })}
                >
                  {state.styles[s]}
                </ChoiceButton>
              ))}
              <span className="ml-3 mr-1">스트로브</span>
              <OnSwitch
                checked={!!summary.options.strobe}
                disabled={!operable || !!playing || !state.settings.allowStrobe}
                onChange={(on) => update(summary.id, { options: { strobe: on } })}
                label="이 쇼에 스트로브"
              />
              {state.scenes.length > 0 && (
                <>
                  <span className="ml-3">시작 장면</span>
                  <Select
                    value={summary.options.startScene ?? ""}
                    disabled={!operable || !!playing}
                    onChange={(id) => update(summary.id, { options: { startScene: id } })}
                    aria-label="시작 장면"
                    options={[{ value: "", label: "없음" }, ...state.scenes.map((sc) => ({ value: sc.id, label: sc.name }))]}
                    className="h-8 px-2"
                  />
                  <span>끝 장면</span>
                  <Select
                    value={summary.options.endScene ?? ""}
                    disabled={!operable || !!playing}
                    onChange={(id) => update(summary.id, { options: { endScene: id } })}
                    aria-label="끝 장면"
                    options={[{ value: "", label: "천천히 끄기" }, ...state.scenes.map((sc) => ({ value: sc.id, label: sc.name }))]}
                    className="h-8 px-2"
                  />
                </>
              )}
              <button
                type="button"
                onClick={() => setEditCues((v) => !v)}
                className="ml-auto h-8 rounded-lg border border-white/10 bg-white/5 px-3 font-mbc text-[13px] text-white/60 hover:text-white"
              >
                {editCues ? "큐 편집 닫기" : "큐 편집"}
              </button>
              <button
                type="button"
                disabled={!operable || !!playing}
                onClick={() => {
                  if (window.confirm(`'${summary.name}' 쇼를 지울까요?`)) remove(summary.id);
                }}
                className="h-8 rounded-lg border border-white/10 bg-white/5 px-3 font-mbc text-[13px] text-white/50 enabled:hover:text-red-300 disabled:opacity-40"
              >
                쇼 지우기
              </button>
            </div>
            <p className="font-pretendard text-[11.5px] text-white/35">
              분위기·스트로브·장면을 바꾸면 큐를 다시 만들어요 (큐마다 끈 것은 처음으로 돌아가요).
            </p>
            {editCues && (
              <CueEditor
                show={show}
                operable={operable}
                onToggleCue={(id, on) => update(summary.id, { cues: { [id]: on } })}
                onToggleLane={(ids, on) =>
                  update(summary.id, { cues: Object.fromEntries(ids.map((id) => [id, on])) })
                }
              />
            )}
          </div>
        )}
      </section>

      <Panel title="조명 쇼" hint="MR 을 올리면 박자·구간을 찾아 쇼를 만들어요">
        <div className="flex flex-col">
          {state.shows.map((s) => {
            const isPlaying = state.playing?.showId === s.id;
            return (
              <div
                key={s.id}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_90px_60px_auto] items-center gap-3.5 border-t border-white/[0.07] px-2 py-3.5 first:border-t-0",
                  s.id === showId && "rounded-xl bg-white/[0.04]",
                )}
              >
                <button type="button" onClick={() => setSelected(s.id)} className="min-w-0 text-left">
                  <span className="flex items-center gap-2.5 font-pretendard text-base font-bold text-white">
                    {isPlaying && (
                      <i className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" />
                    )}
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="font-pretendard text-sm text-white/50">
                    {state.styles[s.options.style ?? "basic"]} · 큐 {s.enabledCues}/{s.cues}
                  </span>
                </button>
                <span className="font-mono text-sm tabular-nums text-white/50">{Math.round(s.bpm)} BPM</span>
                <span className="font-mono text-sm tabular-nums text-white/50">{fmt(s.duration)}</span>
                <button
                  type="button"
                  disabled={!operable || isPlaying}
                  onClick={() => {
                    setSelected(s.id);
                    start(s.id, 0);
                  }}
                  className="h-10 rounded-xl border border-white/[0.12] bg-white/5 px-4 font-pretendard text-[15px] font-bold text-white enabled:hover:bg-white/10 disabled:cursor-default disabled:opacity-60"
                >
                  {isPlaying ? "재생 중" : "▶ 틀기"}
                </button>
              </div>
            );
          })}
          <div className={cn(state.shows.length > 0 && "mt-3")}>
            <UploadBox
              disabled={!operable || noFixtures}
              uploading={isUploading}
              onUpload={(file, name, style) =>
                upload({ file, name, options: { style } }).then((s) => setSelected(s.id))
              }
            />
          </div>
        </div>
      </Panel>

      {isAdmin && (
        <div>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="font-pretendard text-xs text-white/40 hover:text-white/75"
          >
            {showSettings
              ? "▴ 음악 조명 설정 접기"
              : "▾ 음악 조명 설정 (관리자) — 스트로브·깜빡임·소리 입력"}
          </button>
          {showSettings && (
            <Panel title="음악 조명 설정" hint="관리자" className="mt-3">
              <MusicSettings key={hallId} settings={state.settings} onSave={saveSettings} />
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
