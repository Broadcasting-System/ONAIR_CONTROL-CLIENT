"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 좁은 창 가림막 — 자기 상자 크기를 재서(ResizeObserver) minWidth·minHeight 보다 작으면
 * 안의 화면 대신 "창을 더 크게 해 주세요" 한 줄만 보인다. 글자가 겹치거나 찌그러지는 빽빽한 화면용.
 *
 * - 상자 너비는 부모가 정한다(블록처럼 꽉 찬다). 높이를 볼 때는 부모가 높이를 정해 줘야 한다
 *   (안의 화면이 높이를 정하면, 가림막으로 바뀌는 순간 높이가 줄어 다시 커지지 않는다).
 * - 처음 재기 전에는 안의 화면을 그대로 그린다.
 */
export default function MinSizeGuard({
  minWidth = 0,
  minHeight = 0,
  className,
  fallbackClassName,
  children,
}: {
  minWidth?: number;
  minHeight?: number;
  className?: string;
  /** 가림막 상자 모양 (기본 높이 240px) — 원래 화면과 높이를 맞출 때 */
  fallbackClassName?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (w: number, h: number) =>
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    const r = el.getBoundingClientRect();
    if (r.width > 0) measure(Math.round(r.width), Math.round(r.height));
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0) measure(Math.round(width), Math.round(height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const small = !!size && ((minWidth > 0 && size.w < minWidth) || (minHeight > 0 && size.h < minHeight));

  return (
    <div ref={ref} className={cn("relative min-w-0", className)}>
      {small ? (
        <div
          className={cn(
            "flex h-full min-h-[240px] w-full items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-4",
            fallbackClassName,
          )}
        >
          <p className="whitespace-nowrap font-pretendard text-base font-semibold text-white/60">창을 더 크게 해 주세요</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
