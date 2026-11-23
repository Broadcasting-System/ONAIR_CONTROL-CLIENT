"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Link2, Maximize2, Search } from "lucide-react";
import ConfirmModal from "@/components/common/ConfirmModal";
import { toast } from "@/components/common/Toast";
import { AdminTop } from "@/components/recruit/admin/common";
import {
  ClassGroup,
  EmptyCenter,
  GhostButton,
  IconButton,
  NameKey,
  PaneRow,
  Ring,
  useNow,
} from "@/components/recruit/ui";
import { recruitKeys } from "@/hooks/useRecruit";
import { recruitApi } from "@/lib/recruitApi";
import { groupByClass, leftWords, mdhm } from "@/lib/recruitFormat";
import { cn } from "@/lib/utils";
import type {
  ApplicationList,
  Recruit,
  RecruitApplication,
  RecruitPublicInfo,
} from "@/types/recruit";

/**
 * 지원자 탭 — 시안 BC4 '지원자'(반별 이름 칸 + 오른쪽 답) · Rest 1 '지원서 상세'.
 * 부원은 이름·학번·면접 시각만, 부장은 답까지 본다.
 */

export function CloseBar({
  recruit,
  isLead,
  onClose,
  busy,
}: {
  recruit: Recruit | RecruitPublicInfo;
  isLead: boolean;
  onClose: () => void;
  busy: boolean;
}) {
  const now = useNow(30_000);
  const end = recruit.applyEnd ? Date.parse(recruit.applyEnd) : 0;
  if (recruit.phase === "open" && end && now) {
    return (
      <>
        <span className="text-[#FF3B3B] tabular-nums">마감까지 {leftWords(end - now)}</span>
        {isLead && (
          <GhostButton disabled={busy} onClick={onClose}>
            마감하기
          </GhostButton>
        )}
      </>
    );
  }
  if (recruit.phase === "upcoming")
    return <span className="text-white/55 tabular-nums">{mdhm(recruit.applyStart)} 시작</span>;
  return null;
}

