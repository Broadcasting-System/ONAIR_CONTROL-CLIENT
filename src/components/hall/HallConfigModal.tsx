"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Crosshair, Plus, Settings2, Trash2, X } from "lucide-react";
import Button from "@/components/common/Button";
import { toast } from "@/components/common/Toast";
import { hallApi } from "@/lib/hallApi";
import { cn } from "@/lib/utils";
import type { HiqnetAddress, HiqnetParam, MixerChannel, MixerState, VideoMatrixState } from "@/types/hall";

/** 강당·홀 장비의 이름·씬 목록·채널 구성(과 HiQnet 주소)을 화면에서 고치는 관리자용 창.
 *  드라이버·장비 IP 같은 연결 방식은 현장 설정이라 서버의 config/halls.json 에서 다룬다. */

/** 페이지 머리의 관리자용 '설정' 버튼 */
export function ConfigButton({ label = "설정", onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 font-mbc text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Settings2 size={15} />
      {label}
    </button>
  );
}

const inputCls =
  "h-10 min-w-0 rounded-lg border bg-[#141414] px-3 font-pretendard text-sm text-white placeholder:text-white/25 focus:outline-none";
const okBorder = "border-white/10 focus:border-white/30";
const badBorder = "border-red-500/60 focus:border-red-400";

// HiQnet 파라미터 표기 "VD.o1.o2.o3/파라미터"
const ADDR_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,5}$/;
const badAddr = (v: string) => v.trim() !== "" && !ADDR_RE.test(v.trim());

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function duplicates(values: string[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return dup;
}

const specText = (p?: HiqnetParam) => (!p ? "" : typeof p === "string" ? p : `${p.addr}/${p.pid}`);
const toAddress = (h?: MixerChannel["hiqnet"]): HiqnetAddress => ({
  fader: specText(h?.fader),
  mute: specText(h?.mute),
  muteInvert: typeof h?.mute === "object" && !!h.mute.invert,
});

function Shell({
  title,
  hint,
  onClose,
  onSave,
  saving,
  canSave,
  wide,
  children,
}: {
  title: string;
  hint: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1C] shadow-2xl",
          wide ? "max-w-[900px]" : "max-w-[760px]",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-0.5 font-pretendard text-xs text-white/40">{hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
        <div className="flex gap-4 border-t border-white/10 px-6 py-4">
          <div className="flex-1">
            <Button label="취소" onClick={onClose} color="white" className="h-[52px] !aspect-auto" />
          </div>
          <div className="flex-1">
            <Button
              label={saving ? "저장 중..." : "저장"}
              onClick={onSave}
              color="blue"
              disabled={!canSave || saving}
              className="h-[52px] !aspect-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="font-mbc text-sm text-white/60">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function RowTools({
  index,
  count,
  onMove,
  onRemove,
  label,
}: {
  index: number;
  count: number;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  label: string;
}) {
  const btn =
    "flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent";
  return (
    <>
      <button type="button" aria-label={`${label} 위로`} disabled={index === 0} onClick={() => onMove(-1)} className={btn}>
        <ChevronUp size={16} />
      </button>
      <button
        type="button"
        aria-label={`${label} 아래로`}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
        className={btn}
      >
        <ChevronDown size={16} />
      </button>
      <button type="button" aria-label={`${label} 삭제`} onClick={onRemove} className={cn(btn, "hover:text-red-400")}>
        <Trash2 size={15} />
      </button>
    </>
  );
}

function AddButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 rounded-lg px-2.5 py-1 font-mbc text-xs text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
    >
      <Plus size={13} />
      {label}
    </button>
  );
}

type Role = "fader" | "mute";
/** 주소 찾기 대상 — 채널 줄 번호 또는 마스터 */
type LearnTarget = { row: number | "master"; role: Role; label: string };

