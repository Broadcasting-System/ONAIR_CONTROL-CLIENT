"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { SpeakerFloorMap } from "@/components/speaker/SpeakerFloorMap";
import { FLOOR_KEYS } from "@/lib/speakerCoverage";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { SpeakerZone } from "@/types/speaker";
import NeonButton from "@/components/common/NeonButton";
import Portal from "@/components/common/Portal";
import { cn } from "@/lib/utils";

/**
 * 스피커 고르기 창 — 층 지도/목록, [모두 빼기]·[완료]. 방송부 대상 고르기(TargetPicker)와 선생님 바로 방송 '다른 곳'이 같이 쓴다.
 * 지도 칸은 정적 층 지도(speakerCoverage)에서 스피커 이름으로 찾으므로 names(스피커 이름)만 있으면 된다.
 * open 이 꺼져도 살아 있어서 지도/목록·층은 다시 열 때 그대로.
 */
export default function TargetSheet({
  open,
  names,
  selected,
  onChange,
  onClose,
  onDone,
  title = "대상",
  ariaLabel = "대상 직접 고르기",
  labelOf = (n) => n,
}: {
  open: boolean;
  names: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** 바깥·닫기 */
  onClose: () => void;
  /** [완료] — 없으면 닫기와 같다 */
  onDone?: () => void;
  title?: string;
  ariaLabel?: string;
  /** 목록 칸 글자 (선생님 화면은 '2학년 1반') */
  labelOf?: (name: string) => string;
}) {
  const [view, setView] = useState<"map" | "list">("map");
  const isMobile = useIsMobile();
  const [floor, setFloor] = useState(FLOOR_KEYS[0]);
  const sel = useMemo(() => new Set(selected), [selected]);
  const toggleOne = (n: string) => onChange(sel.has(n) ? selected.filter((x) => x !== n) : [...selected, n]);
  // 지도는 스피커 상태(on/off)로 칸을 칠한다 — 여기서는 '골랐는지'를 그 자리에 넣는다
  const zones = useMemo<SpeakerZone[]>(
    () => names.map((n) => ({ id: n, name: n, status: sel.has(n) ? "on" : "off" })),
    [names, sel],
  );
  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center md:p-4">
        <div className="absolute inset-0" onClick={onClose} />
        <div
          role="dialog"
          aria-label={ariaLabel}
          className={cn(
            "relative z-10 flex max-h-[88dvh] w-full flex-col rounded-t-[24px] border border-white/10 bg-[#161618] pb-[env(safe-area-inset-bottom)] shadow-2xl md:max-h-[88vh] md:rounded-2xl md:pb-0",
            view === "map" ? "md:max-w-[1040px]" : "md:max-w-[640px]",
          )}
        >
          <div className="flex items-center justify-between px-5 pb-3 pt-4 md:px-6">
            <h2 className="font-mbc text-xl text-white">
              {title} <span className="font-pretendard text-base text-white/50">{selected.length}곳</span>
            </h2>
            <div className="ml-auto mr-2 flex gap-1 rounded-lg bg-white/[0.06] p-1">
              {(["map", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "h-9 rounded-md px-3.5 font-pretendard text-[14px] font-semibold transition-colors md:h-8",
                    view === v ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80",
                  )}
                >
                  {v === "map" ? "지도" : "목록"}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          {view === "map" ? (
            <div className="no-scrollbar min-h-0 flex-1 overflow-auto px-5 pb-2 pt-1 md:px-6">
              {/* 폰에서는 지도를 세로로 돌려 한 화면에 */}
              <div>
                <SpeakerFloorMap
                  zones={zones}
                  onToggle={toggleOne}
                  floor={floor}
                  onFloorChange={setFloor}
                  mapHeight={isMobile ? "max(380px, calc(88dvh - 230px))" : "clamp(360px, calc(88dvh - 210px), 640px)"}
                  countLabel="선택"
                  portrait={isMobile}
                />
              </div>
            </div>
          ) : (
            <div className="custom-scrollbar grid min-h-0 flex-1 grid-cols-3 gap-2.5 overflow-y-auto px-5 pb-2 pt-1 md:grid-cols-4 md:gap-3 md:px-6">
              {names.map((n) => {
                const on = sel.has(n);
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleOne(n)}
                    className={cn(
                      "flex h-[44px] w-full items-center justify-center rounded-[10px] border px-2 text-center font-pretendard text-[15px] transition-all",
                      on
                        ? "border-[#c4b5fd] bg-[#a78bfa]/15 text-white shadow-[0_0_14px_-3px_#a78bfa]"
                        : "border-[#7c6db0]/35 bg-white/[0.02] text-white/70 hover:border-[#7c6db0]/70 hover:text-white",
                    )}
                  >
                    {labelOf(n)}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-2.5 border-t border-white/[0.08] px-5 py-4 md:px-6">
            <NeonButton tone="white" onClick={() => onChange([])} className="h-12 flex-1 md:h-12">
              모두 빼기
            </NeonButton>
            <NeonButton onClick={onDone ?? onClose} className="h-12 flex-1 md:h-12">
              완료
            </NeonButton>
          </div>
        </div>
      </div>
    </Portal>
  );
}
