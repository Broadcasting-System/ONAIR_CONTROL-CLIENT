"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, List } from "lucide-react";
import NeonButton from "@/components/common/NeonButton";
import { toast } from "@/components/common/Toast";
import { AdminTop, DateTimeField } from "@/components/recruit/admin/common";
import {
  ClassGroup,
  EmptyCenter,
  GhostButton,
  IconButton,
  Led,
  ModalRow,
  NameKey,
  RadioRow,
  RecruitModal,
  type KeyTone,
} from "@/components/recruit/ui";
import { recruitKeys } from "@/hooks/useRecruit";
import { retryUnlessClientError } from "@/lib/http";
import { recruitApi, type ResultValue } from "@/lib/recruitApi";
import { groupByClass, mdhm } from "@/lib/recruitFormat";
import { cn } from "@/lib/utils";
import type {
  ApplicationList,
  ConfirmationList,
  ConfirmationRow,
  Recruit,
  RecruitApplication,
} from "@/types/recruit";

/**
 * 발표 탭 (부장) — 시안 BC4 '발표 관리' · Rest 4 발표 예약 · 5 추가 합격 · 6 입부 확정 현황.
 * 발표 전: 이름 칸마다 합격·예비 n·불합격을 정하고 [발표 예약].
 * 발표 뒤: 입부 확정·아직·거절 LED, 예비 순번대로 [추가 합격], 확정 기한 바꾸기.
 */

type Status = { top: React.ReactNode; tone: KeyTone; label: string };

function statusOf(a: RecruitApplication, announced: boolean): Status {
  const r = a.result;
  if (r === "reserve")
    return { top: <>예비 {a.reserveRank}</>, tone: "plain", label: `예비 ${a.reserveRank}` };
  if (r === "fail") return { top: "불합격", tone: "dim", label: "불합격" };
  if (r === "pass") {
    if (!announced)
      return { top: <span className="text-white">합격</span>, tone: "ok", label: "합격" };
    const c = a.confirm;
    if (c === "accepted")
      return {
        top: (
          <>
            <Led on />
            <span className="text-white">입부 확정</span>
          </>
        ),
        tone: "on",
        label: "입부 확정",
      };
    if (c === "declined")
      return {
        top: (
          <>
            <Led />
            <span className="text-[#FF3B3B]">거절</span>
          </>
        ),
        tone: "pass",
        label: "거절",
      };
    if (c === "expired")
      return {
        top: (
          <>
            <Led />
            <span className="text-[#FF3B3B]">기한 지남</span>
          </>
        ),
        tone: "pass",
        label: "기한 지남",
      };
    return {
      top: (
        <>
          <Led />
          아직
        </>
      ),
      tone: "pass",
      label: "아직",
    };
  }
  return { top: <span className="text-white/40">미정</span>, tone: "plain", label: "미정" };
}

