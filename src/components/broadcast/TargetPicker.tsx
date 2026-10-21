"use client";

import { useMemo, useState } from "react";
import { Chip } from "@/components/mobile/ui";
import { useSpeakerStore } from "@/stores/speakerStore";
import { TEST_SPEAKER_ID, TEST_SPEAKER_LABEL, isTestSpeaker, withoutTest } from "@/constants/testSpeaker";
import { Label } from "./parts";
import TargetSheet from "./TargetSheet";

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

      <TargetSheet open={sheet} names={names} selected={selected} onChange={onChange} onClose={() => setSheet(false)} />
    </div>
  );
}
