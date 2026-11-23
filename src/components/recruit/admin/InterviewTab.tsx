"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Lock } from "lucide-react";
import NeonButton from "@/components/common/NeonButton";
import { toast } from "@/components/common/Toast";
import { AdminTop, wa } from "@/components/recruit/admin/common";
import ScoreFader from "@/components/recruit/admin/ScoreFader";
import {
  EmptyCenter,
  GhostButton,
  ModalRow,
  RadioRow,
  RecruitModal,
  useNow,
} from "@/components/recruit/ui";
import { recruitKeys } from "@/hooks/useRecruit";
import { HttpError, retryUnlessClientError } from "@/lib/http";
import { RecordConflict, recruitApi } from "@/lib/recruitApi";
import { buildCue, hm, initial, md, pad2, type CueRow } from "@/lib/recruitFormat";
import { cn } from "@/lib/utils";
import type {
  ApplicationList,
  InterviewRecord,
  Recruit,
  RecruitApplication,
  RecruitPublicInfo,
} from "@/types/recruit";

/**
 * 면접 탭 — 시안 BC4 '면접 관리'(큐시트 + 지원자당 글 문서 하나) · Rest 2 자리 옮기기·이름순 재배정 · Rest 3 권한 없음.
 * 지금 면접 줄은 빨갛게, 지난 줄은 흐리게, 쉬는 시간 줄을 끼운다.
 * 기록은 부원 모두 같이 쓰는 평범한 글. 조금 뒤 저절로 저장하고, 그 사이 남이 고쳤으면(409) 최신 글을 보여 준다.
 */

