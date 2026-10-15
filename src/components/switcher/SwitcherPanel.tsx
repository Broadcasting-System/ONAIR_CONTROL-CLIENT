"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Send, Volume2, VolumeX, X } from "lucide-react";
import NeonButton from "@/components/common/NeonButton";
import SectionHeader from "@/components/common/SectionHeader";
import MediaSelectModal from "@/components/common/MediaSelectModal";
import InputModal from "@/components/common/InputModal";
import { toast } from "@/components/common/Toast";
import { SlotPreview, SwitchGrid } from "@/components/switcher/SlotPreview";
import Portal from "@/components/common/Portal";
import { DurationWheel } from "@/components/common/DateTimePicker";
import { useChannelStore, MAX_CHANNELS } from "@/stores/channelStore";
import { useDisplaySync } from "@/hooks/useDisplaySync";
import { useHealth } from "@/hooks/useHealth";
import { useMe } from "@/hooks/useMe";
import { parseYouTubeId } from "@/lib/youtube";
import { shareApi, type ShareRequest } from "@/lib/shareApi";
import {
  SLOT_COUNT,
  sourceKey,
  switchApi,
  type SwitchLayout,
  type SwitchSlot,
  type SwitchSource,
  type SwitchState,
} from "@/lib/switchApi";
import { cn } from "@/lib/utils";

/** 송출 › 스위처 — 연결된 외부 화면·파일함 미디어를 칸에 넣어 한 화면·2분할·4분할·PIP 로 바로 송출.
 *  칸을 누르고 왼쪽 소스를 누르면 그 칸이 바뀐다. 칸마다 음소거·볼륨. */

const EMPTY: SwitchState = {
  type: "switch",
  layout: "four",
  slots: Array.from({ length: 4 }, () => ({ source: null, mute: false, volume: 100, startedAt: 0 })),
  sources: [],
};

const LAYOUTS: { key: SwitchLayout; label: string }[] = [
  { key: "one", label: "한 화면" },
  { key: "two", label: "2분할" },
  { key: "four", label: "4분할" },
  { key: "pip", label: "PIP" },
];

const KIND_LABEL: Record<SwitchSource["kind"], string> = {
  share: "외부 화면",
  video: "파일함 영상",
  image: "파일함 사진",
  youtube: "유튜브",
  timer: "타이머",
};

function LayoutIcon({ k }: { k: SwitchLayout }) {
  return (
    <span className="relative h-[15px] w-[23px] rounded-[3px] border-[1.5px] border-current opacity-85">
      {k === "two" && <i className="absolute inset-y-0 left-1/2 border-l-[1.5px] border-current" />}
      {k === "four" && (
        <>
          <i className="absolute inset-y-0 left-1/2 border-l-[1.5px] border-current" />
          <i className="absolute inset-x-0 top-1/2 border-t-[1.5px] border-current" />
        </>
      )}
      {k === "pip" && <i className="absolute bottom-[2px] right-[2px] h-[5px] w-[8px] rounded-[1px] bg-current" />}
    </span>
  );
}

function ChannelPicker() {
  const channel = useChannelStore((s) => s.channel);
  const setChannel = useChannelStore((s) => s.setChannel);
  const { health } = useHealth();
  return (
    <div className="ml-auto flex items-center gap-2" data-tour="switch.channel">
      <span className="font-mbc text-xs text-white/40">채널</span>
      {Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1).map((ch) => {
        const h = health?.channels[String(ch)];
        const onAir = !!h?.type && h.type !== "standby";
        return (
          <button
            key={ch}
            type="button"
            onClick={() => setChannel(ch)}
            aria-pressed={channel === ch}
            className={cn(
              "relative flex h-11 w-12 items-center justify-center rounded-xl border font-orbitron text-sm transition-all md:h-9",
              channel === ch ? "border-red-400/50 bg-red-400/15 text-white" : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/5",
              onAir && "after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-red-400",
            )}
          >
            {ch}
            <span className={cn("absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-black", h?.live ? "bg-emerald-400" : "bg-white/20")} />
          </button>
        );
      })}
    </div>
  );
}

