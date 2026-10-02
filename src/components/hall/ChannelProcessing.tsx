"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Crosshair, Link2, Lock, Pencil, SlidersHorizontal } from "lucide-react";
import InputModal from "@/components/common/InputModal";
import { toast } from "@/components/common/Toast";
import Knob, { LedKey } from "@/components/hall/Knob";
import { hallApi } from "@/lib/hallApi";
import { cn } from "@/lib/utils";
import { SWITCH_ROLES, type MixerChannel, type MixerState, type ProcessingRole } from "@/types/hall";

// 구역별 색 — 실제 콘솔처럼 화면 위 영역마다 색이 다르다
const C_INPUT = "#5AC8FA";
const C_EQ = "#7CF5D4";
const C_DYN = "#FFB23F";
const C_FX = "#B48CFF";

const EQ_BANDS: { role: ProcessingRole; label: string }[] = [
  { role: "eq_low", label: "LOW" },
  { role: "eq_lomid", label: "LO-MID" },
  { role: "eq_himid", label: "HI-MID" },
  { role: "eq_high", label: "HIGH" },
];
const FX_SENDS: ProcessingRole[] = ["fx1", "fx2", "fx3", "fx4"];

const ROLE_NAME: Record<string, string> = {
  fader: "페이더",
  mute: "MUTE 버튼",
  gain: "GAIN 손잡이",
  eq_on: "EQ 버튼",
  eq_low: "EQ LOW 손잡이",
  eq_lomid: "EQ LO-MID 손잡이",
  eq_himid: "EQ HI-MID 손잡이",
  eq_high: "EQ HIGH 손잡이",
  comp_on: "COMP 버튼",
  comp_threshold: "THRESHOLD 손잡이",
  comp_ratio: "RATIO 손잡이",
  comp_makeup: "MAKE-UP 손잡이",
  fx1: "FX 1 보내기 손잡이",
  fx2: "FX 2 보내기 손잡이",
  fx3: "FX 3 보내기 손잡이",
  fx4: "FX 4 보내기 손잡이",
};

/** 가운데(50%)가 0 인 손잡이 표시 — +12 / −08 / 00 */
const signed = (v: number) => {
  const d = Math.round(v - 50);
  return `${d > 0 ? "+" : d < 0 ? "−" : ""}${String(Math.abs(d)).padStart(2, "0")}`;
};

const num = (v: unknown, fallback: number) => (typeof v === "number" ? v : fallback);

// ---------------- 그림 (대략적인 모양) ----------------

const EQ_W = 360;
const EQ_H = 112;
const LOG_LO = Math.log10(20);
const LOG_HI = Math.log10(20000);
const EQ_RANGE = 18;

/** 대역별 손잡이(50% = 0)로 그린 주파수 곡선. 콘솔 단위를 몰라 ±15dB 쯤으로 펼쳐 그린 모양이다 */
function EqCurve({ gains, on }: { gains: number[]; on: boolean }) {
  const db = (f: number) => {
    const g = gains.map((v) => ((v - 50) / 50) * 15);
    const oct = (fc: number) => Math.log2(f / fc);
    return (
      g[0] / (1 + (f / 120) ** 2) +
      g[1] * Math.exp(-(oct(450) ** 2) / (2 * 0.65 ** 2)) +
      g[2] * Math.exp(-(oct(2500) ** 2) / (2 * 0.65 ** 2)) +
      g[3] / (1 + (8000 / f) ** 2)
    );
  };
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const f = 10 ** (LOG_LO + (i / 120) * (LOG_HI - LOG_LO));
    const x = (i / 120) * EQ_W;
    const y = EQ_H / 2 - (Math.max(-EQ_RANGE, Math.min(EQ_RANGE, on ? db(f) : 0)) / EQ_RANGE) * (EQ_H / 2 - 6);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const line = `M${pts.join(" L")}`;
  const fill = `${line} L${EQ_W},${EQ_H / 2} L0,${EQ_H / 2} Z`;
  const fx = (f: number) => ((Math.log10(f) - LOG_LO) / (LOG_HI - LOG_LO)) * EQ_W;

  return (
    <svg viewBox={`0 0 ${EQ_W} ${EQ_H}`} className="h-[112px] w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C_EQ} stopOpacity="0.35" />
          <stop offset="50%" stopColor={C_EQ} stopOpacity="0.04" />
          <stop offset="100%" stopColor={C_EQ} stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map((f) => (
        <line key={f} x1={fx(f)} y1={0} x2={fx(f)} y2={EQ_H} stroke="rgba(124,245,212,0.07)" strokeWidth={1} />
      ))}
      {[-12, -6, 6, 12].map((d) => {
        const y = EQ_H / 2 - (d / EQ_RANGE) * (EQ_H / 2 - 6);
        return <line key={d} x1={0} y1={y} x2={EQ_W} y2={y} stroke="rgba(124,245,212,0.06)" strokeWidth={1} />;
      })}
      <line x1={0} y1={EQ_H / 2} x2={EQ_W} y2={EQ_H / 2} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
      <path d={fill} fill="url(#eq-fill)" opacity={on ? 1 : 0.25} />
      <path
        d={line}
        fill="none"
        stroke={C_EQ}
        strokeWidth={2}
        opacity={on ? 1 : 0.3}
        style={{ filter: on ? `drop-shadow(0 0 4px ${C_EQ})` : undefined }}
        vectorEffect="non-scaling-stroke"
      />
      {[
        [100, "100"],
        [1000, "1k"],
        [10000, "10k"],
      ].map(([f, t]) => (
        <text key={t} x={fx(Number(f)) + 3} y={EQ_H - 4} fill="rgba(255,255,255,0.3)" fontSize={8} fontFamily="var(--font-orbitron)">
          {t}
        </text>
      ))}
    </svg>
  );
}

