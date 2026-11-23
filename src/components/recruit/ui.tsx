"use client";

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";
import Portal from "@/components/common/Portal";
import { cn } from "@/lib/utils";

/** 모집 화면 공용 조각 — 시안 RecruitAdminBC4 의 .ghost · .ib · .tg · .key · .mdl */

/** 지금 시각 (ms) — 주기마다 다시 그린다. 서버 렌더와 어긋나지 않게 처음엔 0 */
export function useNow(every = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(t);
  }, [every]);
  return now;
}

export function GhostButton({
  size = "md",
  className,
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: "md" | "sm" | "lg" }) {
  return (
    <button
      type={type}
      {...rest}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border font-pretendard font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        "border-white/10 bg-white/5 text-white/75 enabled:hover:border-white/20 enabled:hover:bg-white/[0.08] enabled:hover:text-white",
        size === "md" && "h-11 rounded-xl px-[18px] text-[16px]",
        size === "sm" && "h-9 rounded-[10px] px-3.5 text-[14px]",
        size === "lg" &&
          "h-[60px] rounded-2xl border-white/[0.14] bg-white/[0.04] px-[26px] text-[17px]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-white/65 transition-colors enabled:hover:bg-white/[0.06] enabled:hover:text-white disabled:opacity-30",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** 켜고 끄기 (흰 스위치) */
export function Switch({
  on,
  onChange,
  labelledBy,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  labelledBy?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-40",
        on ? "bg-white" : "bg-white/20",
      )}
    >
      <i
        className={cn(
          "absolute top-[3px] h-[18px] w-[18px] rounded-full transition-all",
          on ? "left-[19px] bg-[#0c0c0c]" : "left-[3px] bg-[#9a9a9a]",
        )}
      />
    </button>
  );
}

export function Led({ on }: { on?: boolean }) {
  return (
    <span
      className={cn(
        "h-[7px] w-[7px] shrink-0 rounded-full",
        on ? "bg-[#FF3B3B] shadow-[0_0_7px_#FF3B3B]" : "bg-[#585858]",
      )}
    />
  );
}

export type KeyTone = "plain" | "sel" | "on" | "dim" | "pass" | "ok";

/** 이름 칸 — 스피커 칸처럼 위에 작은 줄, 아래 이름 */
export function NameKey({
  top,
  name,
  sub,
  tone = "plain",
  selected,
  onClick,
}: {
  top: ReactNode;
  name: string;
  sub?: string;
  tone?: KeyTone;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex h-[60px] min-w-0 flex-col items-start justify-center gap-1 rounded-[10px] border bg-black/40 px-3 text-left font-pretendard text-[14px] text-white transition-[border-color,opacity,background-color]",
        "border-white/10 hover:border-white/25",
        tone === "on" && "border-[#FF3B3B]/70 bg-[#FF3B3B]/10 hover:border-[#FF3B3B]",
        tone === "pass" && "border-[#FF3B3B]/45",
        tone === "ok" && "border-white/45",
        tone === "dim" && "opacity-[0.32] hover:opacity-60",
        selected && "border-white/60 opacity-100 shadow-[0_0_0_1px_rgba(255,255,255,0.4)]",
      )}
    >
      <span className="flex max-w-full items-center gap-[7px] whitespace-nowrap text-[14px] text-white/50 tabular-nums">
        {top}
      </span>
      <span className="flex max-w-full items-baseline truncate font-mbc text-[16px] leading-[1.1]">
        <span className="truncate">{name}</span>
        {sub && (
          <span className="ml-1.5 font-pretendard text-[13px] text-white/55 tabular-nums">
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}

/** 반별 묶음 — '1반 9' 머리 + 이름 칸 격자 */
export function ClassGroup({
  label,
  count,
  cols = 6,
  children,
}: {
  label: string;
  count: number;
  cols?: 5 | 6;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 font-pretendard text-[15px]">
        <b className="font-bold text-white">{label}</b>
        <span className="text-white/55 tabular-nums">{count}</span>
      </div>
      <div
        className={cn(
          "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4",
          cols === 6 ? "xl:grid-cols-6" : "xl:grid-cols-5",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** 팝업 — 가운데 어두운 상자, MBC 제목 */
export function RecruitModal({
  title,
  label,
  width = 560,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  label: string;
  width?: number;
  onClose: () => void;
  children?: ReactNode;
  footer: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/[0.66] p-4">
        <div className="absolute inset-0" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          style={{ width }}
          className="relative flex max-h-[calc(100dvh-32px)] max-w-full flex-col overflow-y-auto rounded-2xl border border-white/[0.16] bg-[#151515] px-7 pb-6 pt-7 font-pretendard text-white shadow-[0_24px_60px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="font-mbc text-[22px] leading-[1.3]">{title}</span>
            <IconButton label="닫기" onClick={onClose} className="-mr-3 -mt-2 h-9 w-9">
              <X size={18} />
            </IconButton>
          </div>
          {children}
          <div className="mt-6 flex items-center justify-end gap-2.5">{footer}</div>
        </div>
      </div>
    </Portal>
  );
}

/** 팝업 안 한 줄 (왼쪽 이름, 오른쪽 값) */
export function ModalRow({
  label,
  children,
  htmlFor,
}: {
  label: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-4 border-t border-white/[0.08] last:border-b">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-white/55">
          {label}
        </label>
      ) : (
        <span className="text-white/55">{label}</span>
      )}
      <span className="flex items-center gap-2 tabular-nums">{children}</span>
    </div>
  );
}

/** 고르기 줄 (동그라미 + 글) */
export function RadioRow({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex h-[50px] w-full items-center gap-3.5 border-t border-white/[0.08] text-left font-pretendard text-[16px] last:border-b",
        on ? "text-white" : "text-white/75 hover:text-white",
      )}
    >
      <Ring on={on} />
      {children}
    </button>
  );
}

export function Ring({ on, dim }: { on?: boolean; dim?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px]",
        on ? "border-white" : "border-white/35",
        dim && "opacity-50",
      )}
    >
      {on && <i className="h-2.5 w-2.5 rounded-full bg-white" />}
    </span>
  );
}

/** 화면 가운데 한 줄 + 버튼 (빈 상태) */
export function EmptyCenter({ line, children }: { line: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-24 md:pb-[84px]">
      <span className="font-pretendard text-[20px] text-white/75">{line}</span>
      {children}
    </div>
  );
}

/** 오른쪽 상세 칸 줄 */
export function PaneRow({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[52px] items-center justify-between gap-4 border-t border-white/[0.08]",
        className,
      )}
    >
      <span className="text-white/55">{label}</span>
      <span className="min-w-0 text-right tabular-nums">{children}</span>
    </div>
  );
}
