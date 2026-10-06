"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  FEATURE_INFO,
  LIST_INFO,
  PARAM_INFO,
  RULE_TAG,
  type AutoAudioState,
  type AutoChannel,
  type AutoFeature,
  type AutoLogEntry,
  type AutoParams,
  type MeterSourceKind,
} from "@/types/autoAudio";

/** 켜기 스위치 (자동 음향·음악 조명 공통) */
export function OnSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
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

/** 카드 아래 '지금 하는 일' 한 줄 */
function featureStatus(
  feature: AutoFeature,
  state: AutoAudioState,
): { text: string; acting: boolean } {
  const f = state.features[feature];
  if (!f.enabled) return { text: "꺼짐", acting: false };
  const lists = LIST_INFO[feature].map((l) => (f.params[l.key] as string[]) ?? []);
  if (lists.some((l) => l.length === 0))
    return { text: "대상 채널을 먼저 정해야 해요 (관리자)", acting: false };
  if (!state.meter.ok) return { text: "미터가 없어 쉬는 중", acting: false };
  const name = (c: AutoChannel) => c.name;
  if (feature === "duck") {
    const depth = Number(f.params.depth_db ?? 10);
    return state.ducking
      ? { text: `지금 음악 −${depth} dB 줄이는 중`, acting: true }
      : { text: "목소리 기다리는 중", acting: false };
  }
  if (feature === "idle") {
    const down = state.channels.filter((c) => c.offsetDb.idle < -0.5);
    return down.length
      ? {
          text: `${down.map(name).join(", ")} ${fmtDb(Math.min(...down.map((c) => c.offsetDb.idle)))} 줄여 둠`,
          acting: true,
        }
      : { text: "조용한 마이크 없음", acting: false };
  }
  if (feature === "level") {
    const moved = state.channels.filter((c) => Math.abs(c.offsetDb.level) >= 0.25);
    return moved.length
      ? { text: moved.map((c) => `${c.name} ${fmtDb(c.offsetDb.level)}`).join(" · "), acting: true }
      : { text: "맞출 필요 없음", acting: false };
  }
  const cut = state.channels.filter((c) => c.gainCutDb > 0);
  return cut.length
    ? { text: cut.map((c) => `${c.name} 게인 −${c.gainCutDb} dB`).join(" · "), acting: true }
    : { text: "찢어진 채널 없음", acting: false };
}

