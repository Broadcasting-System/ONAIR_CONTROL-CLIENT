"use client";

import { cn } from "@/lib/utils";

type StatusType = "on" | "off" | "good" | "error";

interface StatusCardProps {
  label: string;
  status: StatusType;
  width?: string | number;
  height?: string | number;
  onClick?: () => void;
}

const statusConfig: Record<StatusType, { color: string; text: string }> = {
  on: { color: "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]", text: "ON" },
  off: { color: "bg-zinc-600", text: "OFF" },
  good: { color: "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]", text: "GOOD" },
  error: { color: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]", text: "ERROR" },
};

export default function StatusCard({
  label,
  status,
  width = "100%",
  height = "auto",
  onClick,
}: StatusCardProps) {
  const config = statusConfig[status];

  return (
    <div
      onClick={onClick}
      style={{ width, height }}
      className={cn(
        "flex cursor-pointer flex-col justify-between rounded-xl border border-white/5 bg-[#1C1C1C] p-6 transition-all hover:bg-white/5",
        "backdrop-blur-sm"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn("h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]", config.color)} />
        <span className="font-mbc text-sm font-medium uppercase tracking-wider text-white/50">
          {config.text}
        </span>
      </div>
      <div className="mt-4 text-xl font-bold font-pretendard text-white leading-tight">{label}</div>
    </div>
  );
}
