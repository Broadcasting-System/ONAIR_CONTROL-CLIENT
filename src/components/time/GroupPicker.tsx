"use client";

import { useState, type ReactNode } from "react";
import { Popover as P } from "radix-ui";
import { Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import NeonButton from "@/components/common/NeonButton";

export interface GroupPickerItem {
  id: number;
  /** 서버에 붙인 이름 (없으면 null → GROUP n) */
  name: string | null;
  weekdayCount: number;
  specialCount: number;
  /** 아직 안 보낸 변경 수 */
  unsent?: number;
}

interface GroupPickerProps {
  groups: GroupPickerItem[];
  activeId: number;
  liveId: number | null;
  onSelect: (id: number) => void;
  onRename: (id: number, name: string) => Promise<void> | void;
  /** 탭 줄 오른쪽 끝 (바닥을 맞춘다) */
  right?: ReactNode;
  /** 고른 탭과 이어진 상자 안 내용 */
  children?: ReactNode;
  className?: string;
}

const NAME_MAX = 20;

/** 시보 그룹 고르기 — 위가 둥근 폴더 탭. 고른 탭은 아래 상자와 이어진다. */
export default function GroupPicker({ groups, activeId, liveId, onSelect, onRename, right, children, className }: GroupPickerProps) {
  const active = groups.find((g) => g.id === activeId) ?? groups[0];
  const firstActive = groups[0]?.id === activeId;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-end gap-3">
        <div
          data-tour="time.group-tabs"
          className="no-scrollbar relative z-[2] -mb-px flex min-w-0 flex-1 items-end gap-1 overflow-x-auto"
        >
          {groups.map((g) => {
            const on = g.id === activeId;
            const isLive = g.id === liveId;
            const empty = g.weekdayCount + g.specialCount === 0;
            const counts = [g.weekdayCount ? `평일 ${g.weekdayCount}개` : "", g.specialCount ? `특별 ${g.specialCount}개` : ""]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(g.id)}
                title={counts || "비어 있음"}
                className={cn(
                  "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-[14px] border border-b-0 px-4 font-mbc text-[15px] transition-colors md:px-[18px]",
                  on
                    ? "h-[50px] border-white/[0.16] bg-[#141418] text-white"
                    : "h-[42px] border-white/[0.07] bg-white/[0.03] text-white/50 hover:text-white/80",
                  empty && !isLive && "border-dashed",
                  empty && !isLive && !on && "text-white/30",
                )}
              >
                {empty && !g.name && !isLive ? (
                  <>
                    <Plus size={15} strokeWidth={2.4} />
                    <span className="font-orbitron text-[11px] font-semibold">{g.id}</span>
                  </>
                ) : (
                  <>
                    <span className="font-orbitron text-[11px] font-semibold text-white/35">{g.id}</span>
                    {g.name || `GROUP ${g.id}`}
                  </>
                )}
                {isLive && (
                  <span className="rounded-[5px] border border-[#FF3B3B]/50 bg-[#FF3B3B]/10 px-1.5 py-[2px] font-orbitron text-[9.5px] font-bold tracking-[0.12em] text-[#ff6a62]">
                    ON AIR
                  </span>
                )}
                {!!g.unsent && <span title={`안 보낸 변경 ${g.unsent}개`} className="h-1.5 w-1.5 rounded-full bg-white/70" />}
              </button>
            );
          })}
          {active && <RenameButton key={active.id} group={active} onRename={onRename} />}
        </div>
        {right}
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col rounded-[20px] border border-white/[0.16] bg-[#141418]/[0.92] p-2.5 md:p-3.5",
          firstActive && "rounded-tl-none",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function RenameButton({ group, onRename }: { group: GroupPickerItem; onRename: GroupPickerProps["onRename"] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(group.name ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRename(group.id, value.trim());
      setOpen(false);
    } catch {
      /* 오류 알림은 부른 쪽에서 */
    } finally {
      setBusy(false);
    }
  };

  return (
    <P.Root
      open={open}
      onOpenChange={(o) => {
        if (o) setValue(group.name ?? "");
        setOpen(o);
      }}
    >
      <P.Trigger
        data-tour="time.group-rename"
        aria-label="그룹 이름 바꾸기"
        className="flex h-[42px] w-10 shrink-0 items-center justify-center rounded-xl text-white/50 transition-colors hover:text-white data-[state=open]:text-white"
      >
        <Pencil size={15} />
      </P.Trigger>
      <P.Portal>
        <P.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-[900] w-[280px] rounded-[18px] border border-white/[0.12] bg-[#141416] p-4 text-white shadow-[0_24px_60px_rgba(0,0,0,0.65)] outline-none"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="flex flex-col gap-3"
          >
            <label className="font-mbc text-[14px] text-white/60" htmlFor="group-name">
              <span className="font-orbitron text-[12px] text-white/40">{group.id}</span> 그룹 이름
            </label>
            <input
              id="group-name"
              autoFocus
              value={value}
              maxLength={NAME_MAX}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`GROUP ${group.id}`}
              className="h-11 rounded-xl border border-white/10 bg-[#0c0d0f] px-3.5 font-pretendard text-[15px] text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />
            <NeonButton type="submit" disabled={busy} className="h-10 md:h-10">
              저장
            </NeonButton>
          </form>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
