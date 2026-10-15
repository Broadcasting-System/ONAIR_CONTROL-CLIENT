"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SectionHeader from "@/components/common/SectionHeader";
import { useMe } from "@/hooks/useMe";
import PageTabs from "@/components/common/PageTabs";
import CrewView from "@/components/devices/CrewView";
import MembersPanel from "@/components/devices/MembersPanel";
import SpeakerMappingPanel from "@/components/devices/SpeakerMappingPanel";
import BridgePanel from "@/components/devices/BridgePanel";
import CloudflarePanel from "@/components/devices/CloudflarePanel";
import DevicesPanel from "@/components/devices/DevicesPanel";
import { useTabParam } from "@/hooks/useTabParam";
import { HttpError, request } from "@/lib/http";

const DEVICE_TAB_KEYS = ["members", "cloudflare", "devices", "speakers", "bridges"] as const;
const DEVICE_TABS = [
  { key: "members" as const, label: "부원" },
  { key: "cloudflare" as const, label: "Cloudflare" },
  { key: "devices" as const, label: "기기" },
  { key: "speakers" as const, label: "스피커 매핑" },
  { key: "bridges" as const, label: "강당 장비" },
];

export default function DevicesPage() {
  const { isAdmin, loading } = useMe();
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useTabParam(DEVICE_TAB_KEYS, "members");
  const tabsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // 접근 로그 탭은 로그 메뉴로 옮겼다 — 예전 주소(?tab=logs)는 그쪽으로
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "logs") router.replace("/logs");
  }, [router]);

  // 폰에서 탭 줄이 옆으로 넘치면 고른 탭이 보이게 밀어 둔다
  useEffect(() => {
    const box = tabsRef.current;
    const btn = box?.querySelector<HTMLElement>(`[data-tour="devices.tab.${tab}"]`);
    if (!box || !btn || box.scrollWidth <= box.clientWidth) return;
    const offset = btn.getBoundingClientRect().left - box.getBoundingClientRect().left;
    box.scrollTo({ left: box.scrollLeft + offset - (box.clientWidth - btn.offsetWidth) / 2, behavior: "smooth" });
  }, [tab, isAdmin]);

  const onDenied = useCallback(() => setDenied(true), []);

  // 부장으로 보여도 서버가 기기 목록을 막으면(권한 없음) 관리 화면 전체를 닫는다
  useEffect(() => {
    if (!isAdmin) return;
    request("/devices").catch((e) => {
      if (e instanceof HttpError && e.status === 403) setDenied(true);
    });
  }, [isAdmin]);

  // 부장이 아니면 방송부 보기만 (내 소개는 여기서 고친다)
  if (!isAdmin) {
    if (loading) return null;
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <SectionHeader className="mb-0 max-md:mt-1 max-md:text-[26px] max-md:leading-none">방송부</SectionHeader>
        <CrewView />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader>관리</SectionHeader>
        <p className="font-pretendard text-white/40">권한 없음</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:h-full md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-x-5 md:gap-y-3">
        <SectionHeader className="mb-0 max-md:mt-1 max-md:text-[26px] max-md:leading-none">관리</SectionHeader>
        <div ref={tabsRef} className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
          <PageTabs
            tour="devices.tab"
            tabs={DEVICE_TABS}
            value={tab}
            onChange={setTab}
            className="max-md:[&>button]:min-h-[44px] max-md:[&>button]:shrink-0 max-md:[&>button]:whitespace-nowrap max-md:[&>button]:text-[15px]"
          />
        </div>
      </div>

      {tab === "members" ? (
        <MembersPanel />
      ) : tab === "cloudflare" ? (
        <CloudflarePanel />
      ) : tab === "speakers" ? (
        <SpeakerMappingPanel />
      ) : tab === "bridges" ? (
        <BridgePanel />
      ) : (
        <DevicesPanel onDenied={onDenied} />
      )}
    </div>
  );
}