const CP = 104;

/** 입력→출력 전달 곡선. 기준(threshold)을 넘는 부분이 비율(ratio)만큼 눌린다 — 역시 대략적인 모양 */
function CompCurve({ threshold, ratio, makeup, on }: { threshold: number; ratio: number; makeup: number; on: boolean }) {
  const t = -48 + (threshold / 100) * 48;
  const r = 1 + (ratio / 100) * 19;
  const m = (makeup / 100) * 18;
  const out = (i: number) => (on ? (i < t ? i : t + (i - t) / r) + m : i);
  const sx = (db: number) => ((db + 48) / 48) * CP;
  const sy = (db: number) => CP - ((Math.max(-48, Math.min(0, db)) + 48) / 48) * CP;
  const pts = Array.from({ length: 49 }, (_, k) => {
    const i = -48 + k;
    return `${sx(i).toFixed(1)},${sy(out(i)).toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${CP} ${CP}`} className="h-[104px] w-[104px] shrink-0 rounded-md bg-black/50" aria-hidden>
      {[12, 24, 36].map((d) => (
        <g key={d}>
          <line x1={sx(-d)} y1={0} x2={sx(-d)} y2={CP} stroke="rgba(255,178,63,0.07)" />
          <line x1={0} y1={sy(-d)} x2={CP} y2={sy(-d)} stroke="rgba(255,178,63,0.07)" />
        </g>
      ))}
      <line x1={0} y1={CP} x2={CP} y2={0} stroke="rgba(255,255,255,0.14)" strokeDasharray="2 3" />
      {on && <line x1={sx(t)} y1={0} x2={sx(t)} y2={CP} stroke="rgba(255,178,63,0.35)" strokeDasharray="3 3" />}
      <path
        d={`M${pts.join(" L")}`}
        fill="none"
        stroke={C_DYN}
        strokeWidth={2}
        opacity={on ? 1 : 0.3}
        style={{ filter: on ? `drop-shadow(0 0 4px ${C_DYN})` : undefined }}
      />
    </svg>
  );
}

// ---------------- 구역 틀 ----------------

function Module({
  label,
  color,
  locked,
  action,
  children,
  className,
}: {
  label: string;
  color: string;
  locked?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border border-black/80 bg-[linear-gradient(180deg,#141418,#0d0d10)] p-3.5",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_0_0_1px_rgba(255,255,255,0.025)]",
        className,
      )}
    >
      <span className="absolute inset-x-3 top-0 h-px" style={{ background: `linear-gradient(90deg,${color},transparent)` }} />
      <header className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <span className="font-orbitron text-[10.5px] tracking-[0.24em] text-white/70">{label}</span>
        {locked && (
          <span className="flex items-center gap-1 font-pretendard text-[10.5px] text-white/35" title="관리자 기기에서만 바꿀 수 있어요">
            <Lock size={10} /> 관리자
          </span>
        )}
        <div className="ml-auto">{action}</div>
      </header>
      {children}
    </section>
  );
}

