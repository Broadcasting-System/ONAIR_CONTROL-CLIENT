"use client";

import LogsView from "@/components/logs/LogsView";
import SectionHeader from "@/components/common/SectionHeader";
import { useMe } from "@/hooks/useMe";

/** 로그 — 누가 무엇을 했는지 (부장 이상) */
export default function LogsPage() {
  const { isAdmin, loading } = useMe();
  if (isAdmin) return <LogsView />;
  if (loading) return null;
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader className="mb-0 max-md:mt-1 max-md:text-[26px] max-md:leading-none">로그</SectionHeader>
      <p className="font-pretendard text-white/40">권한이 없어요</p>
    </div>
  );
}