export default function InterviewTab({
  recruit,
  list,
  isLead,
  tabs,
  focus,
}: {
  recruit: Recruit | RecruitPublicInfo;
  list: ApplicationList | undefined;
  isLead: boolean;
  tabs: React.ReactNode;
  /** 지원자 탭에서 넘어온 사람 */
  focus: string | null;
}) {
  const qc = useQueryClient();
  const now = useNow(1000);
  const minutes = recruit.interview.minutes || 10;
  const rows = useMemo(
    () => buildCue(list?.applications ?? [], list?.breaks ?? [], minutes),
    [list, minutes],
  );
  const slots = rows.filter((r): r is Extract<CueRow, { kind: "slot" }> => r.kind === "slot");
  const nowRow = now ? slots.find((r) => now >= r.at && now < r.end) : undefined;
  const [sel, setSel] = useState<string | null>(focus);
  const [moving, setMoving] = useState<RecruitApplication | null>(null);
  const [byName, setByName] = useState(false);
  const canRecord = !!list?.canRecord;

  useEffect(() => {
    if (focus) setSel(focus);
  }, [focus]);
  // 처음엔 지금 면접 줄(없으면 아직 안 한 첫 줄)
  useEffect(() => {
    if (sel || !slots.length || !now) return;
    setSel((nowRow ?? slots.find((r) => r.end > now) ?? slots[0]).app.id);
  }, [sel, slots, nowRow, now]);

  const cur = slots.find((r) => r.app.id === sel) ?? null;
  const remaining = slots.filter((r) => !(now && r.at <= now)).length;
  const refresh = () => qc.invalidateQueries({ queryKey: recruitKeys.apps(recruit.id) });

  const ivDate = recruit.interview.date ? `${recruit.interview.date}T00:00:00` : null;
  const place = recruit.interview.place;

  if (list && !slots.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <AdminTop tabs={tabs}>
          {ivDate && (
            <span className="text-white/55 tabular-nums">
              {md(ivDate)} · {place}
            </span>
          )}
        </AdminTop>
        <EmptyCenter line="아직 면접 순서가 없어요" />
      </div>
    );
  }

  const cols = canRecord
    ? isLead
      ? "grid-cols-[56px_28px_minmax(0,1fr)_48px_36px_16px]"
      : "grid-cols-[56px_28px_minmax(0,1fr)_48px_36px]"
    : "grid-cols-[56px_28px_minmax(0,1fr)_48px]";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AdminTop tabs={tabs}>
        {ivDate && (
          <span className="text-white/55 tabular-nums">
            {md(ivDate)} · {place}
          </span>
        )}
        {isLead && <GhostButton onClick={() => setByName(true)}>이름순으로 다시 배정</GhostButton>}
      </AdminTop>
      <div className="mt-7 grid min-h-0 flex-1 grid-cols-1 gap-y-8 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* 큐시트 */}
        <div className="no-scrollbar min-h-0 overflow-y-auto pb-6 font-pretendard text-[16px] lg:pr-6">
          <div
            className={cn(
              "grid h-9 items-center gap-x-3 border-t-2 border-white/55 px-3 text-[14px] text-white/50",
              cols,
            )}
          >
            <span className="font-orbitron text-[13px] tracking-[0.16em]">TIME</span>
            <span className="font-orbitron text-[13px] tracking-[0.16em]">NO</span>
            <span>이름</span>
            <span>학번</span>
            {canRecord && <span className="text-right">평균</span>}
            {canRecord && isLead && <span />}
          </div>
          {rows.map((r, i) => {
            if (r.kind === "break") {
              return (
                <div
                  key={`b${i}`}
                  className={cn(
                    "grid h-[34px] items-center gap-x-3 border-t border-white/[0.08] px-3 text-[14px] text-white/50",
                    cols,
                  )}
                >
                  <span className="tabular-nums">{hm(new Date(r.at).toISOString())}</span>
                  <span />
                  <span>쉬는 시간 {r.minutes}분</span>
                </div>
              );
            }
            const isNow = nowRow?.app.id === r.app.id;
            const done = !!now && r.end <= now;
            const picked = sel === r.app.id;
            const prevHot =
              i > 0 &&
              (() => {
                const p = rows[i - 1];
                return p.kind === "slot" && (p.app.id === nowRow?.app.id || p.app.id === sel);
              })();
            return (
              <div
                key={r.app.id}
                role="button"
                tabIndex={0}
                aria-pressed={picked}
                onClick={() => setSel(r.app.id)}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(r.app.id))
                }
                className={cn(
                  "grid h-11 cursor-pointer items-center gap-x-3 border-t border-white/[0.08] px-3 outline-none focus-visible:bg-white/[0.04]",
                  cols,
                  done && !isNow && !picked && "text-white/50",
                  !canRecord && !picked && !isNow && "text-white/50",
                  isNow &&
                    "rounded-[10px] border-t-transparent bg-[#FF3B3B]/10 shadow-[inset_0_0_0_1px_rgba(255,59,59,0.45)]",
                  picked &&
                    !isNow &&
                    "rounded-[10px] border-t-transparent bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)]",
                  prevHot && "border-t-transparent",
                )}
              >
                <span className={cn("tabular-nums", isNow && "text-[#FF3B3B]")}>
                  {Number.isNaN(r.at) ? "" : hm(new Date(r.at).toISOString())}
                </span>
                <span className={cn("tabular-nums", !done && "text-white/55")}>
                  {pad2(r.app.no ?? 0)}
                </span>
                <span className={cn("truncate", (isNow || picked) && "font-bold")}>
                  {r.app.name}
                </span>
                <span className={cn("tabular-nums", !done && "text-white/55")}>
                  {r.app.studentId}
                </span>
                {canRecord && (
                  <span className="text-right tabular-nums">
                    {r.app.average != null ? r.app.average.toFixed(1) : ""}
                  </span>
                )}
                {canRecord && isLead && (
                  <button
                    type="button"
                    aria-label={`${r.app.name} 면접 시간 옮기기`}
                    title="면접 시간 옮기기"
                    disabled={done}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMoving(r.app);
                    }}
                    className="flex text-white/30 hover:text-white disabled:invisible"
                  >
                    <GripVertical size={16} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* 기록 문서 */}
        <div className="flex min-h-[420px] min-w-0 flex-col lg:border-l lg:border-white/[0.08] lg:pl-9">
          {cur &&
            (canRecord ? (
              <RecordDoc
                key={cur.app.id}
                rid={recruit.id}
                app={cur.app}
                slot={cur}
                now={now}
                onScored={refresh}
              />
            ) : (
              <>
                <span className="whitespace-nowrap font-mbc text-[24px] leading-[1.2]">
                  {cur.app.name} <span className="tabular-nums">{cur.app.studentId}</span> 면접 기록
                </span>
                <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-4 border-t border-white/[0.08] pb-20">
                  <Lock size={28} strokeWidth={1.5} className="text-white/45" />
                  <span className="font-pretendard text-[18px] text-white/75">
                    {list?.recordRule ||
                      `${recruit.cohort}기 면접 기록은 ${recruit.cohort - 1}기까지만 볼 수 있어요`}
                  </span>
                </div>
              </>
            ))}
        </div>
      </div>

      {moving && (
        <MoveModal
          rid={recruit.id}
          app={moving}
          slots={slots}
          now={now}
          onClose={() => setMoving(null)}
          onDone={() => {
            setMoving(null);
            refresh();
          }}
        />
      )}
      {byName && (
        <RecruitModal
          title="이름순으로 다시 배정"
          label="이름순으로 다시 배정"
          width={480}
          onClose={() => setByName(false)}
          footer={
            <>
              <GhostButton onClick={() => setByName(false)}>취소</GhostButton>
              <NeonButton
                className="w-[180px]"
                onClick={async () => {
                  try {
                    await recruitApi.scheduleByName(recruit.id);
                    toast.success("이름순으로 다시 배정했어요");
                    setByName(false);
                    refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "배정하지 못했어요");
                  }
                }}
              >
                다시 배정
              </NeonButton>
            </>
          }
        >
          <span className="mt-3 font-pretendard text-white/80 tabular-nums">
            남은 {remaining}명의 면접 시간이 모두 바뀌어요.
          </span>
        </RecruitModal>
      )}
    </div>
  );
}

