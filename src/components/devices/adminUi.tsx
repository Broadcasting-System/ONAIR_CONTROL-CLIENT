"use client";

import { useState, type ReactNode } from "react";
import { Popover as P } from "radix-ui";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/* 관리 탭(스피커 매핑·Cloudflare·기기)이 같이 쓰는 작은 조각 — 시안 Desktop/ONAIR-관리-시안 */

/** 판 (시안 .panel) */
export const adminPanel = "rounded-[20px] border border-white/[0.08] bg-[rgba(14,14,17,0.74)] backdrop-blur-[10px]";

/** 입력 칸 (시안 .fieldbox) */
export const adminField =
  "h-11 min-w-0 rounded-[12px] border border-white/10 bg-[#0c0d0f] px-3.5 font-pretendard text-base font-medium text-white outline-none placeholder:text-white/30 focus:border-white/30 md:text-[15px]";

/** 고르기 칩 (시안 .chip / .pk) — on 이면 흰 바탕 */
export function chipCls(on: boolean, extra?: string) {
  return cn(
    "inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-[9px] border px-3 font-pretendard text-[13.5px] font-medium transition-colors md:h-8",
    on ? "border-white bg-white text-[#0b0b0d]" : "border-white/10 text-white/70 hover:border-white/30 hover:text-white",
    extra,
  );
}

/** 상태 점 — 정상 흰 점 · 문제 빨간 점 · 모름 흐린 점 */
export function StatusDot({ ok, className }: { ok: boolean | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-[7px] w-[7px] shrink-0 rounded-full",
        ok === true && "bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]",
        ok === false && "bg-[#ff3b3b] shadow-[0_0_7px_#ff3b3b]",
        ok === null && "bg-white/30",
        className,
      )}
    />
  );
}

export type RowMenuItem = { label: string; onClick: () => void; danger?: boolean; disabled?: boolean; icon?: ReactNode };

/** ⋯ 메뉴 */
export function RowMenu({
  items,
  label,
  tour,
  className,
  children,
}: {
  items: RowMenuItem[];
  label: string;
  tour?: string;
  className?: string;
  /** 메뉴 아래에 붙일 것 (예: 입력 칸) */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger
        data-tour={tour}
        aria-label={label}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white data-[state=open]:bg-white/[0.06] data-[state=open]:text-white md:h-9 md:w-9",
          className,
        )}
      >
        <MoreHorizontal size={18} />
      </P.Trigger>
      <P.Portal>
        <P.Content
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-[900] flex min-w-[200px] max-w-[calc(100vw-24px)] flex-col rounded-[16px] border border-white/[0.12] bg-[#141416] p-1.5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.65)] outline-none"
        >
          {items.map((x) => (
            <button
              key={x.label}
              type="button"
              disabled={x.disabled}
              onClick={() => {
                setOpen(false);
                x.onClick();
              }}
              className={cn(
                "flex h-11 items-center gap-2.5 rounded-[10px] px-3 text-left font-mbc text-[14px] transition-colors hover:bg-white/[0.07] disabled:opacity-35 disabled:hover:bg-transparent md:h-9 md:text-[13.5px]",
                x.danger ? "text-[#ff8a8a]" : "text-white/80 hover:text-white",
              )}
            >
              {x.icon}
              {x.label}
            </button>
          ))}
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