function Fader({ value, dim, onChange, label }: { value: number; dim: boolean; onChange: (v: number) => void; label: string }) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      step={5}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ background: `linear-gradient(90deg, ${dim ? "rgba(255,255,255,.25)" : "#fff"} ${value}%, rgba(255,255,255,.1) ${value}%)` }}
      className={cn(
        "h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full outline-none",
        "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(0,0,0,0.45)]",
        dim ? "[&::-webkit-slider-thumb]:bg-[#6b6c72]" : "[&::-webkit-slider-thumb]:bg-white",
      )}
    />
  );
}

export default function SwitcherPanel({ lead }: { lead: ReactNode }) {
  const qc = useQueryClient();
  const channel = useChannelStore((s) => s.channel);
  const { canOperate } = useMe();
  const { content } = useDisplaySync(channel);
  const onAir = content?.type === "switch";
  const saved = useQuery({
    queryKey: ["switch", channel],
    queryFn: () => switchApi.get(channel),
    refetchInterval: onAir ? false : 5000,
  });
  const share = useQuery({ queryKey: ["share"], queryFn: shareApi.overview, enabled: canOperate, refetchInterval: 2000, retry: false });

  // 보이는 상태 — 송출 중이면 웹소켓으로 온 진짜 상태, 아니면 마지막 배치. 손으로 바꾸는 중엔 그 값(local)
  const server: SwitchState = useMemo(() => {
    if (onAir && content?.slots) {
      return { type: "switch", layout: content.layout ?? "four", slots: content.slots, sources: content.sources ?? [] };
    }
    return saved.data ?? EMPTY;
  }, [onAir, content, saved.data]);
  const [local, setLocal] = useState<SwitchState | null>(null);
  const view = local ?? server;
  const slots: SwitchSlot[] = [0, 1, 2, 3].map((i) => view.slots[i] ?? EMPTY.slots[0]);
  const count = SLOT_COUNT[view.layout];
  const [sel, setSel] = useState(0);
  const selected = Math.min(sel, count - 1);

  // 보내기 — 소리 막대는 손을 뗄 때까지 모아서
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);
  const push = (next: SwitchState, delay = 0) => {
    setLocal(next);
    clearTimeout(timer.current);
    const my = ++seq.current;
    timer.current = setTimeout(async () => {
      try {
        const res = await switchApi.set(channel, {
          layout: next.layout,
          slots: next.slots.map(({ source, mute, volume }) => ({ source, mute, volume })),
          sources: next.sources,
        });
        qc.setQueryData(["switch", channel], res);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        // 웹소켓으로 진짜 상태가 오기 전에 깜빡이지 않게 조금 뒤에 놓는다
        setTimeout(() => my === seq.current && setLocal(null), 600);
      }
    }, delay);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => setLocal(null), [channel]);

  const setSlot = (i: number, patch: Partial<SwitchSlot>, delay = 0) =>
    push({ ...view, slots: slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) }, delay);

  // 소스 목록 — 이 채널로 허용된 외부 화면 + 기다리는 요청 + 추가해 둔 미디어
  const requests = share.data?.requests ?? [];
  const byId = new Map(requests.map((r) => [r.id, r] as const));
  const shareSources: SwitchSource[] = requests
    .filter((r) => r.status === "approved" && r.channel === channel)
    .map((r) => ({ kind: "share", id: r.id, name: r.name }));
  const waiting = requests.filter((r) => r.status === "waiting");
  const allSources = [...shareSources, ...view.sources];
  const slotOf = (s: SwitchSource) => {
    const k = sourceKey(s);
    const i = slots.findIndex((x, j) => j < count && sourceKey(x.source) === k);
    return i;
  };

  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["share"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const [adding, setAdding] = useState<null | "menu" | "file" | "youtube" | "timer">(null);
  const addSource = (s: SwitchSource) => {
    setAdding(null);
    if (view.sources.some((x) => sourceKey(x) === sourceKey(s))) return;
    push({ ...view, sources: [...view.sources, s] });
  };
  const removeSource = (s: SwitchSource) =>
    push({ ...view, sources: view.sources.filter((x) => sourceKey(x) !== sourceKey(s)) });

  const room = share.data?.room;
  const disabled = !canOperate;

  return (
    <div className="flex w-full flex-col gap-6 md:h-full md:px-[20px]">
      <header className="flex flex-wrap items-center gap-5">
        {lead}
        <ChannelPicker />
      </header>

      <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-[330px_minmax(0,1fr)]">
        {/* 소스 */}
        <div className="flex min-h-0 flex-col gap-2 rounded-[20px] border border-white/[0.08] bg-[rgba(14,14,17,0.72)] p-4 backdrop-blur-md" data-tour="switch.sources">
          <div className="mb-1 flex items-center justify-between">
            <SectionHeader className="mb-0 text-[15px]">소스</SectionHeader>
            <span className="font-orbitron text-xs text-white/40">{allSources.length}</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
            {waiting.map((r: ShareRequest) => (
              <div key={r.id} className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3 rounded-[13px] border border-dashed border-white/15 p-2">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-[#0d0e11]">
                  {r.hasSnapshot ? <SlotPreview source={{ kind: "share", id: r.id, name: r.name }} share={r} /> : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-pretendard text-[14px] font-bold text-white">{r.name}</div>
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => act(() => shareApi.approve(r.id, channel, "source"))}
                      className="flex h-8 items-center gap-1 rounded-lg border border-[#FF3B3B]/55 bg-[#FF3B3B]/15 px-2.5 font-mbc text-[12.5px] text-white disabled:opacity-40"
                    >
                      <Check size={13} />
                      허용
                    </button>
                    <button
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => act(() => shareApi.reject(r.id))}
                      className="h-8 rounded-lg border border-white/10 px-2.5 font-mbc text-[12.5px] text-white/65 disabled:opacity-40"
                    >
                      거절
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {allSources.map((s) => {
              const at = slotOf(s);
              const r = s.kind === "share" ? byId.get(s.id) : undefined;
              return (
                <div
                  key={sourceKey(s)}
                  role="button"
                  tabIndex={0}
                  aria-disabled={disabled}
                  onClick={() => !disabled && setSlot(selected, { source: s })}
                  onKeyDown={(e) => e.key === "Enter" && !disabled && setSlot(selected, { source: s })}
                  className={cn(
                    "group relative grid cursor-pointer grid-cols-[104px_minmax(0,1fr)] items-center gap-3 rounded-[13px] p-2 transition-colors",
                    at === selected ? "bg-[#FF3B3B]/10 outline outline-1 outline-[#FF3B3B]/45" : "bg-white/[0.035] hover:bg-white/[0.06]",
                  )}
                >
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-[#0d0e11]">
                    <SlotPreview source={s} share={r} live={false} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-pretendard text-[14px] font-bold text-white">{s.name}</div>
                    <div className="mt-1 flex items-center gap-2 font-pretendard text-[12.5px] text-white/45">
                      {KIND_LABEL[s.kind]}
                      {at >= 0 && (
                        <span className="ml-auto rounded-[5px] border border-white/25 px-1.5 font-orbitron text-[10.5px] font-bold text-white">{at + 1}</span>
                      )}
                    </div>
                  </div>
                  {s.kind !== "share" && !disabled && (
                    <button
                      type="button"
                      aria-label={`${s.name} 빼기`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSource(s);
                      }}
                      className="absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded-md bg-black/70 text-white/70 hover:text-white group-hover:flex"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
            {allSources.length === 0 && waiting.length === 0 && (
              <p className="py-8 text-center font-pretendard text-[14px] text-white/35">소스가 없어요</p>
            )}
          </div>
          {room && (
            <div className="flex items-center justify-between rounded-xl bg-[#151519] px-3 py-2">
              <span className="font-pretendard text-[12.5px] text-white/50">share 코드</span>
              <span className="font-mono text-[18px] font-bold tracking-[0.16em] text-white">
                {room.code.slice(0, 3)} {room.code.slice(3)}
              </span>
            </div>
          )}
          <div className="relative mt-1 flex gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => act(() => shareApi.openRoom(channel))}
              className="h-10 flex-1 rounded-[10px] border border-[#FF3B3B]/55 bg-[#FF3B3B]/15 font-mbc text-[13.5px] text-white disabled:opacity-40"
            >
              {room ? "새 코드" : "코드 만들기"}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setAdding(adding === "menu" ? null : "menu")}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-white/12 font-mbc text-[13.5px] text-white/80 disabled:opacity-40"
            >
              <Plus size={14} />
              미디어 추가
            </button>
            {adding === "menu" && (
              <div className="absolute bottom-12 right-0 z-20 flex w-[160px] flex-col rounded-xl border border-white/10 bg-[#161618] p-1 shadow-[0_18px_40px_-10px_rgba(0,0,0,0.85)]">
                {(
                  [
                    ["file", "파일함"],
                    ["youtube", "유튜브 링크"],
                    ["timer", "타이머"],
                  ] as const
                ).map(([k, t]) => (
                  <button key={k} type="button" onClick={() => setAdding(k)} className="rounded-lg px-3 py-2 text-left font-pretendard text-sm text-white/80 hover:bg-white/[0.08] hover:text-white">
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 배치 · 송출 화면 · 칸별 소리 */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2" data-tour="switch.layout">
            {LAYOUTS.map((l) => (
              <button
                key={l.key}
                type="button"
                disabled={disabled}
                aria-pressed={view.layout === l.key}
                onClick={() => push({ ...view, layout: l.key })}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-[11px] border pl-2.5 pr-3.5 font-mbc text-sm transition-colors disabled:opacity-40",
                  view.layout === l.key ? "border-[#FF3B3B]/70 bg-[#FF3B3B]/13 text-white" : "border-white/10 bg-white/[0.04] text-white/70 hover:text-white",
                )}
              >
                <LayoutIcon k={l.key} />
                {l.label}
              </button>
            ))}
            <span className="ml-auto" />
            {onAir ? (
              <span className="flex items-center gap-2 rounded-lg border border-[#FF3B3B]/45 bg-[#FF3B3B]/12 px-3 py-1.5 font-orbitron text-[11px] font-bold tracking-[0.16em] text-white">
                <span className="h-[7px] w-[7px] rounded-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" />
                ON AIR · CH{channel}
              </span>
            ) : (
              <NeonButton disabled={disabled} onClick={() => push(view)} icon={<Send />}>
                이대로 송출
              </NeonButton>
            )}
          </div>

          <Program layout={view.layout} slots={slots} byId={byId} selected={selected} onPick={setSel} />

          <div className="grid shrink-0 gap-2 rounded-[20px] border border-white/[0.08] bg-[rgba(14,14,17,0.72)] p-3 backdrop-blur-md lg:grid-cols-2" data-tour="switch.audio">
            {slots.slice(0, count).map((s, i) => (
              <div
                key={i}
                onClick={() => setSel(i)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5",
                  i === selected ? "bg-[#FF3B3B]/[0.08] outline outline-1 outline-[#FF3B3B]/40" : "bg-white/[0.035]",
                )}
              >
                <span className="w-4 font-orbitron text-[13px] font-bold text-white/55">{i + 1}</span>
                <span className={cn("w-[120px] truncate font-pretendard text-sm font-semibold", s.source ? "text-white" : "text-white/35")}>
                  {s.source?.name ?? "비어 있음"}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={s.mute}
                  aria-label={s.mute ? `${i + 1}번 소리 켜기` : `${i + 1}번 음소거`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlot(i, { mute: !s.mute });
                  }}
                  className={cn(
                    "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border disabled:opacity-40",
                    s.mute ? "border-[#FF3B3B]/55 bg-[#FF3B3B]/14 text-[#ff6b6b]" : "border-white/14 text-white",
                  )}
                >
                  {s.mute ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <Fader value={s.volume} dim={s.mute} label={`${i + 1}번 볼륨`} onChange={(v) => !disabled && setSlot(i, { volume: v }, 250)} />
                <span className={cn("w-11 text-right font-orbitron text-[13px] font-semibold tabular-nums", s.mute && "text-white/30")}>{s.volume}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {adding === "file" && (
        <MediaSelectModal
          onClose={() => setAdding(null)}
          onSelect={(f) => {
            if (f.type !== "video" && f.type !== "image") {
              toast.error("영상·사진만 넣을 수 있어요");
              return;
            }
            addSource({ kind: f.type, url: f.fileUrl, fileId: f.id, name: f.fileName });
          }}
        />
      )}
      <InputModal
        isOpen={adding === "youtube"}
        onClose={() => setAdding(null)}
        title="유튜브 링크"
        placeholder="https://youtu.be/…"
        confirmText="추가"
        onConfirm={async (v: string) => {
          const id = parseYouTubeId(v);
          if (!id) {
            toast.error("유튜브 주소가 아니에요");
            return;
          }
          addSource({ kind: "youtube", videoId: id, name: `youtu.be/${id}` });
        }}
      />
      {adding === "timer" && (
        <TimerAddModal
          onClose={() => setAdding(null)}
          onAdd={(durationSec, label) => {
            const p = (n: number) => String(n).padStart(2, "0");
            const t = `${Math.floor(durationSec / 3600) ? `${Math.floor(durationSec / 3600)}:` : ""}${p(Math.floor((durationSec % 3600) / 60))}:${p(durationSec % 60)}`;
            addSource({ kind: "timer", durationSec, mode: "down", label, name: label || `${t} 타이머` });
          }}
        />
      )}
    </div>
  );
}

/** 송출 화면 — 배치대로 칸을 그리고, 누르면 그 칸을 고른다 */
function Program({
  layout,
  slots,
  byId,
  selected,
  onPick,
}: {
  layout: SwitchLayout;
  slots: SwitchSlot[];
  byId: Map<string, ShareRequest>;
  selected: number;
  onPick: (i: number) => void;
}) {
  const cell = (i: number, cls: string, style?: React.CSSProperties) => {
    const s = slots[i];
    return (
      <button
        key={i}
        type="button"
        onClick={() => onPick(i)}
        aria-pressed={selected === i}
        className={cn("overflow-hidden bg-[#0b0b0d] text-left", cls)}
        style={style}
      >
        <SlotPreview source={s.source} startedAt={s.startedAt} share={s.source?.kind === "share" ? byId.get(s.source.id) : undefined} />
        {!s.source && (
          <span className="absolute inset-0 flex items-center justify-center font-pretendard text-[13px] text-white/30">비어 있음</span>
        )}
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 rounded-[5px] bg-black/72 px-1.5 py-0.5 font-pretendard text-[11px] font-semibold text-white">
          <span className="font-orbitron text-[10px] text-white/60">{i + 1}</span>
          {s.source?.name ?? ""}
          {s.source && s.mute ? <VolumeX size={11} className="text-[#ff6b6b]" /> : null}
        </span>
        {selected === i && <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_3px_#FF3B3B]" />}
      </button>
    );
  };
  return (
    // 높이를 화면에 맞춰 묶는다 — 4분할 소리 줄(두 줄)까지 한 화면에 보이게 (md 이상)
    <div
      className="relative aspect-video w-full shrink-0 overflow-hidden rounded-[14px] border border-white/10 bg-black md:max-w-[calc((100dvh_-_400px)*16/9)]"
      data-tour="switch.program"
    >
      <SwitchGrid layout={layout} cell={cell} />
    </div>
  );
}

/** 타이머 추가 — 이름과 시·분·초 휠 */
function TimerAddModal({ onClose, onAdd }: { onClose: () => void; onAdd: (durationSec: number, label: string) => void }) {
  const [sec, setSec] = useState(300);
  const [label, setLabel] = useState("");
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="absolute inset-0" onClick={onClose} />
        <div className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1C] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
            <h2 className="font-mbc text-lg text-white">타이머 추가</h2>
            <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="flex flex-col items-center gap-4 p-6">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 40))}
              placeholder="질문 시간"
              className="h-11 w-full rounded-xl border border-white/10 bg-[#141414] px-4 font-pretendard text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
            />
            <DurationWheel value={sec} onChange={setSec} maxHours={6} />
            <div className="flex w-full gap-3">
              <button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border border-white/10 bg-white/5 font-mbc text-white/70 hover:bg-white/10">
                취소
              </button>
              <button
                type="button"
                disabled={sec <= 0}
                onClick={() => onAdd(sec, label.trim())}
                className="h-12 flex-1 rounded-xl border border-[#FF3B3B]/60 bg-[#FF3B3B]/25 font-mbc text-white hover:bg-[#FF3B3B]/35 disabled:opacity-40"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
