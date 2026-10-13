import { Group } from "@/types/time";
import { cn } from "@/lib/utils";

interface GroupTabProps {
  groups: Group[];
  activeGroupId: number;
  onSelect: (id: number) => void;
}

export default function GroupTab({ groups, activeGroupId, onSelect }: GroupTabProps) {
  return (
    <div className="flex w-max gap-2.5 md:w-full md:gap-[18px]">
      {groups.map((group) => {
        const isActive = group.id === activeGroupId;
        return (
          <button
            key={group.id}
            onClick={() => onSelect(group.id)}
            className="group relative w-[104px] shrink-0 focus:outline-none md:w-auto md:flex-1 md:shrink"
          >
            {/* 각진(평행사변형) 탭 — 좌우 모서리가 비스듬하게 깎인 형태 */}
            <div
              style={{ transform: "skewX(-12deg)" }}
              className={cn(
                "flex h-[48px] w-full items-center md:h-[60px] justify-center rounded-[10px] border transition-all",
                isActive
                  ? "border-[1.5px] border-white bg-[#101012] shadow-[0_0_18px_-6px_rgba(255,255,255,0.5)]"
                  : "border border-white/12 bg-[#0c0c0e] hover:border-white/30"
              )}
            >
              <span
                style={{ transform: "skewX(12deg)" }}
                className={cn(
                  "whitespace-nowrap font-orbitron text-[15px] tracking-wide md:whitespace-normal md:text-[22px] transition-colors",
                  isActive
                    ? "font-semibold text-white"
                    : "font-medium text-white/35 group-hover:text-white/70"
                )}
              >
                {group.name}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
