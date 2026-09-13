"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "@/components/common/Toast";
import { hallApi } from "@/lib/hallApi";
import { cn } from "@/lib/utils";
import type { MixerState } from "@/types/hall";
import { type Draft, type SceneRow, badPc, duplicates, move, nextKey } from "./draft";
import { ActionButton, Card, Th, badBorder, inputCls, okBorder } from "./ui";

const COLS = "grid-cols-[52px_96px_minmax(180px,1fr)_130px_140px_44px]";

/** ③ 씬 — 콘솔에 저장된 씬(Cue) 번호와 이름을 맞추고, 하나씩 불러 확인한다 */
export default function ScenesStep({
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
  const [trying, setTrying] = useState<number | null>(null);
  const hasScenes = state.capabilities.includes("scene");
  const canTry = state.connected && hasScenes && !configDirty;
  const tryHint = !state.connected
    ? "믹서가 연결되면 시험할 수 있어요"
    : !hasScenes
      ? "씬 전환은 USB-MIDI(강당 노트북)가 연결돼야 돼요"
      : configDirty
        ? "저장한 뒤 시험할 수 있어요"
        : "";

  const setScenes = (fn: (l: SceneRow[]) => SceneRow[]) => setDraft((d) => (d ? { ...d, scenes: fn(d.scenes) } : d));
  const patch = (i: number, p: Partial<SceneRow>) => setScenes((l) => l.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const dupPcs = duplicates(draft.scenes.map((s) => String(s.pc)));
  const bad = (pc: number) => badPc(pc) || dupPcs.has(String(pc));

  const add = () => {
    const pc = Math.min(128, Math.max(0, ...draft.scenes.map((s) => s.pc)) + 1);
    setScenes((l) => [...l, { key: nextKey(), pc, name: "", confirm: false }]);
  };

  const tryScene = async (pc: number) => {
    setTrying(pc);
    try {
      const r = await hallApi.tryScene(hallId, pc);
      toast.success(`'${r.scene}' 씬을 불렀어요. 콘솔 화면이 바뀌었는지 확인하세요.`);
      await qc.invalidateQueries({ queryKey: ["mixer", hallId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTrying(null);
    }
  };

  return (
    <Card
      title={`씬 ${draft.scenes.length}개`}
      hint="번호는 콘솔에 저장된 씬(Cue) 번호예요 · '확인'을 켜면 누를 때 한 번 더 물어요"
      action={
        <ActionButton icon={<Plus size={15} />} onClick={add} disabled={draft.scenes.length >= 128}>
          씬 추가
        </ActionButton>
      }
    >
      <div className="overflow-x-auto">
        <div className="flex min-w-[640px] flex-col gap-1.5">
          <div className={cn("grid items-center gap-2 px-2 pb-1", COLS)}>
            <Th>순서</Th>
            <Th>씬 번호</Th>
            <Th>이름</Th>
            <Th>누를 때 확인</Th>
            <Th>시험</Th>
            <Th />
          </div>

          {draft.scenes.length === 0 && (
            <p className="px-2 py-6 text-center font-pretendard text-sm text-white/30">씬이 없어요. ‘씬 추가’를 누르세요.</p>
          )}

          {draft.scenes.map((s, i) => {
            const now = state.currentScene === s.pc;
            return (
              <div
                key={s.key}
                className={cn(
                  "grid items-center gap-2 rounded-xl border px-2 py-2",
                  COLS,
                  now ? "border-red-400/35 bg-red-400/[0.07]" : "border-white/[0.07] bg-white/[0.025]",
                )}
              >
                <div className="flex">
                  <button
                    type="button"
                    aria-label="위로"
                    disabled={i === 0}
                    onClick={() => setScenes((l) => move(l, i, -1))}
                    className="flex h-9 w-8 items-center justify-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white disabled:opacity-20"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label="아래로"
                    disabled={i === draft.scenes.length - 1}
                    onClick={() => setScenes((l) => move(l, i, 1))}
                    className="flex h-9 w-8 items-center justify-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white disabled:opacity-20"
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={128}
                    value={Number.isFinite(s.pc) ? s.pc : ""}
                    aria-label={`${i + 1}번째 씬 번호`}
                    onChange={(e) => patch(i, { pc: Math.floor(Number(e.target.value)) })}
                    className={cn(inputCls, "w-[64px] px-2 text-center font-orbitron", bad(s.pc) ? badBorder : okBorder)}
                  />
                  {now && <span className="rounded bg-red-500 px-1 py-px font-orbitron text-[9px] text-white">NOW</span>}
                </div>
                <input
                  value={s.name}
                  maxLength={20}
                  placeholder="예: 졸업식"
                  aria-label={`씬 ${s.pc} 이름`}
                  onChange={(e) => patch(i, { name: e.target.value })}
                  className={cn(inputCls, s.name.trim() ? okBorder : badBorder)}
                />
                <label className="flex cursor-pointer items-center gap-2 font-pretendard text-sm text-white/60">
                  <input
                    type="checkbox"
                    checked={s.confirm}
                    onChange={(e) => patch(i, { confirm: e.target.checked })}
                    className="h-4 w-4 accent-red-400"
                  />
                  확인
                </label>
                <ActionButton
                  icon={<Play size={13} />}
                  busy={trying === s.pc}
                  disabled={!canTry || trying !== null}
                  title={tryHint || "콘솔을 이 씬으로 바꿔 봅니다 (방송부 알림은 안 보냄)"}
                  onClick={() => tryScene(s.pc)}
                  className="h-9 px-3"
                >
                  불러오기
                </ActionButton>
                <button
                  type="button"
                  aria-label={`씬 ${s.name || s.pc} 삭제`}
                  onClick={() => setScenes((l) => l.filter((_, j) => j !== i))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/45 hover:bg-white/10 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {dupPcs.size > 0 && <p className="font-pretendard text-xs text-red-300/85">같은 씬 번호가 두 번 있어요.</p>}
    </Card>
  );
}