/** 기능 카드 — 켜기 스위치 · 한 줄 설명 · 지금 하는 일 · 자세히(숫자·대상 채널, 관리자만 저장) */
export function FeatureCard({
  feature,
  state,
  canOperate,
  isAdmin,
  saving,
  onToggle,
  onSave,
}: {
  feature: AutoFeature;
  state: AutoAudioState;
  canOperate: boolean;
  isAdmin: boolean;
  saving: boolean;
  onToggle: (on: boolean) => void;
  onSave: (params: AutoParams) => Promise<unknown>;
}) {
  const f = state.features[feature];
  const info = FEATURE_INFO[feature];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AutoParams>(f.params);
  const dirty = JSON.stringify(draft) !== JSON.stringify(f.params);
  // 서버 값이 바뀌면(다른 기기에서 저장 등) 고치는 중이 아닐 때만 따라간다
  useEffect(() => {
    if (!open) setDraft(f.params);
  }, [f.params, open]);
  const status = featureStatus(feature, state);
  const channels = state.channels;
  const others = (key: string) =>
    new Set(
      LIST_INFO[feature]
        .filter((l) => l.key !== key)
        .flatMap((l) => (draft[l.key] as string[]) ?? []),
    );

  return (
    <div
      className={cn(
        "flex min-h-[190px] flex-col gap-2.5 rounded-[18px] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        f.enabled
          ? "border-[#FF3B3B]/45 bg-[linear-gradient(180deg,rgba(255,59,59,0.13),rgba(255,59,59,0.03))]"
          : "border-white/[0.08] bg-[linear-gradient(180deg,#1b1b1f,#121215)]",
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="font-mbc text-[19px] leading-tight text-white">{f.name}</div>
          <div className="font-orbitron text-[8.5px] tracking-[0.16em] text-white/30">
            {info.en}
          </div>
        </div>
        <OnSwitch
          checked={f.enabled}
          disabled={!canOperate}
          onChange={onToggle}
          label={`${f.name} 켜기`}
        />
      </div>
      <p className="font-pretendard text-[12.5px] leading-relaxed text-white/50">{info.desc}</p>
      <div
        className={cn(
          "mt-auto flex items-center gap-2 rounded-[10px] bg-black/35 px-2.5 py-1.5 font-pretendard text-[12.5px]",
          status.acting ? "text-white" : "text-white/40",
        )}
      >
        <span
          className={cn(
            "h-[7px] w-[7px] shrink-0 rounded-full",
            status.acting ? "bg-[#FFB23F] shadow-[0_0_8px_#FFB23F]" : "bg-white/20",
          )}
        />
        <span className="truncate">{status.text}</span>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-fit font-pretendard text-xs text-white/40 hover:text-white/75"
      >
        {open ? "▴ 접기" : `▾ 자세히${isAdmin ? "" : " (바꾸기는 관리자)"}`}
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-dashed border-white/10 pt-2.5">
          {LIST_INFO[feature].map(({ key, label }) => {
            const picked = (draft[key] as string[]) ?? [];
            const taken = others(key);
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <span className="font-pretendard text-xs text-white/55">{label}</span>
                <div className="flex flex-wrap gap-1">
                  {channels.map((c) => {
                    const on = picked.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={!isAdmin || (!on && taken.has(c.id))}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            [key]: on ? picked.filter((x) => x !== c.id) : [...picked, c.id],
                          }))
                        }
                        className={cn(
                          "rounded-md px-2 py-0.5 font-pretendard text-[11.5px] transition-colors disabled:cursor-not-allowed",
                          on
                            ? "bg-white/85 text-black"
                            : "bg-white/[0.07] text-white/55 enabled:hover:bg-white/15",
                          !on && taken.has(c.id) && "opacity-30",
                        )}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {Object.entries(f.limits).map(([key, [lo, hi]]) => {
            const meta = PARAM_INFO[key] ?? { label: key, unit: "", step: 1 };
            const value = Number(draft[key] ?? lo);
            return (
              <label
                key={key}
                className="grid grid-cols-[1fr_auto] gap-x-2 font-pretendard text-xs text-white/60"
              >
                {meta.label}
                <span className="font-orbitron text-[11px] text-[#ff9a9a]">
                  {value} {meta.unit}
                </span>
                <input
                  type="range"
                  min={lo}
                  max={hi}
                  step={meta.step}
                  value={value}
                  disabled={!isAdmin}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                  className="col-span-2 w-full accent-[#FF3B3B] disabled:opacity-50"
                />
              </label>
            );
          })}
          {isAdmin && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={() =>
                  onSave(draft)
                    .then(() => setOpen(false))
                    .catch(() => undefined)
                }
                className="h-8 rounded-lg border border-white/15 bg-white/10 px-3 font-mbc text-[13px] text-white hover:bg-white/15 disabled:opacity-40"
              >
                저장
              </button>
              <button
                type="button"
                disabled={!dirty}
                onClick={() => setDraft(f.params)}
                className="h-8 rounded-lg border border-white/10 bg-white/5 px-3 font-mbc text-[13px] text-white/60 disabled:opacity-40"
              >
                되돌리기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TAG_STYLE: Record<AutoFeature | "voice" | "hold", string> = {
  duck: "bg-[#3FC8FF]/[0.14] text-[#9fe3ff]",
  voice: "bg-[#3FC8FF]/[0.14] text-[#9fe3ff]",
  idle: "bg-[#B48CFF]/15 text-[#d3bcff]",
  level: "bg-[#00FF57]/[0.11] text-[#8dffb5]",
  gain: "bg-[#FFB23F]/15 text-[#ffd08a]",
  hold: "bg-[#FF3B3B]/[0.16] text-[#ffb0b0]",
};

// 미터 막대: -60dBFS(왼쪽 끝) ~ 0dBFS(오른쪽 끝)
const meterWidth = (db: number | undefined) =>
  db === undefined ? 0 : Math.max(0, Math.min(100, ((db + 60) / 60) * 100));

/** 채널마다 지금 입력·붙어 있는 자동·사람이 맞춘 높이 */
export function ChannelTable({
  state,
  canOperate,
  onResume,
}: {
  state: AutoAudioState;
  canOperate: boolean;
  onResume: (channel: string) => void;
}) {
  const duck = state.features.duck;
  const gate = (c: AutoChannel): number | null => {
    if (c.voice && duck.enabled) return Number(duck.params.threshold_db);
    if (c.rules.includes("idle")) return Number(state.features.idle.params.gate_db);
    return null;
  };
  if (state.channels.length === 0) {
    return <p className="font-pretendard text-sm text-white/40">믹서에 채널이 없습니다.</p>;
  }
  return (
    <div className="flex flex-col">
      {state.channels.map((c) => {
        const total = c.offsetDb.duck + c.offsetDb.idle + c.offsetDb.level;
        const g = gate(c);
        return (
          <div
            key={c.id}
            className="grid grid-cols-[104px_minmax(0,1fr)_minmax(0,170px)_96px] items-center gap-3 rounded-xl px-3 py-2 odd:bg-black/25"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-mbc text-[15px] text-white">{c.name}</span>
              <span className="font-orbitron text-[8.5px] tracking-[0.14em] text-white/30">
                CH {c.id.padStart(2, "0")}
              </span>
            </div>
            <div
              className="relative h-2.5 overflow-hidden rounded-[5px] bg-[#050506] shadow-[inset_0_1px_3px_#000]"
              title={
                c.meter ? `입력 ${c.meter.level} dBFS · 최고 ${c.meter.peak} dBFS` : "미터 없음"
              }
            >
              <span
                className="absolute inset-y-0 left-0 rounded-[5px] bg-[linear-gradient(90deg,#00c94a,#00FF57_65%,#FFD600_85%,#FF3B3B)] transition-[width] duration-200"
                style={{ width: `${meterWidth(c.meter?.level)}%` }}
              />
              {g !== null && (
                <span
                  className="absolute -inset-y-0.5 w-0.5 bg-white/55"
                  style={{ left: `${meterWidth(g)}%` }}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {c.voice && (
                <span className={cn("rounded-md px-1.5 py-px text-[11px]", TAG_STYLE.voice)}>
                  목소리
                </span>
              )}
              {c.rules.map((r) => (
                <span key={r} className={cn("rounded-md px-1.5 py-px text-[11px]", TAG_STYLE[r])}>
                  {RULE_TAG[r]}
                </span>
              ))}
              {c.pausedFor > 0 && (
                <button
                  type="button"
                  disabled={!canOperate}
                  onClick={() => onResume(c.id)}
                  title="누르면 지금 바로 자동으로 돌아가요"
                  className={cn(
                    "rounded-md px-1.5 py-px text-[11px] enabled:hover:brightness-125",
                    TAG_STYLE.hold,
                  )}
                >
                  사람 우선 {Math.ceil(c.pausedFor)}초 · 지금 다시
                </button>
              )}
              {!c.voice && c.rules.length === 0 && (
                <span className="rounded-md bg-white/[0.06] px-1.5 py-px text-[11px] text-white/45">
                  자동 없음
                </span>
              )}
            </div>
            <div className="text-right font-orbitron text-xs tabular-nums">
              {Math.abs(total) >= 0.1 ? (
                <span className={total < 0 ? "text-[#3FC8FF]" : "text-[#8dffb5]"}>
                  {fmtDb(total)}
                </span>
              ) : (
                <span className="font-pretendard text-white/70">그대로</span>
              )}
              <span className="block text-[9px] tracking-[0.06em] text-white/35">
                {c.base !== null ? `사람 ${Math.round(c.base)}%` : "—"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const time = (at: number) =>
  new Date(at * 1000).toLocaleTimeString("ko-KR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

/** 최근 동작 — 무엇을 왜 바꿨는지 */
export function AutoLog({ log }: { log: AutoLogEntry[] }) {
  if (log.length === 0) {
    return (
      <p className="font-pretendard text-sm text-white/40">
        아직 한 일이 없습니다. 기능을 켜면 여기에 쌓여요.
      </p>
    );
  }
  return (
    <div className="flex max-h-[440px] flex-col gap-0.5 overflow-y-auto">
      {log.map((e, i) => (
        <div
          key={`${e.at}-${i}`}
          className="grid grid-cols-[62px_1fr] gap-2.5 rounded-[10px] px-2.5 py-1.5 font-pretendard text-[13px] odd:bg-black/25"
        >
          <time className="pt-0.5 font-orbitron text-[10.5px] text-white/35">{time(e.at)}</time>
          <span
            className={cn(
              e.rule === "human"
                ? "text-[#ffb0b0]"
                : e.rule === "system"
                  ? "text-white/50"
                  : "text-white/75",
            )}
          >
            {e.text}
          </span>
        </div>
      ))}
    </div>
  );
}

const SOURCES: { value: MeterSourceKind; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "demo", label: "시연 (가짜 소리)" },
  { value: "console", label: "콘솔 미터" },
  { value: "bridge", label: "강당 노트북 녹음" },
];

const field =
  "h-9 rounded-lg border border-white/10 bg-[#141414] px-2.5 font-pretendard text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none";

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
              "h-9 rounded-xl border px-3 font-mbc text-[13px]",
              source === s.value
                ? "border-red-400/50 bg-red-400/15 text-white"
                : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/5",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {source === "console" && (
        <p className="text-xs text-amber-100/70">
          Si 콘솔 미터(UDP 3333)는 아직 해석하지 못해 모의 콘솔에서만 값이 나옵니다.
        </p>
      )}
      {source === "bridge" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-28 text-white/50">노트북</span>
          <input
            className={cn(field, "w-56")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://100.x.x.x:8765"
          />
          <input
            className={cn(field, "w-32")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="녹음 장치 이름"
          />
          <input
            className={cn(field, "w-64")}
            value={lanes}
            onChange={(e) => setLanes(e.target.value)}
            placeholder="입력=채널, 예: 1=1, 2=5"
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
        <span>초 — 사람이 채널을 만지면 이 시간 동안 자동이 손을 뗍니다.</span>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="h-9 w-fit rounded-lg border border-white/15 bg-white/10 px-4 font-mbc text-[13px] text-white hover:bg-white/15 disabled:opacity-40"
      >
        저장
      </button>
    </div>
  );
}
