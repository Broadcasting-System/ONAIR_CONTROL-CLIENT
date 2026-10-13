"use client";

import SectionHeader from "@/components/common/SectionHeader";
import AccessLogPanel from "@/components/devices/AccessLogPanel";
import { useMe } from "@/hooks/useMe";

/** 로그 — 누가 무엇을 했는지 (부장 이상). 관리 › 접근 로그 탭과 같은 화면 */
export default function LogsPage() {
  const { isAdmin, loading } = useMe();
  return (
    <div className="flex min-h-0 flex-col gap-4 md:h-full md:gap-6">
      <SectionHeader className="mb-0 max-md:mt-1 max-md:text-[26px] max-md:leading-none">로그</SectionHeader>
      {isAdmin ? <AccessLogPanel /> : loading ? null : <p className="font-pretendard text-white/40">권한 없음</p>}
    </div>
  );
}
