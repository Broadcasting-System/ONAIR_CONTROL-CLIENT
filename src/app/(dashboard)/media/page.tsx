"use client";

import BannerPanel from "@/components/banner/BannerPanel";
import PageTabs from "@/components/common/PageTabs";
import SectionHeader from "@/components/common/SectionHeader";
import MediaPanel from "@/components/media/MediaPanel";
import { useTabParam } from "@/hooks/useTabParam";

// 송출 = 채널(CH1~5)에 한 화면·2분할·4분할·PIP 송출 (옛 송출 화면 + 스위처), 현수막 = 강당의 긴 화면 (옛 /banner → ?tab=banner)
// 옛 스위처 주소(?tab=switch)는 송출 탭의 분할 배치로 연다
const BROADCAST_TAB_KEYS = ["display", "switch", "banner"] as const;
const BROADCAST_TABS = [
  { key: "display" as const, label: "송출" },
  { key: "banner" as const, label: "현수막" },
];

export default function BroadcastPage() {
  const [tab, setTab] = useTabParam(BROADCAST_TAB_KEYS, "display");

  const lead = (
    <>
      <SectionHeader className="mb-0">송출</SectionHeader>
      <PageTabs
        tabs={BROADCAST_TABS}
        value={tab === "switch" ? "display" : tab}
        onChange={setTab}
        tour="media.tab"
        className="max-md:ml-auto [&>button]:py-3 md:[&>button]:py-1"
      />
    </>
  );

  if (tab === "banner") return <BannerPanel lead={lead} />;
  return <MediaPanel lead={lead} fromSwitcher={tab === "switch"} />;
}
