import { Fragment } from "react";
import { DayType } from "@/types/time";
import { cn } from "@/lib/utils";

interface DayItem {
  label: string;
  value: DayType;
}

interface DaySelectorProps {
  days: DayItem[];
  activeDay: DayType;
  /** 오늘 요일 (주말이면 null) — 칸 아래 빨간 점 */
  today?: DayType | null;
  onSelect: (day: DayType) => void;
  className?: string;
}

/** 월 화 수 목 금 | 특별 */
export default function DaySelector({ days, activeDay, today, onSelect, className }: DaySelectorProps) {
  return (
    <div data-tour="time.days" className={cn("flex items-center gap-1.5", className)}>
      {days.map((day) => {
        const on = day.value === activeDay;
        const special = day.value === "P";
        return (
          <Fragment key={day.value}>
            {special && <span className="mx-1 h-6 w-px shrink-0 bg-white/[0.12] md:mx-1.5" />}
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(day.value)}
              className={cn(
                "relative flex h-11 items-center justify-center rounded-[11px] border font-mbc text-[15px] transition-colors md:h-10",
                special ? "shrink-0 px-3.5" : "min-w-0 flex-1 md:w-[46px] md:flex-none",
                on
                  ? "border-white bg-white text-[#0b0b0d]"
                  : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white",
              )}
            >
              {day.label}
              {day.value === today && (
                <span className="absolute bottom-[5px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#FF3B3B]" />
              )}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
