"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronRight } from "lucide-react";
import { useMe } from "@/hooks/useMe";
import { GlassCard, MobileHeader } from "@/components/mobile/ui";
import { useMobileOnly } from "@/components/mobile/useMobileOnly";
import MyDevicesModal from "@/components/devices/MyDevicesModal";
import { useRequestCounts } from "@/components/requests/RequestsPanel";

/** 폰 더보기 — 탭에 없는 메뉴 */
const ITEMS: { href: string; label: string; sub: string; admin?: boolean; operator?: boolean }[] = [
  { href: "/main", label: "방송", sub: "TTS · 방송 모니터링 · 스피커 관리" },
  { href: "/media", label: "송출", sub: "CH1~5 송출 화면" },
  { href: "/media?tab=banner", label: "현수막", sub: "기본 · 점수보드 · 타이머" },
  { href: "/requests", label: "요청함", sub: "선생님 요청 · 선생님 승인", operator: true },
  { href: "/time", label: "시보", sub: "시간표 · 특별(P) 모드" },
  { href: "/speakers", label: "스피커 지도", sub: "층별 지도 · 검색" },
  { href: "/files", label: "파일", sub: "이미지 · 동영상 · 음원 · PPT" },
  { href: "/logs", label: "로그", sub: "누가 무엇을 했는지", admin: true },
];

const noop = () => () => {};

/** ONAIR 앱(iOS·안드로이드·맥·윈도우) 안에서 열렸는지 — 앱이 심어 두는 값 */
function useAppPlatform(): string | null {
  return useSyncExternalStore(
    noop,
    () => (window as unknown as { __ONAIR_APP_PLATFORM__?: string }).__ONAIR_APP_PLATFORM__ ?? null,
    () => null,
  );
}

export default function MobileMorePage() {
  useMobileOnly("/main");
  const { isAdmin, me, canOperate } = useMe();
  const reqCounts = useRequestCounts(canOperate);
  const newRequests = (reqCounts.data?.new ?? 0) + (reqCounts.data?.pendingTeachers ?? 0);
  const app = useAppPlatform();
  const [devicesOpen, setDevicesOpen] = useState(false);
  const devices = me?.status === "approved" ? (me.devices ?? []) : [];
  return (
    <div className="flex flex-col">
      <MobileHeader title="더보기" />
      <div className="flex flex-col gap-2.5" data-tour="more.list">
        {ITEMS.filter((i) => (!i.admin || isAdmin) && (!i.operator || canOperate)).map((i) => (
          <GlassCard key={i.href} href={i.href} className="flex items-center justify-between py-4">
            <div>
              <p className="font-pretendard text-[16px] font-semibold">{i.label}</p>
              <p className="mt-0.5 font-pretendard text-[12.5px] text-white/45">{i.sub}</p>
            </div>
            <span className="flex items-center gap-2">
              {i.href === "/requests" && newRequests > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF3B3B] px-1.5 font-pretendard text-[12.5px] font-extrabold text-white">
                  {newRequests}
                </span>
              )}
              <ChevronRight size={18} className="text-white/35" />
            </span>
          </GlassCard>
        ))}
        {devices.length > 0 && (
          <button
            type="button"
            data-tour="more.devices"
            onClick={() => setDevicesOpen(true)}
            className="flex items-center justify-between rounded-[20px] border border-white/[0.09] bg-white/[0.045] px-4 py-4 text-left backdrop-blur-md active:bg-white/[0.08]"
          >
            <div>
              <p className="font-pretendard text-[16px] font-semibold">내 기기</p>
              <p className="mt-0.5 font-pretendard text-[12.5px] text-white/45">
                {devices.map((d) => d.name).join(" · ")}
              </p>
            </div>
            <ChevronRight size={18} className="text-white/35" />
          </button>
        )}
        {app && (
          <button
            type="button"
            onClick={() => void fetch("/__onair/action/settings", { method: "POST" })}
            className="flex items-center justify-between rounded-[20px] border border-white/[0.09] bg-white/[0.045] px-4 py-4 text-left backdrop-blur-md active:bg-white/[0.08]"
          >
            <div>
              <p className="font-pretendard text-[16px] font-semibold">앱 설정</p>
              <p className="mt-0.5 font-pretendard text-[12.5px] text-white/45">서버 주소 · 접속 키</p>
            </div>
            <ChevronRight size={18} className="text-white/35" />
          </button>
        )}
      </div>
      {devicesOpen && <MyDevicesModal onClose={() => setDevicesOpen(false)} />}
    </div>
  );
}
