import { DayType } from "@/types/time";

export const DAYS: { label: string; value: DayType }[] = [
  { label: "월", value: "M" },
  { label: "화", value: "T" },
  { label: "수", value: "W" },
  { label: "목", value: "TH" },
  { label: "금", value: "F" },
  { label: "특별", value: "P" },
];

/** 평일 요일 (특별 P 빼고) */
export const WEEKDAYS: DayType[] = ["M", "T", "W", "TH", "F"];

export const DAY_LABEL: Record<DayType, string> = Object.fromEntries(
  DAYS.map((d) => [d.value, d.label]),
) as Record<DayType, string>;

const BY_JS_DAY: (DayType | null)[] = [null, "M", "T", "W", "TH", "F", null];

/** 날짜의 평일 요일 (주말이면 null) */
export function dayTypeOf(date: Date): DayType | null {
  return BY_JS_DAY[date.getDay()];
}
