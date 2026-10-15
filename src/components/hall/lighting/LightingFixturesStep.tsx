"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Lightbulb, Minus, Plus, Radio, Trash2, X } from "lucide-react";
import Select from "@/components/common/Select";
import { toast } from "@/components/common/Toast";
import { Notice } from "@/components/hall/HallControls";
import { move, nextKey } from "@/components/hall/setup/draft";
import { ActionButton, Card, Th, badBorder, inputCls, okBorder } from "@/components/hall/setup/ui";
import { lightingApi } from "@/lib/lightingApi";
import { cn } from "@/lib/utils";
import type { CaptureResult, FixtureType, LightingState } from "@/types/lighting";
import {
  DMX_MAX,
  type FixtureRow,
  type Run,
  addrNum,
  coveredAddrs,
  groupRuns,
  guessType,
  nextFreeAddr,
  overlapPairs,
  rangeText,
  shortType,
  spanOf,
} from "./fixtureDraft";

const COLS = "grid-cols-[minmax(150px,1fr)_minmax(170px,240px)_88px_96px_148px]";

/** 표 아래에 생기는 새 줄 (칩·주소 켜 보기에서 고른 것) */
interface Pending {
  address: string;
  type: string;
  channels: (string | number)[];
  name: string;
  /** 콘솔이 이어서 쓰는 주소 수 — 2개 이상이면 '조광기 N개로 나눠 추가'를 보여 준다 */
  runLen: number;
}

/** 새 종류로 바꿀 때 채널 — 직접 정하기로 바꾸면 앞 종류의 채널을 그대로 가져와 고치게 한다 */
function channelsFor(type: string, prevType: string, prevChannels: (string | number)[], types: Record<string, FixtureType>) {
  if (type !== "custom") return [];
  if (prevType === "custom" && prevChannels.length) return prevChannels;
  const base = types[prevType]?.channels ?? [];
  return base.length ? [...base] : ["dim"];
}

