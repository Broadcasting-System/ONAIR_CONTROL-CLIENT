"use client";

import { useState, type ComponentType } from "react";
import { Popover as P } from "radix-ui";
import { Columns2, Copy, Image as ImageIcon, MoreHorizontal, Pencil, Plus, SquarePlay, Timer, Trash2, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BannerScene, SavedBanner } from "@/lib/bannerApi";
import { BannerDraftRender, LedStrip } from "./BannerRender";

export type EditScene = Exclude<BannerScene, "blank">;

export const SCENE_META: Record<EditScene, { label: string; Icon: ComponentType<{ size?: number; className?: string }> }> = {
  default: { label: "글자", Icon: Type },
  scoreboard: { label: "점수보드", Icon: Columns2 },
  image: { label: "사진", Icon: ImageIcon },
  gif: { label: "움직이는 사진", Icon: SquarePlay },
  timer: { label: "타이머", Icon: Timer },
};
export const EDIT_SCENES = Object.keys(SCENE_META) as EditScene[];

export function sceneLabel(scene: BannerScene): string {
  return scene === "blank" ? "꺼짐" : (SCENE_META[scene]?.label ?? scene);
}

/** 고친 날짜 — 방금 / 14:02 / 어제 / 10/12 */
export function shortDate(v: string | number | null | undefined, now = Date.now()): string {
  if (v === null || v === undefined || v === "") return "";
  let ms = typeof v === "number" ? v : Number.isFinite(Number(v)) ? Number(v) : Date.parse(v);
  if (!Number.isFinite(ms)) return "";
  if (ms < 1e12) ms *= 1000; // 초 단위로 온 경우
  const d = new Date(ms);
  const today = new Date(now);
  if (now - ms < 60_000) return "방금";
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const y = new Date(now - 86_400_000);
  if (sameDay(d, y)) return "어제";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function KindTag({ scene }: { scene: BannerScene }) {
  const meta = scene === "blank" ? null : SCENE_META[scene];
  if (!meta) return null;
  const { Icon, label } = meta;
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-md bg-white/[0.08] px-1.5 font-pretendard text-[11px] font-medium text-white/65">
      <Icon size={12} />
      {label}
    </span>
  );
}

export function OnAirTag({ small, className }: { small?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md border border-[#FF3B3B]/55 bg-[#FF3B3B]/[0.12] font-orbitron font-bold tracking-[0.14em] text-[#ff6a62]",
        small ? "px-[5px] py-px text-[8.5px]" : "px-2 py-[3px] text-[10.5px]",
        className,
      )}
    >
      ON AIR
    </span>
  );
}

interface ListProps {
  items: SavedBanner[];
  selectedId: string | null;
  liveId: string | null;
  onPick: (item: SavedBanner) => void;
  onNew: () => void;
  onRename: (item: SavedBanner) => void;
  onDuplicate: (item: SavedBanner) => void;
  onDelete: (item: SavedBanner) => void;
  className?: string;
}

function ItemMenu({ item, onRename, onDuplicate, onDelete }: { item: SavedBanner } & Pick<ListProps, "onRename" | "onDuplicate" | "onDelete">) {
  const [open, setOpen] = useState(false);
  const row =
    "flex h-11 w-full items-center gap-2.5 rounded-[10px] px-3 text-left font-mbc text-[14px] transition-colors hover:bg-white/[0.06] md:h-10";
  const pick = (fn: (i: SavedBanner) => void) => () => {
    setOpen(false);
    fn(item);
  };
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger
        aria-label={`${item.name} 메뉴`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white data-[state=open]:text-white md:h-7 md:w-7"
      >
        <MoreHorizontal size={16} />
      </P.Trigger>
      <P.Portal>
        <P.Content
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-[900] w-[180px] rounded-[16px] border border-white/[0.12] bg-[#141416] p-1.5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.65)] outline-none"
        >
          <button type="button" onClick={pick(onRename)} className={cn(row, "text-white/85")}>
            <Pencil size={15} className="text-white/50" />
            이름 바꾸기
          </button>
          <button type="button" onClick={pick(onDuplicate)} className={cn(row, "text-white/85")}>
            <Copy size={15} className="text-white/50" />
            복제
          </button>
          <div className="mx-2 my-1 h-px bg-white/[0.08]" />
          <button type="button" onClick={pick(onDelete)} className={cn(row, "text-[#ff8a8a]")}>
            <Trash2 size={15} />
            지우기
          </button>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

/** 저장한 현수막 — PC 는 세로 목록, 폰은 가로로 넘기는 카드 줄 */
export default function SavedBannerList({ items, selectedId, liveId, onPick, onNew, onRename, onDuplicate, onDelete, className }: ListProps) {
  return (
    <section
      data-tour="banner.saved"
      className={cn(
        "flex min-h-0 flex-col lg:rounded-[20px] lg:border lg:border-white/[0.08] lg:bg-[rgba(14,14,17,0.74)] lg:p-3.5 lg:backdrop-blur-md",
        className,
      )}
    >
      <div className="mb-2.5 flex items-center gap-2.5 lg:px-0.5">
        <h3 className="font-mbc text-[16px] text-white">저장한 현수막</h3>
        <span className="font-orbitron text-[11px] text-white/40">{items.length}</span>
        <button
          type="button"
          onClick={onNew}
          className="ml-auto flex h-10 items-center gap-1.5 rounded-[11px] border border-white/[0.12] bg-white/[0.03] px-3 font-mbc text-[13.5px] text-white/75 transition-colors hover:text-white lg:h-8"
        >
          <Plus size={14} />
          새로
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-white/10 px-4 py-6 text-center font-pretendard text-[14px] text-white/40">저장한 현수막이 없어요</p>
      ) : (
        <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 md:mx-0 md:px-0 lg:min-h-0 lg:flex-1 lg:snap-none lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
          {items.map((it) => {
            const on = it.id === selectedId;
            const air = it.id === liveId;
            return (
              <div
                key={it.id}
                className={cn(
                  "relative w-[220px] shrink-0 snap-start rounded-[14px] border p-2 pb-2.5 transition-colors lg:w-auto",
                  on ? "border-white/75 bg-white/[0.06]" : air ? "border-[#FF3B3B]/55 bg-black/30" : "border-white/[0.08] bg-black/30 hover:border-white/20",
                )}
              >
                <button type="button" aria-pressed={on} onClick={() => onPick(it)} className="block w-full text-left">
                  <LedStrip className="rounded-[5px]">
                    {it.scene !== "blank" && <BannerDraftRender scene={it.scene} payload={it.payload} />}
                  </LedStrip>
                  <span className="mt-2 flex min-w-0 items-center gap-[7px] px-0.5">
                    {air && <OnAirTag small />}
                    <span className="min-w-0 truncate font-pretendard text-[13.5px] font-semibold text-white">{it.name || "이름 없음"}</span>
                    <span className="ml-auto shrink-0 font-pretendard text-[11.5px] text-white/40">{shortDate(it.updatedAt)}</span>
                  </span>
                </button>
                <div className="mt-1 flex items-center px-0.5">
                  <KindTag scene={it.scene} />
                  <span className="ml-auto -my-1">
                    <ItemMenu item={it} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
