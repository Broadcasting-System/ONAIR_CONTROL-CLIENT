"use client";

import type { ReactNode } from "react";
import { Bell, Check, Clock, Megaphone, Mic, MonitorPlay, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusText, type Kind, type TeacherRequest, type Tier } from "@/lib/teacherRequests";

/** 선생님 요청 화면 공용 조각 — 색은 흰·회색과 ONAIR 빨강 하나만. 상태는 색 대신 아이콘·글자로 */

export function KindIcon({ kind, size = 18 }: { kind: Kind; size?: number }) {
  if (kind === "announce") return <Megaphone size={size} />;
  if (kind === "media") return <MonitorPlay size={size} />;
  if (kind === "event") return <Mic size={size} />;
  return <Bell size={size} />;
}

export function StatusPill({ r, big }: { r: TeacherRequest; big?: boolean }) {
  const text = statusText(r);
  const icon =
    r.status === "new" ? <Clock size={big ? 14 : 12} /> : r.status === "rejected" || r.status === "canceled" ? <X size={big ? 14 : 12} /> : <Check size={big ? 14 : 12} />;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-pretendard font-bold",
        big ? "px-3 py-1.5 text-[13.5px]" : "px-2.5 py-1 text-[12px]",
        r.status === "accepted" && "bg-white text-[#0a0a0c]",
        r.status === "new" && "border border-white/25 text-white/80",
        (r.status === "done" || r.status === "rejected" || r.status === "canceled") && "bg-white/[0.07] text-white/50",
      )}
    >
      {icon}
      {text}
    </span>
  );
}

/** 방송부 쪽 '새 요청' 표시 — 빨강은 여기에만 */
export function NewDot({ label = "새 요청" }: { label?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-pretendard text-[12.5px] font-bold text-white">
      <span className="h-2 w-2 rounded-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" />
      {label}
    </span>
  );
}

export function TierChip({ tier, label }: { tier: Tier; label?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-white/15 px-2 py-0.5 font-pretendard text-[12px] font-bold text-white/70">
      {label ?? { general: "일반 교사", lead: "부장·학년부", admin: "교무·관리자" }[tier]}
    </span>
  );
}

export function Glass({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[22px] border border-white/[0.09] bg-white/[0.045] backdrop-blur-md", className)}>
      {children}
    </div>
  );
}

export function FieldLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 font-pretendard text-[14px] font-bold text-white/65">
      <span>{children}</span>
      {right}
    </div>
  );
}

export const inputCls =
  "h-[50px] w-full rounded-xl border border-white/[0.12] bg-[#0c0d0f] px-4 font-pretendard text-[16px] text-white shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)] outline-none placeholder:text-white/25 focus:border-[#FF3B3B]/70";

export function ChoiceChip({
  on,
  disabled,
  onClick,
  children,
}: {
  on?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 font-pretendard text-[14.5px] font-bold transition-colors",
        on ? "border-white bg-white text-[#0a0a0c]" : "border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]",
        disabled && "cursor-not-allowed border-white/5 bg-white/[0.02] text-white/25 hover:bg-white/[0.02]",
      )}
    >
      {children}
    </button>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; sub?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-[14px] bg-white/[0.06] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-[10px] px-2 py-2.5 text-center font-pretendard text-[14.5px] font-bold transition-colors",
            value === o.value ? "bg-white text-[#0a0a0c]" : "text-white/60 hover:text-white",
            o.disabled && "cursor-not-allowed text-white/20 hover:text-white/20",
          )}
        >
          {o.label}
          {o.sub ? <small className="block text-[12px] font-medium opacity-70">{o.sub}</small> : null}
        </button>
      ))}
    </div>
  );
}

export const redBtn =
  "inline-flex h-[52px] items-center justify-center gap-2 rounded-[13px] border border-black bg-[linear-gradient(180deg,#ff5a52,#d9201e)] px-6 font-pretendard text-[16.5px] font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_3px_0_#5c0b0b,0_0_22px_rgba(255,59,59,0.3)] active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40";
export const ghostBtn =
  "inline-flex h-[52px] items-center justify-center gap-2 rounded-[13px] border border-white/15 bg-[#0e0e10]/70 px-6 font-pretendard text-[16px] font-bold text-white hover:bg-white/[0.06] disabled:opacity-40";
