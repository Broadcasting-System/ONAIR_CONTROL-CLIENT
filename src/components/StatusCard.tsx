"use client";

import { cn } from "@/lib/utils";

interface StatusCardProps {
  label: string;
  status: "on" | "off" | "good" | "caution" | "critical" | "error" | "normal";
  width?: string | number;
  height?: string | number;
  onClick?: () => void;
  variant?: "network" | "speaker";
  className?: string;
}

const statusConfig = {
  on: { color: "bg-[#0075FF] shadow-[0_0_10px_#0075FF]", text: "ON" },
  off: { color: "bg-[#585858]", text: "OFF" },
  good: { color: "bg-[#00FF57] shadow-[0_0_10px_#00FF57]", text: "GOOD" },
  normal: { color: "bg-[#00FF57] shadow-[0_0_10px_#00FF57]", text: "GOOD" },
  caution: { color: "bg-[#FFD600] shadow-[0_0_10px_#FFD600]", text: "CHECK" },
  critical: { color: "bg-[#FF0000] shadow-[0_0_10px_#FF0000]", text: "ERROR" },
  error: { color: "bg-[#FF0000] shadow-[0_0_10px_#FF0000]", text: "ERROR" },
};

export default function StatusCard({
  label,
  status,
  width,
  height,
  onClick,
  variant = "network",
  className,
}: StatusCardProps) {
  const config = statusConfig[status] || statusConfig.off;
  const isNetwork = variant === "network";

  return (
    <div
      onClick={onClick}
      style={{ width, height }}
      className={cn(
        "flex cursor-pointer flex-col justify-between rounded-[8px] border-none bg-black/40 transition-all hover:bg-white/10",
        isNetwork ? "h-[92px] px-[7px] py-[4px]" : "h-[53px] px-[7px] py-[4px]",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "rounded-full",
            isNetwork ? "h-[15px] w-[15px]" : "h-[11px] w-[11px]",
            config.color
          )}
        />
        <span
          className={cn(
            "font-orbitron font-normal leading-none text-white",
            isNetwork ? "text-[18px]" : "text-[10px]"
          )}
        >
          {config.text}
        </span>
      </div>

      <div className={cn(
        "w-full text-center font-wooju leading-none text-white",
        isNetwork ? "text-[40px]" : "text-[22px]"
      )}>
        {label}
      </div>
    </div>
  );
}