function MoveModal({
  rid,
  app,
  slots,
  now,
  onClose,
  onDone,
}: {
  rid: string;
  app: RecruitApplication;
  slots: Extract<CueRow, { kind: "slot" }>[];
  now: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pick, setPick] = useState<string | "end" | null>(null);
  const [busy, setBusy] = useState(false);
  const mine = slots.find((s) => s.app.id === app.id);
  const others = slots.filter((s) => s.app.id !== app.id && !(now && s.at <= now));
  const last = slots[slots.length - 1];
  const endAt = last && last.app.id !== app.id ? last.end : null;
  const t = (ms: number) => (Number.isNaN(ms) ? "" : hm(new Date(ms).toISOString()));

  const go = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      await recruitApi.moveSlot(rid, app.id, pick === "end" ? { toEnd: true } : { swapWith: pick });
      toast.success("면접 시간을 옮겼어요");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "옮기지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RecruitModal
      title={
        <>
          {app.name} <span className="tabular-nums">{app.studentId}</span> 면접 시간 옮기기
        </>
      }
      label="면접 시간 옮기기"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>취소</GhostButton>
          <NeonButton className="w-[170px]" disabled={!pick || busy} onClick={go}>
            옮기기
          </NeonButton>
        </>
      }
    >
      <div className="mt-[18px] font-pretendard">
        <ModalRow label="지금">{mine ? `${t(mine.at)} · ${pad2(app.no ?? 0)}` : ""}</ModalRow>
      </div>
      <span className="mb-1 mt-5 font-pretendard text-[14px] text-white/55">옮길 자리</span>
      <div role="radiogroup" className="no-scrollbar max-h-[300px] overflow-y-auto">
        {others.map((s) => (
          <RadioRow key={s.app.id} on={pick === s.app.id} onClick={() => setPick(s.app.id)}>
            <span className="tabular-nums">{t(s.at)}</span>
            <span>
              {s.app.name}
              {wa(s.app.name)} 바꾸기
            </span>
          </RadioRow>
        ))}
        {endAt !== null && (
          <RadioRow on={pick === "end"} onClick={() => setPick("end")}>
            <span className="tabular-nums">{t(endAt)}</span>
            <span>맨 뒤로</span>
          </RadioRow>
        )}
      </div>
    </RecruitModal>
  );
}