export default function ApplicantsTab({
  recruit,
  list,
  isLead,
  tabs,
  onOpenInterview,
}: {
  recruit: Recruit | RecruitPublicInfo;
  list: ApplicationList | undefined;
  isLead: boolean;
  tabs: React.ReactNode;
  onOpenInterview: (aid: string) => void;
}) {
  const qc = useQueryClient();
  const [find, setFind] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<"purge" | "cancel" | null>(null);
  const apps = useMemo(() => list?.applications ?? [], [list]);
  const shown = useMemo(() => {
    const k = find.trim();
    return k ? apps.filter((a) => a.name.includes(k) || a.studentId.includes(k)) : apps;
  }, [apps, find]);
  const groups = useMemo(() => groupByClass(shown), [shown]);
  // 처음엔 첫 지원자를 오른쪽에 보여 준다
  const cur = apps.find((a) => a.id === sel) ?? (find ? null : apps[0]) ?? null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: recruitKeys.apps(recruit.id) });
    qc.invalidateQueries({ queryKey: recruitKeys.list });
  };
  const closeRecruit = async () => {
    setBusy(true);
    try {
      await recruitApi.close(recruit.id);
      toast.success("공고를 마감했어요");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "마감하지 못했어요");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (purge: boolean) => {
    if (!cur) return;
    await recruitApi.removeApplication(recruit.id, cur.id, purge).catch((e) => {
      toast.error(e instanceof Error ? e.message : "처리하지 못했어요");
      throw e;
    });
    toast.success(purge ? "지원서를 지웠어요" : "지원 취소로 처리했어요");
    setSel(null);
    setDetail(false);
    refresh();
  };

  const closeBar = (
    <CloseBar recruit={recruit} isLead={isLead} onClose={closeRecruit} busy={busy} />
  );

  if (list && apps.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <AdminTop tabs={tabs}>{closeBar}</AdminTop>
        <EmptyCenter line="아직 지원자가 없어요">
          <GhostButton
            onClick={() => {
              navigator.clipboard
                ?.writeText(`${window.location.origin}/recruit`)
                .then(() => toast.success("공고 링크를 복사했어요"))
                .catch(() => toast.error("복사하지 못했어요"));
            }}
          >
            <Link2 size={18} strokeWidth={1.5} />
            공고 링크 복사
          </GhostButton>
        </EmptyCenter>
      </div>
    );
  }

  const questions = recruit.questions;

  // 지원서 상세 (부장)
  if (detail && cur && isLead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <AdminTop tabs={tabs}>
          {cur.no != null && (
            <GhostButton onClick={() => onOpenInterview(cur.id)}>면접 시간 바꾸기</GhostButton>
          )}
        </AdminTop>
        <div className="mt-6 flex shrink-0 items-center gap-3">
          <IconButton label="지원자 목록으로" onClick={() => setDetail(false)} className="-ml-3">
            <ChevronLeft size={24} strokeWidth={1.5} />
          </IconButton>
          <span className="font-mbc text-[32px]">{cur.name}</span>
          <span className="text-[18px] text-white/55 tabular-nums">{cur.studentId}</span>
          {cur.class != null && <span className="text-[18px] text-white/55">{cur.class}반</span>}
        </div>
        <div className="mt-5 grid min-h-0 flex-1 grid-cols-1 gap-x-12 gap-y-8 font-pretendard text-[16px] lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="no-scrollbar min-h-0 overflow-y-auto">
            {questions.map((q) => {
              const ans = cur.answers?.[q.id] ?? "";
              return (
                <div
                  key={q.id}
                  className="flex flex-col gap-2.5 border-t border-white/[0.08] py-5 last:border-b"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-bold">{q.title}</span>
                    <span className="shrink-0 text-[14px] text-white/55">
                      {q.kind === "text" ? "주관식" : "객관식"}
                    </span>
                  </div>
                  {q.kind === "text" ? (
                    <p
                      className={cn(
                        "m-0 whitespace-pre-line leading-[1.75] text-white/90",
                        !ans && "text-white/35",
                      )}
                    >
                      {ans || "답 없음"}
                    </p>
                  ) : (
                    <div>
                      {[
                        ...q.options,
                        ...(q.allowOther && ans && !q.options.includes(ans) ? [ans] : []),
                      ].map((o) => (
                        <div
                          key={o}
                          className={cn(
                            "flex h-9 items-center gap-3",
                            ans === o ? "text-white" : "text-white/50",
                          )}
                        >
                          <Ring on={ans === o} />
                          {o}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex min-w-0 flex-col lg:border-l lg:border-white/[0.08] lg:pl-10">
            <PaneRow label="학번" className="border-t-0">
              {cur.studentId}
            </PaneRow>
            <PaneRow label="이름">{cur.name}</PaneRow>
            <PaneRow label="연락처">{cur.phone}</PaneRow>
            <PaneRow label="제출">{mdhm(cur.submittedAt)}</PaneRow>
            <PaneRow label="개인정보 동의" className="border-b border-white/[0.08]">
              {cur.consentAt ? `동의 · ${mdhm(cur.consentAt)}` : ""}
            </PaneRow>
            <span className="pb-2.5 pt-8 text-[16px] font-bold">면접</span>
            <button type="button" onClick={() => onOpenInterview(cur.id)} className="text-left">
              <PaneRow label="면접 시간">
                <span className="inline-flex items-center gap-1">
                  {cur.interviewAt
                    ? `${mdhm(cur.interviewAt)} · ${(recruit.interview.place || "").split(" · ")[0]}`
                    : "배정 전"}
                  <ChevronRight size={16} className="text-white/40" />
                </span>
              </PaneRow>
            </button>
            <button type="button" onClick={() => onOpenInterview(cur.id)} className="text-left">
              <PaneRow label="면접 기록" className="border-b border-white/[0.08]">
                <span className="inline-flex items-center gap-1">
                  {cur.name} {cur.studentId} 면접 기록
                  <ChevronRight size={16} className="text-white/40" />
                </span>
              </PaneRow>
            </button>
            <div className="mb-7 mt-auto flex justify-end pt-8">
              <GhostButton size="sm" onClick={() => setAsk("cancel")}>
                지원 취소 처리
              </GhostButton>
            </div>
          </div>
        </div>
        <ConfirmModal
          isOpen={ask === "cancel"}
          onClose={() => setAsk(null)}
          onConfirm={() => remove(false)}
          title="지원 취소 처리"
          message={`${cur.name} ${cur.studentId} 지원을 취소로 처리할까요?`}
          confirmText="취소 처리"
          cancelText="돌아가기"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AdminTop tabs={tabs}>
        <span className="relative w-[220px]">
          <Search
            size={18}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3.5 top-[13px] text-white/40"
          />
          <input
            aria-label="찾기"
            placeholder="이름이나 학번"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-[#141414] pl-[42px] pr-3.5 font-pretendard text-[16px] text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
        </span>
        {closeBar}
      </AdminTop>
      <div className="mt-7 grid min-h-0 flex-1 grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="no-scrollbar flex min-h-0 min-w-0 flex-col gap-[18px] overflow-y-auto pb-8">
          {groups.map((g) => (
            <ClassGroup key={g.key} label={g.label} count={g.items.length}>
              {g.items.map((a) => (
                <NameKey
                  key={a.id}
                  top={a.studentId}
                  name={a.name}
                  selected={cur?.id === a.id}
                  onClick={() => setSel(a.id)}
                />
              ))}
            </ClassGroup>
          ))}
          {!groups.length && (
            <span className="py-10 text-center font-pretendard text-white/40">
              찾는 지원자가 없어요
            </span>
          )}
        </div>
        {cur && (
          <ApplicantPane
            a={cur}
            recruit={recruit}
            isLead={isLead}
            onDetail={() => setDetail(true)}
            onPurge={() => setAsk("purge")}
          />
        )}
      </div>
      {cur && (
        <ConfirmModal
          isOpen={ask === "purge"}
          onClose={() => setAsk(null)}
          onConfirm={() => remove(true)}
          title="지원서 지우기"
          message={`${cur.name} ${cur.studentId} 지원서와 면접 기록을 지울까요? 되돌릴 수 없어요.`}
          confirmText="지우기"
          cancelText="돌아가기"
        />
      )}
    </div>
  );
}

function ApplicantPane({
  a,
  recruit,
  isLead,
  onDetail,
  onPurge,
}: {
  a: RecruitApplication;
  recruit: Recruit | RecruitPublicInfo;
  isLead: boolean;
  onDetail: () => void;
  onPurge: () => void;
}) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-col font-pretendard text-[16px] lg:border-l lg:border-white/[0.08] lg:pl-10">
      <div className="flex items-baseline justify-between gap-3 pb-[18px]">
        <span className="flex items-center gap-1 text-[16px] font-bold">
          {a.name}
          {isLead && (
            <IconButton label="지원서 크게 보기" onClick={onDetail} className="h-8 w-8">
              <Maximize2 size={15} strokeWidth={1.5} />
            </IconButton>
          )}
        </span>
        <span className="text-white/55 tabular-nums">
          {a.studentId}
          {a.phone ? ` · ${a.phone}` : ""}
        </span>
      </div>
      {isLead ? (
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {recruit.questions.map((q) => (
            <div key={q.id} className="flex flex-col gap-2 border-t border-white/[0.08] py-[18px]">
              <span className="text-[14px] text-white/55">{q.title}</span>
              <p
                className={cn(
                  "m-0 whitespace-pre-line leading-[1.7] text-white/[0.88]",
                  !a.answers?.[q.id] && "text-white/35",
                )}
              >
                {a.answers?.[q.id] || "답 없음"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1">
          <PaneRow label="학번">{a.studentId}</PaneRow>
          <PaneRow label="면접 시간" className="border-b border-white/[0.08]">
            {a.interviewAt ? mdhm(a.interviewAt) : "배정 전"}
          </PaneRow>
        </div>
      )}
      {isLead && (
        <div className="mb-7 flex min-h-[52px] items-center justify-between gap-4 border-t border-white/[0.08]">
          <span className="text-white/55 tabular-nums">제출 {mdhm(a.submittedAt)}</span>
          <GhostButton size="sm" onClick={onPurge}>
            지원서 지우기
          </GhostButton>
        </div>
      )}
    </aside>
  );
}
