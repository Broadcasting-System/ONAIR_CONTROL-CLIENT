"use client";

import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

/** 종 때문에 지금 못 보내는 까닭 한 줄 — '8:50 종이 곧 울려요' + 종까지 남은 시간 (선생님 바로 방송과 같은 모양) */
export default function BellLine({ text, countdown, className }: { text: string; countdown?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex w-full items-center gap-3", className)}>
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-white/[0.07] text-white/85">
        <Bell size={19} />
      </span>
      <b className="min-w-0 flex-1 font-pretendard text-[15px] leading-snug text-white md:text-[16px]">{text}</b>
      {countdown && <span className="whitespace-nowrap font-orbitron text-[17px] font-bold tabular-nums text-white">{countdown}</span>}
    </div>
  );
}
