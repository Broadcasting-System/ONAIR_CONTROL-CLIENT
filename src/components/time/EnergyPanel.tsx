"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/common/ConfirmModal";
import { TimePicker } from "@/components/common/DateTimePicker";
import { useEnergy, type EnergyConfig, type EnergyDay, type EnergyRun } from "@/hooks/useEnergy";
import { cn } from "@/lib/utils";

const DAY_LABELS: { key: EnergyDay; label: string }[] = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
];
const ORDER = DAY_LABELS.map((d) => d.key);
const WEEKDAYS: EnergyDay[] = ["mon", "tue", "wed", "thu", "fri"];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function describeRun(r: EnergyRun): string {
  if (r.skipped) return `건너뜀 · ${r.skipped}`;
  if (r.error) return `실패 · ${r.error}`;
  const speakers = r.speakers ?? [];
  const names = speakers.length
    ? `${speakers.slice(0, 5).join(", ")}${speakers.length > 5 ? ` 외 ${speakers.length - 5}` : ""}`
    : "켜진 곳 없음";
  const screens = r.displays?.length ? r.displays.map((c) => `CH${c}`).join("·") : "없음";
  return `스피커 ${speakers.length}곳 (${names}) · 송출 화면 ${screens}`;
}

const toConfig = (s: EnergyConfig): EnergyConfig => ({
  enabled: s.enabled,
  time: s.time,
  days: [...s.days].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)),
  displays: s.displays,
});

