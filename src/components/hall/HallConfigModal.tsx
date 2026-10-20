"use client";

import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Settings2, X } from "lucide-react";
import NeonButton from "@/components/common/NeonButton";
import Portal from "@/components/common/Portal";
import { toast } from "@/components/common/Toast";
import { hallApi } from "@/lib/hallApi";
import { cn } from "@/lib/utils";
import type { VideoMatrixState } from "@/types/hall";

/** 강당·홀 장비 설정용 창. 믹서는 전용 '현장 세팅' 화면(/mixer/setup)으로 옮겼고,
 *  여기에는 페이지 머리의 설정 버튼과 영상 매트릭스 입출력 이름 창이 남아 있다. */

/** 페이지 머리의 관리자용 '설정' 버튼 */
export function ConfigButton({
  label = "설정",
  onClick,
  tour,
}: {
  label?: string;
  onClick: () => void;
  /** CUE 튜토리얼 이름표 (data-tour) */
  tour?: string;
}) {
  return (
    <button
      data-tour={tour}
      type="button"
      onClick={onClick}
      className="flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3.5 font-mbc text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white md:h-9"
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

function Shell({
  title,
  onClose,
  onSave,
  saving,
  canSave,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Portal>
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1C] shadow-2xl",
          wide ? "max-w-[900px]" : "max-w-[760px]",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
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
            <NeonButton tone="white" onClick={onClose} className="w-full">
              취소
            </NeonButton>
          </div>
          <div className="flex-1">
            <NeonButton icon={<Check />} onClick={onSave} disabled={!canSave || saving} className="w-full">
              {saving ? "저장 중..." : "저장"}
            </NeonButton>
          </div>
        </div>
      </div>
    </div>
    </Portal>
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
      onClose={onClose}
      onSave={save}
      saving={saving}
      canSave={valid}
    >
      <div className="grid grid-cols-2 gap-8">
        {column("입력", "IN", inputs, setInputs)}
        {column("출력", "OUT", outputs, setOutputs)}
      </div>
    </Shell>
  );
}
