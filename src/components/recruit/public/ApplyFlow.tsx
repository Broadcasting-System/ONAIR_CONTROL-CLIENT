"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import NeonButton from "@/components/common/NeonButton";
import { toast } from "@/components/common/Toast";
import { EYEBROW, Horizon, PublicTop, STAGE_H, Warp } from "@/components/recruit/public/Stage";
import { GhostButton } from "@/components/recruit/ui";
import { recruitKeys } from "@/hooks/useRecruit";
import { recruitApi } from "@/lib/recruitApi";
import { dotMd, formatPhone, isPhone, isStudentId, mdhm } from "@/lib/recruitFormat";
import { cn } from "@/lib/utils";
import type { MyApplication, RecruitPublic } from "@/types/recruit";

/**
 * 지원서 — 시안 ApplyFlow.dc.html. 한 화면 한 단계, 가운데 정렬.
 * 동의 → 나(이름·학번·전화번호) → 질문 하나씩 → 확인 → 완료 "합격을 기원해요".
 * 쓰는 중인 글은 이 기기에만 임시 저장한다.
 */

type Draft = {
  agree: boolean;
  name: string;
  studentId: string;
  phone: string;
  answers: Record<string, string>;
};
const EMPTY: Draft = { agree: false, name: "", studentId: "", phone: "", answers: {} };

const INPUT =
  "h-16 w-full border-0 border-b-2 border-white/20 bg-transparent px-1 font-pretendard text-[24px] font-semibold text-white outline-none transition-colors focus:border-[#FF3B3B] md:text-[28px]";

function Next({
  label = "다음",
  disabled,
  onClick,
  busy,
}: {
  label?: string;
  disabled?: boolean;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <NeonButton
      size="lg"
      disabled={disabled || busy}
      onClick={onClick}
      className="h-[60px] w-[200px] md:w-[240px]"
    >
      {busy ? "보내는 중" : label}
    </NeonButton>
  );
}

/** 객관식 '기타' 답 — 옵션에 없는 글 */
const OTHER = "\u0000other";

