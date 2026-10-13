"use client";

import { ChevronRight } from "lucide-react";
import { useMe } from "@/hooks/useMe";
import { GlassCard, MobileHeader } from "@/components/mobile/ui";
import { useMobileOnly } from "@/components/mobile/useMobileOnly";

/** 폰 더보기 — 탭에 없는 메뉴 */
const ITEMS: { href: string; label: string; sub: string; admin?: boolean }[] = [
  { href: "/main", label: "방송", sub: "TTS · 방송 모니터링 · 스피커 관리" },
  { href: "/media", label: "송출", sub: "CH1~5 송출 화면" },
  { href: "/media?tab=banner", label: "현수막", sub: "기본 · 점수보드 · 타이머" },
  { href: "/time", label: "시보", sub: "시간표 · 특별(P) 모드" },
  { href: "/speakers", label: "스피커 지도", sub: "층별 지도 · 검색" },
  { href: "/files", label: "파일", sub: "이미지 · 동영상 · 음원 · PPT" },
  { href: "/logs", label: "로그", sub: "누가 무엇을 했는지", admin: true },
];

export default function MobileMorePage() {
  useMobileOnly("/main");
  const { isAdmin } = useMe();
  return (
    <div className="flex flex-col">
      <MobileHeader title="더보기" />
      <div className="flex flex-col gap-2.5" data-tour="more.list">
        {ITEMS.filter((i) => !i.admin || isAdmin).map((i) => (
          <GlassCard key={i.href} href={i.href} className="flex items-center justify-between py-4">
            <div>
              <p className="font-pretendard text-[16px] font-semibold">{i.label}</p>
              <p className="mt-0.5 font-pretendard text-[12.5px] text-white/45">{i.sub}</p>
            </div>
            <ChevronRight size={18} className="text-white/35" />
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
