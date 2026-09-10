"use client";

import { cn } from "@/lib/utils";
import type { HallSummary } from "@/types/hall";

/** 공간 선택 (미디어 송출의 채널 버튼과 같은 모양) */
export function HallSwitcher({
  halls,
  value,
  onChange,
}: {
  halls: HallSummary[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {halls.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => onChange(h.id)}
          className={cn(
            "flex h-9 items-center rounded-xl border px-4 font-mbc text-sm transition-all",
            value === h.id
              ? "border-red-400/50 bg-red-400/15 text-white"
              : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/5",
          )}
        >
          {h.name}
        </button>
      ))}
    </div>
  );
}

/** 연결 상태 표시 */
export function StatusChip({ tone, label }: { tone: "good" | "warn" | "off"; label: string }) {
  return (
    <span className="flex h-9 items-center gap-2 rounded-xl bg-black/40 px-3.5 font-orbitron text-[11px] uppercase tracking-[0.12em] text-white/70">
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          tone === "good" && "bg-[#00FF57] shadow-[0_0_8px_#00FF57]",
          tone === "warn" && "bg-[#FFD600] shadow-[0_0_8px_#FFD600]",
          tone === "off" && "bg-[#585858]",
        )}
      />
      {label}
    </span>
  );
}

/** 행사 중 실수로 건드리지 않도록 조작을 막는 스위치 */
export function LockToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 font-mbc text-sm text-white/55 hover:text-white/80"
    >
      <span
        className={cn(
          "relative h-[22px] w-[38px] rounded-full transition-colors",
          checked ? "bg-red-400/70" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all",
            checked ? "left-[19px]" : "left-[3px]",
          )}
        />
      </span>
      조작 잠금
    </button>
  );
}

/** 섹션 패널 (메인 세팅과 같은 반투명 카드) */
export function Panel({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[24px] border border-sidebar-border bg-sidebar p-7 shadow-2xl backdrop-blur-md",
        className,
      )}
    >
      <div className="mb-4 flex items-baseline gap-3">
        <h3 className="font-mbc text-2xl text-white">{title}</h3>
        {hint && <span className="font-pretendard text-[13px] text-white/40">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** 장비 미연결·권한 부족 등 안내 줄 */
export function Notice({ tone = "warn", children }: { tone?: "warn" | "info"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-5 py-3 font-pretendard text-sm",
        tone === "warn"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100/90"
          : "border-white/10 bg-white/[0.03] text-white/60",
      )}
    >
      {children}
    </div>
  );
}
