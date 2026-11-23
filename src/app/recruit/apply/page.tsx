"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ApplyFlow from "@/components/recruit/public/ApplyFlow";
import { useMyApplication, useRecruitCurrent } from "@/hooks/useRecruit";

/** 지원서 (/recruit/apply) — 이미 냈으면 내 지원으로, ?edit=1 이면 마감 전 고치기 */
export default function ApplyPage() {
  const router = useRouter();
  const cur = useRecruitCurrent();
  const me = useMyApplication(!!cur.data?.recruit);
  const [edit, setEdit] = useState(false);
  useEffect(() => {
    setEdit(new URLSearchParams(window.location.search).get("edit") === "1");
  }, []);

  const r = cur.data?.recruit;
  const mine =
    me.data?.application?.status === "active" && me.data.recruit?.id === r?.id ? me.data : null;
  const editing = edit && !!mine?.canEdit;
  const leave = !cur.isLoading && !me.isLoading && (!r || !r.accepting || (!!mine && !editing));
  useEffect(() => {
    if (leave) router.replace(mine ? "/recruit/me" : "/recruit");
  }, [leave, mine, router]);

  if (cur.isLoading || me.isLoading || leave || !r) return <main className="h-[100dvh] bg-black" />;
  return (
    <ApplyFlow
      data={{ ...cur.data!, email: cur.data?.email ?? me.data?.email ?? null }}
      edit={editing ? mine : null}
    />
  );
}
