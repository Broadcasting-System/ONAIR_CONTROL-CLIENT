import { memo } from "react";
import { Bell } from "@/types/time";
import { cn } from "@/lib/utils";

interface BellCardProps {
  bell: Bell;
  isSelected: boolean;
  onClick: () => void;
}

const BellCard = memo(({ bell, isSelected, onClick }: BellCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-[334px] h-[74px] rounded-[8px] flex items-center justify-between px-[28px] transition-all relative overflow-hidden text-left",
        isSelected
          ? "bg-[rgba(213,185,185,0.2)] shadow-[0px_0px_20px_0px_#c69efa] border border-white/20"
          : "bg-transparent border border-[rgba(255,255,255,0.05)] hover:bg-white/5"
      )}
    >
      <span className="font-semibold text-[20px] text-white truncate max-w-[150px]">
        {bell.label}
      </span>
      <div className="flex flex-col items-end gap-[4px] text-[14px]">
        <span className="font-medium text-[#d1d1d1] leading-none">{bell.time}</span>
        <span className="font-medium text-[#d1d1d1] leading-none truncate max-w-[100px]">{bell.audioFile || "음악 없음"}</span>
      </div>
    </button>
  );
});

BellCard.displayName = "BellCard";
export default BellCard;
