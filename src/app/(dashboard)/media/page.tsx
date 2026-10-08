"use client";

import BannerPanel from "@/components/banner/BannerPanel";
import PageTabs from "@/components/common/PageTabs";
import SectionHeader from "@/components/common/SectionHeader";
import MediaPanel from "@/components/media/MediaPanel";
import { useTabParam } from "@/hooks/useTabParam";

// 송출 화면 = 채널(CH1~5) 송출, 현수막 = 강당의 긴 화면 (옛 /banner → ?tab=banner)
const BROADCAST_TAB_KEYS = ["display", "banner"] as const;
const BROADCAST_TABS = [
  { key: "display" as const, label: "송출 화면" },
  { key: "banner" as const, label: "현수막" },
];

export default function BroadcastPage() {
  const [tab, setTab] = useTabParam(BROADCAST_TAB_KEYS, "display");

  const lead = (
    <>
      <SectionHeader className="mb-0">송출</SectionHeader>
      <PageTabs tabs={BROADCAST_TABS} value={tab} onChange={setTab} />
    </>
  );

  return tab === "banner" ? <BannerPanel lead={lead} /> : <MediaPanel lead={lead} />;
}
