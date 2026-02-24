import { Group } from "@/types/time";
import { cn } from "@/lib/utils";

interface GroupTabProps {
  groups: Group[];
  activeGroupId: number;
  onSelect: (id: number) => void;
}

export default function GroupTab({ groups, activeGroupId, onSelect }: GroupTabProps) {
  return (
    <div className="flex gap-[22px] w-full">
      {groups.map((group) => {
        const isActive = group.id === activeGroupId;
        return (
          <button
            key={group.id}
            onClick={() => onSelect(group.id)}
            className={cn(
              "flex items-center justify-center w-[208px] h-[64px] rounded-[6px] transition-all bg-transparent",
              isActive
                ? "border-[2px] border-white text-white font-semibold"
                : "border border-white/20 text-white/40 hover:border-white/40 hover:text-white/80 font-medium"
            )}
          >
            <span className="font-pretendard text-[22px] tracking-widest">
              {group.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
