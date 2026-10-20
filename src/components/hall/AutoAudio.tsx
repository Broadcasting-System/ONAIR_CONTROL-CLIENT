"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Check, X } from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import NeonButton from "@/components/common/NeonButton";
import Portal from "@/components/common/Portal";
import { cn } from "@/lib/utils";
import {
  AUTO_FEATURES,
  FEATURE_INFO,
  LIST_INFO,
  PARAM_INFO,
  RULE_TAG,
  type AutoAudioState,
  type AutoChannel,
  type AutoFeature,
  type AutoParams,
  type MeterSourceKind,
} from "@/types/autoAudio";

/** 켜기 스위치 (자동 음향·음악 조명 공통) */
export function OnSwitch({
  checked,
  disabled,
  onChange,
  label,
  tour,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
  /** CUE 튜토리얼 이름표 (data-tour) */
  tour?: string;
}) {
  return (
    <button
      data-tour={tour}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 max-md:before:absolute max-md:before:-inset-x-1 max-md:before:-inset-y-2.5 max-md:before:content-['']",
        checked ? "bg-[#FF3B3B] shadow-[0_0_12px_rgba(255,59,59,0.45)]" : "bg-white/15",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all",
          checked ? "left-[23px]" : "left-[3px]",
        )}
      />
    </button>
  );
}

