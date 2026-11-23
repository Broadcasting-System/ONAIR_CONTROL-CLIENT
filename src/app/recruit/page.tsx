"use client";

import RecruitLanding, { NoRecruit } from "@/components/recruit/public/RecruitLanding";
import { useMyApplication, useRecruitCurrent } from "@/hooks/useRecruit";

/** 공고 페이지 (/recruit) */
export default function RecruitPage() {
  const cur = useRecruitCurrent();
  const me = useMyApplication(!!cur.data?.recruit);
  if (cur.isLoading) return <main className="h-[100dvh] bg-black" />;
  const r = cur.data?.recruit;
  if (!r || r.phase === "draft") return <NoRecruit email={cur.data?.email} />;
  const applied = me.data?.application?.status === "active" && me.data.recruit?.id === r.id;
  return (
    <RecruitLanding
      data={{ ...cur.data!, email: cur.data?.email ?? me.data?.email ?? null }}
      applied={applied}
    />
  );
}
