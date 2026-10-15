"use client";

import { cn } from "@/lib/utils";
import type { SpeakerSection } from "./bellUtils";

type Tri = "on" | "part" | "off";

function TriCheck({ state, small }: { state: Tri; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center border-[1.5px]",
        small ? "h-[15px] w-[15px] rounded-[4px]" : "h-[18px] w-[18px] rounded-[5px]",
        state === "on" ? "border-white bg-white" : state === "part" ? "border-white" : "border-white/30",
      )}
    >
      {state === "on" && (
        <svg viewBox="0 0 12 12" className={small ? "h-[10px] w-[10px]" : "h-3 w-3"} fill="none" stroke="#0b0b0d" strokeWidth={2.4}>
          <path d="M2.5 6.3 5 8.6l4.6-5.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {state === "part" && <span className={cn("h-[2px] rounded-sm bg-white", small ? "w-[7px]" : "w-[9px]")} />}
    </span>
  );
}

const triOf = (ids: string[], set: Set<string>): Tri => {
  const n = ids.filter((id) => set.has(id)).length;
  return n === 0 ? "off" : n === ids.length ? "on" : "part";
};

interface SpeakerPickerProps {
  sections: SpeakerSection[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

/** 장소 고르기 — 분류마다 한 줄(3상태 체크 + 칩), 교실은 학년별 줄 */
export default function SpeakerPicker({ sections, selected, onChange, className }: SpeakerPickerProps) {
  const set = new Set(selected);
  const all = sections.flatMap((s) => s.ids);
  const known = new Set(all);
  const count = selected.filter((id) => known.has(id)).length;
  // 스피커 매핑이 바뀌어 지금 목록에 없는 대상 — 보이지 않으면 뺄 수도 없어 소리 없는 시보가 된다
  const stale = selected.filter((id) => !known.has(id));
  const allOn = all.length > 0 && all.every((id) => set.has(id));

  const toggle = (id: string) => onChange(set.has(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  const toggleMany = (ids: string[]) => {
    if (ids.length > 0 && ids.every((id) => set.has(id))) onChange(selected.filter((id) => !ids.includes(id)));
    else onChange([...selected, ...ids.filter((id) => !set.has(id))]);
  };

  const chip = (id: string, grow?: boolean) => (
    <button
      key={id}
      type="button"
      aria-pressed={set.has(id)}
      onClick={() => toggle(id)}
      className={cn(
        "flex h-9 items-center justify-center whitespace-nowrap rounded-lg border px-2.5 font-pretendard text-[13px] font-medium transition-colors md:h-7 md:text-[12.5px]",
        grow && "min-w-0 flex-1 px-0",
        set.has(id)
          ? "border-white bg-white font-semibold text-[#0b0b0d]"
          : "border-white/10 text-white/50 hover:border-white/25 hover:text-white/80",
      )}
    >
      {id}
    </button>
  );

  return (
    <div
      data-tour="time.editor.speakers"
      className={cn("flex min-h-0 flex-col gap-2 rounded-2xl border border-white/[0.08] bg-black/25 px-3 py-3 md:px-3.5", className)}
    >
      <div className="flex items-center gap-2">
        <span className="font-mbc text-[15px] text-white">장소</span>
        <span className="font-orbitron text-[12px] text-white/50">{count}</span>
        <div data-tour="time.editor.quick" className="ml-auto flex gap-1.5">
          <button
            type="button"
            aria-pressed={allOn}
            onClick={() => onChange(allOn ? selected : [...selected, ...all.filter((id) => !set.has(id))])}
            className={cn(
              "flex h-9 items-center rounded-[9px] border px-3 font-mbc text-[13.5px] transition-colors md:h-[30px]",
              allOn ? "border-white bg-white text-[#0b0b0d]" : "border-white/[0.12] text-white/60 hover:text-white",
            )}
          >
            학교 전체
          </button>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => onChange([])}
            className="flex h-9 items-center rounded-[9px] border border-white/[0.12] px-3 font-mbc text-[13.5px] text-white/60 transition-colors hover:text-white disabled:opacity-35 md:h-[30px]"
          >
            모두 끄기
          </button>
        </div>
      </div>

      {stale.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#FF3B3B]/30 bg-[#FF3B3B]/[0.06] px-2.5 py-2">
          <span className="mr-1 font-mbc text-[13px] text-[#ff8a8a]">목록에 없는 대상</span>
          {stale.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="flex h-8 items-center rounded-lg border border-[#FF3B3B]/40 px-2.5 font-pretendard text-[12.5px] text-white/85 hover:bg-[#FF3B3B]/15 md:h-7"
            >
              {id} ×
            </button>
          ))}
        </div>
      )}

      <div className="-mr-1 flex min-h-0 flex-col gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {sections.length === 0 && <p className="py-6 text-center font-pretendard text-[13.5px] text-white/35">스피커 목록을 불러오는 중이에요</p>}
        {sections.map((sec) => {
          const on = sec.ids.filter((id) => set.has(id)).length;
          const rest = sec.grades ? sec.ids.filter((id) => !sec.grades!.some((g) => g.ids.includes(id))) : sec.ids;
          return (
            <div
              key={sec.name}
              className="grid gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0 sm:grid-cols-[128px_minmax(0,1fr)] sm:items-start"
            >
              <button
                type="button"
                onClick={() => toggleMany(sec.ids)}
                className="flex h-8 items-center gap-2 whitespace-nowrap text-left font-mbc text-[14px] text-white/75 hover:text-white md:h-7"
              >
                <TriCheck state={triOf(sec.ids, set)} />
                {sec.name}
                <small className="font-orbitron text-[11px] font-semibold text-white/35">
                  {on}/{sec.ids.length}
                </small>
              </button>
              <div className="flex min-w-0 flex-col gap-[5px]">
                {sec.grades?.map((g) => (
                  <div key={g.grade} className="flex items-center gap-[5px]">
                    <button
                      type="button"
                      onClick={() => toggleMany(g.ids)}
                      className="flex w-[58px] shrink-0 items-center gap-1.5 whitespace-nowrap font-mbc text-[12.5px] text-white/60 hover:text-white"
                    >
                      <TriCheck small state={triOf(g.ids, set) === "on" ? "on" : "off"} />
                      {g.grade}학년
                    </button>
                    {g.ids.map((id) => chip(id, true))}
                  </div>
                ))}
                {rest.length > 0 && <div className="flex flex-wrap gap-[5px]">{rest.map((id) => chip(id))}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
