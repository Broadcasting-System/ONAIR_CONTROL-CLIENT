import { DayType } from "@/types/time";
import { cn } from "@/lib/utils";

interface DayItem {
  label: string;
  value: DayType;
}

interface DaySelectorProps {
  days: DayItem[];
  activeDay: DayType;
  onSelect: (day: DayType) => void;
}

export default function DaySelector({ days, activeDay, onSelect }: DaySelectorProps) {
  return (
    <div className="flex gap-4">
      {days.map((day) => {
        const isActive = day.value === activeDay;
        return (
          <button
            key={day.value}
            onClick={() => onSelect(day.value)}
            className={cn(
              "flex items-center justify-center w-[58px] h-[58px] rounded-[6px] transition-all",
              isActive
                ? "bg-[#111] border-[1.5px] border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                : "bg-[#111] border border-white/20 text-white/40 hover:border-white/40 hover:text-white/80"
            )}
          >
            <span className="font-pretendard font-medium text-[22px]">
              {day.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