// ---------------- 주소 연결 (현장에서 콘솔 손잡이를 돌려 찾기) ----------------

type LearnTarget = { channel: string; role: string; label: string };

function useAddressLearn(hallId: string, onSaved: () => void) {
  const [target, setTarget] = useState<LearnTarget | null>(null);
  const started = useRef(false);
  const baseline = useRef<Record<string, number>>({});

  const begin = async (t: LearnTarget) => {
    if (target && target.channel === t.channel && target.role === t.role) {
      setTarget(null);
      return;
    }
    try {
      if (!started.current) {
        await hallApi.learnStart(hallId);
        started.current = true;
      }
      const r = await hallApi.learnResults(hallId);
      baseline.current = Object.fromEntries(r.moved.map((m) => [m.param, m.changes]));
      setTarget(t);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  useEffect(() => {
    if (!target) return;
    let alive = true;
    const isSwitch = SWITCH_ROLES.has(target.role);
    const id = setInterval(async () => {
      try {
        const r = await hallApi.learnResults(hallId);
        if (!alive) return;
        const hit = r.moved.find(
          (m) => m.kind === (isSwitch ? "mute" : "fader") && m.changes > (baseline.current[m.param] ?? 0),
        );
        if (!hit) return;
        // 스위치는 '켜 두세요' 안내 뒤 값이 0% 면 콘솔이 반대(끄기 버튼)로 동작하는 것
        await hallApi.setParamAddress(hallId, target.channel, target.role, hit.param, isSwitch && hit.last < 50);
        toast.success(`${target.label} ${ROLE_NAME[target.role] ?? target.role} ← ${hit.param}`);
        setTarget(null);
        onSaved();
      } catch (e) {
        toast.error((e as Error).message);
        setTarget(null);
      }
    }, 700);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, hallId]);

  // 화면을 떠나면 콘솔 구독을 푼다
  useEffect(
    () => () => {
      if (started.current) void hallApi.learnStop(hallId).catch(() => {});
    },
    [hallId],
  );

  return { target, begin, cancel: () => setTarget(null) };
}

function FindButton({ active, linked, onClick }: { active: boolean; linked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded border px-1.5 py-0.5 font-orbitron text-[8.5px] tracking-[0.14em] transition-colors",
        active
          ? "animate-pulse border-[#FF3B3B]/60 bg-[#FF3B3B]/20 text-[#ff8a8a]"
          : linked
            ? "border-white/10 text-white/40 hover:text-white/75"
            : "border-[#FFB23F]/40 text-[#FFB23F]/85 hover:bg-[#FFB23F]/10",
      )}
    >
      <Crosshair size={9} />
      {active ? "WAIT" : linked ? "RELINK" : "LINK"}
    </button>
  );
}

// ---------------- 본체 ----------------

