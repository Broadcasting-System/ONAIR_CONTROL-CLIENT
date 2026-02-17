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
        "flex w-full cursor-pointer items-center justify-between rounded-lg border border-white/5 bg-[#1A1A1A] p-4 transition-all",
        isActive
          ? "border-primary/50 bg-primary/10 shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]"
          : "hover:bg-white/5",
      )}
    >
      <span className="text-base font-bold text-white">{title}</span>
      <div className="text-right">
        <div className="text-xs font-medium text-white/70">{date}</div>
        <div className="text-xs text-white/50">{day}</div>
      </div>
    </div>
  );
}
