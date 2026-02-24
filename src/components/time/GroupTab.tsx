import { Group } from "@/types/time";
import { cn } from "@/lib/utils";

interface GroupTabProps {
  groups: Group[];
  activeGroupId: number;
  onSelect: (id: number) => void;
}

export default function GroupTab({ groups, activeGroupId, onSelect }: GroupTabProps) {
  return (
    <div className="flex gap-[30px] w-full">
      {groups.map((group) => {
        const isActive = group.id === activeGroupId;
        return (
          <button
            key={group.id}
            onClick={() => onSelect(group.id)}
            className={cn(
              "flex items-center justify-center w-[160px] h-[55px] rounded-[7px] pb-[4px] pt-[8px] transition-all",
              isActive
                ? "bg-[rgba(32,32,32,0.8)] border border-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                : "bg-[rgba(32,32,32,0.6)] border border-[rgba(255,255,255,0.1)] text-white/50 hover:bg-[rgba(32,32,32,0.7)] hover:text-white/80"
            )}
          >
            <span className="font-orbitron font-normal text-[24px] leading-[0] tracking-wider mt-2">
              {group.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
