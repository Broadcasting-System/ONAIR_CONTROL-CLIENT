"use client";

import { cn } from "@/lib/utils";
import type { DeviceGroup } from "@/constants/deviceBell";

interface DeviceGroupPickerProps {
  /** 장비 그룹 목록 (서버 config/lnb_timer.json) */
  groups: DeviceGroup[];
  value: number | undefined;
  onChange: (no: number) => void;
  className?: string;
}

/** 장비 시보 장소 — 장비에 정해 둔 그룹 하나 */
export default function DeviceGroupPicker({ groups, value, onChange, className }: DeviceGroupPickerProps) {
  return (
    <div
      data-tour="time.editor.device-group"
      className={cn("flex flex-col gap-2.5 rounded-2xl border border-white/[0.08] bg-black/25 px-3 py-3 md:px-3.5", className)}
    >
      <div className="flex h-[30px] items-center gap-2">
        <span className="font-mbc text-[15px] text-white">장소</span>
      </div>
      <div className="grid grid-cols-2 gap-[6px] sm:grid-cols-4" role="radiogroup" aria-label="장비 그룹">
        {groups.map((g) => {
          const on = g.no === value;
          return (
            <button
              key={g.no}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(g.no)}
              className={cn(
                "flex h-11 min-w-0 items-center gap-2 rounded-[10px] border px-2.5 text-left transition-colors md:h-10",
                on ? "border-white bg-white text-[#0b0b0d]" : "border-white/[0.1] bg-white/[0.02] text-white/70 hover:border-white/25 hover:text-white",
              )}
            >
              <span className={cn("w-[18px] shrink-0 font-orbitron text-[11px] font-semibold tabular-nums", on ? "text-black/45" : "text-white/30")}>
                {g.no}
              </span>
              <span className={cn("truncate font-pretendard text-[13.5px]", on ? "font-semibold" : "font-medium")}>{g.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