export default function ApplyFlow({
  data,
  edit,
}: {
  data: RecruitPublic;
  edit?: MyApplication | null;
}) {
  const r = data.recruit!;
  const router = useRouter();
  const qc = useQueryClient();
  const key = `onair.recruit.draft.${r.id}`;
  const [step, setStep] = useState(edit?.application ? 1 : 0);
  const [d, setD] = useState<Draft>(
    edit?.application
      ? {
          agree: true,
          name: edit.application.name,
          studentId: edit.application.studentId,
          phone: edit.application.phone,
          answers: { ...edit.application.answers },
        }
      : EMPTY,
  );
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<MyApplication | null>(null);
  const loaded = useRef(false);

  // 임시 저장 불러오기·저장
  useEffect(() => {
    if (edit?.application) {
      loaded.current = true;
      return;
    }
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setD({ ...EMPTY, ...(JSON.parse(raw) as Draft) });
    } catch {
      /* 저장소 사용 불가 */
    }
    loaded.current = true;
  }, [key, edit]);
  useEffect(() => {
    if (!loaded.current || done || edit?.application) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(d));
        setSaved(true);
      } catch {
        /* 저장 실패는 무시 */
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [d, key, done, edit]);

  const qs = r.questions;
  const total = qs.length + 3; // 동의 · 나 · 질문들 · 확인
  const reviewStep = qs.length + 2;
  const doneStep = total;
  const cur = done ? doneStep : step;
  const go = (n: number) => setStep(Math.max(0, Math.min(reviewStep, n)));
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setAnswer = (qid: string, v: string) =>
    setD((x) => ({ ...x, answers: { ...x.answers, [qid]: v } }));

  const meOk = d.name.trim().length > 0 && isStudentId(d.studentId) && isPhone(d.phone);
  const missing = useMemo(
    () => qs.filter((q) => q.required && !(d.answers[q.id] ?? "").replace(OTHER, "").trim()),
    [qs, d.answers],
  );

  const submit = async () => {
    if (!meOk) return go(1);
    if (missing.length) return go(2 + qs.indexOf(missing[0]));
    setBusy(true);
    try {
      const body = {
        name: d.name.trim(),
        studentId: d.studentId.trim(),
        phone: d.phone,
        answers: Object.fromEntries(
          qs.map((q) => [q.id, (d.answers[q.id] ?? "").replace(OTHER, "").trim()]),
        ),
      };
      const res = edit?.application
        ? await recruitApi.editMine(body)
        : await recruitApi.apply(r.id, { ...body, consent: true });
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* 무시 */
      }
      setDone(res);
      qc.setQueryData(recruitKeys.me, res);
      qc.invalidateQueries({ queryKey: recruitKeys.current });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "지원서를 내지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const eb = (s: string) => <span className={EYEBROW}>{s}</span>;
  const nav = (
    n: React.ReactNode,
    onPrev?: () => void,
    prevLabel = "이전",
    spread?: React.ReactNode,
  ) => (
    <div
      className={cn(
        "flex w-full items-center gap-3 pt-1.5",
        spread !== undefined ? "justify-between" : "justify-center",
      )}
    >
      {onPrev && (
        <GhostButton size="lg" onClick={onPrev}>
          {prevLabel}
        </GhostButton>
      )}
      {spread}
      {n}
    </div>
  );

  const applied = done?.recruit?.applied ?? r.applied;
  const ratio = r.quota ? `${((applied ?? 0) / r.quota).toFixed(1)} : 1` : "";

  return (
    <div className="relative h-[100dvh] w-full overflow-clip break-keep bg-black font-pretendard text-white">
      <Warp soft className="opacity-35" />
      <Horizon top={cur === doneStep ? "calc(100dvh - 260px)" : "calc(100dvh + 60px)"} animate />
      <PublicTop
        center={`방송부 ${r.cohort}기 지원서`}
        right={cur > 0 && cur < doneStep && saved ? "임시 저장됨" : (data.email ?? "")}
      />
      <div className="absolute inset-x-0 top-[72px] z-[5] h-[3px] bg-white/[0.06]">
        <div
          className="h-[3px] bg-[#FF3B3B] shadow-[0_0_10px_rgba(255,59,59,0.8)] transition-[width] duration-500"
          style={{ width: `${Math.round((Math.min(cur, total) / total) * 100)}%` }}
        />
      </div>

      <div className="no-scrollbar absolute inset-x-0 bottom-0 top-[75px] overflow-y-auto">
        {/* 1. 동의 */}
        {cur === 0 && (
          <div
            key="s0"
            className="rc-rise mx-auto flex w-full max-w-[720px] flex-col items-center gap-[26px] px-5 pb-16 pt-[60px] md:pt-[75px]"
          >
            {eb(`STEP 1 / ${total}`)}
            <h1 className={STAGE_H}>
              개인정보 수집·이용에
              <br />
              동의해 주세요
            </h1>
            <div className="w-full border-b border-white/[0.12]">
              {[
                ["모으는 것", "이름, 학번, 전화번호, 지원서 답변"],
                ["쓰는 곳", "방송부 선발과 면접 안내"],
                ["보는 사람", "방송부원"],
                ["보관", "방송부가 지울 때까지"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-[110px_minmax(0,1fr)] border-t border-white/[0.12] py-[18px] text-[17px] md:grid-cols-[140px_minmax(0,1fr)] md:text-[19px]"
                >
                  <span className="text-[16px] text-white/50 md:text-[17px]">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
              {r.consent && (
                <p className="m-0 whitespace-pre-line border-t border-white/[0.12] py-[18px] text-[16px] leading-[1.7] text-white/70">
                  {r.consent}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={d.agree}
                onClick={() => set({ agree: !d.agree })}
                className={cn(
                  "flex h-[60px] items-center gap-4 rounded-2xl border-[1.5px] bg-transparent px-[26px] text-[20px] font-semibold transition-[border-color,box-shadow]",
                  d.agree
                    ? "border-[#FF3B3B] shadow-[0_0_14px_rgba(255,59,59,0.3)]"
                    : "border-white/20",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md border-2",
                    d.agree ? "border-[#FF3B3B] bg-[#FF3B3B]" : "border-white/40",
                  )}
                >
                  {d.agree && <Check size={16} strokeWidth={3} />}
                </span>
                동의해요
              </button>
              <Next disabled={!d.agree} onClick={() => go(1)} />
            </div>
          </div>
        )}

        {/* 2. 나 */}
        {cur === 1 && (
          <div
            key="s1"
            className="rc-rise mx-auto flex w-full max-w-[720px] flex-col items-center gap-[34px] px-5 pb-16 pt-[60px] md:pt-[95px]"
          >
            {eb(`STEP 2 / ${total}`)}
            <h1 className={STAGE_H}>먼저 알려 주세요</h1>
            <div className="flex w-full flex-col gap-2.5">
              <label htmlFor="af-name" className="text-[16px] text-white/55">
                이름
              </label>
              <input
                id="af-name"
                autoComplete="name"
                className={INPUT}
                value={d.name}
                maxLength={20}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
            <div className="flex w-full flex-col gap-7 sm:flex-row">
              <div className="flex flex-col gap-2.5 sm:flex-1">
                <label htmlFor="af-no" className="text-[16px] text-white/55">
                  학번
                </label>
                <input
                  id="af-no"
                  inputMode="numeric"
                  className={cn(
                    INPUT,
                    "tabular-nums",
                    d.studentId.length === 4 && !isStudentId(d.studentId) && "border-[#FF3B3B]/60",
                  )}
                  value={d.studentId}
                  placeholder="1207"
                  onChange={(e) =>
                    set({ studentId: e.target.value.replace(/\D/g, "").slice(0, 4) })
                  }
                />
              </div>
              <div className="flex flex-col gap-2.5 sm:flex-[2]">
                <label htmlFor="af-tel" className="text-[16px] text-white/55">
                  전화번호
                </label>
                <input
                  id="af-tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className={cn(INPUT, "tabular-nums")}
                  value={d.phone}
                  placeholder="010-0000-0000"
                  onChange={(e) => set({ phone: formatPhone(e.target.value) })}
                />
              </div>
            </div>
            {nav(<Next disabled={!meOk} onClick={() => go(2)} />, () => go(0))}
          </div>
        )}

        {/* 3. 질문 하나씩 */}
        {qs.map((q, i) =>
          cur === 2 + i ? (
            <div
              key={q.id}
              className="rc-rise mx-auto flex w-full max-w-[820px] flex-col items-center gap-[26px] px-5 pb-16 pt-[60px] md:pt-[75px]"
            >
              {eb(`STEP ${3 + i} / ${total} · 질문 ${i + 1}`)}
              {q.kind === "text" ? (
                <>
                  <label htmlFor={`af-q-${q.id}`} className={cn(STAGE_H, "whitespace-pre-line")}>
                    {q.title}
                  </label>
                  <textarea
                    id={`af-q-${q.id}`}
                    value={d.answers[q.id] ?? ""}
                    maxLength={q.maxLength || 500}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="h-[220px] w-full resize-none rounded-[18px] border border-white/[0.16] bg-black/50 px-6 py-[22px] font-pretendard text-[18px] leading-[1.8] text-white outline-none focus:border-white/40 md:text-[20px]"
                  />
                  {nav(
                    <Next
                      disabled={q.required && !(d.answers[q.id] ?? "").trim()}
                      onClick={() => go(3 + i)}
                    />,
                    () => go(1 + i),
                    "이전",
                    <span className="text-[15px] text-white/50 tabular-nums">
                      {(d.answers[q.id] ?? "").length} / {q.maxLength || 500}
                    </span>,
                  )}
                </>
              ) : (
                <>
                  <h1 className={cn(STAGE_H, "whitespace-pre-line")}>{q.title}</h1>
                  <div
                    role="radiogroup"
                    aria-label={q.title}
                    className="flex w-full max-w-[720px] flex-col gap-3 pt-1.5"
                  >
                    {q.options.map((o) => {
                      const on = d.answers[q.id] === o;
                      return (
                        <button
                          key={o}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setAnswer(q.id, o)}
                          className={cn(
                            "flex h-[68px] w-full items-center justify-between rounded-2xl border px-6 text-left text-[18px] font-semibold transition-[border-color,background-color,box-shadow] md:text-[20px]",
                            on
                              ? "border-[#FF3B3B] bg-[#FF3B3B]/[0.08] shadow-[0_0_14px_rgba(255,59,59,0.25)]"
                              : "border-white/[0.14] hover:border-white/30",
                          )}
                        >
                          <span>{o}</span>
                          <span
                            className={cn(
                              "h-3 w-3 rounded-full",
                              on
                                ? "bg-[#FF3B3B] shadow-[0_0_10px_#FF3B3B]"
                                : "border-[1.5px] border-white/30",
                            )}
                          />
                        </button>
                      );
                    })}
                    {q.allowOther && (
                      <OtherOption
                        value={
                          q.options.includes(d.answers[q.id] ?? "")
                            ? ""
                            : (d.answers[q.id] ?? "").replace(OTHER, "")
                        }
                        picked={!!d.answers[q.id] && !q.options.includes(d.answers[q.id] ?? "")}
                        onChange={(v) => setAnswer(q.id, v || OTHER)}
                      />
                    )}
                  </div>
                  <div className="w-full max-w-[720px]">
                    {nav(
                      <Next
                        disabled={q.required && !(d.answers[q.id] ?? "").replace(OTHER, "").trim()}
                        onClick={() => go(3 + i)}
                      />,
                      () => go(1 + i),
                      "이전",
                      null,
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null,
        )}

        {/* 4. 확인 */}
        {cur === reviewStep && (
          <div
            key="review"
            className="rc-rise mx-auto flex w-full max-w-[760px] flex-col items-center gap-6 px-5 pb-16 pt-[50px] md:pt-[65px]"
          >
            {eb(`STEP ${total} / ${total}`)}
            <h1 className={STAGE_H}>{edit?.application ? "이대로 고칠까요?" : "이대로 낼까요?"}</h1>
            <div className="w-full border-b border-white/[0.12]">
              <div className="grid grid-cols-[110px_minmax(0,1fr)] border-t border-white/[0.12] py-[18px] text-[17px] md:grid-cols-[140px_minmax(0,1fr)] md:text-[19px]">
                <span className="text-[16px] text-white/50 md:text-[17px]">나</span>
                <span className="tabular-nums">
                  {d.name} · {d.studentId} · {d.phone}
                </span>
              </div>
              {qs.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => go(2 + i)}
                  className="grid w-full grid-cols-[110px_minmax(0,1fr)] border-t border-white/[0.12] py-[18px] text-left text-[17px] md:grid-cols-[140px_minmax(0,1fr)] md:text-[19px]"
                >
                  <span className="line-clamp-2 pr-3 text-[16px] text-white/50 md:text-[17px]">
                    {q.title}
                  </span>
                  <span
                    className={cn(
                      "whitespace-pre-line leading-[1.6]",
                      !(d.answers[q.id] ?? "").replace(OTHER, "").trim() && "text-white/35",
                    )}
                  >
                    {(d.answers[q.id] ?? "").replace(OTHER, "").trim() || "답 없음"}
                  </span>
                </button>
              ))}
            </div>
            {r.applyEnd && (
              <span className="text-[16px] text-white/50 tabular-nums">
                마감 {mdhm(r.applyEnd)} 전까지는 고칠 수 있어요
              </span>
            )}
            <div className="flex gap-3">
              <GhostButton size="lg" onClick={() => go(1)}>
                고치기
              </GhostButton>
              <Next
                label={edit?.application ? "저장하기" : "제출하기"}
                busy={busy}
                onClick={submit}
              />
            </div>
          </div>
        )}

        {/* 5. 완료 */}
        {cur === doneStep && (
          <div
            key="done"
            className="rc-rise flex flex-col items-center gap-[22px] px-5 pb-16 pt-[70px] text-center md:pt-[95px]"
          >
            <span className={EYEBROW}>SUBMITTED</span>
            <h1 className="m-0 font-mbc text-[48px] font-normal leading-[1.2] md:text-[84px]">
              합격을 기원해요
            </h1>
            <span className="text-[18px] text-white/75 md:text-[22px]">
              {edit?.application ? "지원서를 고쳤어요" : "지원서가 들어갔어요"}. 면접 시간은 여기서
              알려 드려요
            </span>
            <div className="flex flex-wrap justify-center pb-2 pt-[18px]">
              {[
                { k: "지금 경쟁률", v: <span className="text-[#FF3B3B]">{ratio}</span> },
                { k: "면접", v: dotMd(r.interview.date) },
                {
                  k: "발표",
                  v: r.announceAt
                    ? `${dotMd(r.announceAt)} ${mdhm(r.announceAt).split(" ").pop()}`
                    : "",
                },
              ]
                .filter((c) => c.v)
                .map((c, i) => (
                  <div
                    key={c.k}
                    className={cn(
                      "flex flex-col items-center gap-2 px-6 md:px-10",
                      i > 0 && "border-l border-white/[0.14]",
                    )}
                  >
                    <span className="text-[15px] text-white/50">{c.k}</span>
                    <span className="text-[24px] font-bold tabular-nums md:text-[30px]">{c.v}</span>
                  </div>
                ))}
            </div>
            <GhostButton size="lg" onClick={() => router.push("/recruit/me")}>
              내 지원 보기
            </GhostButton>
          </div>
        )}
      </div>
    </div>
  );
}

/** 객관식 '기타' — 누르면 글 칸 */
function OtherOption({
  value,
  picked,
  onChange,
}: {
  value: string;
  picked: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label
      className={cn(
        "flex h-[68px] w-full cursor-text items-center gap-4 rounded-2xl border px-6 text-[18px] font-semibold transition-[border-color,background-color,box-shadow] md:text-[20px]",
        picked
          ? "border-[#FF3B3B] bg-[#FF3B3B]/[0.08] shadow-[0_0_14px_rgba(255,59,59,0.25)]"
          : "border-white/[0.14] hover:border-white/30",
      )}
    >
      <span className="shrink-0">기타</span>
      <input
        value={value}
        maxLength={80}
        onFocus={() => !picked && onChange("")}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 border-0 border-b border-white/20 bg-transparent py-1 font-pretendard text-[18px] font-medium text-white outline-none focus:border-[#FF3B3B]"
      />
    </label>
  );
}
