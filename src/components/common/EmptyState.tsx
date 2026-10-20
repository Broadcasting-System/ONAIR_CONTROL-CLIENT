import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 빈 목록·빈 칸 안내 — 화면마다 같은 한 줄.
 * 글은 '~가 없어요' 한 문장만 (예: "올린 파일이 없어요", "기록이 없어요"). 아이콘·설명 줄·점선 상자 없이.
 * size: md = 목록·패널 한가운데, sm = 좁은 칸(팝오버·작은 목록) 안.
 */
export default function EmptyState({
  children,
  size = "md",
  className,
}: {
  children: ReactNode;
  size?: "md" | "sm";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-center font-pretendard text-white/40",
        size === "md" ? "py-10 text-[15px]" : "py-4 text-[13.5px]",
        className,
      )}
    >
      {children}
    </p>
  );
}
