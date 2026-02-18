"use client";

import { cn } from "@/lib/utils";

interface ScheduleItemProps {
  title: string;
  date: string;
  day: string;
  isActive?: boolean;
  onClick?: () => void;
}

export default function ScheduleItem({
  title,
  date,
  day,
  isActive = false,
  onClick,
}: ScheduleItemProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-[#1C1C1C] p-5 transition-all",
        isActive
          ? "border-white/20 bg-white/10 shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]"
          : "hover:bg-white/5",
      )}
    >
      <span className={cn("text-lg font-bold font-pretendard", isActive ? "text-white" : "text-white/90")}>{title}</span>
      <div className="text-right">
        <div className="text-sm font-medium text-white/50 font-mbc mb-0.5">{date}</div>
        <div className="text-xs text-white/30 font-pretendard">{day}</div>
      </div>
    </div>
  );
}
