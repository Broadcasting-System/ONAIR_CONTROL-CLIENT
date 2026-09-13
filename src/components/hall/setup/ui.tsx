"use client";

import type { ReactNode } from "react";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionTestResult } from "@/types/hall";

/** 믹서 현장 세팅 화면에서 같이 쓰는 작은 부품들 */

export const inputCls =
  "h-10 min-w-0 rounded-lg border bg-[#141414] px-3 font-pretendard text-sm text-white placeholder:text-white/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40";
export const okBorder = "border-white/10 focus:border-white/30";
export const badBorder = "border-red-500/60 focus:border-red-400";

/** 한 덩어리 설정 카드 */
export function Card({
  title,
  hint,
  action,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-black/30 p-5", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="font-mbc text-lg text-white">{title}</h3>}
            {hint && <p className="mt-0.5 font-pretendard text-[13px] text-white/40">{hint}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** 이름표 + 입력 칸 */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="font-mbc text-[13px] text-white/55">{label}</span>
      {children}
      {hint && <span className="font-pretendard text-xs text-white/30">{hint}</span>}
    </div>
  );
}

/** 여러 개 중 하나를 고르는 카드 (라디오 대신) */
export function OptionCard({
  selected,
  onClick,
  title,
  hint,
  badge,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        selected
          ? "border-[#FF3B3B]/55 bg-[#FF3B3B]/10 shadow-[0_0_18px_-8px_#FF3B3B]"
          : "border-white/10 bg-white/[0.02] enabled:hover:bg-white/[0.06]",
      )}
    >
      <span className="flex w-full items-center gap-2">
        <span
          className={cn(
            "h-3.5 w-3.5 shrink-0 rounded-full border-2",
            selected ? "border-[#FF3B3B] bg-[#FF3B3B] shadow-[inset_0_0_0_2px_#1a1a1a]" : "border-white/25",
          )}
        />
        <span className={cn("font-mbc text-[15px]", selected ? "text-white" : "text-white/75")}>{title}</span>
        {badge && (
          <span className="ml-auto rounded bg-white/10 px-1.5 py-px font-pretendard text-[10px] text-white/55">
            {badge}
          </span>
        )}
      </span>
      {hint && <span className="pl-[22px] font-pretendard text-xs leading-relaxed text-white/40">{hint}</span>}
    </button>
  );
}

/** 평평한 버튼 (광택 없는 새 스타일) */
export function ActionButton({
  onClick,
  children,
  tone = "default",
  disabled,
  busy,
  icon,
  title,
  className,
}: {
  onClick: () => void;
  children?: ReactNode;
  tone?: "default" | "primary" | "ghost";
  disabled?: boolean;
  busy?: boolean;
  icon?: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className={cn(
        "flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-4 font-mbc text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        tone === "primary" && "border-[#FF3B3B]/60 bg-[#FF3B3B]/20 text-white enabled:hover:bg-[#FF3B3B]/30",
        tone === "default" &&
          "border-white/10 bg-white/[0.04] text-white/75 enabled:hover:bg-white/10 enabled:hover:text-white",
        tone === "ghost" && "border-transparent text-white/55 enabled:hover:bg-white/[0.06] enabled:hover:text-white",
        className,
      )}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/** 켜고 끄는 스위치 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 font-pretendard text-sm text-white/70 disabled:opacity-40"
    >
      <span className={cn("relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors", checked ? "bg-[#00FF57]/55" : "bg-white/15")}>
        <span
          className={cn("absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all", checked ? "left-[19px]" : "left-[3px]")}
        />
      </span>
      {label}
    </button>
  );
}

/** 작은 상태 표시 */
export function Badge({ tone, children }: { tone: "good" | "warn" | "off"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 font-pretendard text-[11px]",
        tone === "good" && "bg-[#00FF57]/12 text-[#9dffc1]",
        tone === "warn" && "bg-amber-400/12 text-amber-200",
        tone === "off" && "bg-white/[0.06] text-white/45",
      )}
    >
      {children}
    </span>
  );
}

/** 연결 시험 결과 — 단계별로 통과/막힘과 할 일 */
export function TestResults({ result }: { result: ConnectionTestResult }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4",
        result.ok ? "border-[#00FF57]/30 bg-[#00FF57]/[0.05]" : "border-amber-400/30 bg-amber-400/[0.05]",
      )}
    >
      <p className={cn("font-mbc text-sm", result.ok ? "text-[#9dffc1]" : "text-amber-200")}>
        {result.ok ? "모두 통과 — 저장하면 바로 쓸 수 있어요" : "막힌 곳이 있어요"}
      </p>
      <ol className="flex flex-col gap-2.5">
        {result.steps.map((s) => (
          <li key={s.key} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                s.ok ? "bg-[#00FF57]/20 text-[#00FF57]" : "bg-red-500/20 text-red-300",
              )}
            >
              {s.ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
            </span>
            <div className="min-w-0">
              <p className="font-mbc text-sm text-white">
                {s.label}
                <span className="ml-2 break-all font-pretendard text-xs text-white/45">{s.detail}</span>
              </p>
              {!s.ok && s.hint && <p className="mt-0.5 font-pretendard text-xs text-amber-200/85">→ {s.hint}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 표 머리 칸 */
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cn("font-orbitron text-[10px] uppercase tracking-[0.14em] text-white/35", className)}>
      {children}
    </span>
  );
}
