"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import Portal from "@/components/common/Portal";
import { Chip } from "@/components/mobile/ui";
import { useSpeakerStore } from "@/stores/speakerStore";
import { cn } from "@/lib/utils";
import { Label } from "./parts";

/**
 * 방송 대상 — 처음에는 '스피커 관리'에서 켜 둔 스피커를 따라간다(예전 TTS 습관 그대로).
 * 여기서 한 번 고르면 그때부터는 고른 대로.
 */
export function useBroadcastTargets(names: string[]) {
  const zones = useSpeakerStore((s) => s.zones);
  const [picked, setPicked] = useState<string[] | null>(null);
  const onNames = useMemo(() => zones.filter((z) => z.status === "on").map((z) => z.name), [zones]);
  const known = useMemo(() => new Set(names), [names]);
  const raw = picked ?? onNames;
  // 구역표가 아직 없으면 거르지 않는다
  const selected = useMemo(() => (known.size ? raw.filter((n) => known.has(n)) : raw), [raw, known]);
  return { selected, setSelected: (next: string[]) => setPicked(next) };
}

function gradesOf(names: string[]) {
  const grades = Array.from(
    new Set(names.map((n) => /^(\d+)-\d+/.exec(n)?.[1]).filter((g): g is string => !!g)),
  ).sort((a, b) => Number(a) - Number(b));
  return grades.map((g) => ({
    label: `${g}학년`,
    ids: names.filter((n) => new RegExp(`^${g}-\\d`).test(n)),
  }));
}

export default function TargetPicker({
  names,
  selected,
  onChange,
  disabled,
}: {
  names: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [sheet, setSheet] = useState(false);
  const grades = useMemo(() => gradesOf(names), [names]);
  const sel = useMemo(() => new Set(selected), [selected]);
  const all = names.length > 0 && names.every((n) => sel.has(n));
  const fullGrades = grades.filter((g) => g.ids.length > 0 && g.ids.every((id) => sel.has(id)));
  // 학년 묶음으로 설명되지 않는 선택이면 '직접 고르기'가 켜진 것으로
  const covered = new Set(fullGrades.flatMap((g) => g.ids));
  const custom = !all && selected.length > 0 && selected.some((n) => !covered.has(n));

  const toggleAll = () => onChange(all ? [] : [...names]);
  const toggleGrade = (ids: string[]) => {
    if (all) return onChange([...ids]); // 학교 전체에서 학년을 누르면 그 학년만
    const on = ids.every((id) => sel.has(id));
    if (on) onChange(selected.filter((n) => !ids.includes(n)));
    else onChange(Array.from(new Set([...selected, ...ids])));
  };
  const toggleOne = (n: string) => onChange(sel.has(n) ? selected.filter((x) => x !== n) : [...selected, n]);

  return (
    <div data-tour="main.broadcast.targets" className="flex flex-col gap-2.5">
      <Label>
        대상 <span className="font-pretendard">{selected.length}곳</span>
      </Label>
      <div className="flex flex-wrap gap-2">
        <Chip active={all} disabled={disabled || names.length === 0} onClick={toggleAll}>
          학교 전체
        </Chip>
        {grades.map((g) => (
          <Chip
            key={g.label}
            active={!all && g.ids.every((id) => sel.has(id))}
            disabled={disabled}
            onClick={() => toggleGrade(g.ids)}
          >
            {g.label}
          </Chip>
        ))}
        <Chip active={custom} disabled={disabled || names.length === 0} onClick={() => setSheet(true)}>
          직접 고르기
        </Chip>
      </div>

      {sheet && (
        <Portal>
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center md:p-4">
            <div className="absolute inset-0" onClick={() => setSheet(false)} />
            <div
              role="dialog"
              aria-label="대상 직접 고르기"
              className="relative z-10 flex max-h-[82dvh] w-full flex-col rounded-t-[24px] border border-white/10 bg-[#161618] pb-[env(safe-area-inset-bottom)] shadow-2xl md:max-h-[80vh] md:max-w-[640px] md:rounded-2xl md:pb-0"
            >
              <div className="flex items-center justify-between px-5 pb-3 pt-4 md:px-6">
                <h2 className="font-mbc text-xl text-white">
                  대상 <span className="font-pretendard text-base text-white/50">{selected.length}곳</span>
                </h2>
                <button
                  type="button"
                  aria-label="닫기"
                  onClick={() => setSheet(false)}
                  className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
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
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2.5 border-t border-white/[0.08] px-5 py-4 md:px-6">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="h-12 flex-1 rounded-xl border border-white/10 bg-white/[0.06] font-pretendard text-[15px] font-semibold text-white/80 hover:bg-white/10"
                >
                  모두 빼기
                </button>
                <button
                  type="button"
                  onClick={() => setSheet(false)}
                  className="h-12 flex-1 rounded-xl bg-white font-pretendard text-[15px] font-semibold text-black hover:bg-white/90"
                >
                  완료
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
