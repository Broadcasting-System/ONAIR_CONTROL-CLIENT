"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import NeonButton from "@/components/common/NeonButton";
import { cn } from "@/lib/utils";
import type { ChatQuestion, ChatQuestionCard } from "@/types/chat";

type Answer = { picked: string[]; text: string };

/** 질문 하나의 답 글 — 고른 것 + 직접 쓴 것 */
function valueOf(q: ChatQuestion, a: Answer): string {
  const text = a.text.trim();
  if (q.multi) return [...a.picked, ...(text ? [text] : [])].join(", ");
  return text || a.picked[0] || "";
}

/** 보낼 글 — 질문이 하나면 값만, 여럿이면 "이름표: 값" 줄마다 */
function answerText(card: ChatQuestionCard, answers: Answer[]): string {
  if (card.questions.length === 1) return valueOf(card.questions[0], answers[0]);
  return card.questions.map((q, i) => `${q.header}: ${valueOf(q, answers[i])}`).join("\n");
}

/**
 * CUE 질문 카드 (시안 C) — 정할 것을 한 카드에서 1/N, 2/N 차례로 고르고 마지막에 한 번에 보낸다.
 * 선택지마다 설명·추천 표시, 직접 쓰기 칸. 답하면 흐려지고 고른 값만 남는다.
 */
export default function QuestionCard({
  card,
  disabled,
  stale,
  onAnswer,
}: {
  card: ChatQuestionCard;
  /** 답을 받는 중이라 지금은 못 보냄 */
  disabled: boolean;
  /** 답하지 않고 대화가 넘어갔다 */
  stale: boolean;
  onAnswer: (cardId: string, text: string) => void;
}) {
  const qs = card.questions;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(() => qs.map(() => ({ picked: [], text: "" })));
  const q = qs[index];
  const a = answers[index];
  const last = index === qs.length - 1;
  const ready = useMemo(() => valueOf(q, a) !== "", [q, a]);

  const set = (next: Partial<Answer>) =>
    setAnswers((all) => all.map((x, i) => (i === index ? { ...x, ...next } : x)));

  const pick = (label: string) => {
    if (q.multi) set({ picked: a.picked.includes(label) ? a.picked.filter((p) => p !== label) : [...a.picked, label] });
    else set({ picked: [label], text: "" });
  };

  const go = () => {
    if (!ready || disabled) return;
    if (!last) setIndex(index + 1);
    else onAnswer(card.id, answerText(card, answers));
  };

  if (card.answer || stale) {
    const lines = card.answer ? card.answer.split("\n").filter(Boolean) : [];
    return (
      <div className="flex flex-col gap-1.5 rounded-xl border border-white/12 bg-white/[0.035] p-4 opacity-60">
        {qs.length === 1 && <p className="font-pretendard text-[15px] font-semibold text-white">{qs[0].question}</p>}
        {lines.length ? (
          lines.map((l, i) => (
            <p key={i} className="flex items-center gap-1.5 font-pretendard text-[13.5px] text-white/80">
              <Check size={13} className="shrink-0" />
              {qs.length > 1 ? l.replace(/^([^:]+):\s*/, "$1 · ") : l}
            </p>
          ))
        ) : (
          <p className="font-pretendard text-[13.5px] text-white/55">답하지 않았어요</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/12 bg-white/[0.035] p-4">
      {qs.length > 1 && (
        <div className="flex items-center justify-between">
          <span className="font-pretendard text-[12px] tracking-[0.12em] text-white/40">
            질문 {index + 1} / {qs.length}
          </span>
          <div className="flex gap-[5px]" aria-hidden>
            {qs.map((_, k) => (
              <span
                key={k}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  k === index ? "w-[18px] bg-white" : k < index ? "w-1.5 bg-[#FF4A43]/80" : "w-1.5 bg-white/20",
                )}
              />
            ))}
          </div>
        </div>
      )}
      {qs.slice(0, index).map((pq, k) => (
        <p key={k} className="-mt-1 flex items-center gap-1.5 font-pretendard text-[13.5px] text-white/70">
          <Check size={13} className="shrink-0" />
          {pq.header} · {valueOf(pq, answers[k])}
        </p>
      ))}

      <p className="font-pretendard text-[15px] font-semibold leading-snug text-white">
        {q.question}
        {q.multi && <span className="ml-1.5 text-[12px] font-normal text-white/40">(여러 개)</span>}
      </p>

      {q.options.length > 0 && (
        <div role={q.multi ? "group" : "radiogroup"} aria-label={q.question} className="flex flex-col gap-2">
          {q.options.map((o) => {
            const on = a.picked.includes(o.label);
            return (
              <button
                key={o.label}
                type="button"
                role={q.multi ? "checkbox" : "radio"}
                aria-checked={on}
                disabled={disabled}
                onClick={() => pick(o.label)}
                onDoubleClick={() => !q.multi && go()}
                className={cn(
                  "flex items-start gap-3 rounded-[10px] border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
                  on
                    ? "border-[#FF4A43]/70 bg-[#FF4A43]/[0.08]"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center border-[1.5px]",
                    q.multi ? "rounded-[5px]" : "rounded-full",
                    on ? "border-[#FF4A43]" : "border-white/35",
                  )}
                >
                  {on &&
                    (q.multi ? (
                      <Check size={12} strokeWidth={3} className="text-[#FF4A43]" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-[#FF4A43]" />
                    ))}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 font-pretendard text-[14.5px] font-semibold text-white">
                    {o.label}
                    {o.recommended && (
                      <span className="rounded-full border border-[#FF4A43]/50 px-[7px] py-px text-[11px] font-medium text-[#FF6B66]">
                        추천
                      </span>
                    )}
                  </span>
                  {o.description && (
                    <span className="mt-0.5 block font-pretendard text-[13px] leading-snug text-white/55">
                      {o.description}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {q.allowText && (
        <input
          value={a.text}
          disabled={disabled}
          onChange={(e) => set(q.multi ? { text: e.target.value } : { text: e.target.value, picked: [] })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              go();
            }
          }}
          placeholder={q.placeholder || (q.options.length ? "다른 답 직접 쓰기" : "답 쓰기")}
          aria-label={`${q.header} 직접 쓰기`}
          className="h-9 rounded-[10px] border border-white/15 bg-white/[0.04] px-3 font-pretendard text-[14px] text-white outline-none placeholder:text-white/35 focus:border-white/35 disabled:opacity-60"
        />
      )}

      <div className="flex items-center justify-between gap-2">
        {index > 0 ? (
          <NeonButton tone="white" onClick={() => setIndex(index - 1)} disabled={disabled} className="h-9 md:h-9">
            이전
          </NeonButton>
        ) : (
          <span />
        )}
        <NeonButton onClick={go} disabled={!ready || disabled} className="h-9 md:h-9">
          {last ? "보내기" : "다음"}
        </NeonButton>
      </div>
    </div>
  );
}