/** 시보 설정 › 야간 절전 (관리자) — 켜진 채 남은 스피커·송출 화면을 정해진 시각에 끈다 */
export default function EnergyPanel() {
  const { state, error, save, isSaving, runNow, isRunning } = useEnergy();
  const [form, setForm] = useState<EnergyConfig | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (state && form === null) setForm(toConfig(state));
  }, [state, form]);

  if (!state || !form) {
    return (
      <p className="font-pretendard text-white/40">
        {error ? `절전 설정을 불러오지 못했어요: ${error.message}` : "불러오는 중…"}
      </p>
    );
  }

  const dirty = JSON.stringify(toConfig(form)) !== JSON.stringify(toConfig(state));
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(form.time);
  const canSave = dirty && validTime && (!form.enabled || form.days.length > 0);
  const setDays = (days: EnergyDay[]) => setForm({ ...form, days });
  const toggleDay = (d: EnergyDay) =>
    setDays(form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d]);

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-3 md:gap-5">
      <section data-tour="energy.settings" className="flex flex-col gap-5 rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-4 backdrop-blur-md md:gap-6 md:rounded-2xl md:border-white/5 md:bg-[#0a0a0a] md:p-6 md:backdrop-blur-none">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-mbc text-lg text-white">야간 절전</h3>
            <p className="mt-0.5 font-pretendard text-xs text-white/35">
              다음 실행: {state.enabled ? fmtDate(state.nextRun) : "꺼짐"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            data-tour="energy.toggle"
            aria-checked={form.enabled}
            aria-label="야간 절전 사용"
            onClick={() => setForm({ ...form, enabled: !form.enabled })}
            className={cn(
              "relative h-8 w-14 shrink-0 rounded-full transition-colors max-md:before:absolute max-md:before:-inset-2 max-md:before:content-['']",
              form.enabled ? "bg-emerald-500/70" : "bg-white/15",
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all",
                form.enabled ? "left-7" : "left-1",
              )}
            />
          </button>
        </div>

        <div className={cn("flex flex-col gap-5 transition-opacity", !form.enabled && "opacity-40")}>
          <div data-tour="energy.time" className="flex items-center gap-4">
            <span className="w-20 shrink-0 font-mbc text-sm text-white/50">끄는 시각</span>
            <TimePicker
              value={form.time}
              onChange={(time) => setForm({ ...form, time })}
              invalid={!validTime}
              aria-label="끄는 시각"
              className="flex-1 md:w-[180px] md:flex-none"
            />
          </div>

          <div data-tour="energy.days" className="flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-4">
            <span className="w-20 shrink-0 font-mbc text-sm text-white/50">요일</span>
            <div className="grid w-full grid-cols-7 gap-1.5 md:flex md:w-auto md:gap-2">
              {DAY_LABELS.map((d) => {
                const on = form.days.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(d.key)}
                    className={cn(
                      "h-11 w-full rounded-xl border font-mbc text-sm transition-colors md:h-10 md:w-10",
                      on
                        ? "border-emerald-400/50 bg-emerald-400/15 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/40 hover:bg-white/5",
                      (d.key === "sat" || d.key === "sun") && !on && "text-red-300/50",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setDays(WEEKDAYS)}
                className="min-h-[44px] rounded-lg px-3.5 py-1 font-mbc text-xs text-white/45 hover:bg-white/10 hover:text-white md:min-h-0 md:px-2.5"
              >
                평일
              </button>
              <button
                type="button"
                onClick={() => setDays(ORDER)}
                className="min-h-[44px] rounded-lg px-3.5 py-1 font-mbc text-xs text-white/45 hover:bg-white/10 hover:text-white md:min-h-0 md:px-2.5"
              >
                매일
              </button>
            </div>
          </div>
          {form.enabled && form.days.length === 0 && (
            <p className="font-pretendard text-xs text-red-300/80">요일을 고르세요</p>
          )}

          <label data-tour="energy.displays" className="flex min-h-[44px] cursor-pointer items-center gap-3 md:min-h-0">
            <input
              type="checkbox"
              checked={form.displays}
              onChange={(e) => setForm({ ...form, displays: e.target.checked })}
              className="h-4 w-4 accent-emerald-400"
            />
            <span className="font-pretendard text-sm text-white/70">송출 화면도 대기 화면으로</span>
          </label>
        </div>

        <div className="flex justify-end gap-3">
          {dirty && (
            <button
              type="button"
              onClick={() => setForm(toConfig(state))}
              className="h-11 rounded-xl px-4 font-mbc text-sm text-white/45 hover:bg-white/5 hover:text-white"
            >
              되돌리기
            </button>
          )}
          <button
            type="button"
            data-tour="energy.save"
            disabled={!canSave || isSaving}
            onClick={() => save(toConfig(form))}
            className="h-11 rounded-xl border border-white/15 bg-white/10 px-6 font-mbc text-white transition-colors hover:bg-white/15 disabled:opacity-40"
          >
            {isSaving ? "저장 중…" : "저장"}
          </button>
        </div>
      </section>

      <section data-tour="energy.last-run" className="flex items-center gap-4 rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-4 backdrop-blur-md md:rounded-2xl md:border-white/5 md:bg-[#0a0a0a] md:p-5 md:backdrop-blur-none">
        <div className="min-w-0 flex-1">
          <span className="font-mbc text-sm text-white/50">최근 실행</span>
          <p className="mt-1 truncate font-pretendard text-sm text-white/80" title={state.lastRun ? describeRun(state.lastRun) : undefined}>
            {state.lastRun ? `${fmtDate(state.lastRun.at)} · ${describeRun(state.lastRun)}` : "없음"}
          </p>
        </div>
        <button
          type="button"
          data-tour="energy.run-now"
          onClick={() => setConfirm(true)}
          disabled={isRunning}
          className="h-11 shrink-0 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 font-mbc text-sm text-amber-100 transition-colors hover:bg-amber-500/20 disabled:opacity-40"
        >
          {isRunning ? "끄는 중…" : "지금 모두 끄기"}
        </button>
      </section>

      <ConfirmModal
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={runNow}
        title="지금 모두 끄기"
        message={
          state.displays
            ? "스피커를 모두 끄고 송출 화면을 대기 화면으로 바꿀까요?"
            : "스피커를 모두 끌까요?"
        }
        confirmText="끄기"
        isDestructive
      />
    </div>
  );
}
