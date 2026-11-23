"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * 면접 점수 — 시안 ScoreUI A 페이더. 눈금 5개(1~5점) 위로 흰 캡을 끌거나 누른다.
 * 내 점수를 주기 전에는 캡이 없다. 평균은 흐린 세로줄(내가 준 뒤에만).
 */

const W = 260;
const L = 10; // 트랙 시작
const T = 240; // 트랙 길이
const xOf = (score: number) => L + ((score - 1) / 4) * T;

export default function ScoreFader({
  value,
  average,
  onChange,
  disabled,
}: {
  value: number | null;
  average: number | null;
  onChange: (score: number) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? value;

  const pick = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return 1;
    const x = clientX - box.left;
    return Math.max(1, Math.min(5, Math.round(((x - L) / T) * 4) + 1));
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(pick(e.clientX));
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (drag !== null) setDrag(pick(e.clientX));
  };
  const up = () => {
    if (drag !== null && drag !== value) onChange(drag);
    setDrag(null);
  };
  const key = (e: KeyboardEvent) => {
    if (disabled) return;
    const cur = value ?? 0;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(5, cur + 1 || 1);
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(1, cur - 1 || 1);
    if (e.key === "Home") next = 1;
    if (e.key === "End") next = 5;
    if (/^[1-5]$/.test(e.key)) next = Number(e.key);
    if (next !== null) {
      e.preventDefault();
      if (next !== value) onChange(next);
    }
  };

  const label = value
    ? `내 점수 ${value}점${average != null ? `, 부원 평균 ${average.toFixed(1)}` : ""}`
    : "내 점수, 아직 안 줌";

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={5}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value ? `${value}점` : "안 줌"}
      aria-disabled={disabled}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={key}
      style={{ width: W }}
      className="relative h-11 shrink-0 cursor-pointer touch-none select-none rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
    >
      <span
        className="absolute top-5 h-[3px] rounded-sm bg-white/[0.16]"
        style={{ left: L, width: T }}
      />
      {shown != null && (
        <span
          className="absolute top-5 h-[3px] rounded-sm bg-white"
          style={{ left: L, width: xOf(shown) - L }}
        />
      )}
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className="absolute top-[30px] h-[7px] w-px bg-white/40"
          style={{ left: s === 5 ? xOf(s) - 1 : xOf(s) }}
        />
      ))}
      {average != null && value != null && (
        <span
          className="absolute top-[11px] h-[22px] w-[2px] rounded-[1px] bg-white/45"
          style={{ left: xOf(average) - 1 }}
        />
      )}
      {shown != null && (
        <span
          className="absolute top-[7px] h-[30px] w-4 rounded bg-[#ececec] shadow-[0_2px_8px_rgba(0,0,0,0.7)] transition-[left] duration-100 after:absolute after:inset-x-0.5 after:top-[14px] after:h-[2px] after:bg-[#0c0c0c] after:content-['']"
          style={{ left: xOf(shown) - 8 }}
        />
      )}
    </div>
  );
}
