"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Notice, Panel } from "@/components/hall/HallControls";
import { OnSwitch } from "@/components/hall/AutoAudio";
import { useMusicLight, useMusicShow } from "@/hooks/useMusicLight";
import { musicLightApi } from "@/lib/autoAudioApi";
import { cn } from "@/lib/utils";
import {
  LANE_INFO,
  SECTION_INFO,
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

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[9px] bg-black/40 px-2.5 py-1.5 font-orbitron text-[11px] tracking-[0.1em] text-white/70">
      {children}
    </span>
  );
}

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

/** 구간 띠 · 크기 곡선 · 4박자 눈금 · 재생 위치 + 아래 큐 줄 */
function Timeline({
  show,
  position,
  operable,
  onToggleCue,
  onToggleLane,
}: {
  show: ShowDetail;
  position: number;
  operable: boolean;
  onToggleCue: (id: string, on: boolean) => void;
  onToggleLane: (ids: string[], on: boolean) => void;
}) {
  const W = 1000;
  const H = 130;
  const L = Math.max(1, show.analysis.duration);
  const x = (s: number) => (s / L) * W;
  const path = useMemo(() => {
    const e = show.analysis.energy;
    if (!e.length) return "";
    const step = L / e.length;
    return (
      `M0 ${H} ` +
      e.map((v, i) => `L${x(i * step).toFixed(1)} ${(H - v * (H - 22)).toFixed(1)}`).join(" ") +
      ` L${W} ${H} Z`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show.analysis.energy, L]);
  const bars = show.analysis.beats.filter((_, i) => i % 4 === 0);
  const lanes = LANE_INFO.filter((l) => show.cueList.some((c) => c.lane === l.lane));

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-[14px] border border-black bg-[#08080a] shadow-[inset_0_1px_6px_#000]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-[130px] w-full"
        >
          {bars.map((b, i) => (
            <line key={i} x1={x(b)} x2={x(b)} y1={18} y2={H} stroke="rgba(255,255,255,0.06)" />
          ))}
          {path && <path d={path} fill="rgba(255,59,59,0.22)" stroke="#FF3B3B" strokeWidth={1.2} />}
          {show.analysis.sections.map((s, i) => (
            <g key={i}>
              <rect
                x={x(s.start)}
                y={0}
                width={x(s.end) - x(s.start)}
                height={16}
                fill={SECTION_INFO[s.kind].color}
                opacity={0.55}
              />
              <text x={x(s.start) + 6} y={12} fontSize={10} fill="#fff" fontFamily="Pretendard">
                {SECTION_INFO[s.kind].label}
              </text>
            </g>
          ))}
          {position > 0 && (
            <line x1={x(position)} x2={x(position)} y1={0} y2={H} stroke="#fff" strokeWidth={2} />
          )}
        </svg>
      </div>
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
                      background: c.strobe ? "#ffffff" : l.color,
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 font-pretendard text-[11.5px] text-white/50">
        {Object.values(SECTION_INFO).map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto">
          큐를 누르면 그 큐만, 줄 이름을 누르면 줄 전체를 끄고 켤 수 있어요
        </span>
      </div>
    </div>
  );
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
          className="h-9 flex-1 rounded-lg border border-[#FF3B3B]/50 bg-[#FF3B3B]/20 font-mbc text-sm text-white disabled:opacity-50"
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
        <p className="text-xs text-amber-100/70">
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

/** 조명 화면의 '음악 조명' 탭 — 쇼 목록·올리기·실시간 | 타임라인·시작/정지·안전 */
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

  if (!state) {
    return error ? <Notice>{error.message}</Notice> : null;
  }

  const live = state.live;
  const summary = state.shows.find((s) => s.id === showId) ?? null;
  const noFixtures = state.fixtures.led + state.fixtures.dimmer === 0;

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

  return (
    <div className="flex flex-col gap-5">
      <style>{`@keyframes onairBeat { 0%, 12% { background: #FF3B3B; box-shadow: 0 0 18px #FF3B3B; } 30%, 100% { background: #222; box-shadow: none; } }`}</style>
      {noFixtures && (
        <Notice tone="info">
          조명 목록이 비어 있어요. 관리자가 조명 세팅에서 조명을 넣으면 쇼를 만들 수 있어요.
        </Notice>
      )}
      {state.lastError && <Notice>{state.lastError}</Notice>}
      {(playing?.error || live?.error) && <Notice>{playing?.error || live?.error}</Notice>}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Panel title="조명 쇼">
          <div className="flex flex-col gap-2">
            {state.shows.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s.id)}
                className={cn(
                  "rounded-[14px] border px-3.5 py-3 text-left",
                  s.id === showId
                    ? "border-[#FF3B3B]/55 bg-[linear-gradient(180deg,rgba(255,59,59,0.2),rgba(255,59,59,0.06))]"
                    : "border-white/[0.08] bg-[linear-gradient(180deg,#1d1d21,#131316)] hover:border-white/20",
                )}
              >
                <span className="flex items-center gap-2 font-mbc text-base text-white">
                  {s.name}
                  {playing?.showId === s.id && (
                    <span className="rounded bg-red-500 px-1.5 py-px font-orbitron text-[9px] text-white">
                      ON AIR
                    </span>
                  )}
                </span>
                <span className="font-orbitron text-[10px] tracking-[0.08em] text-white/40">
                  {Math.round(s.bpm)} BPM · {fmt(s.duration)} · 큐 {s.enabledCues}/{s.cues}
                </span>
              </button>
            ))}
            <UploadBox
              disabled={!operable || noFixtures}
              uploading={isUploading}
              onUpload={(file, name, style) =>
                upload({ file, name, options: { style } }).then((s) => setSelected(s.id))
              }
            />
          </div>

          <div className="mt-4 flex items-center gap-3.5 rounded-2xl border border-white/[0.06] bg-black/35 p-3.5">
            <span
              className="h-[22px] w-[22px] shrink-0 rounded-full bg-[#222]"
              style={live?.bpm ? { animation: `onairBeat ${60 / live.bpm}s infinite` } : undefined}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="font-mbc text-[17px] text-white">실시간 박자 따라가기</div>
              <div className="font-pretendard text-xs text-white/45">
                {live
                  ? live.bpm
                    ? `${Math.round(live.bpm)} BPM · 박자 ${live.beats}번`
                    : "박자를 듣는 중…"
                  : state.feed || "쇼 없이 지금 나오는 음악에 맞춰요"}
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded bg-[#050506]">
                <span
                  className="block h-full bg-[linear-gradient(90deg,#3D6BFF,#A855F7,#FF3B3B)] transition-[width] duration-300"
                  style={{ width: `${live ? live.energy * 100 : 0}%` }}
                />
              </div>
            </div>
            <OnSwitch
              checked={!!live}
              disabled={!operable || (!live && !state.feed)}
              onChange={(on) => setLive(on)}
              label="실시간 박자 따라가기"
            />
          </div>
          {!state.feed && (
            <p className="mt-2 font-pretendard text-[11.5px] text-white/35">
              소리 입력이 없어 실시간은 꺼져 있어요 (관리자 설정).
            </p>
          )}
        </Panel>

        <Panel
          title={summary?.name ?? "쇼를 고르세요"}
          hint={summary ? "음악을 트는 순간 '시작'을 누르세요" : undefined}
        >
          {!summary || !show ? (
            <p className="font-pretendard text-sm text-white/40">
              MR 을 올리면 빠르기·박자·구간을 찾아 조명 큐를 만들어요.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2.5">
                <Chip>{Math.round(summary.bpm)} BPM</Chip>
                <Chip>{fmt(summary.duration)}</Chip>
                <Chip>
                  큐 {summary.enabledCues}/{summary.cues}
                </Chip>
                <Chip>
                  LED {state.fixtures.led} · 할로겐 {state.fixtures.dimmer}
                </Chip>
              </div>

              <Timeline
                show={show}
                position={position}
                operable={operable}
                onToggleCue={(id, on) => update(summary.id, { cues: { [id]: on } })}
                onToggleLane={(ids, on) =>
                  update(summary.id, { cues: Object.fromEntries(ids.map((id) => [id, on])) })
                }
              />

              <div className="flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  disabled={!operable}
                  onClick={press}
                  className={cn(
                    "flex h-14 items-center gap-2.5 rounded-2xl border px-6 font-mbc text-[19px] text-white disabled:cursor-not-allowed disabled:opacity-40",
                    playing
                      ? "border-[#FF3B3B] bg-[#FF3B3B] shadow-[0_0_24px_rgba(255,59,59,0.5)]"
                      : "border-[#FF3B3B]/50 bg-[linear-gradient(180deg,rgba(255,59,59,0.3),rgba(255,59,59,0.1))]",
                  )}
                >
                  {playing ? "■ 정지" : "▶ 시작"}
                </button>
                <div className="font-orbitron text-[22px] tabular-nums text-white">
                  {fmt(position)}{" "}
                  <span className="text-xs text-white/35">/ {fmt(summary.duration)}</span>
                </div>
                {summary.hasAudio && (
                  <div className="flex flex-col gap-1">
                    <audio
                      ref={setAudio}
                      key={summary.id}
                      src={musicLightApi.audioUrl(hallId, summary.id)}
                      controls
                      preload="none"
                      className="h-8 w-60"
                    />
                    <label className="flex items-center gap-1.5 font-pretendard text-[11.5px] text-white/50">
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
                <div className="ml-auto flex flex-col gap-1.5 font-pretendard text-[12.5px] text-white/55">
                  <span className="flex items-center gap-2">
                    <i className="h-[7px] w-[7px] rounded-full bg-[#00FF57]" />
                    깜빡임은 1초에 {state.settings.maxFlashPerSec}번까지 (고정 상한{" "}
                    {state.maxFlashPerSec})
                  </span>
                  <span className="flex items-center gap-2">
                    <i
                      className={cn(
                        "h-[7px] w-[7px] rounded-full",
                        state.settings.allowStrobe ? "bg-[#FFD600]" : "bg-[#585858]",
                      )}
                    />
                    {state.settings.allowStrobe
                      ? "스트로브 허용됨 · 쇼에서 켜야 나감"
                      : "스트로브 꺼짐 · 관리자가 켜야 함"}
                  </span>
                  <span className="flex items-center gap-2">
                    <i className="h-[7px] w-[7px] rounded-full bg-[#00FF57]" />
                    할로겐 조명은 {state.dimmerMinFade}초 넘게 천천히만
                  </span>
                </div>
              </div>
              {playing && (playing.skipped.flash > 0 || playing.skipped.strobe > 0) && (
                <p className="font-pretendard text-xs text-white/40">
                  안전 규칙으로 건너뜀 — 깜빡임 {playing.skipped.flash}번 · 스트로브{" "}
                  {playing.skipped.strobe}번
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4 font-pretendard text-[13px] text-white/55">
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
                    <select
                      value={summary.options.startScene ?? ""}
                      disabled={!operable || !!playing}
                      onChange={(e) =>
                        update(summary.id, { options: { startScene: e.target.value } })
                      }
                      className="h-8 rounded-lg border border-white/10 bg-[#141414] px-2 text-sm text-white"
                    >
                      <option value="">없음</option>
                      {state.scenes.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                    <span>끝 장면</span>
                    <select
                      value={summary.options.endScene ?? ""}
                      disabled={!operable || !!playing}
                      onChange={(e) =>
                        update(summary.id, { options: { endScene: e.target.value } })
                      }
                      className="h-8 rounded-lg border border-white/10 bg-[#141414] px-2 text-sm text-white"
                    >
                      <option value="">천천히 끄기</option>
                      {state.scenes.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <button
                  type="button"
                  disabled={!operable || !!playing}
                  onClick={() => {
                    if (window.confirm(`'${summary.name}' 쇼를 지울까요?`)) remove(summary.id);
                  }}
                  className="ml-auto h-8 rounded-lg border border-white/10 bg-white/5 px-3 font-mbc text-[13px] text-white/50 enabled:hover:text-red-300 disabled:opacity-40"
                >
                  쇼 지우기
                </button>
              </div>
              <p className="font-pretendard text-[11.5px] text-white/35">
                분위기·스트로브·장면을 바꾸면 큐를 다시 만들어요 (큐마다 끈 것은 처음으로 돌아가요).
              </p>
            </div>
          )}
        </Panel>
      </div>

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
