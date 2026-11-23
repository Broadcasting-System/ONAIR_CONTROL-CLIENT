"use client";

import MyStatus from "@/components/recruit/public/MyStatus";
import { useMyApplication, useRecruitCurrent } from "@/hooks/useRecruit";

/** 내 지원 (/recruit/me) */
export default function MyRecruitPage() {
  const me = useMyApplication();
  const cur = useRecruitCurrent();
  if (me.isLoading) return <main className="h-[100dvh] bg-black" />;
  const data = me.data ?? {
    recruit: cur.data?.recruit ?? null,
    email: cur.data?.email ?? null,
    application: null,
    interview: null,
    result: null,
    confirm: null,
  };
  return <MyStatus data={data} />;
}
