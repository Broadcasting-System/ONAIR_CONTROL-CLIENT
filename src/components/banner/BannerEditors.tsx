"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, Minus, Plus, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DurationWheel } from "@/components/common/DateTimePicker";
import { UploadedFile } from "@/types/file";
import {
  SCORE_ANIM_OPTIONS,
  type BannerOverlay,
  type DefaultBannerPayload,
  type GifPayload,
  type ImagePayload,
  type ScoreAnim,
  type ScoreboardPayload,
  type TimerPayload,
} from "@/lib/bannerApi";

// ---------------------------------------------------------------- 공용 모양

export const inputCls =
  "h-11 w-full min-w-0 rounded-xl border border-white/10 bg-[#0c0d0f] px-3.5 font-pretendard text-[15px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/30 disabled:opacity-40 md:h-[42px] md:text-[14.5px]";
const chipCls =
  "flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] border px-3 font-mbc text-[13.5px] transition-colors md:h-[34px]";
const chipOn = "border-white bg-white text-[#0b0b0d]";
const chipOff = "border-white/[0.12] text-white/60 hover:text-white";
const ghostSm =
  "flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[11px] border border-white/[0.12] bg-white/[0.03] px-3 font-mbc text-[13.5px] text-white/75 transition-colors hover:text-white md:h-9";

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mbc text-[14px] text-white/55", className)}>{children}</span>;
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Text({
  value,
  onChange,
  placeholder,
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <input
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={inputCls}
    />
  );
}

export function Chip({ on, onClick, children, className }: { on?: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" aria-pressed={!!on} onClick={onClick} className={cn(chipCls, on ? chipOn : chipOff, className)}>
      {children}
    </button>
  );
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex h-11 items-center justify-between gap-3 rounded-[11px] border border-white/10 bg-white/[0.03] px-3 font-mbc text-[14px] text-white/75 md:h-10"
    >
      {label}
      <span className={cn("relative h-5 w-[34px] shrink-0 rounded-full transition-colors", on ? "bg-[#FF3B3B]" : "bg-white/15")}>
        <i className={cn("absolute top-[3px] h-[14px] w-[14px] rounded-full transition-all", on ? "left-[17px] bg-white" : "left-[3px] bg-white/70")} />
      </span>
    </button>
  );
}

function Slider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Label className="w-[88px] shrink-0 text-[13.5px]">{label}</Label>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--p": `${pct}%` } as CSSProperties}
        className="h-11 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent md:h-6 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded [&::-moz-range-track]:bg-[linear-gradient(90deg,#fff_var(--p),rgba(255,255,255,0.1)_var(--p))] [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded [&::-webkit-slider-runnable-track]:bg-[linear-gradient(90deg,#fff_var(--p),rgba(255,255,255,0.1)_var(--p))] [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(0,0,0,0.45)]"
      />
      <span className="w-10 shrink-0 text-right font-orbitron text-[12px] tabular-nums text-white">{value}</span>
    </div>
  );
}

