"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useTour } from "@/stores/tourStore";
import { cn } from "@/lib/utils";

/**
 * CUE 화면 튜토리얼 (시안 A) — 그 화면으로 옮기고, data-tour 이름표 요소만 뚫어 보여 주고, 옆에 설명 카드.
 * [다음]을 누르거나 강조된 요소를 직접 눌러도 다음 단계. 이름표가 없거나 안 보이면 설명만 가운데.
 */

const PAD = 8; // 강조 구멍 여백
const CARD_W = 340;
const GAP = 18; // 구멍과 카드 사이
const FIND_MS = 3000; // 화면을 옮긴 뒤 요소를 기다리는 시간

type Rect = { x: number; y: number; w: number; h: number };

/** 단계 주소(/time?tab=schedule)와 지금 주소가 같은 화면인지 — 경로와 tab 만 본다 */
function samePage(href: string): boolean {
  const u = new URL(href, window.location.origin);
  const here = new URL(window.location.href);
  return u.pathname === here.pathname && (u.searchParams.get("tab") ?? "") === (here.searchParams.get("tab") ?? "");
}

function findTarget(id: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(id)}"]`);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
}

/** 카드 자리 — 왼쪽(시안 A) → 오른쪽 → 아래 → 위 순으로 들어가는 곳 */
function placeCard(hole: Rect | null, cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampY = (y: number) => Math.min(Math.max(16, y), vh - cardH - 16);
  const clampX = (x: number) => Math.min(Math.max(16, x), vw - CARD_W - 16);
  if (!hole) return { left: (vw - CARD_W) / 2, top: (vh - cardH) / 2, side: "none" as const, arrow: 0 };
  const midY = hole.y + hole.h / 2;
  const midX = hole.x + hole.w / 2;
  if (hole.x - GAP - CARD_W >= 16) {
    const top = clampY(midY - cardH / 2);
    return { left: hole.x - GAP - CARD_W, top, side: "left" as const, arrow: midY - top };
  }
  if (hole.x + hole.w + GAP + CARD_W <= vw - 16) {
    const top = clampY(midY - cardH / 2);
    return { left: hole.x + hole.w + GAP, top, side: "right" as const, arrow: midY - top };
  }
  if (hole.y + hole.h + GAP + cardH <= vh - 16) {
    const left = clampX(midX - CARD_W / 2);
    return { left, top: hole.y + hole.h + GAP, side: "below" as const, arrow: midX - left };
  }
  const left = clampX(midX - CARD_W / 2);
  return { left, top: Math.max(16, hole.y - GAP - cardH), side: "above" as const, arrow: midX - left };
}