/** 지원자 한 명의 면접 기록 — 같이 쓰는 글 하나 + 내 점수 */
function RecordDoc({
  rid,
  app,
  slot,
  now,
  onScored,
}: {
  rid: string;
  app: RecruitApplication;
  slot: Extract<CueRow, { kind: "slot" }>;
  now: number;
  onScored: () => void;
}) {
  const qc = useQueryClient();
  // 열쇠가 매번 새 배열이면 save 가 매번 바뀌어 아래 '떠날 때 저장'이 글자마다 돈다
  const key = useMemo(() => recruitKeys.record(rid, app.id), [rid, app.id]);
  const q = useQuery({
    queryKey: key,
    queryFn: () => recruitApi.record(rid, app.id),
    retry: retryUnlessClientError,
    refetchInterval: 4000,
  });
  const [text, setText] = useState("");
  const [conflict, setConflict] = useState<string | null>(null);
  const dirty = useRef(false);
  const version = useRef(0);
  const saving = useRef(false);
  const latestText = useRef("");

  // 남이 고친 글 — 내가 쓰는 중이 아니면 바로 따라간다
  useEffect(() => {
    const r = q.data;
    if (!r) return;
    if (!dirty.current && !saving.current) {
      setText(r.text);
      latestText.current = r.text;
      version.current = r.version;
    }
  }, [q.data]);

  const save = useCallback(async () => {
    if (!dirty.current || saving.current) return;
    saving.current = true;
    const sending = latestText.current;
    try {
      const r = await recruitApi.saveRecord(rid, app.id, sending, version.current);
      version.current = r.version;
      if (latestText.current === sending) dirty.current = false;
      qc.setQueryData(key, r);
    } catch (e) {
      if (e instanceof RecordConflict) {
        setConflict(latestText.current);
        dirty.current = false;
        version.current = e.latest.version;
        latestText.current = e.latest.text;
        setText(e.latest.text);
        qc.setQueryData(key, e.latest);
      } else {
        toast.error(e instanceof Error ? e.message : "기록을 저장하지 못했어요");
      }
    } finally {
      saving.current = false;
    }
  }, [rid, app.id, qc, key]);

  useEffect(() => {
    if (!dirty.current) return;
    const t = window.setTimeout(save, 1000);
    return () => window.clearTimeout(t);
  }, [text, save]);
  // 다른 사람으로 넘어가거나 화면을 떠날 때 남은 글을 저장
  useEffect(() => () => void save(), [save]);

  const setScore = async (score: number) => {
    try {
      const r = await recruitApi.score(rid, app.id, score);
      qc.setQueryData<InterviewRecord>(key, (old) =>
        old ? { ...old, myScore: r.myScore, scoreCount: r.scoreCount, average: r.average } : r,
      );
      onScored();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "점수를 주지 못했어요");
    }
  };

  const r = q.data;
  const denied = q.error instanceof HttpError && q.error.status === 403;
  const live = !!now && now >= slot.at && now < slot.end;
  const el = live ? Math.floor((now - slot.at) / 1000) : 0;
  const editors = r?.editors?.length ? r.editors : r?.updatedBy ? [r.updatedBy] : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col font-pretendard">
      <div className="flex items-center justify-between gap-4">
        <span className="truncate whitespace-nowrap font-mbc text-[24px] leading-[1.2]">
          {app.name} <span className="tabular-nums">{app.studentId}</span> 면접 기록
        </span>
        <span className="inline-flex shrink-0 pl-1.5">
          {editors.map((e, i) => (
            <span
              key={`${e.id ?? e.name}${i}`}
              title={`${e.name}${e.cohort ? ` · ${e.cohort}기` : ""}`}
              className="-ml-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0c0c0c] bg-[#2b2b2b] text-[12px] font-semibold text-white"
            >
              {initial(e.name)}
            </span>
          ))}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4 text-[14px]">
        <span className="text-white/55 tabular-nums">
          {r?.updatedBy
            ? `${r.updatedBy.name}${r.updatedBy.cohort ? ` · ${r.updatedBy.cohort}기` : ""} · ${hm(r.updatedAt)} 저장`
            : ""}
        </span>
        {live && (
          <span className="text-[#FF3B3B] tabular-nums">
            진행 {pad2(Math.floor(el / 60))}:{pad2(el % 60)}
          </span>
        )}
      </div>
      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-3.5">
          <span className="whitespace-nowrap text-[14px] text-white/55">내 점수</span>
          <ScoreFader
            value={r?.myScore ?? null}
            average={r?.average ?? null}
            disabled={!r || denied}
            onChange={setScore}
          />
        </span>
        {r &&
          (r.myScore == null ? (
            <span className="text-[14px] text-white/55 tabular-nums">{r.scoreCount}명 줌</span>
          ) : (
            <span className="flex items-center gap-2.5 text-[14px]">
              <span className="inline-block h-3.5 w-[2px] rounded-[1px] bg-white/45" />
              <span className="text-white/55">부원</span>
              <span className="text-white/55 tabular-nums">
                {r.average != null ? r.average.toFixed(1) : ""} · {r.scoreCount}명
              </span>
            </span>
          ))}
      </div>
      {conflict !== null && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.14] bg-white/[0.04] px-4 py-2.5 text-[14px]">
          <span className="text-white/80">다른 부원이 먼저 저장했어요</span>
          <span className="flex shrink-0 gap-2">
            <GhostButton
              size="sm"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(conflict)
                  .then(() => toast.success("내가 쓴 글을 복사했어요"))
                  .catch(() => toast.error("복사하지 못했어요"))
              }
            >
              내 글 복사
            </GhostButton>
            <GhostButton size="sm" onClick={() => setConflict(null)}>
              닫기
            </GhostButton>
          </span>
        </div>
      )}
      <textarea
        aria-label={`${app.name} 면접 기록`}
        value={text}
        disabled={!r}
        maxLength={20000}
        onChange={(e) => {
          dirty.current = true;
          latestText.current = e.target.value;
          setText(e.target.value);
        }}
        onBlur={() => void save()}
        className="mb-7 min-h-[280px] w-full flex-1 resize-none border-0 border-t border-white/[0.08] bg-transparent px-0.5 pt-5 text-[16px] leading-[1.85] text-white/90 outline-none disabled:opacity-50"
      />
    </div>
  );
}