export default function ChannelProcessing({
  hallId,
  state,
  channel,
  canOperate,
  canAdmin,
  isAdmin,
  onParam,
  onRefresh,
}: {
  hallId: string;
  state: MixerState;
  /** SEL 로 고른 입력 채널 */
  channel: MixerChannel | null;
  /** 게인·이펙트 보내기 (운영 + 잠금 해제) */
  canOperate: boolean;
  /** EQ·컴프레서 (관리자 + 잠금 해제) */
  canAdmin: boolean;
  /** 주소 연결 버튼을 보일지 (관리자) */
  isAdmin: boolean;
  onParam: (role: ProcessingRole, value: number | boolean) => void;
  onRefresh: () => void;
}) {
  const [linkMode, setLinkMode] = useState(false);
  const [renaming, setRenaming] = useState<MixerChannel | null>(null);
  const learn = useAddressLearn(hallId, onRefresh);
  const fx = state.fx ?? [];
  const realDevice = state.driver !== "mock";

  if (!channel) {
    return (
      <div className="flex h-[150px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/30">
        <SlidersHorizontal size={22} className="text-white/25" />
        <p className="font-orbitron text-[11px] tracking-[0.2em] text-white/40">SELECT A CHANNEL</p>
      </div>
    );
  }

  const roles = new Set(channel.roles ?? []);
  const p = channel.params ?? {};
  const unlinked = (role: ProcessingRole) => !roles.has(role);
  const label = channel.name || `CH ${channel.id}`;
  const knobFooter = (role: ProcessingRole) =>
    linkMode ? (
      <FindButton
        active={learn.target?.channel === channel.id && learn.target.role === role}
        linked={roles.has(role)}
        onClick={() => learn.begin({ channel: channel.id, role, label })}
      />
    ) : null;
  const value = (role: ProcessingRole): number | null => {
    const v = p[role];
    return typeof v === "number" ? v : null;
  };
  const on = (role: ProcessingRole): boolean | null => {
    const v = p[role];
    return typeof v === "boolean" ? v : null;
  };
  const switchKey = (role: ProcessingRole, text: string, color: string, allowed: boolean) => (
    <div className="flex items-center gap-1.5">
      <LedKey
        label={text}
        on={on(role)}
        color={color}
        disabled={!allowed}
        unlinked={unlinked(role)}
        onToggle={(next) => onParam(role, next)}
      />
      {linkMode && (
        <FindButton
          active={learn.target?.channel === channel.id && learn.target.role === role}
          linked={roles.has(role)}
          onClick={() => learn.begin({ channel: channel.id, role, label })}
        />
      )}
    </div>
  );

  const eqOn = on("eq_on") !== false;
  const compOn = on("comp_on") === true;

  return (
    <div className="relative flex flex-col gap-3">
      {/* 머리줄 — 고른 채널 */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md border border-[#7CF5D4]/40 bg-[#7CF5D4]/10 px-2 py-1 font-orbitron text-[11px] tracking-[0.2em] text-[#7CF5D4] shadow-[0_0_14px_-4px_#7CF5D4]">
          SEL · CH {channel.id.padStart(2, "0")}
        </span>
        <span className="font-mbc text-xl text-white">{channel.name}</span>
        {realDevice && roles.size === 0 && !linkMode && (
          <span className="font-pretendard text-xs text-[#FFB23F]/80">
            이 채널은 아직 콘솔 주소가 연결되지 않았어요{isAdmin ? " — 오른쪽 ‘주소 연결’을 켜서 하나씩 찾으세요" : ""}
          </span>
        )}
        {isAdmin && realDevice && (
          <button
            type="button"
            onClick={() => {
              setLinkMode((v) => !v);
              learn.cancel();
            }}
            className={cn(
              "ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-pretendard text-xs transition-colors",
              linkMode
                ? "border-[#FFB23F]/50 bg-[#FFB23F]/15 text-[#FFB23F]"
                : "border-white/10 text-white/50 hover:text-white/80",
            )}
            title="콘솔에서 손잡이를 돌려 ONAIR 손잡이와 짝을 지어요 (관리자)"
          >
            <Link2 size={13} />
            주소 연결 {linkMode ? "켜짐" : ""}
          </button>
        )}
      </div>

      {learn.target && (
        <div className="flex items-center gap-3 rounded-xl border border-[#FF3B3B]/30 bg-[#FF3B3B]/10 px-4 py-2.5">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#FF3B3B] shadow-[0_0_10px_#FF3B3B]" />
          <p className="flex-1 font-pretendard text-sm text-white/85">
            {SWITCH_ROLES.has(learn.target.role)
              ? `콘솔에서 ‘${learn.target.label}’의 ${ROLE_NAME[learn.target.role]}을 눌러 켜 두세요`
              : `콘솔에서 ‘${learn.target.label}’의 ${ROLE_NAME[learn.target.role]}을 돌리세요`}
          </p>
          <button type="button" onClick={learn.cancel} className="font-pretendard text-xs text-white/55 hover:text-white">
            취소
          </button>
        </div>
      )}

      {/* 실제 콘솔 화면처럼 한 줄 — 좁으면 EQ 가 먼저 줄을 바꾼다 */}
      <div className="flex flex-wrap items-stretch gap-3">
        {/* INPUT */}
        <Module label="INPUT" color={C_INPUT} className="w-[150px]">
          <div className="flex flex-1 items-center justify-center px-2">
            <Knob
              label="GAIN"
              value={value("gain")}
              color={C_INPUT}
              size={84}
              defaultValue={50}
              disabled={!canOperate}
              unlinked={unlinked("gain")}
              onChange={(v) => onParam("gain", v)}
              footer={knobFooter("gain")}
            />
          </div>
        </Module>

        {/* EQ */}
        <Module
          label="EQUALIZER"
          color={C_EQ}
          locked={!canAdmin}
          action={switchKey("eq_on", "EQ", C_EQ, canAdmin)}
          className="min-w-[340px] flex-1"
        >
          <div className="overflow-hidden rounded-md border border-black bg-black/50">
            <EqCurve gains={EQ_BANDS.map((b) => num(p[b.role], 50))} on={eqOn} />
          </div>
          <div className="flex flex-wrap justify-around gap-2">
            {EQ_BANDS.map((b) => (
              <Knob
                key={b.role}
                label={b.label}
                value={value(b.role)}
                color={C_EQ}
                bipolar
                defaultValue={50}
                format={signed}
                disabled={!canAdmin}
                unlinked={unlinked(b.role)}
                onChange={(v) => onParam(b.role, v)}
                footer={knobFooter(b.role)}
              />
            ))}
          </div>
        </Module>

        {/* DYNAMICS */}
        <Module
          label="COMPRESSOR"
          color={C_DYN}
          locked={!canAdmin}
          action={switchKey("comp_on", "COMP", C_DYN, canAdmin)}
          className="w-[280px]"
        >
          <div className="flex justify-center">
            <CompCurve
              threshold={num(p.comp_threshold, 70)}
              ratio={num(p.comp_ratio, 30)}
              makeup={num(p.comp_makeup, 0)}
              on={compOn}
            />
          </div>
          <div className="flex flex-wrap justify-around gap-2">
            {(
              [
                ["comp_threshold", "THRESH"],
                ["comp_ratio", "RATIO"],
                ["comp_makeup", "MAKE-UP"],
              ] as [ProcessingRole, string][]
            ).map(([role, text]) => (
              <Knob
                key={role}
                label={text}
                value={value(role)}
                color={C_DYN}
                disabled={!canAdmin}
                unlinked={unlinked(role)}
                onChange={(v) => onParam(role, v)}
                footer={knobFooter(role)}
              />
            ))}
          </div>
        </Module>

        {/* FX SENDS */}
        <Module label="FX SEND" color={C_FX} className="w-[190px]">
          <div className="grid grid-cols-2 justify-items-center gap-x-2 gap-y-2">
            {FX_SENDS.map((role, i) => {
              const ret = fx.find((f) => f.id === role);
              return (
                <Knob
                  key={role}
                  label={(ret?.name ?? `FX ${i + 1}`).toUpperCase()}
                  value={value(role)}
                  color={C_FX}
                  size={56}
                  defaultValue={0}
                  disabled={!canOperate}
                  unlinked={unlinked(role)}
                  onChange={(v) => onParam(role, v)}
                  footer={knobFooter(role)}
                />
              );
            })}
          </div>
        </Module>
      </div>

      {/* 이펙트 리턴 — 주소 연결 중에만 (관리자) */}
      {linkMode && fx.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#B48CFF]/20 bg-[#B48CFF]/[0.05] px-3 py-2.5">
          <span className="mr-1 font-orbitron text-[10px] tracking-[0.22em] text-[#B48CFF]">FX RETURN</span>
          {fx.map((f) => (
            <div key={f.id} className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-black/40 px-2 py-1">
              <span className="font-mbc text-sm text-white/85">{f.name}</span>
              <button
                type="button"
                onClick={() => setRenaming(f)}
                className="text-white/35 hover:text-white/80"
                aria-label={`${f.name} 이름 바꾸기`}
              >
                <Pencil size={11} />
              </button>
              {(["fader", "mute"] as const).map((role) => (
                <span key={role} className="flex items-center gap-1 font-pretendard text-[10px] text-white/40">
                  {role === "fader" ? "페이더" : "뮤트"}
                  <FindButton
                    active={learn.target?.channel === f.id && learn.target.role === role}
                    linked={!!f.hiqnet?.[role]}
                    onClick={() => learn.begin({ channel: f.id, role, label: f.name })}
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      <InputModal
        isOpen={!!renaming}
        onClose={() => setRenaming(null)}
        title="이펙트 이름"
        placeholder="예: 에코, 울림"
        initialValue={renaming?.name ?? ""}
        confirmText="저장"
        onConfirm={async (name) => {
          if (!renaming) return;
          try {
            await hallApi.renameFx(hallId, renaming.id, name.trim());
            toast.success(`이펙트 이름을 '${name.trim()}'(으)로 바꿨어요.`);
            onRefresh();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </div>
  );
}