/** ② 조명 찾기·목록 — 콘솔이 쓰는 주소를 읽어 칩으로 보여 주고, 누르면 켜지면서 표에 새 줄이 생긴다 */
export default function LightingFixturesStep({
  hallId,
  state,
  rows,
  setRows,
  capture,
  setCapture,
  lit,
  light,
  clearLight,
}: {
  hallId: string;
  state: LightingState;
  rows: FixtureRow[];
  setRows: Dispatch<SetStateAction<FixtureRow[] | null>>;
  capture: CaptureResult | null;
  setCapture: (c: CaptureResult) => void;
  lit: { from: number; to: number } | null;
  light: (from: number, to: number) => void;
  clearLight: () => Promise<unknown>;
}) {
  const types = state.types;
  const roles = state.roles;
  const canTest = state.configured;
  const [reading, setReading] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingSeq, setPendingSeq] = useState(0);
  const [tester, setTester] = useState(false);
  const [testAddr, setTestAddr] = useState(1);

  const runs: Run[] = capture ? groupRuns(capture.used) : [];
  const covered = coveredAddrs(rows, types);
  const overlaps = overlapPairs(rows, types);

  const update = (fn: (l: FixtureRow[]) => FixtureRow[]) => setRows((l) => (l ? fn(l) : l));
  const patchRow = (i: number, patch: Partial<FixtureRow>) => update((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const readConsole = async () => {
    setReading(true);
    try {
      // 켜 둔 시험 값이 읽기 결과에 섞이지 않게 먼저 지운다
      await clearLight();
      const res = await lightingApi.capture(hallId, 3);
      setCapture(res);
      if (res.used.length === 0) toast.info("콘솔 신호가 없어요");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReading(false);
    }
  };

  const openPending = (address: number, len: number) => {
    const type = guessType(len);
    setPending({
      address: String(address),
      type,
      channels: type === "custom" ? Array.from({ length: len }, () => "dim") : [],
      name: "",
      runLen: len,
    });
    setPendingSeq((n) => n + 1);
  };

  const pickRun = (run: Run) => {
    if (lit && lit.from === run.from && lit.to === run.to) {
      void clearLight();
      setPending(null);
      return;
    }
    if (canTest) light(run.from, run.to);
    // 목록에 아직 없는 첫 주소부터 이어진 만큼을 새 줄로
    let start = run.from;
    while (start <= run.to && covered.has(start)) start++;
    if (start > run.to) {
      setPending(null);
      return;
    }
    let end = start;
    while (end + 1 <= run.to && !covered.has(end + 1)) end++;
    openPending(start, end - start + 1);
  };

  const pendingRow: FixtureRow | null = pending
    ? { key: "pending", id: "", name: pending.name, type: pending.type, address: pending.address, channels: pending.channels, group: "" }
    : null;
  const pendingSpan = pendingRow ? spanOf(pendingRow, types) : null;

  const addPending = () => {
    if (!pending || !pendingSpan) return;
    const name = pending.name.trim() || `조명 ${pendingSpan.from}`;
    update((l) => [...l, { ...pendingRow!, key: nextKey(), name }]);
    setPending(null);
  };

  // 조광기 팩처럼 주소마다 다른 등이면 한 칸씩 나눠 넣는다
  const addPendingSplit = () => {
    if (!pending) return;
    const start = addrNum(pending.address);
    if (start === null) return;
    const base = pending.name.trim() || "조명";
    const n = Math.min(pending.runLen, DMX_MAX - start + 1);
    update((l) => [
      ...l,
      ...Array.from({ length: n }, (_, k) => ({
        key: nextKey(),
        id: "",
        name: `${base} ${k + 1}`,
        type: "dimmer",
        address: String(start + k),
        channels: [],
        group: "",
      })),
    ]);
    setPending(null);
  };

  const addBlank = () => {
    update((l) => [
      ...l,
      { key: nextKey(), id: "", name: "", type: "dimmer", address: String(nextFreeAddr(l, types)), channels: [], group: "" },
    ]);
  };

  const moveTest = (d: number) => {
    const next = Math.max(1, Math.min(DMX_MAX, testAddr + d));
    setTestAddr(next);
    if (lit && lit.from === lit.to && lit.from === testAddr) light(next, next);
  };
  const testLit = !!lit && lit.from === testAddr && lit.to === testAddr;
  const testRun = runs.find((r) => testAddr >= r.from && testAddr <= r.to);
  const testOwner = rows.find((r) => {
    const s = spanOf(r, types);
    return s && testAddr >= s.from && testAddr <= s.to;
  });

  const typeOptions = Object.entries(types).map(([k, t]) => ({ value: k, label: t.name }));

  return (
    <div className="flex flex-col gap-5">
      {!canTest && <Notice>연결 저장 안 됨</Notice>}

      <Card tour="lighting-setup.fixtures" title="조명 찾기·목록">
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton tour="lighting-setup.read-console" tone="primary" icon={<Radio size={15} />} busy={reading} disabled={!canTest} onClick={readConsole}>
            {reading ? "읽는 중… 3초" : "콘솔 신호 읽기 (3초)"}
          </ActionButton>
          {capture && (
            <span className="font-pretendard text-xs text-white/40">
              {`콘솔이 쓰는 주소 ${capture.used.length}개 · ${runs.length}묶음`}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {runs.map((run) => {
            const total = run.to - run.from + 1;
            let have = 0;
            for (let a = run.from; a <= run.to; a++) if (covered.has(a)) have++;
            const done = have === total;
            const on = !!lit && lit.from === run.from && lit.to === run.to;
            const guess = types[guessType(total)];
            return (
              <button
                key={run.from}
                type="button"
                onClick={() => pickRun(run)}
                title={`콘솔 값 ${run.last.join(" · ")}`}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 font-orbitron text-xs transition-all max-md:min-h-11",
                  on
                    ? "border-[#FFD49A] bg-[#FFD49A]/10 text-[#FFD49A] shadow-[0_0_12px_rgba(255,212,154,0.3)]"
                    : done
                      ? "border-white/[0.06] bg-black/30 text-white/35 line-through"
                      : "border-white/10 bg-black/40 text-white/85 hover:border-white/25",
                )}
              >
                {on && <Lightbulb size={13} />}
                {rangeText(run.from, run.to)}
                <span className="font-pretendard text-[11px] text-white/45 no-underline">
                  {guess ? shortType(guess.name) : "직접 정하기"}
                </span>
                {!done && have > 0 && (
                  <span className="rounded bg-amber-400/15 px-1 font-pretendard text-[10px] text-amber-200">
                    {have}/{total}
                  </span>
                )}
              </button>
            );
          })}
          <button
            data-tour="lighting-setup.address-test"
            type="button"
            onClick={() => setTester((v) => !v)}
            aria-expanded={tester}
            className={cn(
              "rounded-xl border border-dashed px-3 py-2 font-mbc text-[13px] transition-colors max-md:min-h-11",
              tester ? "border-white/35 text-white" : "border-white/20 text-white/55 hover:text-white/80",
            )}
          >
            + 주소 직접 켜 보기
          </button>
        </div>

        {tester && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.025] p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="앞 주소"
                onClick={() => moveTest(-1)}
                className="flex h-14 w-11 items-center justify-center rounded-xl border border-white/10 bg-[linear-gradient(180deg,#303035,#1e1e22)] text-white/70 hover:text-white"
              >
                <ChevronLeft size={18} />
              </button>
              <label className="flex h-14 w-[120px] flex-col items-center justify-center rounded-xl border border-black bg-[#07090b] shadow-[inset_0_1px_4px_#000]">
                <span className="font-orbitron text-[9px] tracking-[0.2em] text-white/35">DMX 주소</span>
                <input
                  type="number"
                  min={1}
                  max={DMX_MAX}
                  value={testAddr}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(DMX_MAX, Math.round(Number(e.target.value)) || 1));
                    setTestAddr(v);
                  }}
                  className="w-full bg-transparent text-center font-orbitron text-2xl text-[#ff8a8a] [text-shadow:0_0_10px_rgba(255,59,59,0.6)] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </label>
              <button
                type="button"
                aria-label="다음 주소"
                onClick={() => moveTest(1)}
                className="flex h-14 w-11 items-center justify-center rounded-xl border border-white/10 bg-[linear-gradient(180deg,#303035,#1e1e22)] text-white/70 hover:text-white"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <ActionButton
              icon={<Lightbulb size={14} />}
              disabled={!canTest}
              onClick={() => (testLit ? void clearLight() : light(testAddr, testAddr))}
              className={cn(testLit && "border-[#FFD49A] bg-[#FFD49A]/15 text-[#FFD49A] enabled:hover:bg-[#FFD49A]/20")}
            >
              {testLit ? "끄기" : "켜 보기"}
            </ActionButton>
            <ActionButton onClick={() => openPending(testAddr, 1)}>이 주소로 새 줄</ActionButton>
            <p className="min-w-[220px] flex-1 font-pretendard text-xs leading-relaxed text-white/45 max-md:min-w-0 max-md:basis-full">
              {testOwner
                ? `사용 중 · ${testOwner.name || "이름 없음"}`
                : testRun
                  ? `콘솔 ${rangeText(testRun.from, testRun.to)}`
                  : capture
                    ? "콘솔 미사용"
                    : ""}
            </p>
          </div>
        )}

        <div data-tour="lighting-setup.fixture-list" className="overflow-x-auto">
          <div className="flex flex-col gap-2 md:min-w-[720px] md:gap-1.5">
            <div className={cn("hidden items-center gap-2 px-2 pb-1 md:grid", COLS)}>
              <Th>이름</Th>
              <Th>종류</Th>
              <Th>시작 주소</Th>
              <Th>쓰는 주소</Th>
              <Th className="text-right">켜 보기·순서·삭제</Th>
            </div>

            {rows.length === 0 && !pending && (
              <p className="px-2 py-6 text-center font-pretendard text-sm text-white/30">
                조명이 없어요
              </p>
            )}

            {rows.map((r, i) => {
              const span = spanOf(r, types);
              const rowLit = !!span && !!lit && lit.from === span.from && lit.to === span.to;
              return (
                <div key={r.key} className="flex flex-col gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2 py-2">
                  <div className={cn("flex flex-wrap items-center gap-2 md:grid", COLS)}>
                    <input
                      value={r.name}
                      maxLength={24}
                      placeholder="예: 무대 앞 1"
                      aria-label={`${i + 1}번째 조명 이름`}
                      onChange={(e) => patchRow(i, { name: e.target.value })}
                      className={cn(inputCls, "basis-full", r.name.trim() ? okBorder : badBorder)}
                    />
                    <Select
                      value={r.type}
                      aria-label={`${r.name || i + 1} 종류`}
                      onChange={(type) => patchRow(i, { type, channels: channelsFor(type, r.type, r.channels, types) })}
                      placeholder="종류 고르기"
                      options={typeOptions}
                      className={cn(inputCls, types[r.type] ? okBorder : badBorder, "basis-[calc(100%-88px)] px-2 max-md:grow")}
                    />
                    <input
                      value={r.address}
                      inputMode="numeric"
                      aria-label={`${r.name || i + 1} 시작 주소`}
                      onChange={(e) => patchRow(i, { address: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                      className={cn(inputCls, "px-2 text-center font-orbitron max-md:w-20", span ? okBorder : badBorder)}
                    />
                    <span className="whitespace-nowrap font-orbitron text-xs text-white/55">
                      {span ? rangeText(span.from, span.to) : ""}
                    </span>
                    <div className="flex justify-end max-md:ml-auto">
                      <IconBtn
                        label={rowLit ? "끄기" : "켜 보기"}
                        disabled={!canTest || !span}
                        onClick={() => (rowLit ? void clearLight() : span && light(span.from, span.to))}
                        className={rowLit ? "text-[#FFD49A]" : undefined}
                      >
                        <Lightbulb size={15} />
                      </IconBtn>
                      <IconBtn label="위로" disabled={i === 0} onClick={() => update((l) => move(l, i, -1))}>
                        <ChevronUp size={15} />
                      </IconBtn>
                      <IconBtn label="아래로" disabled={i === rows.length - 1} onClick={() => update((l) => move(l, i, 1))}>
                        <ChevronDown size={15} />
                      </IconBtn>
                      <IconBtn
                        label="삭제"
                        onClick={() => update((l) => l.filter((_, j) => j !== i))}
                        className="hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </IconBtn>
                    </div>
                  </div>
                  {r.type === "custom" && (
                    <ChannelEditor
                      start={addrNum(r.address)}
                      channels={r.channels}
                      roles={roles}
                      onChange={(channels) => patchRow(i, { channels })}
                    />
                  )}
                </div>
              );
            })}

            {pending && pendingRow && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-[#FFD49A]/35 bg-[#FFD49A]/[0.07] px-2 py-2">
                <div className={cn("flex flex-wrap items-center gap-2 md:grid", COLS)}>
                  <input
                    key={pendingSeq}
                    autoFocus
                    value={pending.name}
                    maxLength={24}
                    placeholder="예: 객석 1"
                    aria-label="새 조명 이름"
                    onChange={(e) => setPending({ ...pending, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addPending();
                    }}
                    className={cn(inputCls, "basis-full", okBorder)}
                  />
                  <Select
                    value={pending.type}
                    aria-label="새 조명 종류"
                    onChange={(type) =>
                      setPending({
                        ...pending,
                        type,
                        channels: channelsFor(type, pending.type, pending.channels, types),
                      })
                    }
                    options={typeOptions}
                    className={cn(inputCls, okBorder, "basis-[calc(100%-88px)] px-2 max-md:grow")}
                  />
                  <input
                    value={pending.address}
                    inputMode="numeric"
                    aria-label="새 조명 시작 주소"
                    onChange={(e) => setPending({ ...pending, address: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                    className={cn(inputCls, "px-2 text-center font-orbitron max-md:w-20", pendingSpan ? okBorder : badBorder)}
                  />
                  <span className="whitespace-nowrap font-orbitron text-xs text-[#FFD49A]/80">
                    {pendingSpan ? rangeText(pendingSpan.from, pendingSpan.to) : ""}
                  </span>
                  <div className="flex justify-end gap-1 max-md:ml-auto">
                    <ActionButton tone="primary" onClick={addPending} disabled={!pendingSpan} className="h-9 px-3">
                      추가
                    </ActionButton>
                    <IconBtn label="새 줄 취소" onClick={() => setPending(null)}>
                      <X size={15} />
                    </IconBtn>
                  </div>
                </div>
                {pending.type === "custom" && (
                  <ChannelEditor
                    start={addrNum(pending.address)}
                    channels={pending.channels}
                    roles={roles}
                    onChange={(channels) => setPending({ ...pending, channels })}
                  />
                )}
                {pending.runLen > 1 && (
                  <p className="px-1 font-pretendard text-xs text-white/45">
                    <button type="button" onClick={addPendingSplit} className="font-mbc text-[#FFD49A] hover:underline max-md:min-h-11">
                      밝기만 {pending.runLen}개로 나눠 추가
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <ActionButton tour="lighting-setup.add-fixture" tone="ghost" icon={<Plus size={14} />} onClick={addBlank} className="self-start">
          직접 추가
        </ActionButton>

        {overlaps.length > 0 && (
          <Notice>
            {overlaps.map((o) => `${o.a}·${o.b} 주소 ${o.addrs.join(", ")} 겹침`).join(" · ")}
          </Notice>
        )}
      </Card>
    </div>
  );
}

/** 직접 정하기 — 채널마다 역할(밝기·색·깜빡임·안 씀) 또는 늘 보내는 고정 값 */
function ChannelEditor({
  start,
  channels,
  roles,
  onChange,
}: {
  start: number | null;
  channels: (string | number)[];
  roles: Record<string, string>;
  onChange: (channels: (string | number)[]) => void;
}) {
  const set = (i: number, v: string | number) => onChange(channels.map((c, j) => (j === i ? v : c)));
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-black/25 px-2 py-2">
      <span className="mr-1 font-mbc text-xs text-white/45">채널</span>
      {channels.map((c, i) => {
        const fixed = typeof c === "number";
        return (
          <div key={i} className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#101010] py-1 pl-2 pr-1">
            <span className="font-orbitron text-[10px] text-white/35">{start !== null ? start + i : i + 1}</span>
            <Select
              value={fixed ? "#fixed" : c}
              aria-label={`${i + 1}번째 채널 역할`}
              onChange={(v) => set(i, v === "#fixed" ? 0 : v)}
              options={[
                ...Object.entries(roles).map(([k, name]) => ({ value: k, label: name })),
                { value: "#fixed", label: "고정 값" },
              ]}
              className="h-7 gap-1 border-transparent bg-transparent px-1.5 text-xs focus:border-white/20 max-md:h-11 max-md:text-[14px]"
            />
            {fixed && (
              <input
                type="number"
                min={0}
                max={255}
                value={c}
                aria-label={`${i + 1}번째 채널 고정 값`}
                onChange={(e) => set(i, Math.max(0, Math.min(255, Math.round(Number(e.target.value)) || 0)))}
                className="h-7 w-14 rounded-md border border-white/10 bg-black/40 px-1 text-center font-orbitron text-xs text-white focus:outline-none max-md:h-11 max-md:text-base"
              />
            )}
          </div>
        );
      })}
      <IconBtn label="채널 빼기" disabled={channels.length <= 1} onClick={() => onChange(channels.slice(0, -1))}>
        <Minus size={14} />
      </IconBtn>
      <IconBtn label="채널 추가" disabled={channels.length >= 32} onClick={() => onChange([...channels, "none"])}>
        <Plus size={14} />
      </IconBtn>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent max-md:h-11 max-md:w-11",
        className,
      )}
    >
      {children}
    </button>
  );
}
