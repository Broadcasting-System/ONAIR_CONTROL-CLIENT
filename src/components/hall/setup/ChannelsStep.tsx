"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Crosshair, Eye, EyeOff, Minus, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "@/components/common/Toast";
import { Notice } from "@/components/hall/HallControls";
import { hallApi } from "@/lib/hallApi";
import { cn } from "@/lib/utils";
import type { HiqnetAddress, MixerChannel, MixerState } from "@/types/hall";
import { CHANNEL_ID_RE, type ChannelRow, type Draft, badAddr, badMax, duplicates, move, nextKey, siAddress } from "./draft";
import { ActionButton, Card, Th, badBorder, inputCls, okBorder } from "./ui";

type Role = "fader" | "mute";
/** 주소 찾기 대상 — 채널 줄 번호 또는 마스터 */
type LearnTarget = { row: number | "master"; role: Role; label: string };

const COLS_HQ = "grid-cols-[52px_76px_minmax(130px,1fr)_188px_262px_112px_150px_76px]";
const COLS_BASIC = "grid-cols-[52px_76px_minmax(160px,1fr)_112px_150px_76px]";

/** ② 채널 — 이름·콘솔 주소·최대 레벨·숨김을 정하고, 하나씩 움직여 확인한다 */
export default function ChannelsStep({
  hallId,
  state,
  draft,
  setDraft,
  configDirty,
}: {
  hallId: string;
  state: MixerState;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft | null>>;
  configDirty: boolean;
}) {
  const qc = useQueryClient();
  const hiqnet = state.connection.driver === "hiqnet";
  const hasChannelControl = state.capabilities.includes("channel");
  const canTry = state.connected && hasChannelControl && !configDirty;
  const tryHint = !state.connected
    ? "믹서가 연결되면 시험할 수 있어요"
    : !hasChannelControl
      ? "채널 조작은 랜선(HiQnet) 연결에서만 돼요"
      : configDirty
        ? "저장한 뒤 시험할 수 있어요"
        : "";

  const setChannels = (fn: (l: ChannelRow[]) => ChannelRow[]) =>
    setDraft((d) => (d ? { ...d, channels: fn(d.channels) } : d));
  const patchRow = (i: number, patch: Partial<ChannelRow>) =>
    setChannels((l) => l.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const patchMaster = (patch: Partial<NonNullable<Draft["master"]>>) =>
    setDraft((d) => (d && d.master ? { ...d, master: { ...d.master, ...patch } } : d));

  // ---- 주소 찾기: 콘솔을 구독해 두고, '찾기' 뒤 새로 움직인 파라미터를 그 칸에 넣는다 ----
  const [learn, setLearn] = useState<LearnTarget | null>(null);
  const learnStarted = useRef(false);
  const baseline = useRef<Record<string, number>>({});

  const beginLearn = async (target: LearnTarget) => {
    if (learn && learn.row === target.row && learn.role === target.role) {
      setLearn(null);
      return;
    }
    try {
      if (!learnStarted.current) {
        await hallApi.learnStart(hallId);
        learnStarted.current = true;
      }
      const r = await hallApi.learnResults(hallId);
      baseline.current = Object.fromEntries(r.moved.map((m) => [m.param, m.changes]));
      setLearn(target);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  useEffect(() => {
    if (!learn) return;
    let alive = true;
    const id = setInterval(async () => {
      try {
        const r = await hallApi.learnResults(hallId);
        if (!alive) return;
        const hit = r.moved.find((m) => m.kind === learn.role && m.changes > (baseline.current[m.param] ?? 0));
        if (!hit) return;
        // 뮤트: '켜 두세요' 안내 뒤 값이 0이면 켜짐(ON) 스위치 — 뮤트와 반대
        const patch: Partial<HiqnetAddress> =
          learn.role === "fader" ? { fader: hit.param } : { mute: hit.param, muteInvert: hit.last < 50 };
        if (learn.row === "master") patchMaster(patch);
        else patchRow(learn.row, patch);
        toast.success(`${learn.label} ${learn.role === "fader" ? "페이더" : "뮤트"} ← ${hit.param}`);
        setLearn(null);
      } catch {
        /* 다음 주기에 다시 */
      }
    }, 700);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learn, hallId]);

  // 화면을 떠나면 콘솔 구독을 푼다 (수천 개 파라미터를 계속 받지 않게)
  useEffect(
    () => () => {
      if (learnStarted.current) void hallApi.learnStop(hallId).catch(() => {});
    },
    [hallId],
  );

  const ids = draft.channels.map((c) => c.id.trim());
  const dupIds = duplicates([...ids, ...(draft.master ? [draft.master.id] : [])]);
  const badId = (id: string) => !CHANNEL_ID_RE.test(id.trim()) || dupIds.has(id.trim());

  const addChannel = () => {
    const nums = ids.map(Number).filter(Number.isInteger);
    const id = String(Math.max(0, ...nums) + 1);
    setChannels((l) => [
      ...l,
      { key: nextKey(), id, name: "", max: 100, hidden: false, fader: "", mute: "", muteInvert: false },
    ]);
  };

  const fillSi = () => {
    let filled = 0;
    const next = draft.channels.map((c) => {
      const si = siAddress(c.id.trim());
      if (!si) return c;
      const row = { ...c };
      if (!c.fader.trim()) {
        row.fader = si.fader;
        filled++;
      }
      if (!c.mute.trim()) {
        row.mute = si.mute;
        row.muteInvert = false;
        filled++;
      }
      return row;
    });
    if (filled === 0) {
      toast.info("채울 빈 칸이 없어요.");
      return;
    }
    setChannels(() => next);
    toast.success(`빈 칸 ${filled}개를 Si 기본 주소로 채웠어요. 추정값이라 저장 후 시험으로 확인하세요.`);
  };

  // ---- 시험: 저장된 설정으로 콘솔을 조금씩 움직여 본다 ----
  const live = (id: string): MixerChannel | undefined =>
    state.channels.find((c) => c.id === id) ?? (state.master?.id === id ? state.master : undefined);

  const refresh = () => qc.invalidateQueries({ queryKey: ["mixer", hallId] });
  const tryLevel = async (id: string, max: number, delta: number) => {
    // 지금 값을 모르면 움직이지 않는다 — 짐작한 값에서 ±하면 '올리기'가 실제로는 내려갈 수 있다
    const cur = live(id)?.level;
    if (cur == null) return;
    try {
      await hallApi.tryChannel(hallId, id, { level: Math.max(0, Math.min(max, cur + delta)) });
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const tryMute = async (id: string) => {
    try {
      await hallApi.tryChannel(hallId, id, { mute: !live(id)?.mute });
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const cols = hiqnet ? COLS_HQ : COLS_BASIC;
  const learningRole = (row: number | "master"): Role | null => (learn && learn.row === row ? learn.role : null);
  const withAddr = draft.channels.filter((c) => c.fader.trim()).length;

  return (
    <Card
      title={`채널 ${draft.channels.length}개`}
      hint={
        hiqnet
          ? `콘솔 주소 ${withAddr}/${draft.channels.length} · 방송부가 알아볼 이름으로 · 안 쓰는 채널은 눈을 꺼서 숨기세요`
          : "방송부가 알아볼 이름으로 · 안 쓰는 채널은 눈을 꺼서 숨기세요"
      }
      action={
        <div className="flex gap-2">
          {hiqnet && (
            <ActionButton icon={<Wand2 size={15} />} onClick={fillSi} title="HiQontrol 분석 기준 추정값 — 저장 후 시험으로 확인">
              Si 기본 주소 채우기
            </ActionButton>
          )}
          <ActionButton icon={<Plus size={15} />} onClick={addChannel} disabled={draft.channels.length >= 64}>
            채널 추가
          </ActionButton>
        </div>
      }
    >
      {!hiqnet && (
        <Notice tone="info">콘솔 주소 칸은 ‘연결’에서 랜선(HiQnet)을 고르고 저장하면 나타나요.</Notice>
      )}
      {hiqnet && !learn && (
        <p className="-mt-1 font-pretendard text-xs text-white/35">
          주소는 <b className="text-white/55">찾기</b>를 누른 뒤 콘솔에서 그 채널을 움직이면 자동으로 채워져요. 시험 버튼은 저장한 설정으로 콘솔을 실제로 움직입니다.
        </p>
      )}
      {learn && (
        <div className="flex items-center gap-3 rounded-xl border border-[#FF3B3B]/30 bg-[#FF3B3B]/10 px-4 py-3">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#FF3B3B] shadow-[0_0_10px_#FF3B3B]" />
          <p className="flex-1 font-pretendard text-sm text-white/85">
            {learn.role === "fader"
              ? `콘솔에서 ‘${learn.label}’ 페이더를 위아래로 움직이세요`
              : `콘솔에서 ‘${learn.label}’ MUTE를 눌러 켜 두세요`}
          </p>
          <ActionButton tone="ghost" onClick={() => setLearn(null)}>
            취소
          </ActionButton>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className={cn("flex flex-col gap-1.5", hiqnet ? "min-w-[1080px]" : "min-w-[640px]")}>
          <div className={cn("grid items-center gap-2 px-2 pb-1", cols)}>
            <Th>순서</Th>
            <Th>CH</Th>
            <Th>이름</Th>
            {hiqnet && <Th>페이더 주소</Th>}
            {hiqnet && <Th>뮤트 주소</Th>}
            <Th>최대</Th>
            <Th>시험</Th>
            <Th className="text-right">보기·삭제</Th>
          </div>

          {draft.channels.length === 0 && (
            <p className="px-2 py-6 text-center font-pretendard text-sm text-white/30">채널이 없어요. ‘채널 추가’를 누르세요.</p>
          )}

          {draft.channels.map((c, i) => {
            const lv = live(c.id);
            return (
              <div
                key={c.key}
                className={cn(
                  "grid items-center gap-2 rounded-xl border px-2 py-2 transition-colors",
                  cols,
                  c.hidden ? "border-white/[0.04] bg-white/[0.01]" : "border-white/[0.07] bg-white/[0.025]",
                )}
              >
                <div className="flex">
                  <IconBtn label="위로" disabled={i === 0} onClick={() => setChannels((l) => move(l, i, -1))}>
                    <ChevronUp size={15} />
                  </IconBtn>
                  <IconBtn
                    label="아래로"
                    disabled={i === draft.channels.length - 1}
                    onClick={() => setChannels((l) => move(l, i, 1))}
                  >
                    <ChevronDown size={15} />
                  </IconBtn>
                </div>
                <input
                  value={c.id}
                  maxLength={8}
                  aria-label={`${i + 1}번째 채널 번호`}
                  onChange={(e) => patchRow(i, { id: e.target.value })}
                  className={cn(inputCls, "px-2 text-center font-orbitron", badId(c.id) ? badBorder : okBorder)}
                />
                <input
                  value={c.name}
                  maxLength={12}
                  placeholder="예: 무선 1"
                  aria-label={`CH ${c.id} 이름`}
                  onChange={(e) => patchRow(i, { name: e.target.value })}
                  className={cn(inputCls, c.name.trim() ? okBorder : badBorder, c.hidden && "opacity-40")}
                />
                {hiqnet && (
                  <AddrInput
                    value={c.fader}
                    onChange={(v) => patchRow(i, { fader: v })}
                    learning={learningRole(i) === "fader"}
                    onLearn={() => beginLearn({ row: i, role: "fader", label: c.name || `CH ${c.id}` })}
                    label={`CH ${c.id} 페이더 주소`}
                  />
                )}
                {hiqnet && (
                  <div className="flex items-center gap-1.5">
                    <AddrInput
                      value={c.mute}
                      onChange={(v) => patchRow(i, { mute: v })}
                      learning={learningRole(i) === "mute"}
                      onLearn={() => beginLearn({ row: i, role: "mute", label: c.name || `CH ${c.id}` })}
                      label={`CH ${c.id} 뮤트 주소`}
                    />
                    <label
                      className="flex shrink-0 cursor-pointer items-center gap-1 font-pretendard text-[11px] text-white/45"
                      title="콘솔의 켜짐(ON) 버튼처럼 뮤트와 반대로 동작하는 파라미터"
                    >
                      <input
                        type="checkbox"
                        checked={c.muteInvert}
                        onChange={(e) => patchRow(i, { muteInvert: e.target.checked })}
                        className="h-3.5 w-3.5 accent-red-400"
                      />
                      반대
                    </label>
                  </div>
                )}
                <MaxInput value={c.max} onChange={(v) => patchRow(i, { max: v })} label={`CH ${c.id} 최대 레벨`} />
                <TryCell
                  disabled={!canTry}
                  hint={tryHint}
                  level={lv?.level ?? null}
                  muted={lv?.mute ?? null}
                  onDown={() => tryLevel(c.id, c.max, -5)}
                  onUp={() => tryLevel(c.id, c.max, 5)}
                  onMute={() => tryMute(c.id)}
                />
                <div className="flex justify-end">
                  <IconBtn
                    label={c.hidden ? "보이기" : "숨기기"}
                    onClick={() => patchRow(i, { hidden: !c.hidden })}
                    className={c.hidden ? "text-[#FFB23F]" : undefined}
                    title={c.hidden ? "숨김 — 조작 화면에 안 보여요 (주소는 남아 있음)" : "조작 화면에서 숨기기"}
                  >
                    {c.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                  </IconBtn>
                  <IconBtn
                    label="삭제"
                    onClick={() => setChannels((l) => l.filter((_, j) => j !== i))}
                    className="hover:text-red-400"
                    title="삭제하면 찾아 둔 콘솔 주소도 사라져요. 잠깐 빼려면 숨기기를 쓰세요."
                  >
                    <Trash2 size={14} />
                  </IconBtn>
                </div>
              </div>
            );
          })}

          {draft.master && (
            <div
              className={cn(
                "mt-2 grid items-center gap-2 rounded-xl border border-[#FF3B3B]/25 bg-[#FF3B3B]/[0.05] px-2 py-2",
                cols,
              )}
            >
              <span className="text-center font-orbitron text-[10px] tracking-[0.14em] text-[#FF3B3B]/80">MAIN</span>
              <span className="text-center font-orbitron text-sm text-white/50">{draft.master.id}</span>
              <input
                value={draft.master.name}
                maxLength={12}
                aria-label="마스터 이름"
                onChange={(e) => patchMaster({ name: e.target.value })}
                className={cn(inputCls, draft.master.name.trim() ? okBorder : badBorder)}
              />
              {hiqnet && (
                <AddrInput
                  value={draft.master.fader}
                  onChange={(v) => patchMaster({ fader: v })}
                  learning={learningRole("master") === "fader"}
                  onLearn={() => beginLearn({ row: "master", role: "fader", label: draft.master?.name || "MAIN" })}
                  label="마스터 페이더 주소"
                />
              )}
              {hiqnet && (
                <div className="flex items-center gap-1.5">
                  <AddrInput
                    value={draft.master.mute}
                    onChange={(v) => patchMaster({ mute: v })}
                    learning={learningRole("master") === "mute"}
                    onLearn={() => beginLearn({ row: "master", role: "mute", label: draft.master?.name || "MAIN" })}
                    label="마스터 뮤트 주소"
                  />
                  <label className="flex shrink-0 cursor-pointer items-center gap-1 font-pretendard text-[11px] text-white/45">
                    <input
                      type="checkbox"
                      checked={draft.master.muteInvert}
                      onChange={(e) => patchMaster({ muteInvert: e.target.checked })}
                      className="h-3.5 w-3.5 accent-red-400"
                    />
                    반대
                  </label>
                </div>
              )}
              <MaxInput value={draft.master.max} onChange={(v) => patchMaster({ max: v })} label="마스터 최대 레벨" />
              <TryCell
                disabled={!canTry}
                hint={tryHint}
                level={live(draft.master.id)?.level ?? null}
                muted={live(draft.master.id)?.mute ?? null}
                onDown={() => tryLevel(draft.master!.id, draft.master!.max, -5)}
                onUp={() => tryLevel(draft.master!.id, draft.master!.max, 5)}
                onMute={() => tryMute(draft.master!.id)}
              />
              <span />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
  className,
  title,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** 콘솔 주소 칸 + 찾기 */
function AddrInput({
  value,
  onChange,
  learning,
  onLearn,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  learning: boolean;
  onLearn: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="1.0.0.22/37"
        aria-label={label}
        className={cn(
          "h-9 w-[122px] min-w-0 rounded-lg border bg-[#101010] px-2 font-mono text-xs text-white placeholder:text-white/20 focus:outline-none",
          badAddr(value) ? badBorder : okBorder,
        )}
      />
      <button
        type="button"
        onClick={onLearn}
        title="콘솔에서 움직여 주소 찾기"
        className={cn(
          "flex h-9 shrink-0 items-center gap-1 rounded-lg border px-2 font-mbc text-xs transition-colors",
          learning
            ? "border-[#FF3B3B]/60 bg-[#FF3B3B]/15 text-[#ff8a8a]"
            : "border-white/10 text-white/50 hover:bg-white/10 hover:text-white",
        )}
      >
        <Crosshair size={13} className={cn(learning && "animate-pulse")} />
        {learning ? "대기" : "찾기"}
      </button>
    </div>
  );
}

/** 최대 레벨 — 이 값 위로는 조작 화면에서 못 올린다. 100 = 제한 없음, 75 ≈ 0dB */
function MaxInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const bad = badMax(value);
  const limited = !bad && value < 100;
  return (
    <div className="flex flex-col gap-1" title="이 값 위로는 조작 화면에서 올릴 수 없어요 · 100 = 제한 없음 · 75 ≈ 0dB">
      <input
        type="number"
        min={0}
        max={100}
        value={Number.isFinite(value) ? value : ""}
        aria-label={label}
        onChange={(e) => onChange(Math.floor(Number(e.target.value)))}
        className={cn(inputCls, "h-8 px-2 font-orbitron", bad ? badBorder : okBorder, limited && "text-[#ff8a8a]")}
      />
      <span className="h-1 overflow-hidden rounded-full bg-white/10">
        <span
          className={cn("block h-full rounded-full", limited ? "bg-[#FF3B3B]/70" : "bg-white/25")}
          style={{ width: `${bad ? 0 : value}%` }}
        />
      </span>
    </div>
  );
}

/** 시험 — 지금 값 보기 + 조금 내리기/올리기/뮤트.
 *  콘솔에서 지금 값을 아직 못 받았으면 누르지 못하게 한다 — 짐작한 값에서 ±하면
 *  실제 75 인 페이더가 '올리기'에 55 로 내려가는 식의 사고가 난다. */
function TryCell({
  disabled,
  hint,
  level,
  muted,
  onDown,
  onUp,
  onMute,
}: {
  disabled: boolean;
  hint: string;
  level: number | null;
  muted: boolean | null;
  onDown: () => void;
  onUp: () => void;
  onMute: () => void;
}) {
  const levelUnknown = level == null;
  const muteUnknown = muted == null;
  const waiting = !disabled && (levelUnknown || muteUnknown) ? "콘솔에서 지금 값을 받는 중이에요 — 잠시 뒤에 누르세요" : "";
  const btn =
    "flex h-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 transition-colors enabled:hover:bg-white/10 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div className="flex items-center gap-1" title={hint || waiting || undefined}>
      <span
        className={cn(
          "w-9 text-center font-orbitron text-[11px] tabular-nums",
          muted ? "text-[#ff6b6b]" : level == null ? "text-white/25" : "text-[#7CF5D4]",
        )}
      >
        {muted ? "MUTE" : level == null ? "--" : String(level).padStart(2, "0")}
      </span>
      <button type="button" aria-label="조금 내리기" disabled={disabled || levelUnknown} onClick={onDown} className={cn(btn, "w-7")}>
        <Minus size={13} />
      </button>
      <button type="button" aria-label="조금 올리기" disabled={disabled || levelUnknown} onClick={onUp} className={cn(btn, "w-7")}>
        <Plus size={13} />
      </button>
      <button
        type="button"
        aria-label="뮤트 켜고 끄기"
        disabled={disabled || muteUnknown}
        onClick={onMute}
        className={cn(btn, "w-9 font-orbitron text-[9px] tracking-wider", muted && "border-[#FF3B3B]/50 text-[#ff8a8a]")}
      >
        M
      </button>
    </div>
  );
}
