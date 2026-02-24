import { DayType } from "@/types/time";
import { cn } from "@/lib/utils";

interface DaySelectorProps {
  days: DayType[];
  activeDay: DayType;
  onSelect: (day: DayType) => void;
}

export default function DaySelector({ days, activeDay, onSelect }: DaySelectorProps) {
  return (
    <div className="flex gap-[30px]">
      {days.map((day) => {
        const isActive = day === activeDay;
        return (
          <button
            key={day}
            onClick={() => onSelect(day)}
            className={cn(
              "flex items-center justify-center w-[55px] h-[55px] rounded-[7px] transition-all",
              isActive
                ? "bg-[rgba(32,32,32,0.8)] border border-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                : "bg-[rgba(32,32,32,0.6)] border border-[rgba(255,255,255,0.1)] text-white/50 hover:bg-[rgba(32,32,32,0.7)] hover:text-white/80"
            )}
          >
            <span className="font-orbitron font-normal text-[24px] leading-[0] mt-1 whitespace-pre-wrap">
              {day}
            </span>
          </button>
        );
      })}
    </div>
  );
}
