"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** 모바일 시안 A (글래스 카드) 공용 조각 */

export function MobileHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="mb-4 mt-1 flex items-center justify-between">
      <h1 className="font-mbc text-[26px] leading-none text-white">{title}</h1>
      {right}
    </header>
  );
}

export function GlassCard({
  children,
  className,
  href,
  tour,
}: {
  children: ReactNode;
  className?: string;
  href?: string;
  tour?: string;
}) {
  const cls = cn(
    "block rounded-[20px] border border-white/[0.09] bg-white/[0.045] px-4 py-3.5 backdrop-blur-md",
    href && "transition-colors active:bg-white/[0.08]",
    className,
  );
  return href ? (
    <Link href={href} className={cls} data-tour={tour}>
      {children}
    </Link>
  ) : (
    <div className={cls} data-tour={tour}>
      {children}
    </div>
  );
}

export function SectionLabel({ children, href }: { children: ReactNode; href?: string }) {
  const body = (
    <span className="flex items-center gap-1 font-orbitron text-[11px] tracking-[0.25em] text-white/35">
      {children}
      {href && <ChevronRight size={14} className="text-white/35" />}
    </span>
  );
  return href ? (
    <Link href={href} className="mb-2 mt-4 flex w-fit py-1">
      {body}
    </Link>
  ) : (
    <div className="mb-2 mt-4">{body}</div>
  );
}

export function Chip({
  children,
  active,
  danger,
  disabled,
  onClick,
  tour,
}: {
  children: ReactNode;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  tour?: string;
}) {
  return (
    <button
      type="button"
      data-tour={tour}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3.5 py-2 font-pretendard text-[14px] font-semibold transition-colors disabled:opacity-40",
        active
          ? "border-white bg-white text-black"
          : "border-white/10 bg-white/[0.06] text-white active:bg-white/[0.12]",
        danger && !active && "text-[#FF6B6B]",
        danger && active && "border-[#FF3B3B] bg-[#FF3B3B] text-white",
      )}
    >
      {children}
    </button>
  );
}

export function Dot({ ok }: { ok: boolean | null }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        ok === null ? "bg-white/25" : ok ? "bg-[#3ddc84]" : "bg-[#FF3B3B]",
      )}
    />
  );
}

export function KV({ k, v, align }: { k: ReactNode; v: ReactNode; align?: "right" }) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <p className="font-pretendard text-[12px] text-white/50">{k}</p>
      <p className="mt-0.5 truncate font-pretendard text-[16px] font-semibold text-white">{v}</p>
    </div>
  );
}

export function fmtElapsed(s: number) {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