/** 페이더·뮤트 주소 칸 + '찾기' */
function AddressFields({
  value,
  onChange,
  learning,
  onLearn,
  name,
}: {
  value: HiqnetAddress;
  onChange: (next: HiqnetAddress) => void;
  learning: Role | null;
  onLearn: (role: Role) => void;
  name: string;
}) {
  const field = (role: Role, label: string, placeholder: string) => (
    <div className="flex items-center gap-1.5">
      <span className="w-9 shrink-0 font-orbitron text-[9.5px] tracking-[0.14em] text-white/35">{label}</span>
      <input
        value={value[role]}
        onChange={(e) => onChange({ ...value, [role]: e.target.value })}
        placeholder={placeholder}
        aria-label={`${name} ${role === "fader" ? "페이더" : "뮤트"} 주소`}
        className={cn(
          "h-9 w-[128px] rounded-lg border bg-[#101010] px-2.5 font-mono text-xs text-white placeholder:text-white/20 focus:outline-none",
          badAddr(value[role]) ? badBorder : okBorder,
        )}
      />
      <button
        type="button"
        onClick={() => onLearn(role)}
        title="콘솔에서 움직여 주소 찾기"
        className={cn(
          "flex h-9 items-center gap-1 rounded-lg border px-2 font-mbc text-xs transition-colors",
          learning === role
            ? "border-[#FF3B3B]/60 bg-[#FF3B3B]/15 text-[#ff8a8a]"
            : "border-white/10 text-white/50 hover:bg-white/10 hover:text-white",
        )}
      >
        <Crosshair size={13} className={cn(learning === role && "animate-pulse")} />
        {learning === role ? "대기" : "찾기"}
      </button>
    </div>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-black/25 px-3 py-2">
      {field("fader", "FADER", "1.0.0.22/37")}
      {field("mute", "MUTE", "1.0.0.48/1")}
      <label className="flex cursor-pointer items-center gap-1.5 font-pretendard text-xs text-white/45" title="콘솔의 켜짐(ON) 버튼처럼 뮤트와 반대로 동작하는 파라미터">
        <input
          type="checkbox"
          checked={value.muteInvert}
          onChange={(e) => onChange({ ...value, muteInvert: e.target.checked })}
          className="h-3.5 w-3.5 accent-red-400"
        />
        켜짐 스위치
      </label>
    </div>
  );
}

type ChannelRow = { id: string; name: string } & HiqnetAddress;