/** 크기 같은 세부 설정은 접어 둔다 */
function Details({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.015]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-11 w-full items-center gap-2 px-3.5 font-mbc text-[14px] text-white/55 transition-colors hover:text-white md:h-10"
      >
        자세히
        <ChevronDown size={15} className={cn("ml-auto transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="flex flex-col gap-3 border-t border-white/[0.06] px-3.5 pb-3.5 pt-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- 글자

export function DefaultBannerEditor({ value, onChange }: { value: DefaultBannerPayload; onChange: (v: DefaultBannerPayload) => void }) {
  const set = (k: keyof DefaultBannerPayload) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="flex flex-col gap-3">
      <Field label="큰 글자">
        <Text label="큰 글자" value={value.mainText} onChange={set("mainText")} placeholder="2025학년도 2학기 동계캠프" />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="작은 글자 1">
          <Text label="작은 글자 1" value={value.subText1} onChange={set("subText1")} placeholder="2025년, BSSM 해커톤" />
        </Field>
        <Field label="작은 글자 2">
          <Text label="작은 글자 2" value={value.subText2} onChange={set("subText2")} placeholder="가락관 · 12. 29.(월) ~ 31.(수)" />
        </Field>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 점수보드

/** 점수 조작 — 지금 현수막에도 똑같이 적용할 수 있게 함수로 넘긴다 */
export type ScoreOp = (p: ScoreboardPayload) => ScoreboardPayload;

const bump =
  (team: "teamA" | "teamB", field: "score" | "set", delta: number): ScoreOp =>
  (p) => {
    const cap = field === "score" ? 99 : 9;
    const cur = Number.isFinite(p[team][field]) ? p[team][field] : 0;
    return { ...p, [team]: { ...p[team], [field]: Math.max(0, Math.min(cap, cur + delta)) } };
  };
const resetScore: ScoreOp = (p) => ({ ...p, teamA: { ...p.teamA, score: 0 }, teamB: { ...p.teamB, score: 0 } });
const courtChange: ScoreOp = (p) => ({ ...p, teamA: p.teamB, teamB: p.teamA, courtChange: { at: Date.now() } });
const victory =
  (side: "left" | "right"): ScoreOp =>
  (p) => ({ ...p, victory: { side, name: side === "left" ? p.teamA.name : p.teamB.name, at: Date.now() } });
const clearVictory: ScoreOp = (p) => ({ ...p, victory: null });
const setAnim =
  (k: ScoreAnim): ScoreOp =>
  (p) => ({ ...p, scoreAnim: k });

function TeamCard({
  name,
  side,
  team,
  showSet,
  onBump,
}: {
  name: string;
  side: string;
  team: { score: number; set: number };
  showSet: boolean;
  onBump: (field: "score" | "set", d: number) => void;
}) {
  const sm =
    "flex h-11 w-11 items-center justify-center rounded-lg border border-white/[0.14] text-white/75 transition-colors hover:text-white active:scale-95 md:h-[30px] md:w-[30px]";
  return (
    <div className="min-w-0 rounded-[14px] border border-white/[0.08] bg-black/35 px-3.5 py-3">
      <div className="flex items-baseline gap-2">
        <span className="truncate font-mbc text-[17px] text-white">{name || side}</span>
        <span className="font-pretendard text-[12px] text-white/40">{side}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          aria-label={`${name || side} 점수 빼기`}
          onClick={() => onBump("score", -1)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.14] text-white/75 transition-colors hover:text-white active:scale-95 md:h-11 md:w-11"
        >
          <Minus size={18} />
        </button>
        <span className="flex-1 text-center font-orbitron text-[44px] font-black leading-none tabular-nums text-white">{team.score}</span>
        <button
          type="button"
          aria-label={`${name || side} 점수 더하기`}
          onClick={() => onBump("score", 1)}
          className="flex h-[52px] w-16 shrink-0 items-center justify-center rounded-xl bg-white font-orbitron text-[18px] font-bold text-[#0b0b0d] transition-transform active:scale-95"
        >
          +1
        </button>
      </div>
      {showSet && (
        <div className="mt-2.5 flex items-center gap-2">
          <Label className="mr-1">세트</Label>
          <button type="button" aria-label="세트 빼기" onClick={() => onBump("set", -1)} className={sm}>
            <Minus size={14} />
          </button>
          <span className="w-[26px] text-center font-orbitron text-[18px] font-bold tabular-nums text-white">{team.set}</span>
          <button type="button" aria-label="세트 더하기" onClick={() => onBump("set", 1)} className={sm}>
            <Plus size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export function ScoreboardEditor({
  value,
  onChange,
  onScore,
  live,
}: {
  value: ScoreboardPayload;
  /** 초안만 바꾸는 편집 (제목·팀 이름·크기 등) */
  onChange: (v: ScoreboardPayload) => void;
  /** 점수 조작 — 점수보드가 떠 있으면 바로 나간다 */
  onScore: (op: ScoreOp) => void;
  /** 이 점수보드가 지금 떠 있는지 */
  live: boolean;
}) {
  const set = (patch: Partial<ScoreboardPayload>) => onChange({ ...value, ...patch });
  const nameA = value.teamA.name || "왼쪽";
  const nameB = value.teamB.name || "오른쪽";
  return (
    <div className="flex flex-col gap-3" data-tour="banner.scoreboard">
      <div className={cn("rounded-2xl border p-3 md:px-4 md:py-3.5", live ? "border-[#FF3B3B]/25 bg-[#FF3B3B]/[0.04]" : "border-white/[0.08] bg-white/[0.015]")}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-mbc text-[15px] text-white">점수</span>
          {live && (
            <span className="rounded-md border border-[#FF3B3B]/45 bg-[#FF3B3B]/10 px-2 py-0.5 font-pretendard text-[11px] font-semibold text-[#ff8a8a]">바로 나감</span>
          )}
          <span className="ml-auto" />
          <button type="button" data-tour="banner.court-change" onClick={() => onScore(courtChange)} className={ghostSm}>
            <Shuffle size={14} />
            코트 체인지
          </button>
          <button type="button" data-tour="banner.score-reset" onClick={() => onScore(resetScore)} className={ghostSm}>
            점수 초기화
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] md:items-center">
          <TeamCard name={value.teamA.name ?? ""} side="왼쪽" team={value.teamA} showSet={value.showSet} onBump={(f, d) => onScore(bump("teamA", f, d))} />
          <span className="hidden text-center font-orbitron text-[13px] font-bold text-white/35 md:block">VS</span>
          <TeamCard name={value.teamB.name ?? ""} side="오른쪽" team={value.teamB} showSet={value.showSet} onBump={(f, d) => onScore(bump("teamB", f, d))} />
        </div>
        <div className="mt-3 flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2" data-tour="banner.victory">
            <Label className="mr-1">승리 선언</Label>
            <Chip on={value.victory?.side === "left"} onClick={() => onScore(victory("left"))}>
              {nameA} 승리
            </Chip>
            <Chip on={value.victory?.side === "right"} onClick={() => onScore(victory("right"))}>
              {nameB} 승리
            </Chip>
            {value.victory && (
              <Chip onClick={() => onScore(clearVictory)} className="border-dashed">
                해제
              </Chip>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="mr-1">득점 효과</Label>
            {SCORE_ANIM_OPTIONS.map((o) => (
              <Chip key={o.key} on={value.scoreAnim === o.key} onClick={() => onScore(setAnim(o.key))}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label="제목">
          <Text label="제목" value={value.title} onChange={(t) => set({ title: t })} placeholder="2학년 빅발리볼 3위 결정전" />
        </Field>
        <Field label="왼쪽 팀">
          <Text label="왼쪽 팀" value={value.teamA.name ?? ""} onChange={(t) => onChange({ ...value, teamA: { ...value.teamA, name: t } })} placeholder="2반" />
        </Field>
        <Field label="오른쪽 팀">
          <Text label="오른쪽 팀" value={value.teamB.name ?? ""} onChange={(t) => onChange({ ...value, teamB: { ...value.teamB, name: t } })} placeholder="4반" />
        </Field>
      </div>

      <Details>
        <div className="grid gap-3 md:grid-cols-2">
          <Switch label="세트 점수 보이기" on={value.showSet} onToggle={() => set({ showSet: !value.showSet })} />
          <div className="flex h-11 items-center gap-2 rounded-[11px] border border-white/10 bg-white/[0.03] px-3 md:h-10">
            <span className="flex-1 font-mbc text-[14px] text-white/75">목표 점수</span>
            <button
              type="button"
              aria-label="목표 점수 빼기"
              onClick={() => set({ targetScore: Math.max(2, value.targetScore - 1) })}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.14] text-white/75 md:h-7 md:w-7"
            >
              <Minus size={13} />
            </button>
            <span className="w-8 text-center font-orbitron text-[15px] font-bold tabular-nums text-white">{value.targetScore}</span>
            <button
              type="button"
              aria-label="목표 점수 더하기"
              onClick={() => set({ targetScore: Math.min(99, value.targetScore + 1) })}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.14] text-white/75 md:h-7 md:w-7"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
        <Slider label="제목 크기" value={value.titleSize} min={80} max={260} onChange={(n) => set({ titleSize: n })} />
        <Slider label="팀 이름 크기" value={value.subtitleSize} min={40} max={160} onChange={(n) => set({ subtitleSize: n })} />
      </Details>
    </div>
  );
}

// ---------------------------------------------------------------- 사진 · 움직이는 사진

const OVERLAY_COLORS = ["#ffffff", "#000000", "#ffe14d", "#ff3b3b", "#7dffb0", "#5ab8ff"];
const OVERLAY_POSITIONS: { key: BannerOverlay["position"]; label: string }[] = [
  { key: "top", label: "위" },
  { key: "center", label: "가운데" },
  { key: "bottom", label: "아래" },
];
const DEFAULT_OVERLAY: BannerOverlay = {
  title: "",
  subtitle: "",
  titleSize: 240,
  subtitleSize: 120,
  showSubtitle: true,
  color: "#ffffff",
  position: "center",
  visible: true,
};

function ImagePicker({ files, activeUrl, onPick, empty }: { files: UploadedFile[]; activeUrl?: string; onPick: (url: string) => void; empty: string }) {
  if (files.length === 0) {
    return <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center font-pretendard text-[14px] text-white/40">{empty}</p>;
  }
  return (
    <div className="grid max-h-[208px] grid-cols-3 gap-2 overflow-auto rounded-xl border border-white/[0.07] bg-black/30 p-2 sm:grid-cols-4 lg:grid-cols-6">
      {files.map((f) => {
        const on = activeUrl === f.fileUrl;
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(f.fileUrl)}
            title={f.fileName}
            className={cn("relative overflow-hidden rounded-lg border transition-colors", on ? "border-white ring-1 ring-white" : "border-white/10 hover:border-white/35")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.thumbnailUrl || f.fileUrl} alt={f.fileName} className="h-16 w-full bg-black object-cover" />
          </button>
        );
      })}
    </div>
  );
}

export function ImageEditor({ value, onChange, images }: { value: ImagePayload; onChange: (v: ImagePayload) => void; images: UploadedFile[] }) {
  const ov: BannerOverlay = { ...DEFAULT_OVERLAY, ...value.overlay };
  const patch = (p: Partial<BannerOverlay>) => onChange({ ...value, overlay: { ...ov, ...p } });
  return (
    <div className="flex flex-col gap-3">
      <Field label="사진">
        <ImagePicker files={images} activeUrl={value.url} onPick={(url) => onChange({ ...value, url })} empty="올린 사진이 없어요" />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Label className="mr-1">맞춤</Label>
        {(["cover", "contain"] as const).map((fit) => (
          <Chip key={fit} on={(value.fit ?? "cover") === fit} onClick={() => onChange({ ...value, fit })}>
            {fit === "cover" ? "꽉 채움" : "전체 보이기"}
          </Chip>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="위에 올릴 글자">
          <div className="flex gap-2">
            <Text label="위에 올릴 글자" value={ov.title} onChange={(title) => patch({ title })} placeholder="제목" />
            <Chip on={ov.visible} onClick={() => patch({ visible: !ov.visible })} className="md:h-[42px]">
              {ov.visible ? "보임" : "숨김"}
            </Chip>
          </div>
        </Field>
        <Field label="작은 글자">
          <div className="flex gap-2">
            <Text label="작은 글자" value={ov.subtitle} onChange={(subtitle) => patch({ subtitle })} placeholder="부제목" disabled={!ov.showSubtitle} />
            <Chip on={ov.showSubtitle} onClick={() => patch({ showSubtitle: !ov.showSubtitle })} className="md:h-[42px]">
              {ov.showSubtitle ? "보임" : "숨김"}
            </Chip>
          </div>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <Label className="mr-1">글자 색</Label>
          {OVERLAY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={ov.color === c}
              onClick={() => patch({ color: c })}
              style={{ backgroundColor: c }}
              className={cn(
                "h-8 w-8 rounded-full border transition-transform md:h-7 md:w-7",
                ov.color === c ? "scale-110 border-white ring-2 ring-white/40" : "border-white/20 hover:scale-105",
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Label className="mr-1">위치</Label>
          {OVERLAY_POSITIONS.map((p) => (
            <Chip key={p.key} on={ov.position === p.key} onClick={() => patch({ position: p.key })}>
              {p.label}
            </Chip>
          ))}
        </div>
      </div>
      <Details>
        <Slider label="글자 크기" value={ov.titleSize} min={60} max={520} step={10} onChange={(n) => patch({ titleSize: n })} />
        <Slider label="작은 글자 크기" value={ov.subtitleSize} min={40} max={360} step={10} onChange={(n) => patch({ subtitleSize: n })} />
        <Field label="주소로 넣기">
          <Text label="사진 주소" value={value.url} onChange={(url) => onChange({ ...value, url })} placeholder="https://" />
        </Field>
      </Details>
    </div>
  );
}

export function GifEditor({ value, onChange, gifs }: { value: GifPayload; onChange: (v: GifPayload) => void; gifs: UploadedFile[] }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="움직이는 사진">
        <ImagePicker files={gifs} activeUrl={value.url} onPick={(url) => onChange({ url })} empty="올린 사진이 없어요" />
      </Field>
      <Details>
        <Field label="주소로 넣기">
          <Text label="움직이는 사진 주소" value={value.url} onChange={(url) => onChange({ url })} placeholder="https://" />
        </Field>
      </Details>
    </div>
  );
}

// ---------------------------------------------------------------- 타이머

export function BannerTimerEditor({ value, onChange }: { value: TimerPayload; onChange: (v: TimerPayload) => void }) {
  const mode = value.mode ?? "down";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["down", "up"] as const).map((m) => (
          <Chip key={m} on={mode === m} onClick={() => onChange({ ...value, mode: m })}>
            {m === "down" ? "줄어드는 시간" : "늘어나는 시간"}
          </Chip>
        ))}
      </div>
      <Field label="위에 쓸 글자">
        <Text label="위에 쓸 글자" value={value.label ?? ""} onChange={(label) => onChange({ ...value, label })} placeholder="축제 시작까지" />
      </Field>
      {mode === "down" && (
        <DurationWheel value={value.durationSec ?? 0} onChange={(sec) => onChange({ ...value, durationSec: sec })} className="self-start" />
      )}
    </div>
  );
}
