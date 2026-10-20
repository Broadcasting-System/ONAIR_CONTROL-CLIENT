"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { SpeakerFloorMap } from "@/components/speaker/SpeakerFloorMap";
import { FLOOR_KEYS } from "@/lib/speakerCoverage";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { SpeakerZone } from "@/types/speaker";
import NeonButton from "@/components/common/NeonButton";
import Portal from "@/components/common/Portal";
import { Chip } from "@/components/mobile/ui";
import { useSpeakerStore } from "@/stores/speakerStore";
import { cn } from "@/lib/utils";
import { TEST_SPEAKER_ID, TEST_SPEAKER_LABEL, isTestSpeaker, withoutTest } from "@/constants/testSpeaker";
import { Label } from "./parts";

/**
 * 방송 대상 — 처음에는 '스피커 관리'에서 켜 둔 스피커를 따라간다(예전 TTS 습관 그대로).
 * 여기서 한 번 고르면 그때부터는 고른 대로.
 */
export function useBroadcastTargets(names: string[], testSpeaker = false) {
  const zones = useSpeakerStore((s) => s.zones);
  const [picked, setPicked] = useState<string[] | null>(null);
  const onNames = useMemo(() => zones.filter((z) => z.status === "on").map((z) => z.name), [zones]);
  const known = useMemo(() => new Set(names), [names]);
  const raw = picked ?? onNames;
  // 구역표가 아직 없으면 거르지 않는다. 시험 스피커는 최고 관리자일 때만 남는다
  const selected = useMemo(
    () =>
      raw.filter((n) => (isTestSpeaker(n) ? testSpeaker : known.size === 0 || known.has(n))),
    [raw, known, testSpeaker],
  );
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
  onChange: setTargets,
  disabled,
  testSpeaker,
}: {
  names: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** 최고 관리자 — 시험 스피커 칩을 보인다 (고르면 다른 스피커는 빠지고, 다른 스피커를 고르면 시험 스피커가 빠진다) */
  testSpeaker?: boolean;
}) {
  const testOn = selected.some(isTestSpeaker);
  const onChange = (next: string[]) => setTargets(withoutTest(next));
  const toggleTest = () => setTargets(testOn ? [] : [TEST_SPEAKER_ID]);
  const [sheet, setSheet] = useState(false);
  const [view, setView] = useState<"map" | "list">("map");
  const isMobile = useIsMobile();
  const [floor, setFloor] = useState(FLOOR_KEYS[0]);
  const grades = useMemo(() => gradesOf(names), [names]);
  const sel = useMemo(() => new Set(selected), [selected]);
  const all = names.length > 0 && names.every((n) => sel.has(n));
  const fullGrades = grades.filter((g) => g.ids.length > 0 && g.ids.every((id) => sel.has(id)));
  // 학년 묶음으로 설명되지 않는 선택이면 '직접 고르기'가 켜진 것으로
  const covered = new Set(fullGrades.flatMap((g) => g.ids));
  const custom = !all && !testOn && selected.length > 0 && selected.some((n) => !covered.has(n));

  const toggleAll = () => onChange(all ? [] : [...names]);
  const toggleGrade = (ids: string[]) => {
    if (all) return onChange([...ids]); // 학교 전체에서 학년을 누르면 그 학년만
    const on = ids.every((id) => sel.has(id));
    if (on) onChange(selected.filter((n) => !ids.includes(n)));
    else onChange(Array.from(new Set([...selected, ...ids])));
  };
  const toggleOne = (n: string) => onChange(sel.has(n) ? selected.filter((x) => x !== n) : [...selected, n]);
  // 지도는 스피커 상태(on/off)로 칸을 칠한다 — 여기서는 '골랐는지'를 그 자리에 넣는다
  const zones = useMemo<SpeakerZone[]>(
    () => names.map((n) => ({ id: n, name: n, status: sel.has(n) ? "on" : "off" })),
    [names, sel],
  );

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
        {testSpeaker && (
          <Chip active={testOn} disabled={disabled} onClick={toggleTest}>
            {TEST_SPEAKER_LABEL}
          </Chip>
        )}
      </div>

      {sheet && (
        <Portal>
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center md:p-4">
            <div className="absolute inset-0" onClick={() => setSheet(false)} />
            <div
              role="dialog"
              aria-label="대상 직접 고르기"
              className={cn(
                "relative z-10 flex max-h-[88dvh] w-full flex-col rounded-t-[24px] border border-white/10 bg-[#161618] pb-[env(safe-area-inset-bottom)] shadow-2xl md:max-h-[88vh] md:rounded-2xl md:pb-0",
                view === "map" ? "md:max-w-[1040px]" : "md:max-w-[640px]",
              )}
            >
              <div className="flex items-center justify-between px-5 pb-3 pt-4 md:px-6">
                <h2 className="font-mbc text-xl text-white">
                  대상 <span className="font-pretendard text-base text-white/50">{selected.length}곳</span>
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
                  onClick={() => setSheet(false)}
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
                      {n}
                    </button>
                  );
                })}
              </div>
              )}
              <div className="flex gap-2.5 border-t border-white/[0.08] px-5 py-4 md:px-6">
                <NeonButton tone="white" onClick={() => onChange([])} className="h-12 flex-1 md:h-12">
                  모두 빼기
                </NeonButton>
                <NeonButton onClick={() => setSheet(false)} className="h-12 flex-1 md:h-12">
                  완료
                </NeonButton>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