export default function TourOverlay() {
  const tour = useTour((s) => s.tour);
  const index = useTour((s) => s.index);
  const next = useTour((s) => s.next);
  const prev = useTour((s) => s.prev);
  const stop = useTour((s) => s.stop);
  const router = useRouter();
  const step = tour?.steps[index];

  const [el, setEl] = useState<HTMLElement | null>(null);
  const [hole, setHole] = useState<Rect | null>(null);
  const [searching, setSearching] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(180);

  // 1) 그 화면으로 옮기고 2) 이름표 요소를 기다린다
  useEffect(() => {
    if (!step) return;
    setEl(null);
    setHole(null);
    if (!samePage(step.href)) router.push(step.href);
    if (!step.target) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const until = Date.now() + FIND_MS;
    let timer = 0;
    const look = () => {
      const found = findTarget(step.target!);
      if (found) {
        found.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        setEl(found);
        setSearching(false);
      } else if (Date.now() < until) {
        timer = window.setTimeout(look, 120);
      } else {
        setSearching(false); // 못 찾음 — 설명만 가운데
      }
    };
    timer = window.setTimeout(look, samePage(step.href) ? 0 : 250);
    return () => window.clearTimeout(timer);
  }, [step, router]);

  // 요소가 움직이거나(스크롤·창 크기·애니메이션) 사라지면 따라간다
  useEffect(() => {
    if (!el) return;
    let raf = 0;
    const tick = () => {
      if (!el.isConnected) {
        const again = step?.target ? findTarget(step.target) : null;
        if (again) setEl(again);
        else setHole(null);
        return;
      }
      const r = rectOf(el);
      setHole((h) => (h && h.x === r.x && h.y === r.y && h.w === r.w && h.h === r.h ? h : r));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [el, step]);

  // 강조된 요소를 직접 누르면 그 클릭은 그대로 두고 다음 단계로
  useEffect(() => {
    if (!el) return;
    const onClick = () => window.setTimeout(next, 60);
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [el, next]);

  // Esc 닫기, ←·→ 이동
  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour, next, prev, stop]);

  useLayoutEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight);
  }, [step, hole]);

  if (!tour || !step) return null;

  const total = tour.steps.length;
  const last = index === total - 1;
  const shown = hole && !searching ? hole : null;
  const pos = placeCard(shown, cardH);
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  // 구멍 밖 클릭은 막고 구멍 안은 그대로 누를 수 있게 — 겉 사각형에서 구멍을 뺀 모양
  const blocker = shown
    ? `path(evenodd, "M0 0H${vw}V${vh}H0Z M${shown.x} ${shown.y}h${shown.w}v${shown.h}h${-shown.w}Z")`
    : undefined;

  return (
    <div className="pointer-events-none fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-label={tour.title}>
      {/* 어두운 막 + 구멍 */}
      {shown ? (
        <div
          className="pointer-events-none absolute rounded-[14px] transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{
            left: shown.x,
            top: shown.y,
            width: shown.w,
            height: shown.h,
            boxShadow: "0 0 0 9999px rgba(4,4,8,.74)",
          }}
        >
          <div className="absolute -inset-1 rounded-[17px] border-2 border-white/85 shadow-[0_0_22px_rgba(255,255,255,.35)]" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[rgba(4,4,8,.74)]" />
      )}
      <div className="pointer-events-auto absolute inset-0" style={{ clipPath: blocker }} onClick={(e) => e.stopPropagation()} />

      {/* 설명 카드 */}
      <div
        ref={card}
        className="pointer-events-auto absolute rounded-2xl border border-white/12 bg-[#141418] px-[18px] pb-4 pt-[18px] shadow-[0_20px_50px_rgba(0,0,0,.6)] transition-[left,top] duration-300 ease-out motion-reduce:transition-none"
        style={{ left: pos.left, top: pos.top, width: CARD_W }}
      >
        {pos.side === "left" && (
          <span
            className="absolute -right-[19px] h-0 w-0 border-[10px] border-transparent border-l-[#141418]"
            style={{ top: pos.arrow - 10 }}
          />
        )}
        {pos.side === "right" && (
          <span
            className="absolute -left-[19px] h-0 w-0 border-[10px] border-transparent border-r-[#141418]"
            style={{ top: pos.arrow - 10 }}
          />
        )}
        {pos.side === "below" && (
          <span
            className="absolute -top-[19px] h-0 w-0 border-[10px] border-transparent border-b-[#141418]"
            style={{ left: pos.arrow - 10 }}
          />
        )}
        {pos.side === "above" && (
          <span
            className="absolute -bottom-[19px] h-0 w-0 border-[10px] border-transparent border-t-[#141418]"
            style={{ left: pos.arrow - 10 }}
          />
        )}

        <div className="flex items-center justify-between">
          <span className="font-orbitron text-[12px] tracking-[0.12em] text-white/45">
            STEP {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={stop}
            aria-label="튜토리얼 닫기"
            className="-mr-1 rounded-md p-1 text-white/40 transition-colors hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-2.5 font-pretendard text-[18px] font-bold text-white">{step.title}</p>
        <p className="mt-1.5 whitespace-pre-line font-pretendard text-[15px] leading-relaxed text-white/75">
          {step.text}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-[5px]">
            {tour.steps.map((_, k) => (
              <span
                key={k}
                className={cn("h-1.5 rounded-full transition-all", k === index ? "w-[18px] bg-white" : "w-1.5 bg-white/20")}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={prev}
                className="rounded-[10px] border border-white/15 px-3.5 py-2 font-pretendard text-[14px] text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                이전
              </button>
            )}
            <button
              type="button"
              onClick={next}
              autoFocus
              className="rounded-[10px] bg-white px-[18px] py-2 font-pretendard text-[14px] font-bold text-[#0a0a0c] transition-opacity hover:opacity-90"
            >
              {last ? "끝" : "다음"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