export default function AnnounceTab({
  recruit,
  list,
  tabs,
}: {
  recruit: Recruit;
  list: ApplicationList | undefined;
  tabs: React.ReactNode;
}) {
  const qc = useQueryClient();
  const announced = recruit.phase === "announced";
  const apps = useMemo(() => list?.applications ?? [], [list]);
  const groups = useMemo(() => groupByClass(apps), [apps]);
  const [sel, setSel] = useState<string | null>(null);
  const [modal, setModal] = useState<"announce" | "promote" | "due" | null>(null);
  const [view, setView] = useState<"keys" | "table">("keys");
  const conf = useQuery({
    queryKey: recruitKeys.confirmations(recruit.id),
    queryFn: () => recruitApi.confirmations(recruit.id),
    enabled: announced,
    retry: retryUnlessClientError,
    refetchInterval: 20_000,
  });
  const cur = apps.find((a) => a.id === sel) ?? apps[0] ?? null;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: recruitKeys.apps(recruit.id) });
    qc.invalidateQueries({ queryKey: recruitKeys.list });
    qc.invalidateQueries({ queryKey: recruitKeys.confirmations(recruit.id) });
  };

  const counts = useMemo(() => {
    const c = { pass: 0, reserve: 0, fail: 0, undecided: 0 };
    for (const a of apps) c[a.result ?? "undecided"]++;
    return c;
  }, [apps]);

  const setResult = async (a: RecruitApplication, v: "pass" | "fail" | "reserve") => {
    if ((a.result ?? null) === v) return;
    const others = apps.filter((x) => x.result === "reserve" && x.id !== a.id);
    const body: Record<string, ResultValue> = {};
    // 예비에서 빠지면 뒤 순번을 하나씩 당기고, 새 예비는 맨 뒤 순번
    if (a.result === "reserve" && a.reserveRank) {
      for (const x of others)
        if ((x.reserveRank ?? 0) > a.reserveRank)
          body[x.id] = { reserve: (x.reserveRank ?? 1) - 1 };
    }
    body[a.id] = v === "reserve" ? { reserve: others.length + 1 } : v;
    try {
      await recruitApi.setResults(recruit.id, body);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "결과를 바꾸지 못했어요");
    }
  };

  const c = conf.data;
  const nextReserve = c?.reserves[0] ?? null;
  const canPromote = !!c && c.vacancies > 0 && !!nextReserve;

  if (list && apps.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <AdminTop tabs={tabs} />
        <EmptyCenter line="아직 지원자가 없어요" />
      </div>
    );
  }

  const top = announced ? (
    <>
      <span className="tabular-nums">
        확정 {c?.counts.accepted ?? 0} / {c?.quota ?? recruit.quota ?? 0}
      </span>
      <span className="text-white/55 tabular-nums">
        아직 {c?.counts.pending ?? 0} · 거절 {(c?.counts.declined ?? 0) + (c?.counts.expired ?? 0)}
      </span>
      <span className="flex rounded-[10px] bg-white/5 p-1">
        <IconButton
          label="이름 칸으로 보기"
          aria-pressed={view === "keys"}
          onClick={() => setView("keys")}
          className={cn("h-8 w-8", view === "keys" && "bg-white/20 text-white")}
        >
          <LayoutGrid size={16} strokeWidth={1.5} />
        </IconButton>
        <IconButton
          label="입부 확정 현황"
          aria-pressed={view === "table"}
          onClick={() => setView("table")}
          className={cn("h-8 w-8", view === "table" && "bg-white/20 text-white")}
        >
          <List size={16} strokeWidth={1.5} />
        </IconButton>
      </span>
      {view === "table" && canPromote && (
        <NeonButton
          size="lg"
          className="h-12 w-[270px] [&_.nb-t]:text-[16px]"
          onClick={() => {
            setSel(nextReserve!.id);
            setModal("promote");
          }}
        >
          예비 {nextReserve!.reserveRank} {nextReserve!.name} 추가 합격
        </NeonButton>
      )}
    </>
  ) : (
    <>
      <span className="tabular-nums">합격 {counts.pass}</span>
      <span className="text-white/55 tabular-nums">예비 {counts.reserve}</span>
      {counts.undecided > 0 && (
        <span className="text-white/55 tabular-nums">미정 {counts.undecided}</span>
      )}
      {recruit.announceAt ? (
        <>
          <span className="text-white/75 tabular-nums">{mdhm(recruit.announceAt)} 발표</span>
          <GhostButton
            onClick={async () => {
              try {
                await recruitApi.announce(recruit.id, null);
                toast.success("발표 예약을 취소했어요");
                refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "취소하지 못했어요");
              }
            }}
          >
            예약 취소
          </GhostButton>
        </>
      ) : (
        <NeonButton
          size="lg"
          className="h-12 w-[180px] [&_.nb-t]:text-[16px]"
          onClick={() => setModal("announce")}
        >
          발표 예약
        </NeonButton>
      )}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AdminTop tabs={tabs}>{top}</AdminTop>

      {announced && view === "table" ? (
        <ConfirmTable data={c} recruit={recruit} />
      ) : (
        <div className="mt-7 grid min-h-0 flex-1 grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="no-scrollbar flex min-h-0 min-w-0 flex-col gap-[18px] overflow-y-auto pb-8">
            {groups.map((g) => (
              <ClassGroup key={g.key} label={g.label} count={g.items.length} cols={5}>
                {g.items.map((a) => {
                  const s = statusOf(a, announced);
                  return (
                    <NameKey
                      key={a.id}
                      top={s.top}
                      name={a.name}
                      sub={a.studentId}
                      tone={s.tone}
                      selected={cur?.id === a.id}
                      onClick={() => setSel(a.id)}
                    />
                  );
                })}
              </ClassGroup>
            ))}
          </div>
          <aside className="flex min-w-0 flex-col font-pretendard text-[16px] lg:border-l lg:border-white/[0.08] lg:pl-10">
            {cur && (
              <>
                <span className="pb-2.5 text-[14px] text-white/55">
                  {statusOf(cur, announced).label}
                </span>
                <div className="flex items-baseline justify-between pb-[18px]">
                  <span className="font-bold">
                    {cur.name}{" "}
                    <span className="font-normal text-white/55 tabular-nums">{cur.studentId}</span>
                  </span>
                  {cur.average != null ? (
                    <span className="tabular-nums">평균 {cur.average.toFixed(1)}</span>
                  ) : cur.scoreCount ? (
                    <span className="text-white/55 tabular-nums">{cur.scoreCount}명 줌</span>
                  ) : null}
                </div>
                {!announced && (
                  <div role="radiogroup" aria-label={`${cur.name} 결과`} className="mb-2">
                    <RadioRow on={cur.result === "pass"} onClick={() => setResult(cur, "pass")}>
                      합격
                    </RadioRow>
                    <RadioRow
                      on={cur.result === "reserve"}
                      onClick={() => setResult(cur, "reserve")}
                    >
                      예비
                      {cur.result === "reserve" ? (
                        <span className="tabular-nums"> {cur.reserveRank}</span>
                      ) : (
                        ""
                      )}
                    </RadioRow>
                    <RadioRow on={cur.result === "fail"} onClick={() => setResult(cur, "fail")}>
                      불합격
                    </RadioRow>
                  </div>
                )}
                {list?.canRecord && <RecordPeek rid={recruit.id} aid={cur.id} />}
                {announced && canPromote && nextReserve?.id === cur.id && (
                  <NeonButton
                    size="lg"
                    className="mt-5 h-12 w-full [&_.nb-t]:text-[16px]"
                    onClick={() => setModal("promote")}
                  >
                    {cur.name} 추가 합격
                  </NeonButton>
                )}
              </>
            )}
            {announced && (
              <>
                <span className={cn("pb-2.5 text-[16px] font-bold", cur ? "mt-11" : "")}>발표</span>
                <div className="flex min-h-[52px] items-center gap-4 border-t border-white/[0.08]">
                  <span className="w-[84px] text-white/55">발표</span>
                  <span className="flex-1 tabular-nums">{mdhm(recruit.announceAt)}</span>
                  <span className="text-white/55">완료</span>
                </div>
                <div className="flex min-h-[52px] items-center gap-4 border-y border-white/[0.08]">
                  <span className="w-[84px] text-white/55">확정 기한</span>
                  <span className="flex-1 tabular-nums">{mdhm(recruit.confirmBy)}</span>
                  <GhostButton size="sm" onClick={() => setModal("due")}>
                    바꾸기
                  </GhostButton>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {modal === "announce" && (
        <AnnounceModal
          recruit={recruit}
          apps={apps}
          onClose={() => setModal(null)}
          onDone={() => (setModal(null), refresh())}
        />
      )}
      {modal === "promote" && nextReserve && c && (
        <PromoteModal
          rid={recruit.id}
          reserve={nextReserve}
          conf={c}
          onClose={() => setModal(null)}
          onDone={() => (setModal(null), refresh())}
        />
      )}
      {modal === "due" && (
        <DueModal
          recruit={recruit}
          onClose={() => setModal(null)}
          onDone={() => (setModal(null), refresh())}
        />
      )}
    </div>
  );
}

/** 면접 기록 맛보기 (기록 권한이 있을 때) */
function RecordPeek({ rid, aid }: { rid: string; aid: string }) {
  const q = useQuery({
    queryKey: recruitKeys.record(rid, aid),
    queryFn: () => recruitApi.record(rid, aid),
    retry: false,
  });
  const r = q.data;
  if (!r || !r.text.trim()) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-white/[0.08] py-4">
      <div className="flex justify-between text-[14px] text-white/55">
        <span>
          {r.updatedBy
            ? `${r.updatedBy.name}${r.updatedBy.cohort ? ` · ${r.updatedBy.cohort}기` : ""}`
            : ""}
        </span>
        {r.myScore != null && <span className="tabular-nums">{r.myScore}점</span>}
      </div>
      <p className="m-0 line-clamp-6 whitespace-pre-line leading-[1.7] text-white/[0.88]">
        {r.text}
      </p>
    </div>
  );
}

function ConfirmTable({ data, recruit }: { data: ConfirmationList | undefined; recruit: Recruit }) {
  const groups = useMemo(() => groupByClass(data?.applications ?? []), [data]);
  const cols = "grid-cols-[80px_minmax(0,1fr)_180px_200px]";
  const label = (r: ConfirmationRow) =>
    r.status === "accepted" ? (
      <span className="flex items-center gap-2">
        <Led on />
        확정 완료
      </span>
    ) : r.status === "declined" ? (
      <span className="flex items-center gap-2">
        <Led />
        <span className="text-[#FF3B3B]">거절</span>
      </span>
    ) : r.status === "expired" ? (
      <span className="flex items-center gap-2">
        <Led />
        <span className="text-[#FF3B3B]">기한 지남</span>
      </span>
    ) : (
      <span className="flex items-center gap-2 text-white/55">
        <Led />
        아직
      </span>
    );
  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-8 font-pretendard text-[16px]">
      <div className="mt-6 flex justify-end">
        <span className="text-white/55 tabular-nums">
          확정 기한 {mdhm(data?.confirmBy ?? recruit.confirmBy)}
        </span>
      </div>
      <div className="mt-3">
        <div
          className={cn(
            "grid h-9 items-center gap-x-3 border-t-2 border-white/55 px-3 text-[14px] text-white/50",
            cols,
          )}
        >
          <span>학번</span>
          <span>이름</span>
          <span>상태</span>
          <span>시각</span>
        </div>
        {groups.map((g) => (
          <div key={g.key}>
            <div className="flex h-11 items-center border-t border-white/[0.14] px-3 font-bold">
              {g.label}{" "}
              <span className="ml-1.5 font-normal text-white/55 tabular-nums">
                {g.items.length}
              </span>
            </div>
            {g.items.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "grid h-11 items-center gap-x-3 border-t border-white/[0.08] px-3",
                  cols,
                )}
              >
                <span className="text-white/55 tabular-nums">{r.studentId}</span>
                <span className="truncate">
                  {r.name}
                  {r.promoted && <span className="ml-2 text-[14px] text-white/55">추가 합격</span>}
                </span>
                {label(r)}
                <span className="text-white/55 tabular-nums">{mdhm(r.at)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnnounceModal({
  recruit,
  apps,
  onClose,
  onDone,
}: {
  recruit: Recruit;
  apps: RecruitApplication[];
  onClose: () => void;
  onDone: () => void;
}) {
  const tomorrow = () => {
    const d = new Date(Date.now() + 86400000);
    d.setHours(18, 0, 0, 0);
    return d.toISOString();
  };
  const [at, setAt] = useState<string | null>(tomorrow());
  const [busy, setBusy] = useState(false);
  const pass = apps.filter((a) => a.result === "pass");
  const fail = apps.filter((a) => a.result === "fail");
  const reserve = apps.filter((a) => a.result === "reserve");
  const go = async () => {
    if (!at) return;
    setBusy(true);
    try {
      await recruitApi.announce(recruit.id, at);
      toast.success(`${mdhm(at)}에 발표해요`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "예약하지 못했어요");
    } finally {
      setBusy(false);
    }
  };
  const who = (list: RecruitApplication[]) => list[0]?.name ?? "지원자";
  return (
    <RecruitModal
      title="발표 예약"
      label="발표 예약"
      width={720}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>취소</GhostButton>
          <NeonButton className="w-[190px]" disabled={!at || busy} onClick={go}>
            발표 예약
          </NeonButton>
        </>
      }
    >
      <div className="mt-[18px] font-pretendard">
        <ModalRow label="발표 일시">
          <DateTimeField label="발표" value={at} onChange={setAt} />
        </ModalRow>
        <ModalRow label="받는 사람">지원자 {apps.length}명</ModalRow>
      </div>
      <span className="mb-2.5 mt-[22px] font-pretendard text-[14px] text-white/55">미리 보기</span>
      <div className="grid grid-cols-1 gap-3 font-pretendard sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-white/[0.12] bg-[#0c0c0c] px-[18px] py-4">
          <span className="text-[14px] text-white/55 tabular-nums">합격 {pass.length}명</span>
          <p className="m-0 text-[15px] leading-[1.7] text-white/90">
            {who(pass)}님, {recruit.cohort}기 방송부에 합격했어요.
            {recruit.confirmBy
              ? ` ${mdhm(recruit.confirmBy)}까지 입부를 확정해 주세요.`
              : " 입부를 확정해 주세요."}
          </p>
          <span className="inline-flex h-9 items-center self-start rounded-[10px] border border-white/30 px-3.5 text-[14px] font-medium">
            입부 확정
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-white/[0.12] bg-[#0c0c0c] px-[18px] py-4">
          <span className="text-[14px] text-white/55 tabular-nums">
            불합격 {fail.length}명 · 예비 {reserve.length}명
          </span>
          <p className="m-0 text-[15px] leading-[1.7] text-white/90">
            {who(fail)}님, 이번 {recruit.cohort}기 모집에서는 함께하지 못하게 됐어요. 지원해 줘서
            고마워요.
          </p>
        </div>
      </div>
    </RecruitModal>
  );
}

function PromoteModal({
  rid,
  reserve,
  conf,
  onClose,
  onDone,
}: {
  rid: string;
  reserve: ConfirmationList["reserves"][number];
  conf: ConfirmationList;
  onClose: () => void;
  onDone: () => void;
}) {
  const later = () => {
    const d = new Date(Date.now() + 86400000);
    d.setMinutes(0, 0, 0);
    d.setHours(Math.max(18, d.getHours()));
    return d.toISOString();
  };
  const [due, setDue] = useState<string | null>(later());
  const [busy, setBusy] = useState(false);
  const gone = conf.declined[conf.declined.length - 1];
  const go = async () => {
    setBusy(true);
    try {
      await recruitApi.promote(rid, { count: 1, confirmBy: due });
      toast.success(`${reserve.name} 추가 합격`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "추가 합격을 띄우지 못했어요");
    } finally {
      setBusy(false);
    }
  };
  return (
    <RecruitModal
      title={
        <>
          예비 {reserve.reserveRank} {reserve.name}{" "}
          <span className="tabular-nums">{reserve.studentId}</span> 추가 합격
        </>
      }
      label={`예비 ${reserve.reserveRank} ${reserve.name} 추가 합격`}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>취소</GhostButton>
          <NeonButton className="w-[190px]" disabled={busy} onClick={go}>
            추가 합격
          </NeonButton>
        </>
      }
    >
      <div className="mt-[18px] font-pretendard">
        {gone && (
          <ModalRow label="빈자리">
            {gone.name} {gone.studentId} · {mdhm(gone.at ?? gone.confirmBy)}{" "}
            {gone.status === "expired" ? "기한 지남" : "거절"}
          </ModalRow>
        )}
        {reserve.average != null ? (
          <ModalRow label="면접 평균">{reserve.average.toFixed(1)}</ModalRow>
        ) : reserve.scoreCount ? (
          <ModalRow label="면접 점수">{reserve.scoreCount}명 줌</ModalRow>
        ) : null}
        <ModalRow label="입부 확정 기한">
          <DateTimeField label="입부 확정 기한" value={due} onChange={setDue} />
        </ModalRow>
      </div>
    </RecruitModal>
  );
}

function DueModal({
  recruit,
  onClose,
  onDone,
}: {
  recruit: Recruit;
  onClose: () => void;
  onDone: () => void;
}) {
  const [due, setDue] = useState<string | null>(recruit.confirmBy);
  const [busy, setBusy] = useState(false);
  return (
    <RecruitModal
      title="입부 확정 기한"
      label="입부 확정 기한 바꾸기"
      width={520}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>취소</GhostButton>
          <NeonButton
            className="w-[150px]"
            disabled={!due || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await recruitApi.save(recruit.id, { confirmBy: due });
                toast.success("확정 기한을 바꿨어요");
                onDone();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "바꾸지 못했어요");
              } finally {
                setBusy(false);
              }
            }}
          >
            바꾸기
          </NeonButton>
        </>
      }
    >
      <div className="mt-[18px] font-pretendard">
        <ModalRow label="확정 기한">
          <DateTimeField label="확정 기한" value={due} onChange={setDue} />
        </ModalRow>
      </div>
    </RecruitModal>
  );
}
