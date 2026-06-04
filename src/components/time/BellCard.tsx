import { memo } from "react";
import { Bell } from "@/types/time";
import { cn } from "@/lib/utils";
import { SPEAKER_ITEMS } from "@/constants/speakers";

const ALL_SPEAKERS = SPEAKER_ITEMS.map((s) => s.label);

/** 선택한 장소를 짧게 요약: 학교 전체 / 1학년 묶음 / 개별 나열 */
function summarizeSpeakers(sel: string[] | undefined): string {
  if (!sel || sel.length === 0) return "장소 미선택";
  const set = new Set(sel);
  if (ALL_SPEAKERS.length > 0 && ALL_SPEAKERS.every((l) => set.has(l))) {
    return "학교 전체";
  }
  const tokens: string[] = [];
  const used = new Set<string>();
  for (const g of [1, 2, 3]) {
    const grade = ALL_SPEAKERS.filter((l) => new RegExp(`^${g}-\\d`).test(l));
    if (grade.length > 0 && grade.every((l) => set.has(l))) {
      tokens.push(`${g}학년`);
      grade.forEach((l) => used.add(l));
    }
  }
  for (const l of sel) if (!used.has(l)) tokens.push(l);
  return tokens.join(", ");
}

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
        "w-full h-[60px] rounded-[8px] flex items-center justify-between px-[20px] transition-all relative overflow-hidden text-left mb-2",
        isSelected
          ? "bg-[rgba(167,139,250,0.14)] shadow-[0_0_20px_-5px_#c69efa,inset_0_0_10px_-2px_#c69efa] border border-[#c4b5fd]"
          : "bg-transparent border border-[#7c6db0]/20 hover:border-[#7c6db0]/45 hover:bg-white/5"
      )}
    >
      <span className="font-semibold text-[16px] text-white truncate max-w-[150px]">
        {bell.label}
      </span>
      <div className="flex flex-col items-end gap-[4px] text-[14px]">
        <span className="font-medium text-[#d1d1d1] leading-none">{bell.time}</span>
        <span className="font-medium text-white/45 leading-none truncate max-w-[170px]">
          {summarizeSpeakers(bell.speakers)}
        </span>
      </div>
    </button>
  );
});

BellCard.displayName = "BellCard";
export default BellCard;
