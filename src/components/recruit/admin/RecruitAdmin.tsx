"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import NeonButton from "@/components/common/NeonButton";
import PageTabs from "@/components/common/PageTabs";
import Select from "@/components/common/Select";
import { toast } from "@/components/common/Toast";
import AnnounceTab from "@/components/recruit/admin/AnnounceTab";
import ApplicantsTab from "@/components/recruit/admin/ApplicantsTab";
import { AdminTop } from "@/components/recruit/admin/common";
import InterviewTab from "@/components/recruit/admin/InterviewTab";
import NoticeTab from "@/components/recruit/admin/NoticeTab";
import { EmptyCenter } from "@/components/recruit/ui";
import { recruitKeys, useRecruitCurrent } from "@/hooks/useRecruit";
import { useMe } from "@/hooks/useMe";
import { useTabParam } from "@/hooks/useTabParam";
import { HttpError, retryUnlessClientError } from "@/lib/http";
import { recruitApi } from "@/lib/recruitApi";
import type { Recruit, RecruitPublicInfo } from "@/types/recruit";

/**
 * SETUP › 방송부 모집 — 시안 RecruitAdminBC4(+Rest).
 * 부장: 공고(질문·설정) / 지원자 N / 면접 / 발표.  부원: 지원자 / 면접 (면접 기록은 모집 기수보다 앞 기수만).
 */

const TAB_KEYS = ["notice", "applicants", "interview", "announce"] as const;
type Tab = (typeof TAB_KEYS)[number];

export default function RecruitAdmin() {
  const qc = useQueryClient();
  const { isAdmin, canOperate, loading } = useMe();
  const [tab, setTab] = useTabParam<Tab>(TAB_KEYS, "applicants");
  const [rid, setRid] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // 부장은 초안까지 전부, 부원은 공개 공고
  const all = useQuery({
    queryKey: recruitKeys.list,
    queryFn: recruitApi.list,
    enabled: isAdmin,
    retry: retryUnlessClientError,
  });
  const pub = useRecruitCurrent();
  const recruits = useMemo(() => all.data ?? [], [all.data]);

  useEffect(() => {
    if (!isAdmin || rid || !recruits.length) return;
    const live = recruits.find((r) => r.phase === "open" || r.phase === "upcoming");
    setRid((live ?? recruits[0]).id);
  }, [isAdmin, rid, recruits]);

  const recruit: Recruit | RecruitPublicInfo | null = isAdmin
    ? (recruits.find((r) => r.id === rid) ?? null)
    : (pub.data?.recruit ?? null);
  const id = recruit?.id ?? null;

  const apps = useQuery({
    queryKey: recruitKeys.apps(id ?? ""),
    queryFn: () => recruitApi.applications(id!),
    enabled: !!id && (isAdmin || recruit?.phase !== "draft"),
    retry: retryUnlessClientError,
    refetchInterval: 15_000,
  });

  // 부원은 공고·발표 탭이 없다
  const tabs = (isAdmin ? TAB_KEYS : (["applicants", "interview"] as const)).map((k) => ({
    key: k as Tab,
    label:
      k === "notice"
        ? "공고"
        : k === "applicants"
          ? `지원자${apps.data ? ` ${apps.data.total}` : ""}`
          : k === "interview"
            ? "면접"
            : "발표",
  }));
  const current: Tab = tabs.some((t) => t.key === tab)
    ? tab
    : isAdmin && recruit?.phase === "draft"
      ? "notice"
      : "applicants";
  const draftNow = recruit?.phase === "draft";

  const tabsEl = (
    <span className="flex items-center gap-3">
      <PageTabs tabs={tabs} value={current} onChange={setTab} />
      {isAdmin && recruits.length > 1 && (
        <Select
          aria-label="모집 고르기"
          value={rid}
          onChange={(v) => setRid(v)}
          options={recruits.map((r) => ({
            value: r.id,
            label: `${r.cohort}기${r.status === "draft" ? " 초안" : ""}`,
          }))}
          className="h-9 rounded-[10px] text-[14px]"
        />
      )}
    </span>
  );

  const create = async () => {
    setCreating(true);
    try {
      const cohorts = recruits.map((r) => r.cohort);
      const next = cohorts.length ? Math.max(...cohorts) + 1 : undefined;
      const r = await recruitApi.create(next ? { cohort: next } : ({} as { cohort: number }));
      qc.setQueryData<Recruit[]>(recruitKeys.list, (l) => [r, ...(l ?? [])]);
      setRid(r.id);
      setTab("notice");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "모집을 만들지 못했어요");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return null;
  if (!canOperate) {
    return (
      <Shell>
        <EmptyCenter line="방송부원만 볼 수 있어요" />
      </Shell>
    );
  }
  const listLoading = isAdmin ? all.isLoading : pub.isLoading;
  if (listLoading) return <Shell />;
  if (isAdmin && all.error instanceof HttpError && all.error.status === 403) {
    return (
      <Shell>
        <EmptyCenter line="권한이 없어요" />
      </Shell>
    );
  }

  if (!recruit) {
    return (
      <Shell>
        <AdminTop tabs={<PageTabs tabs={tabs} value={current} onChange={setTab} />} />
        <EmptyCenter line="아직 모집이 없어요">
          {isAdmin && (
            <NeonButton
              size="lg"
              disabled={creating}
              className="h-12 w-[220px] [&_.nb-t]:text-[16px]"
              onClick={create}
            >
              모집 만들기
            </NeonButton>
          )}
        </EmptyCenter>
      </Shell>
    );
  }

  const openInterview = (aid: string) => {
    setFocus(aid);
    setTab("interview");
  };

  return (
    <Shell>
      {current === "notice" && isAdmin && <NoticeTab recruit={recruit as Recruit} tabs={tabsEl} />}
      {current === "applicants" &&
        (draftNow ? (
          <>
            <AdminTop tabs={tabsEl} />
            <EmptyCenter line="아직 지원자가 없어요" />
          </>
        ) : (
          <ApplicantsTab
            recruit={recruit}
            list={apps.data}
            isLead={isAdmin}
            tabs={tabsEl}
            onOpenInterview={openInterview}
          />
        ))}
      {current === "interview" && (
        <InterviewTab
          recruit={recruit}
          list={apps.data}
          isLead={isAdmin}
          tabs={tabsEl}
          focus={focus}
        />
      )}
      {current === "announce" && isAdmin && (
        <AnnounceTab recruit={recruit as Recruit} list={apps.data} tabs={tabsEl} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-120px)] flex-col break-keep font-pretendard text-white md:h-[calc(100dvh-80px)] md:min-h-0">
      {children}
    </div>
  );
}
