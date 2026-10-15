"use client";

import { useState, type ReactNode } from "react";
import { Popover as P } from "radix-ui";
import { ClipboardPaste, Copy, CopyPlus, Eraser, MoreHorizontal, Send } from "lucide-react";
import NeonButton from "@/components/common/NeonButton";
import Portal from "@/components/common/Portal";
import { DAYS, DAY_LABEL } from "@/constants/days";
import { DayType } from "@/types/time";
import { cn } from "@/lib/utils";

export const ghostBtn =
  "flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[11px] border border-white/[0.12] bg-white/[0.03] px-3.5 font-mbc text-[13.5px] text-white/75 transition-colors hover:text-white disabled:opacity-35 disabled:hover:text-white/75 md:h-[38px]";
export const redBtn =
  "flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[11px] border border-black bg-[linear-gradient(180deg,#ff5a52,#d9201e)] px-4 font-mbc text-[14px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_0_#5c0b0b] transition-opacity disabled:opacity-50 md:h-[38px]";
const popBox =
  "z-[900] rounded-[18px] border border-white/[0.12] bg-[#141416] p-3 text-white shadow-[0_24px_60px_rgba(0,0,0,0.65)] outline-none";

// ---------------------------------------------------------------- 확인 창 (흑백 + 빨강)

export function TimeConfirm({
  open,
  title,
  message,
  confirmText,
  danger,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmText: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[950] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal>
        <div className="absolute inset-0" onClick={onClose} />
        <div className="relative w-full max-w-[400px] rounded-[20px] border border-white/10 bg-[#141416] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)]">
          <h2 className="font-mbc text-[19px] text-white">{title}</h2>
          <div className="mt-2.5 whitespace-pre-line font-pretendard text-[14.5px] leading-relaxed text-white/70">{message}</div>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={onClose} className={cn(ghostBtn, "h-11 flex-1 md:h-11")}>
              취소
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={cn(
                "h-11 flex-1 rounded-[11px] font-mbc text-[14px]",
                danger ? "border border-[#FF3B3B]/60 bg-[#FF3B3B]/15 text-[#ff8a8a]" : "bg-white text-[#0b0b0d]",
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ---------------------------------------------------------------- 다른 요일에 복사

export function CopyDaysButton({
  activeDay,
  counts,
  onCopy,
  className,
}: {
  activeDay: DayType;
  /** 요일별 시보 수 */
  counts: Record<DayType, number>;
  onCopy: (targets: DayType[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<DayType[]>([]);
  const [confirm, setConfirm] = useState(false);
  const others = DAYS.filter((d) => d.value !== activeDay);
  const lost = targets.reduce((n, d) => n + (counts[d] ?? 0), 0);
  const names = targets.map((d) => DAY_LABEL[d]).join("·");

  const run = () => {
    onCopy(targets);
    setOpen(false);
  };

  return (
    <>
      <P.Root
        open={open}
        onOpenChange={(o) => {
          if (o) setTargets([]);
          setOpen(o);
        }}
      >
        <P.Trigger data-tour="time.copy-days" disabled={!counts[activeDay]} className={cn(ghostBtn, className)}>
          <CopyPlus size={14} />
          <span className="max-sm:hidden">다른 요일에 복사</span>
          <span className="sm:hidden">복사</span>
        </P.Trigger>
        <P.Portal>
          <P.Content side="bottom" align="end" sideOffset={8} collisionPadding={12} className={cn(popBox, "w-[290px] p-4")}>
            <p className="font-mbc text-[15px] text-white">
              {DAY_LABEL[activeDay]} 시보 {counts[activeDay]}개를 복사해요
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {others.map((d) => {
                const on = targets.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTargets(on ? targets.filter((x) => x !== d.value) : [...targets, d.value])}
                    className={cn(
                      "flex h-10 min-w-[44px] items-center justify-center rounded-[10px] border px-3 font-mbc text-[14px] transition-colors",
                      on ? "border-white bg-white text-[#0b0b0d]" : "border-white/[0.12] text-white/55 hover:text-white",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            {lost > 0 && (
              <p className="mt-3 font-pretendard text-[13px] text-[#ff8a8a]">{names}에 있던 시보 {lost}개는 지워져요</p>
            )}
            <button
              type="button"
              disabled={targets.length === 0}
              onClick={() => (lost > 0 ? setConfirm(true) : run())}
              className="mt-3 h-10 w-full rounded-[11px] bg-white font-mbc text-[14px] text-[#0b0b0d] disabled:opacity-35"
            >
              {targets.length ? `${names}에 복사` : "요일을 골라요"}
            </button>
          </P.Content>
        </P.Portal>
      </P.Root>
      <TimeConfirm
        open={confirm}
        title="덮어쓸까요?"
        message={`${names} 시보 ${lost}개가 지워지고 ${DAY_LABEL[activeDay]} 시보로 바뀌어요.`}
        confirmText="덮어쓰기"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={run}
      />
    </>
  );
}

// ---------------------------------------------------------------- ⋯ 메뉴

export function MoreMenu({
  canCopy,
  canPaste,
  onCopy,
  onPaste,
  onReset,
  className,
}: {
  canCopy: boolean;
  canPaste: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onReset: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const item =
    "flex h-11 w-full items-center gap-2.5 rounded-[10px] px-3 text-left font-mbc text-[14px] transition-colors hover:bg-white/[0.06] disabled:opacity-35 disabled:hover:bg-transparent md:h-10";
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger data-tour="time.more" aria-label="더 보기" className={cn(ghostBtn, "w-11 px-0 md:w-[38px]", className)}>
        <MoreHorizontal size={18} />
      </P.Trigger>
      <P.Portal>
        <P.Content side="bottom" align="end" sideOffset={8} collisionPadding={12} className={cn(popBox, "w-[200px] p-1.5")}>
          <button type="button" data-tour="time.copy" disabled={!canCopy} onClick={pick(onCopy)} className={cn(item, "text-white/85")}>
            <Copy size={15} className="text-white/50" />
            복사해 두기
          </button>
          <button type="button" data-tour="time.paste" disabled={!canPaste} onClick={pick(onPaste)} className={cn(item, "text-white/85")}>
            <ClipboardPaste size={15} className="text-white/50" />
            붙여넣기
          </button>
          <div className="mx-2 my-1 h-px bg-white/[0.08]" />
          <button type="button" data-tour="time.reset" disabled={!canCopy} onClick={pick(onReset)} className={cn(item, "text-[#ff8a8a]")}>
            <Eraser size={15} />
            이 요일 비우기
          </button>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

// ---------------------------------------------------------------- 적용하기

export function ApplyButtons({
  isLive,
  count,
  busy,
  onApply,
  className,
}: {
  /** 보고 있는 그룹이 울리는 그룹인지 */
  isLive: boolean;
  /** 안 보낸 시보 수 */
  count: number;
  busy: boolean;
  /** activate: 이 그룹을 울리는 그룹으로 */
  onApply: (activate: boolean) => void;
  className?: string;
}) {
  if (isLive)
    return (
      <NeonButton data-tour="time.send" disabled={busy} onClick={() => onApply(true)} icon={<Send />} count={count} className={className}>
        적용하기
      </NeonButton>
    );
  return (
    <div className={cn("flex gap-2", className)}>
      <button type="button" disabled={busy || count === 0} onClick={() => onApply(false)} className={ghostBtn}>
        저장만
      </button>
      <NeonButton data-tour="time.send" disabled={busy} onClick={() => onApply(true)} icon={<Send />} count={count} className="min-w-0 max-md:flex-1">
        이 시간표로 울리기
      </NeonButton>
    </div>
  );
}
