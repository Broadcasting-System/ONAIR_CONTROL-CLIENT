"use client";

import type { ReactNode } from "react";
import { DatePicker, TimePicker } from "@/components/common/DateTimePicker";
import { joinIso, splitIso } from "@/lib/recruitFormat";
import { cn } from "@/lib/utils";

/** 부장 화면 공용 — 위 줄, 날짜·시각 칸, 숫자 칸 */

export function AdminTop({ tabs, children }: { tabs: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-3 md:min-h-11 md:flex-row md:items-center md:justify-between">
      <div className="no-scrollbar max-w-full overflow-x-auto">{tabs}</div>
      {children && (
        <div className="flex flex-wrap items-center gap-3 font-pretendard text-[16px]">
          {children}
        </div>
      )}
    </div>
  );
}

/** ISO 하나를 날짜 + 시각 두 칸으로 */
export function DateTimeField({
  value,
  onChange,
  label,
  defaultTime = "18:00",
  dateClass,
}: {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  label: string;
  defaultTime?: string;
  dateClass?: string;
}) {
  const { date, time } = splitIso(value);
  return (
    <span className="flex items-center gap-2">
      <DatePicker
        value={date}
        aria-label={`${label} 날짜`}
        onChange={(d) => onChange(joinIso(d, time || defaultTime))}
        className={cn("h-9 w-[178px] shrink-0 rounded-lg px-3 text-[15px]", dateClass)}
      />
      <TimePicker
        value={time}
        aria-label={`${label} 시각`}
        onChange={(t) => onChange(joinIso(date || todayIso(), t))}
        className="h-9 w-[104px] shrink-0 rounded-lg px-3 text-[15px]"
      />
    </span>
  );
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** 오른쪽 정렬 숫자 칸 + 단위 (10명 · 10분) */
export function NumberField({
  id,
  value,
  onChange,
  unit,
  width = 200,
  max = 999,
  label,
}: {
  id?: string;
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  unit: string;
  width?: number;
  max?: number;
  label?: string;
}) {
  return (
    <span
      style={{ width }}
      className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-[#141414] px-3 font-pretendard text-[15px] focus-within:border-white/30"
    >
      <input
        id={id}
        aria-label={label}
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "");
          onChange(d === "" ? null : Math.min(max, Number(d)));
        }}
        className="min-w-0 flex-1 bg-transparent text-right text-white tabular-nums outline-none"
      />
      <span className="ml-0.5 text-white/55">{unit}</span>
    </span>
  );
}

export const ROW_INPUT =
  "h-9 w-[200px] rounded-lg border border-white/10 bg-[#141414] px-3 text-right font-pretendard text-[15px] text-white outline-none focus:border-white/30";

/** 받침 있으면 '과', 없으면 '와' */
export function wa(name: string): string {
  const c = name.trim().charCodeAt(name.trim().length - 1);
  if (c < 0xac00 || c > 0xd7a3) return "와";
  return (c - 0xac00) % 28 ? "과" : "와";
}