const fmtDb = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} dB`;

/** 기능이 지금 이 채널을 실제로 바꾸고 있나 */
function actingOn(feature: AutoFeature, c: AutoChannel): boolean {
  if (feature === "duck") return c.offsetDb.duck < -0.25;
  if (feature === "idle") return c.offsetDb.idle < -0.5;
  if (feature === "level") return Math.abs(c.offsetDb.level) >= 0.25;
  return c.gainCutDb > 0;
}

/** 카드 아래 '지금 하는 일' 한 줄. 꺼져 있으면 없음 */
function featureStatus(
  feature: AutoFeature,
  state: AutoAudioState,
): { text: string; acting: boolean } | null {
  const f = state.features[feature];
  if (!f.enabled) return null;
  const lists = LIST_INFO[feature].map((l) => (f.params[l.key] as string[]) ?? []);
  if (lists.some((l) => l.length === 0)) return { text: "대상 채널 없음", acting: false };
  if (!state.meter.ok) return { text: "미터가 없어 쉬는 중", acting: false };
  const moving = state.channels.filter((c) => actingOn(feature, c));
  if (feature === "duck") {
    const depth = Number(f.params.depth_db ?? 10);
    return state.ducking
      ? { text: `지금 음악 −${depth} dB`, acting: true }
      : { text: "목소리 기다리는 중", acting: false };
  }
  if (feature === "idle") {
    return moving.length
      ? {
          text: `${moving.map((c) => c.name).join(" · ")} ${fmtDb(Math.min(...moving.map((c) => c.offsetDb.idle)))} 줄여 둠`,
          acting: true,
        }
      : { text: "조용한 마이크 없음", acting: false };
  }
  if (feature === "level") {
    return moving.length
      ? { text: moving.map((c) => `${c.name} ${fmtDb(c.offsetDb.level)}`).join(" · "), acting: true }
      : { text: "맞출 필요 없음", acting: false };
  }
  return moving.length
    ? { text: moving.map((c) => `${c.name} 게인 −${c.gainCutDb} dB`).join(" · "), acting: true }
    : { text: "찢어진 채널 없음", acting: false };
}

// 빨간 빛 점 (지금 줄이거나 맞추는 중)
const ACT_DOT = "h-[7px] w-[7px] shrink-0 rounded-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]";

/** 기능 카드 — 이름·켜기 스위치·지금 하는 일. 누르면 숫자 설정 창이 열린다 */
export function FeatureCard({
  feature,
  state,
  canOperate,
  onToggle,
  onOpen,
}: {
  feature: AutoFeature;
  state: AutoAudioState;
  canOperate: boolean;
  onToggle: (on: boolean) => void;
  onOpen: () => void;
}) {
  const f = state.features[feature];
  const info = FEATURE_INFO[feature];
  const status = featureStatus(feature, state);

  return (
    <div
      data-tour={`auto.feature.${feature}`}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={`${f.name} 설정`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        onOpen();
      }}
      className={cn(
        "flex min-w-0 cursor-pointer flex-col gap-2 rounded-2xl border px-3.5 py-3 outline-none backdrop-blur-md transition-colors focus-visible:border-white/50 md:px-4 md:py-3.5",
        f.enabled
          ? "border-white/[0.22] bg-white/[0.05] hover:bg-white/[0.08]"
          : "border-white/[0.08] bg-[rgba(14,14,17,0.7)] hover:bg-white/[0.035]",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "truncate font-orbitron text-[9.5px] font-semibold tracking-[0.18em]",
            f.enabled ? "text-white/40" : "text-white/25",
          )}
        >
          {info.en}
        </span>
        {/* 스위치를 눌러도 설정 창은 열리지 않는다 */}
        <span className="ml-auto flex" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <OnSwitch
            tour={`auto.feature.${feature}.switch`}
            checked={f.enabled}
            disabled={!canOperate}
            onChange={onToggle}
            label={`${f.name} 켜기`}
          />
        </span>
      </div>
      <span
        className={cn(
          "break-keep font-mbc text-[16px] leading-tight max-md:line-clamp-2 md:truncate md:text-[17px]",
          f.enabled ? "text-white" : "text-white/40",
        )}
      >
        {f.name}
      </span>
      <span className="flex min-h-[18px] min-w-0 items-center gap-[7px] font-pretendard text-[12.5px] font-medium">
        {status && (
          <>
            {status.acting && <span className={ACT_DOT} aria-hidden />}
            <span className={cn("truncate", status.acting ? "text-white" : "text-white/55")}>{status.text}</span>
          </>
        )}
      </span>
    </div>
  );
}

// 숫자 밀대 — 흰 채움 (시보 화면과 같은 모양)
const RANGE =
  "h-11 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default disabled:opacity-50 md:h-6 " +
  "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white " +
  "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded [&::-moz-range-track]:bg-[linear-gradient(90deg,#fff_var(--p),rgba(255,255,255,0.1)_var(--p))] " +
  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded [&::-webkit-slider-runnable-track]:bg-[linear-gradient(90deg,#fff_var(--p),rgba(255,255,255,0.1)_var(--p))] " +
  "[&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(0,0,0,0.45)]";

/** 기능 숫자 설정 창 — 문턱·깊이 등. 관리자만 저장, 나머지는 보기만. 대상 채널은 표에서 고른다 */
export function FeatureParamsModal({
  feature,
  state,
  isAdmin,
  saving,
  onClose,
  onSave,
}: {
  feature: AutoFeature;
  state: AutoAudioState;
  isAdmin: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (params: AutoParams) => Promise<unknown>;
}) {
  const f = state.features[feature];
  const keys = Object.keys(f.limits);
  const server = (k: string) => Number(f.params[k] ?? f.limits[k][0]);
  // 창을 연 동안에는 서버 값이 바뀌어도 고치는 값을 그대로 둔다
  const [draft, setDraft] = useState<Record<string, number>>(() =>
    Object.fromEntries(keys.map((k) => [k, server(k)])),
  );
  const dirty = keys.some((k) => draft[k] !== server(k));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 대상 채널 목록은 지금 서버 값 그대로 두고 숫자만 바꿔 보낸다
  const save = () =>
    onSave({ ...f.params, ...draft })
      .then(onClose)
      .catch(() => undefined);

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center md:p-4">
        <div className="absolute inset-0" onClick={onClose} aria-hidden />
        <div
          data-tour="auto.params"
          role="dialog"
          aria-modal="true"
          aria-label={`${f.name} 설정`}
          className="relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[22px] border border-white/10 bg-[#151518] pb-[env(safe-area-inset-bottom)] shadow-2xl md:max-w-[440px] md:rounded-[20px] md:pb-0"
        >
          <div className="flex items-start gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0 flex-1">
              <div className="font-orbitron text-[9.5px] font-semibold tracking-[0.18em] text-white/35">
                {FEATURE_INFO[feature].en}
              </div>
              <h2 className="mt-1 truncate font-mbc text-[20px] text-white">{f.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white md:h-9 md:w-9"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-5 pb-4 md:gap-2">
            {keys.map((key) => {
              const [lo, hi] = f.limits[key];
              const meta = PARAM_INFO[key] ?? { label: key, unit: "", step: 1 };
              const value = draft[key];
              const p = hi > lo ? ((value - lo) / (hi - lo)) * 100 : 0;
              return (
                <label key={key} className="flex flex-col font-pretendard text-[13px] text-white/60">
                  <span className="flex items-baseline justify-between gap-3">
                    {meta.label}
                    <span className="whitespace-nowrap font-orbitron text-[12px] font-semibold text-white">
                      {value}
                      <span className="ml-1 font-pretendard text-[11px] font-medium text-white/40">{meta.unit}</span>
                    </span>
                  </span>
                  <input
                    type="range"
                    min={lo}
                    max={hi}
                    step={meta.step}
                    value={value}
                    disabled={!isAdmin}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                    style={{ "--p": `${p}%` } as CSSProperties}
                    className={RANGE}
                  />
                </label>
              );
            })}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-3 border-t border-white/[0.08] px-5 py-3.5">
              <NeonButton
                tone="white"
                disabled={!dirty}
                onClick={() => setDraft(Object.fromEntries(keys.map((k) => [k, server(k)])))}
              >
                되돌리기
              </NeonButton>
              <NeonButton icon={<Check />} disabled={!dirty || saving} onClick={save} className="ml-auto min-w-[120px]">
                {saving ? "저장 중..." : "저장"}
              </NeonButton>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

// ---------------- 채널 × 기능 표 ----------------

// 입력 미터: -60dBFS(왼쪽 끝) ~ 0dBFS(오른쪽 끝)
const meterWidth = (db: number | undefined) =>
  db === undefined ? 0 : Math.max(0, Math.min(100, ((db + 60) / 60) * 100));

const SEGMENTS = 28;
// 칸 i 가 켜지는 소리 크기 (칸 오른쪽 끝, dBFS)
const SEG_TOP = Array.from({ length: SEGMENTS }, (_, i) => -60 + ((i + 1) * 60) / SEGMENTS);
const WARM_DB = -8; // -6dB 근처부터 분홍
const HOT_DB = -3; // 0dB 근처는 빨강
const SEG_CLS = {
  off: "bg-white/[0.07]",
  on: "bg-white/[0.85]",
  warm: "bg-[#ffb1ac]",
  hot: "bg-[#ff3b3b] shadow-[0_0_6px_#ff3b3b]",
  peak: "bg-transparent shadow-[inset_0_0_0_1px_#ff6a62]",
} as const;
const segTone = (i: number) => (SEG_TOP[i] > HOT_DB ? "hot" : SEG_TOP[i] > WARM_DB ? "warm" : "on");
const segsOf = (db: number | undefined) => Math.round((meterWidth(db) / 100) * SEGMENTS);

/** 한 줄 가로 LED 미터 (28칸) — 흰 LED, -6dB 근처 분홍, 0dB 근처 빨강. 문턱은 흰 세로선 */
function LedRow({ meter, gate, className }: { meter: AutoChannel["meter"]; gate: number | null; className?: string }) {
  const n = segsOf(meter?.level);
  const peak = segsOf(meter?.peak);
  return (
    <div
      role="meter"
      aria-label="입력"
      aria-valuemin={-60}
      aria-valuemax={0}
      aria-valuenow={meter ? Math.max(-60, meter.level) : -60}
      title={meter ? `입력 ${meter.level} dBFS · 최고 ${meter.peak} dBFS` : "미터 없음"}
      className={cn("relative flex gap-[2px]", !meter && "opacity-50", className)}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <i
          key={i}
          className={cn(
            "h-[9px] flex-1 rounded-[2px]",
            SEG_CLS[i < n ? segTone(i) : peak > n && i === peak - 1 ? "peak" : "off"],
          )}
        />
      ))}
      {gate !== null && (
        <span
          className="absolute -inset-y-[3px] w-[2px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.65)]"
          style={{ left: `${meterWidth(gate)}%` }}
          aria-hidden
        />
      )}
    </div>
  );
}

type CellKind = "none" | "on" | "voice" | "music";

/** 기능 칸 — PC 는 가운데 작은 네모, 폰은 한 줄 칩. 누르면 그 채널을 대상에 넣고 뺀다 */
function FeatureCell({
  kind,
  acting,
  label,
  phoneLabel,
  editable,
  busy,
  onClick,
  tour,
}: {
  kind: CellKind;
  acting: boolean;
  /** 읽어 주는 이름 (채널 · 기능 · 상태) */
  label: string;
  /** 폰 칩 글자 */
  phoneLabel: string;
  editable: boolean;
  busy: boolean;
  onClick: () => void;
  tour?: string;
}) {
  const pcText = kind === "voice" ? "목소리" : kind === "music" ? "음악" : "";
  return (
    <button
      data-tour={tour}
      type="button"
      aria-label={label}
      aria-disabled={!editable}
      title={label}
      onClick={() => editable && !busy && onClick()}
      className={cn(
        "group flex h-11 min-w-0 items-center justify-center md:h-10",
        editable ? "cursor-pointer" : "cursor-default",
        busy && "opacity-60",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-lg border font-pretendard font-semibold transition-colors",
          "max-md:h-full max-md:w-full max-md:px-1 max-md:text-center max-md:text-[12px] max-md:leading-tight",
          "md:h-[26px] md:min-w-[26px] md:whitespace-nowrap md:px-1.5 md:text-[10.5px]",
          acting
            ? "border-[#ff4a43] bg-[#FF3B3B]/[0.18] text-white shadow-[0_0_10px_-2px_#ff3b3b]"
            : kind === "voice"
              ? "border-white/60 bg-white text-[#0b0b0d]"
              : kind === "music" || kind === "on"
                ? "border-white/60 bg-white/[0.08] text-white"
                : "border-white/10 text-white/35 md:text-white/20",
          editable && !acting && kind !== "voice" && "group-hover:border-white/35 group-hover:bg-white/[0.05]",
        )}
      >
        <span className="md:hidden">{phoneLabel}</span>
        <span className="max-md:hidden">{pcText}</span>
      </span>
    </button>
  );
}

// 채널 | 입력 | 기능 4칸 | 지금 보정
const COLS = "md:grid-cols-[minmax(150px,1.1fr)_minmax(140px,2fr)_repeat(4,84px)_96px]";

/** 채널 × 기능 표 — 입력 미터, 기능마다 대상(누르면 넣고 빼기, 관리자만), 지금 보정 */
export function ChannelMatrix({
  state,
  canOperate,
  isAdmin,
  saving,
  onSaveParams,
  onResume,
}: {
  state: AutoAudioState;
  canOperate: boolean;
  isAdmin: boolean;
  saving: boolean;
  onSaveParams: (feature: AutoFeature, params: AutoParams) => Promise<unknown>;
  onResume: (channel: string) => void;
}) {
  const duck = state.features.duck;
  const listOf = (feature: AutoFeature, key: string) =>
    (state.features[feature].params[key] as string[] | undefined) ?? [];
  const keysOf = (feature: AutoFeature) => LIST_INFO[feature].map((l) => l.key);
  // 그 채널이 들어 있는 목록 번호 (-1 = 없음)
  const slotOf = (feature: AutoFeature, id: string) =>
    keysOf(feature).findIndex((k) => listOf(feature, k).includes(id));

  // 없음 → 첫 목록 → 다음 목록 → … → 없음. 한 기능의 두 목록에 같은 채널이 동시에 들어가지 않는다
  const cycle = (feature: AutoFeature, id: string) => {
    const keys = keysOf(feature);
    const next = slotOf(feature, id) + 1;
    const params: AutoParams = { ...state.features[feature].params };
    for (const k of keys) params[k] = listOf(feature, k).filter((x) => x !== id);
    if (next < keys.length) params[keys[next]] = [...(params[keys[next]] as string[]), id];
    onSaveParams(feature, params).catch(() => undefined);
  };

  const gate = (c: AutoChannel): number | null => {
    if (c.voice && duck.enabled) return Number(duck.params.threshold_db);
    if (c.rules.includes("idle")) return Number(state.features.idle.params.gate_db);
    return null;
  };

  if (state.channels.length === 0) {
    return <EmptyState size="sm">채널이 없어요</EmptyState>;
  }

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "hidden h-11 items-center gap-2.5 px-3.5 text-center font-mbc text-[12px] text-white/45 md:grid",
          COLS,
        )}
      >
        <span className="text-left">채널</span>
        <span className="text-left">입력</span>
        {AUTO_FEATURES.map((f) => (
          <span key={f} className="whitespace-nowrap">
            {RULE_TAG[f]}
          </span>
        ))}
        <span className="text-right">지금 보정</span>
      </div>
      <div className="flex flex-col gap-2 md:gap-0">
        {state.channels.map((c, idx) => {
          const total = c.offsetDb.duck + c.offsetDb.idle + c.offsetDb.level;
          const sub = [
            c.base !== null ? `사람 ${Math.round(c.base)}%` : "",
            c.gainCutDb > 0 ? `게인 −${c.gainCutDb} dB` : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <div
              key={c.id}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3",
                "md:gap-2.5 md:rounded-[10px] md:border-0 md:bg-transparent md:px-3.5 md:py-0.5 md:odd:bg-white/[0.025]",
                COLS,
              )}
            >
              <div className="flex min-w-0 flex-col">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-mbc text-[15px] text-white md:text-[14.5px]">{c.name}</span>
                  {c.pausedFor > 0 && (
                    <button
                      type="button"
                      disabled={!canOperate}
                      onClick={() => onResume(c.id)}
                      className="shrink-0 whitespace-nowrap rounded-md border border-white/30 px-1.5 py-px font-pretendard text-[11px] font-semibold text-white transition-colors enabled:hover:border-white/60 enabled:hover:bg-white/[0.08] disabled:cursor-default max-md:h-9 max-md:px-2.5 max-md:text-[12.5px]"
                    >
                      사람 우선 {Math.ceil(c.pausedFor)}초 · 지금 다시
                    </button>
                  )}
                </div>
                <span className="font-orbitron text-[8.5px] font-semibold tracking-[0.14em] text-white/30">
                  CH {c.id.padStart(2, "0")}
                </span>
              </div>
              <LedRow meter={c.meter} gate={gate(c)} className="order-3 col-span-2 md:order-none md:col-span-1" />
              <div className="order-4 col-span-2 grid grid-cols-4 gap-1.5 md:contents">
                {AUTO_FEATURES.map((f) => {
                  const slot = slotOf(f, c.id);
                  const kind: CellKind =
                    slot < 0 ? "none" : f === "duck" ? (slot === 0 ? "voice" : "music") : "on";
                  const acting = kind !== "none" && kind !== "voice" && actingOn(f, c);
                  const word =
                    kind === "voice" ? "목소리" : kind === "music" ? "음악" : kind === "on" ? "대상" : "대상 아님";
                  return (
                    <FeatureCell
                      key={f}
                      tour={idx === 0 ? `auto.cell.${f}` : undefined}
                      kind={kind}
                      acting={acting}
                      label={`${c.name} · ${RULE_TAG[f]} · ${word}`}
                      phoneLabel={f === "duck" && kind !== "none" ? word : RULE_TAG[f]}
                      editable={isAdmin}
                      busy={saving}
                      onClick={() => cycle(f, c.id)}
                    />
                  );
                })}
              </div>
              <div className="order-2 flex flex-col items-end md:order-none">
                <span
                  className={cn(
                    "whitespace-nowrap font-orbitron text-[12.5px] font-semibold tabular-nums",
                    Math.abs(total) < 0.1 ? "text-white/30" : total < 0 ? "text-[#ff8a8a]" : "text-white",
                  )}
                >
                  {Math.abs(total) < 0.1 ? "0 dB" : fmtDb(total)}
                </span>
                {sub && <span className="whitespace-nowrap font-pretendard text-[10px] text-white/35">{sub}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SOURCES: { value: MeterSourceKind; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "demo", label: "시연" },
  { value: "console", label: "콘솔 미터" },
  { value: "bridge", label: "강당 노트북 녹음" },
];

const field =
  "h-9 rounded-lg border border-white/10 bg-[#141414] px-2.5 font-pretendard text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none max-md:h-11 max-md:text-base";

/** 미터 출처·사람 우선 시간 (관리자) */
export function AutoSettings({
  state,
  saving,
  onSave,
}: {
  state: AutoAudioState;
  saving: boolean;
  onSave: (body: {
    meter?: {
      source: MeterSourceKind;
      url?: string;
      name?: string;
      lanes?: Record<string, string>;
    };
    overrideS?: number;
  }) => Promise<unknown>;
}) {
  const [source, setSource] = useState<MeterSourceKind>(state.meter.source);
  const [url, setUrl] = useState(state.meter.url);
  const [name, setName] = useState(state.meter.name);
  const [lanes, setLanes] = useState(
    Object.entries(state.meter.lanes)
      .map(([k, v]) => `${k}=${v}`)
      .join(", "),
  );
  const [override, setOverride] = useState(state.overrideS);

  const save = () => {
    const parsed: Record<string, string> = {};
    for (const part of lanes.split(",")) {
      const [k, v] = part.split("=").map((s) => s.trim());
      if (k && v) parsed[k] = v;
    }
    return onSave({
      meter: source === "bridge" ? { source, url, name, lanes: parsed } : { source },
      overrideS: override,
    }).catch(() => undefined);
  };

  return (
    <div className="flex flex-col gap-3 font-pretendard text-sm text-white/65">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 text-white/50">미터 출처</span>
        {SOURCES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setSource(s.value)}
            className={cn(
              "h-9 rounded-xl border px-3 font-mbc text-[13px] max-md:h-11",
              source === s.value
                ? "border-red-400/50 bg-red-400/15 text-white"
                : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/5",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {source === "bridge" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-28 text-white/50">노트북</span>
          <input
            className={cn(field, "w-56 max-md:w-full")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://100.x.x.x:8765"
          />
          <input
            className={cn(field, "w-32 max-md:w-full")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="녹음 장치 이름"
          />
          <input
            className={cn(field, "w-64 max-md:w-full")}
            value={lanes}
            onChange={(e) => setLanes(e.target.value)}
            placeholder="예: 1=1, 2=5"
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 text-white/50">사람 우선 시간</span>
        <input
          type="number"
          min={5}
          max={600}
          value={override}
          onChange={(e) => setOverride(Math.max(5, Math.min(600, Number(e.target.value) || 30)))}
          className={cn(field, "w-20 text-center font-orbitron")}
        />
        <span>초</span>
      </div>
      <NeonButton disabled={saving} onClick={save} className="w-fit md:h-9">
        저장
      </NeonButton>
    </div>
  );
}