export function MixerConfigModal({
  hallId,
  state,
  onClose,
}: {
  hallId: string;
  state: MixerState;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  // HiQnet 연결이면 채널마다 콘솔 주소를 붙일 수 있다
  const hiqnet = state.driver.includes("hiqnet");
  const [scenes, setScenes] = useState(() => state.scenes.map((s) => ({ pc: s.pc, name: s.name })));
  const [channels, setChannels] = useState<ChannelRow[]>(() =>
    state.channels.map((c) => ({ id: c.id, name: c.name, ...toAddress(c.hiqnet) })),
  );
  const [masterName, setMasterName] = useState(state.master?.name ?? "");
  const [masterAddr, setMasterAddr] = useState<HiqnetAddress>(() => toAddress(state.master?.hiqnet));
  const [saving, setSaving] = useState(false);

  // ---- 주소 찾기: 콘솔을 구독해 두고, '찾기'를 누른 뒤 새로 움직인 파라미터를 그 칸에 넣는다 ----
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
        const hit = r.moved.find(
          (m) => m.kind === learn.role && m.changes > (baseline.current[m.param] ?? 0),
        );
        if (!hit) return;
        // 뮤트: '켜 두세요' 안내 뒤 값이 0이면 켜짐(ON) 스위치 — 뮤트와 반대
        const patch: Partial<HiqnetAddress> =
          learn.role === "fader" ? { fader: hit.param } : { mute: hit.param, muteInvert: hit.last < 50 };
        if (learn.row === "master") setMasterAddr((a) => ({ ...a, ...patch }));
        else setChannels((l) => l.map((c, j) => (j === learn.row ? { ...c, ...patch } : c)));
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
  }, [learn, hallId]);

  // 창을 닫으면 콘솔 구독을 푼다 (수천 개 파라미터를 계속 받지 않게)
  useEffect(
    () => () => {
      if (learnStarted.current) void hallApi.learnStop(hallId).catch(() => {});
    },
    [hallId],
  );

  const dupPcs = useMemo(() => duplicates(scenes.map((s) => String(s.pc))), [scenes]);
  const dupIds = useMemo(
    () => duplicates([...channels.map((c) => c.id.trim()), ...(state.master ? [state.master.id] : [])]),
    [channels, state.master],
  );
  const badPc = (pc: number) => !Number.isInteger(pc) || pc < 1 || pc > 128 || dupPcs.has(String(pc));
  const badId = (id: string) => !/^[0-9A-Za-z_-]{1,8}$/.test(id.trim()) || dupIds.has(id.trim());
  const addrOk = (a: HiqnetAddress) => !badAddr(a.fader) && !badAddr(a.mute);
  const valid =
    scenes.every((s) => !badPc(s.pc) && s.name.trim()) &&
    channels.every((c) => !badId(c.id) && c.name.trim() && (!hiqnet || addrOk(c))) &&
    (!state.master || (masterName.trim() && (!hiqnet || addrOk(masterAddr))));

  const cleanAddr = (a: HiqnetAddress): HiqnetAddress => ({
    fader: a.fader.trim(),
    mute: a.mute.trim(),
    muteInvert: a.muteInvert && !!a.mute.trim(),
  });

  const save = async () => {
    setSaving(true);
    try {
      await hallApi.updateMixerConfig(hallId, {
        scenes: scenes.map((s) => ({ pc: s.pc, name: s.name.trim() })),
        channels: channels.map((c) => ({
          id: c.id.trim(),
          name: c.name.trim(),
          ...(hiqnet ? { hiqnet: cleanAddr(c) } : {}),
        })),
        masterName: state.master ? masterName.trim() : undefined,
        masterHiqnet: state.master && hiqnet ? cleanAddr(masterAddr) : undefined,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["mixer", hallId] }),
        qc.invalidateQueries({ queryKey: ["hallsStatus"] }),
      ]);
      toast.success("믹서 설정을 저장했습니다.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const nextPc = () => Math.min(128, Math.max(0, ...scenes.map((s) => s.pc)) + 1);
  const nextId = () => {
    const nums = channels.map((c) => Number(c.id)).filter(Number.isInteger);
    return String(Math.max(0, ...nums) + 1);
  };
  const learningRole = (row: number | "master"): Role | null => (learn && learn.row === row ? learn.role : null);

  return (
    <Shell
      title={`${state.hall.name} 믹서 설정`}
      hint="씬 번호는 콘솔에 저장된 Cue(Program) 번호입니다 · 채널 번호를 바꾸면 그 채널의 장비 주소 연결이 풀립니다"
      onClose={onClose}
      onSave={save}
      saving={saving}
      canSave={!!valid}
      wide={hiqnet}
    >
      <div className="flex flex-col gap-8">
        <Section
          title={`씬 (${scenes.length})`}
          action={
            <AddButton
              label="씬 추가"
              disabled={scenes.length >= 128}
              onClick={() => setScenes((l) => [...l, { pc: nextPc(), name: "" }])}
            />
          }
        >
          {scenes.length === 0 && <p className="font-pretendard text-sm text-white/30">등록된 씬이 없습니다.</p>}
          {scenes.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-8 shrink-0 font-orbitron text-[10px] tracking-[0.14em] text-white/35">PC</span>
              <input
                type="number"
                min={1}
                max={128}
                value={Number.isFinite(s.pc) ? s.pc : ""}
                aria-label={`씬 ${i + 1} 번호`}
                onChange={(e) =>
                  setScenes((l) => l.map((x, j) => (j === i ? { ...x, pc: Math.floor(Number(e.target.value)) } : x)))
                }
                className={cn(inputCls, "w-20 font-orbitron", badPc(s.pc) ? badBorder : okBorder)}
              />
              <input
                value={s.name}
                maxLength={20}
                placeholder="씬 이름 (예: 졸업식)"
                aria-label={`씬 ${i + 1} 이름`}
                onChange={(e) => setScenes((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className={cn(inputCls, "flex-1", s.name.trim() ? okBorder : badBorder)}
              />
              <RowTools
                index={i}
                count={scenes.length}
                label={`씬 ${s.name || i + 1}`}
                onMove={(d) => setScenes((l) => move(l, i, d))}
                onRemove={() => setScenes((l) => l.filter((_, j) => j !== i))}
              />
            </div>
          ))}
          {dupPcs.size > 0 && (
            <p className="font-pretendard text-xs text-red-300/80">같은 씬 번호가 두 번 있습니다.</p>
          )}
        </Section>

        <Section
          title={`채널 (${channels.length})`}
          action={
            <AddButton
              label="채널 추가"
              disabled={channels.length >= 64}
              onClick={() => setChannels((l) => [...l, { id: nextId(), name: "", fader: "", mute: "", muteInvert: false }])}
            />
          }
        >
          {hiqnet && !learn && (
            <p className="font-pretendard text-xs text-white/35">
              콘솔 주소는 <b className="text-white/55">찾기</b>를 누른 뒤 콘솔에서 그 채널을 움직이면 자동으로 채워집니다.
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
              <button
                type="button"
                onClick={() => setLearn(null)}
                className="rounded-lg px-2.5 py-1 font-mbc text-xs text-white/60 hover:bg-white/10 hover:text-white"
              >
                취소
              </button>
            </div>
          )}
          {channels.map((c, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 font-orbitron text-[10px] tracking-[0.14em] text-white/35">CH</span>
                <input
                  value={c.id}
                  maxLength={8}
                  aria-label={`채널 ${i + 1} 번호`}
                  onChange={(e) => setChannels((l) => l.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))}
                  className={cn(inputCls, "w-20 font-orbitron", badId(c.id) ? badBorder : okBorder)}
                />
                <input
                  value={c.name}
                  maxLength={12}
                  placeholder="채널 이름 (예: 무선 1)"
                  aria-label={`채널 ${i + 1} 이름`}
                  onChange={(e) => setChannels((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className={cn(inputCls, "flex-1", c.name.trim() ? okBorder : badBorder)}
                />
                <RowTools
                  index={i}
                  count={channels.length}
                  label={`채널 ${c.name || c.id}`}
                  onMove={(d) => setChannels((l) => move(l, i, d))}
                  onRemove={() => setChannels((l) => l.filter((_, j) => j !== i))}
                />
              </div>
              {hiqnet && (
                <div className="pl-10">
                  <AddressFields
                    value={c}
                    name={c.name || `채널 ${c.id}`}
                    onChange={(next) => setChannels((l) => l.map((x, j) => (j === i ? { ...x, ...next } : x)))}
                    learning={learningRole(i)}
                    onLearn={(role) => beginLearn({ row: i, role, label: c.name || `CH ${c.id}` })}
                  />
                </div>
              )}
            </div>
          ))}
          {dupIds.size > 0 && (
            <p className="font-pretendard text-xs text-red-300/80">같은 채널 번호가 두 번 있습니다 (마스터 포함).</p>
          )}
        </Section>

        {state.master && (
          <Section title="마스터">
            <input
              value={masterName}
              maxLength={12}
              aria-label="마스터 이름"
              onChange={(e) => setMasterName(e.target.value)}
              className={cn(inputCls, masterName.trim() ? okBorder : badBorder)}
            />
            {hiqnet && (
              <AddressFields
                value={masterAddr}
                name="마스터"
                onChange={setMasterAddr}
                learning={learningRole("master")}
                onLearn={(role) => beginLearn({ row: "master", role, label: masterName || "MAIN" })}
              />
            )}
          </Section>
        )}
      </div>
    </Shell>
  );
}

export function MatrixLabelsModal({
  hallId,
  state,
  onClose,
}: {
  hallId: string;
  state: VideoMatrixState;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [inputs, setInputs] = useState(() => state.inputs.map((i) => i.name));
  const [outputs, setOutputs] = useState(() => state.outputs.map((o) => o.name));
  const [saving, setSaving] = useState(false);
  const valid = [...inputs, ...outputs].every((n) => n.trim());

  const save = async () => {
    setSaving(true);
    try {
      await hallApi.updateMatrixConfig(
        hallId,
        inputs.map((n) => n.trim()),
        outputs.map((n) => n.trim()),
      );
      await qc.invalidateQueries({ queryKey: ["videoMatrix", hallId] });
      toast.success("입출력 이름을 저장했습니다.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const column = (label: string, prefix: string, names: string[], set: (fn: (l: string[]) => string[]) => void) => (
    <Section title={label}>
      {names.map((n, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-14 shrink-0 font-orbitron text-[10px] tracking-[0.14em] text-white/35">
            {prefix} {i + 1}
          </span>
          <input
            value={n}
            maxLength={20}
            aria-label={`${prefix} ${i + 1} 이름`}
            onChange={(e) => set((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
            className={cn(inputCls, "flex-1", n.trim() ? okBorder : badBorder)}
          />
        </div>
      ))}
    </Section>
  );

  return (
    <Shell
      title={`${state.hall.name} 영상 매트릭스 이름`}
      hint="장비 뒷면 단자 번호 순서입니다 · 개수는 장비에 맞춰져 있어 이름만 바꿀 수 있습니다"
      onClose={onClose}
      onSave={save}
      saving={saving}
      canSave={valid}
    >
      <div className="grid grid-cols-2 gap-8">
        {column("입력 (소스)", "IN", inputs, setInputs)}
        {column("출력 (화면)", "OUT", outputs, setOutputs)}
      </div>
    </Shell>
  );
}
