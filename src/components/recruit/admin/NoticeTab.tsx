"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlignLeft,
  CircleDot,
  Copy,
  Eye,
  GripHorizontal,
  Pencil,
  Plus,
  PlusCircle,
  Trash2,
  X,
} from "lucide-react";
import NeonButton from "@/components/common/NeonButton";
import Select from "@/components/common/Select";
import { toast } from "@/components/common/Toast";
import { AdminTop, DateTimeField, NumberField, ROW_INPUT } from "@/components/recruit/admin/common";
import RecruitLanding from "@/components/recruit/public/RecruitLanding";
import { GhostButton, IconButton, RecruitModal, Ring, Switch } from "@/components/recruit/ui";
import Portal from "@/components/common/Portal";
import { recruitKeys, useRecruitCurrent } from "@/hooks/useRecruit";
import { recruitApi } from "@/lib/recruitApi";
import { mdhm } from "@/lib/recruitFormat";
import { cn } from "@/lib/utils";
import type { Recruit, RecruitFaq, RecruitHistory, RecruitQuestion } from "@/types/recruit";

/**
 * 공고 탭 — 시안 RecruitAdminBC4 '모집 만들기 · 질문 / 설정'.
 * 구글 설문지처럼 질문 카드(주관식·객관식, 필수, 복사·삭제, 끌어서 순서), 고르면 오른쪽에 떠 있는 도구.
 * 설정은 두 단: 모집·지원 · 면접 · 발표 / 응답 · 자주 묻는 질문 · 지난 경쟁률.
 * 고치면 조금 뒤 저절로 저장한다.
 */

type LocalQ = RecruitQuestion & { _k: string };
type Editable = Pick<
  Recruit,
  | "cohort"
  | "title"
  | "body"
  | "quota"
  | "applyStart"
  | "applyEnd"
  | "interview"
  | "announcePlanned"
  | "confirmBy"
  | "faq"
  | "rules"
  | "consent"
  | "pastHistory"
> & {
  questions: LocalQ[];
};

let seq = 0;
const newKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;
const toLocal = (r: Recruit): Editable => ({
  cohort: r.cohort,
  title: r.title,
  body: r.body,
  quota: r.quota,
  applyStart: r.applyStart,
  applyEnd: r.applyEnd,
  interview: { ...r.interview },
  announcePlanned: r.announcePlanned ?? null,
  confirmBy: r.confirmBy,
  faq: r.faq.map((f) => ({ ...f })),
  rules: { ...r.rules },
  consent: r.consentCustom ? r.consent : "",
  pastHistory: (r.pastHistory ?? []).map((h) => ({ ...h })),
  questions: r.questions.map((q) => ({ ...q, options: [...q.options], _k: newKey() })),
});
const strip = (qs: LocalQ[]) =>
  qs.map((x) => {
    const { _k, id, ...q } = x;
    void _k;
    return id && !id.startsWith("new") ? { id, ...q } : q;
  });

const blankQ = (): LocalQ => ({
  id: "new",
  _k: newKey(),
  kind: "text",
  title: "",
  required: true,
  options: [],
  allowOther: false,
  maxLength: 500,
});

const FIELDS = [
  "cohort",
  "title",
  "body",
  "quota",
  "applyStart",
  "applyEnd",
  "interview",
  "announcePlanned",
  "confirmBy",
  "faq",
  "rules",
  "consent",
  "pastHistory",
  "questions",
] as const;

export default function NoticeTab({ recruit, tabs }: { recruit: Recruit; tabs: React.ReactNode }) {
  const qc = useQueryClient();
  const [sub, setSub] = useState<"questions" | "settings">("questions");
  const [d, setD] = useState<Editable>(() => toLocal(recruit));
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const sent = useRef<Record<string, string>>({});
  const rid = recruit.id;
  const pub = useRecruitCurrent();

  // 다른 모집으로 바뀌면 새로 읽는다
  useEffect(() => {
    const local = toLocal(recruit);
    setD(local);
    sent.current = snapshot(local);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid]);

  const applyServer = useCallback(
    (r: Recruit) => {
      qc.setQueryData<Recruit[]>(recruitKeys.list, (list) =>
        list?.map((x) => (x.id === r.id ? r : x)),
      );
    },
    [qc],
  );

  // 바뀐 칸만 조금 뒤에 저장
  useEffect(() => {
    const now = snapshot(d);
    const changed = FIELDS.filter((f) => now[f] !== sent.current[f]);
    if (!changed.length) return;
    const t = window.setTimeout(async () => {
      const body: Record<string, unknown> = {};
      for (const f of changed) body[f] = f === "questions" ? strip(d.questions) : d[f];
      const keys = d.questions.map((q) => q._k);
      setState("saving");
      try {
        const r = await recruitApi.save(rid, body as Partial<Recruit>);
        for (const f of changed) sent.current[f] = now[f];
        // 새 질문에 서버가 붙인 id 를 넣는다
        if (changed.includes("questions")) {
          setD((x) => {
            const qs = x.questions.map((q) => {
              const i = keys.indexOf(q._k);
              return i >= 0 && r.questions[i] && q.id !== r.questions[i].id
                ? { ...q, id: r.questions[i].id }
                : q;
            });
            sent.current.questions = JSON.stringify(strip(qs));
            return { ...x, questions: qs };
          });
        }
        applyServer(r);
        setState("idle");
      } catch (e) {
        setState("error");
        toast.error(e instanceof Error ? e.message : "저장하지 못했어요");
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [d, rid, applyServer]);

  const set = (patch: Partial<Editable>) => setD((x) => ({ ...x, ...patch }));

  const act = async (fn: () => Promise<Recruit>, ok: string) => {
    setBusy(true);
    try {
      applyServer(await fn());
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const phase = recruit.phase;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AdminTop tabs={tabs}>
        {state === "saving" && <span className="text-[14px] text-white/40">저장 중</span>}
        {state === "error" && <span className="text-[14px] text-[#FF3B3B]">저장 못 했어요</span>}
        <GhostButton onClick={() => setPreview(true)}>
          <Eye size={18} strokeWidth={1.5} />
          미리 보기
        </GhostButton>
        {recruit.status === "draft" && (
          <NeonButton
            size="lg"
            disabled={busy}
            className="h-12 w-[200px] [&_.nb-t]:text-[16px]"
            onClick={() => act(() => recruitApi.open(rid), "공고를 열었어요")}
          >
            공고 열기
          </NeonButton>
        )}
        {recruit.status === "open" && (phase === "open" || phase === "upcoming") && (
          <GhostButton
            disabled={busy}
            onClick={() => act(() => recruitApi.close(rid), "공고를 마감했어요")}
          >
            마감하기
          </GhostButton>
        )}
      </AdminTop>

      <div className="mt-5 flex shrink-0 items-end justify-center gap-7 border-b border-white/[0.08]">
        {(
          [
            ["questions", "질문"],
            ["settings", "설정"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSub(k)}
            aria-pressed={sub === k}
            className={cn(
              "-mb-px inline-flex h-11 items-center border-b-2 px-0.5 font-pretendard text-[15px] font-medium",
              sub === k
                ? "border-white text-white"
                : "border-transparent text-white/50 hover:text-white/80",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-16">
        {sub === "questions" ? (
          <QuestionsEditor d={d} set={set} recruit={recruit} />
        ) : (
          <SettingsPanel d={d} set={set} recruit={recruit} />
        )}
      </div>

      {preview && (
        <Portal>
          <div className="fixed inset-0 z-[90] bg-black">
            <RecruitLanding
              preview
              data={{
                recruit: {
                  ...recruit,
                  ...d,
                  consent: d.consent || recruit.consent,
                  questions: d.questions,
                  phase: phase === "draft" ? "open" : phase,
                },
                history: recruit.history ?? [],
                stats: pub.data?.stats ?? null,
              }}
            />
            <IconButton
              label="미리 보기 닫기"
              onClick={() => setPreview(false)}
              className="fixed right-4 top-3.5 z-[95] bg-black/60"
            >
              <X size={22} />
            </IconButton>
          </div>
        </Portal>
      )}
    </div>
  );
}

function snapshot(d: Editable): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of FIELDS) out[f] = JSON.stringify(f === "questions" ? strip(d.questions) : d[f]);
  return out;
}

/* ───────────── 질문 ───────────── */

const CARD = "rounded-[14px] border border-white/10 bg-[#121212] px-6 pb-5 pt-[18px]";
const UNDER =
  "w-full border-0 border-b border-white/15 bg-transparent py-1.5 font-pretendard text-white outline-none focus:border-white/50";

function QuestionsEditor({
  d,
  set,
  recruit,
}: {
  d: Editable;
  set: (p: Partial<Editable>) => void;
  recruit: Recruit;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const qs = d.questions;
  // 마감한 뒤에는 서버가 질문을 못 바꾸게 한다 — 카드도 읽기만
  const locked = recruit.phase === "closed" || recruit.phase === "announced";

  const setQ = (k: string, patch: Partial<LocalQ>) =>
    set({ questions: qs.map((q) => (q._k === k ? { ...q, ...patch } : q)) });
  const insertAfter = (k: string | null, q: LocalQ) => {
    const i = k ? qs.findIndex((x) => x._k === k) : qs.length - 1;
    const next = [...qs];
    next.splice(i + 1, 0, q);
    set({ questions: next });
    setActive(q._k);
  };
  const remove = (k: string) => {
    const i = qs.findIndex((x) => x._k === k);
    set({ questions: qs.filter((q) => q._k !== k) });
    setActive(qs[i + 1]?._k ?? qs[i - 1]?._k ?? null);
  };
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= qs.length) return;
    const next = [...qs];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    set({ questions: next });
  };

  const onDrop = (e: DragEvent, to: number) => {
    e.preventDefault();
    const from = qs.findIndex((q) => q._k === armed);
    if (from >= 0) move(from, from < to ? to : to);
    setArmed(null);
    setOver(null);
  };

  return (
    <div className="mx-auto mt-5 flex w-full max-w-[800px] min-w-0 flex-col gap-3">
      {/* 제목·본문 */}
      <div className={cn(CARD, "pt-5")}>
        <div className="flex items-end gap-3.5">
          <span className="flex w-[84px] items-end border-b border-white/15 focus-within:border-white/50">
            <input
              aria-label="기수"
              inputMode="numeric"
              value={d.cohort || ""}
              disabled={recruit.status !== "draft"}
              onChange={(e) =>
                set({ cohort: Number(e.target.value.replace(/\D/g, "").slice(0, 2)) || 0 })
              }
              className="w-full min-w-0 bg-transparent py-1.5 text-right font-mbc text-[26px] text-white outline-none tabular-nums disabled:text-white/60"
            />
            <span className="py-1.5 font-mbc text-[26px] text-white/80">기</span>
          </span>
          <input
            aria-label="제목"
            value={d.title}
            maxLength={60}
            onChange={(e) => set({ title: e.target.value })}
            className={cn(UNDER, "flex-1 font-mbc text-[26px]")}
          />
        </div>
        <AutoText
          ariaLabel="공고 본문"
          value={d.body}
          onChange={(v) => set({ body: v })}
          className="mt-3 min-h-[72px] text-[15px] leading-[1.65] text-white/[0.88]"
        />
      </div>

      {qs.map((q, i) => {
        const on = active === q._k;
        return (
          <div
            key={q._k}
            draggable={armed === q._k}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", q._k);
            }}
            onDragEnd={() => {
              setArmed(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              if (!armed) return;
              e.preventDefault();
              setOver(i);
            }}
            onDrop={(e) => onDrop(e, i)}
            onClick={() => !locked && setActive(q._k)}
            className={cn(
              CARD,
              "relative transition-[border-color,background-color,box-shadow]",
              on &&
                "border-white/[0.42] bg-[#1b1b1b] shadow-[0_12px_32px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.06)]",
              over === i && armed !== q._k && "border-white/50",
              armed === q._k && "opacity-60",
            )}
          >
            {!locked && (
              <button
                type="button"
                aria-label="끌어서 순서 바꾸기"
                title="끌어서 순서 바꾸기"
                onPointerDown={() => setArmed(q._k)}
                onPointerUp={() => setArmed(null)}
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                  e.preventDefault();
                  move(i, e.key === "ArrowUp" ? i - 1 : i + 1);
                }}
                className="-mt-2 mb-2 flex h-[14px] w-full cursor-grab justify-center text-white/30 hover:text-white/60 active:cursor-grabbing"
              >
                <GripHorizontal size={20} />
              </button>
            )}

            {on && !locked ? (
              <ActiveQuestion
                q={q}
                setQ={(p) => setQ(q._k, p)}
                onCopy={() =>
                  insertAfter(q._k, { ...q, id: "new", _k: newKey(), options: [...q.options] })
                }
                onDelete={() => remove(q._k)}
              />
            ) : (
              <IdleQuestion q={q} />
            )}

            {on && !locked && (
              <div className="absolute -right-16 top-0 flex w-[52px] flex-col items-center gap-0.5 rounded-xl border border-white/[0.16] bg-[#1b1b1b] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] max-xl:hidden">
                <IconButton
                  label="질문 추가"
                  onClick={(e) => (e.stopPropagation(), insertAfter(q._k, blankQ()))}
                >
                  <PlusCircle size={22} strokeWidth={1.5} />
                </IconButton>
              </div>
            )}
          </div>
        );
      })}

      <div className={cn("flex justify-center", qs.length && "xl:hidden", locked && "hidden")}>
        <GhostButton size="sm" onClick={() => insertAfter(active, blankQ())}>
          <Plus size={16} strokeWidth={1.5} />
          질문 추가
        </GhostButton>
      </div>

      {/* 개인정보 동의 */}
      <div className={cn(CARD, "pt-4")}>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-baseline gap-3">
            <span className="text-[17px] font-medium">개인정보 수집·이용 동의</span>
            <span className="text-[14px] text-white/55">
              {d.consent ? "고친 문구" : "자동 포함"}
            </span>
          </span>
          <GhostButton size="sm" onClick={() => setConsentOpen(true)}>
            고치기
          </GhostButton>
        </div>
        <div className="mt-2.5 truncate text-[14px] text-white/55">
          {d.consent || recruit.consent}
        </div>
      </div>

      {consentOpen && (
        <ConsentModal
          value={d.consent || recruit.consent}
          custom={!!d.consent}
          onClose={() => setConsentOpen(false)}
          onSave={(v) => {
            set({ consent: v });
            setConsentOpen(false);
          }}
        />
      )}
    </div>
  );
}

function IdleQuestion({ q }: { q: LocalQ }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <span className={cn("text-[17px] font-medium", !q.title && "text-white/40")}>
          {q.title || "질문"} {q.required && <span className="text-white/55">*</span>}
        </span>
        <span className="shrink-0 text-[14px] text-white/55">
          {q.kind === "text" ? "주관식" : "객관식"}
        </span>
      </div>
      {q.kind === "text" ? (
        <div className="mt-3.5 w-[52%] border-b border-dotted border-white/30 pb-1.5 text-[14px] text-white/55">
          주관식 답
        </div>
      ) : (
        <div className="mt-2.5 flex flex-col">
          {q.options.map((o, i) => (
            <span key={i} className="flex h-9 items-center gap-3.5 text-[15px] text-white/75">
              <Ring />
              {o}
            </span>
          ))}
          {q.allowOther && (
            <span className="flex h-9 items-center gap-3.5 text-[15px] text-white/55">
              <Ring />
              기타
            </span>
          )}
        </div>
      )}
    </>
  );
}

function ActiveQuestion({
  q,
  setQ,
  onCopy,
  onDelete,
}: {
  q: LocalQ;
  setQ: (p: Partial<LocalQ>) => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const reqId = `req-${q._k}`;
  const optRefs = useRef<(HTMLInputElement | null)[]>([]);
  const addOption = () => {
    setQ({ options: [...q.options, `옵션 ${q.options.length + 1}`] });
    window.setTimeout(() => optRefs.current[q.options.length]?.select(), 0);
  };
  return (
    <>
      <div className="flex items-center gap-2">
        <input
          aria-label="질문"
          autoFocus={!q.title}
          value={q.title}
          maxLength={200}
          placeholder="질문"
          onChange={(e) => setQ({ title: e.target.value })}
          className="h-[52px] min-w-0 flex-1 rounded-t-lg border-0 border-b-2 border-white bg-white/[0.06] px-3.5 font-pretendard text-[17px] font-medium text-white outline-none placeholder:text-white/35"
        />
        <Select<"text" | "choice">
          aria-label="질문 종류"
          value={q.kind}
          onChange={(k) =>
            setQ(
              k === "choice"
                ? { kind: k, options: q.options.length ? q.options : ["옵션 1"] }
                : { kind: k },
            )
          }
          options={[
            {
              value: "text",
              label: (
                <span className="inline-flex items-center gap-2.5">
                  <AlignLeft size={18} strokeWidth={1.5} />
                  주관식
                </span>
              ),
              textValue: "주관식",
            },
            {
              value: "choice",
              label: (
                <span className="inline-flex items-center gap-2.5">
                  <CircleDot size={18} strokeWidth={1.5} />
                  객관식
                </span>
              ),
              textValue: "객관식",
            },
          ]}
          className="h-[52px] w-[168px] shrink-0 rounded-[10px] border-white/[0.16] bg-[#0c0c0c] pl-3.5 pr-3 text-[15px] font-medium"
        />
      </div>

      {q.kind === "text" ? (
        <div className="mt-4 w-[52%] border-b border-dotted border-white/30 pb-1.5 text-[14px] text-white/55">
          주관식 답
        </div>
      ) : (
        <div className="mt-3">
          {q.options.map((o, i) => (
            <div key={i} className="flex h-[42px] items-center gap-3.5">
              <Ring />
              <input
                ref={(el) => {
                  optRefs.current[i] = el;
                }}
                aria-label={`옵션 ${i + 1}`}
                value={o}
                maxLength={80}
                onChange={(e) =>
                  setQ({ options: q.options.map((x, j) => (j === i ? e.target.value : x)) })
                }
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOption())}
                className="h-[34px] min-w-0 flex-1 border-0 border-b border-transparent bg-transparent font-pretendard text-[16px] text-white outline-none hover:border-white/15 focus:border-white/40"
              />
              <IconButton
                label={`옵션 ${i + 1} 지우기`}
                disabled={q.options.length <= 1 && !q.allowOther}
                onClick={() => setQ({ options: q.options.filter((_, j) => j !== i) })}
              >
                <X size={18} strokeWidth={1.5} />
              </IconButton>
            </div>
          ))}
          {q.allowOther && (
            <div className="flex h-[42px] items-center gap-3.5">
              <Ring />
              <span className="flex-1 border-b border-dotted border-white/30 pb-1 text-[16px] text-white/55">
                기타
              </span>
              <IconButton label="기타 지우기" onClick={() => setQ({ allowOther: false })}>
                <X size={18} strokeWidth={1.5} />
              </IconButton>
            </div>
          )}
          <div className="flex h-[42px] items-center gap-3.5">
            <Ring dim />
            <button
              type="button"
              onClick={addOption}
              className="h-[30px] border-b border-white/[0.18] pb-0.5 text-[16px] text-white/55 hover:text-white/80"
            >
              옵션 추가
            </button>
            {!q.allowOther && (
              <>
                <span className="text-[15px] text-white/55">또는</span>
                <button
                  type="button"
                  onClick={() => setQ({ allowOther: true })}
                  className="h-[30px] pb-0.5 text-[16px] font-medium text-white/85 hover:text-white"
                >
                  기타 추가
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-3.5 flex items-center justify-end gap-0.5 border-t border-white/10 pt-2">
        <IconButton label="복사" onClick={(e) => (e.stopPropagation(), onCopy())}>
          <Copy size={20} strokeWidth={1.5} />
        </IconButton>
        <IconButton label="삭제" onClick={(e) => (e.stopPropagation(), onDelete())}>
          <Trash2 size={20} strokeWidth={1.5} />
        </IconButton>
        <span className="ml-2.5 mr-3.5 h-7 w-px bg-white/[0.14]" />
        <span className="mr-1.5 inline-flex items-center gap-2.5 text-[15px]">
          <span id={reqId}>필수</span>
          <Switch on={q.required} onChange={(v) => setQ({ required: v })} labelledBy={reqId} />
        </span>
      </div>
    </>
  );
}

/** 글 길이에 맞춰 늘어나는 칸 */
function AutoText({
  value,
  onChange,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      aria-label={ariaLabel}
      value={value}
      rows={2}
      maxLength={4000}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full resize-none overflow-hidden border-0 border-b border-white/15 bg-transparent py-1.5 font-pretendard outline-none focus:border-white/50",
        className,
      )}
    />
  );
}

function ConsentModal({
  value,
  custom,
  onClose,
  onSave,
}: {
  value: string;
  custom: boolean;
  onClose: () => void;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  return (
    <RecruitModal
      title="개인정보 수집·이용 동의"
      label="개인정보 동의 문구 고치기"
      width={640}
      onClose={onClose}
      footer={
        <>
          {custom && (
            <GhostButton className="mr-auto" onClick={() => onSave("")}>
              기본 문구로
            </GhostButton>
          )}
          <GhostButton onClick={onClose}>취소</GhostButton>
          <NeonButton
            className="w-[150px]"
            onClick={() => onSave(v.trim() === value.trim() && !custom ? "" : v.trim())}
          >
            저장
          </NeonButton>
        </>
      }
    >
      <textarea
        aria-label="동의 문구"
        value={v}
        maxLength={2000}
        onChange={(e) => setV(e.target.value)}
        className="mt-5 h-[200px] w-full resize-none rounded-xl border border-white/[0.12] bg-[#0c0c0c] px-4 py-3.5 font-pretendard text-[15px] leading-[1.7] text-white outline-none focus:border-white/30"
      />
    </RecruitModal>
  );
}

/* ───────────── 설정 ───────────── */

function Group({
  title,
  extra,
  children,
}: {
  title: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col [&+&]:mt-7">
      <div className="flex items-center justify-between pb-3">
        <span className="text-[16px] font-bold">{title}</span>
        {extra}
      </div>
      <div className="flex flex-col border-b border-white/[0.08]">{children}</div>
    </section>
  );
}

function Row({
  label,
  htmlFor,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/[0.08] py-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-white/55">
          {label}
        </label>
      ) : (
        <span className="text-white/55">{label}</span>
      )}
      {children}
    </div>
  );
}

function SettingsPanel({
  d,
  set,
  recruit,
}: {
  d: Editable;
  set: (p: Partial<Editable>) => void;
  recruit: Recruit;
}) {
  const iv = d.interview;
  const setIv = (p: Partial<typeof iv>) => set({ interview: { ...iv, ...p } });
  const [faq, setFaq] = useState<{ i: number; f: RecruitFaq } | null>(null);
  const [hist, setHist] = useState<{ i: number; h: RecruitHistory } | null>(null);

  return (
    <div className="mt-7 grid grid-cols-1 gap-x-[72px] gap-y-7 font-pretendard text-[16px] lg:grid-cols-2">
      <div>
        <Group title="모집·지원">
          <Row label="모집 인원" htmlFor="s-cnt">
            <NumberField id="s-cnt" value={d.quota} onChange={(n) => set({ quota: n })} unit="명" />
          </Row>
          <Row label="지원 시작">
            <DateTimeField
              label="지원 시작"
              value={d.applyStart}
              defaultTime="09:00"
              onChange={(v) => set({ applyStart: v })}
            />
          </Row>
          <Row label="지원 마감">
            <DateTimeField
              label="지원 마감"
              value={d.applyEnd}
              onChange={(v) => set({ applyEnd: v })}
            />
          </Row>
        </Group>
        <Group title="면접">
          <Row label="날짜">
            <DateTimeField
              label="면접"
              value={iv.date ? `${iv.date}T${iv.start || "09:00"}:00` : null}
              defaultTime="09:00"
              onChange={(v) => {
                if (!v) return setIv({ date: "" });
                const t = new Date(v);
                const p = (n: number) => String(n).padStart(2, "0");
                setIv({
                  date: `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`,
                  start: `${p(t.getHours())}:${p(t.getMinutes())}`,
                });
              }}
            />
          </Row>
          <Row label="장소" htmlFor="s-i1">
            <input
              id="s-i1"
              className={ROW_INPUT}
              value={iv.place}
              maxLength={60}
              onChange={(e) => setIv({ place: e.target.value })}
            />
          </Row>
          <Row label="한 사람" htmlFor="s-i2">
            <NumberField
              id="s-i2"
              value={iv.minutes}
              max={120}
              onChange={(n) => setIv({ minutes: n ?? 10 })}
              unit="분"
            />
          </Row>
          <Row label="쉬는 시간">
            <span className="flex items-center gap-2">
              <NumberField
                label="몇 명마다"
                value={iv.breakEvery ?? 0}
                width={96}
                max={100}
                onChange={(n) => setIv({ breakEvery: n ?? 0 })}
                unit="명마다"
              />
              <NumberField
                label="쉬는 시간 분"
                value={iv.breakMinutes ?? 0}
                width={96}
                max={120}
                onChange={(n) => setIv({ breakMinutes: n ?? 0 })}
                unit="분"
              />
            </span>
          </Row>
          <Row label="준비할 것" htmlFor="s-i4">
            <input
              id="s-i4"
              className={cn(ROW_INPUT, "w-[290px]")}
              value={iv.prep ?? ""}
              maxLength={120}
              onChange={(e) => setIv({ prep: e.target.value })}
            />
          </Row>
        </Group>
        <Group title="발표">
          <Row label="발표 예정일">
            <DateTimeField
              label="발표 예정일"
              value={d.announcePlanned}
              onChange={(v) => set({ announcePlanned: v })}
            />
          </Row>
          <Row label="발표 예약">
            <span className="tabular-nums text-white/75">
              {recruit.announceAt ? mdhm(recruit.announceAt) : "예약 전"}
            </span>
          </Row>
          <Row label="입부 확정 기한">
            <DateTimeField
              label="입부 확정 기한"
              value={d.confirmBy}
              onChange={(v) => set({ confirmBy: v })}
            />
          </Row>
        </Group>
      </div>

      <div>
        <Group title="응답">
          <Row
            label={
              <span id="s-r0" className="text-white">
                학교 계정만 받기
              </span>
            }
          >
            <Switch
              on={d.rules.schoolOnly}
              labelledBy="s-r0"
              onChange={(v) => set({ rules: { ...d.rules, schoolOnly: v } })}
            />
          </Row>
          <Row
            label={
              <span id="s-r1" className="text-white">
                한 사람 한 번만 제출
              </span>
            }
          >
            <Switch
              on={d.rules.oncePerPerson}
              labelledBy="s-r1"
              onChange={(v) => set({ rules: { ...d.rules, oncePerPerson: v } })}
            />
          </Row>
        </Group>

        <Group
          title={
            <>
              자주 묻는 질문{" "}
              <span className="font-normal text-white/55 tabular-nums">{d.faq.length}</span>
            </>
          }
          extra={
            <GhostButton size="sm" onClick={() => setFaq({ i: -1, f: { q: "", a: "" } })}>
              <Plus size={16} strokeWidth={1.5} />
              추가
            </GhostButton>
          }
        >
          {d.faq.map((f, i) => (
            <div
              key={i}
              className="flex min-h-[68px] items-center gap-3 border-t border-white/[0.08]"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium">{f.q}</span>
                <span className="truncate text-[14px] text-white/60">{f.a}</span>
              </div>
              <IconButton label="고치기" onClick={() => setFaq({ i, f })}>
                <Pencil size={18} strokeWidth={1.5} />
              </IconButton>
            </div>
          ))}
        </Group>

        <Group
          title={
            <>
              지난 경쟁률{" "}
              <span className="font-normal text-white/55 tabular-nums">{d.pastHistory.length}</span>
            </>
          }
          extra={
            <GhostButton
              size="sm"
              onClick={() =>
                setHist({
                  i: -1,
                  h: { cohort: Math.max(1, (d.cohort || 2) - 1), quota: 10, applied: 0 },
                })
              }
            >
              <Plus size={16} strokeWidth={1.5} />
              추가
            </GhostButton>
          }
        >
          {d.pastHistory.map((h, i) => (
            <div
              key={h.cohort}
              className="flex min-h-[52px] items-center gap-3 border-t border-white/[0.08]"
            >
              <span className="w-14 font-medium tabular-nums">{h.cohort}기</span>
              <span className="flex-1 text-white/60 tabular-nums">
                지원 {h.applied}명 · 모집 {h.quota}명
              </span>
              <IconButton label="고치기" onClick={() => setHist({ i, h })}>
                <Pencil size={18} strokeWidth={1.5} />
              </IconButton>
            </div>
          ))}
        </Group>
      </div>

      {faq && (
        <FaqModal
          init={faq.f}
          isNew={faq.i < 0}
          onClose={() => setFaq(null)}
          onSave={(f) => {
            set({ faq: faq.i < 0 ? [...d.faq, f] : d.faq.map((x, j) => (j === faq.i ? f : x)) });
            setFaq(null);
          }}
          onDelete={() => {
            set({ faq: d.faq.filter((_, j) => j !== faq.i) });
            setFaq(null);
          }}
        />
      )}
      {hist && (
        <HistoryModal
          init={hist.h}
          isNew={hist.i < 0}
          onClose={() => setHist(null)}
          onSave={(h) => {
            const rest = d.pastHistory.filter((x, j) => j !== hist.i && x.cohort !== h.cohort);
            set({ pastHistory: [...rest, h].sort((a, b) => a.cohort - b.cohort) });
            setHist(null);
          }}
          onDelete={() => {
            set({ pastHistory: d.pastHistory.filter((_, j) => j !== hist.i) });
            setHist(null);
          }}
        />
      )}
    </div>
  );
}

function FaqModal({
  init,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  init: RecruitFaq;
  isNew: boolean;
  onClose: () => void;
  onSave: (f: RecruitFaq) => void;
  onDelete: () => void;
}) {
  const [q, setQ] = useState(init.q);
  const [a, setA] = useState(init.a);
  return (
    <RecruitModal
      title={isNew ? "자주 묻는 질문 추가" : "자주 묻는 질문"}
      label="자주 묻는 질문"
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <GhostButton className="mr-auto" onClick={onDelete}>
              지우기
            </GhostButton>
          )}
          <GhostButton onClick={onClose}>취소</GhostButton>
          <NeonButton
            className="w-[150px]"
            disabled={!q.trim() || !a.trim()}
            onClick={() => onSave({ q: q.trim(), a: a.trim() })}
          >
            저장
          </NeonButton>
        </>
      }
    >
      <label htmlFor="faq-q" className="mt-5 text-[14px] text-white/55">
        질문
      </label>
      <input
        id="faq-q"
        value={q}
        maxLength={120}
        onChange={(e) => setQ(e.target.value)}
        className={cn(UNDER, "text-[17px]")}
      />
      <label htmlFor="faq-a" className="mt-5 text-[14px] text-white/55">
        답
      </label>
      <textarea
        id="faq-a"
        value={a}
        maxLength={1000}
        onChange={(e) => setA(e.target.value)}
        className="mt-2 h-[120px] w-full resize-none rounded-xl border border-white/[0.12] bg-[#0c0c0c] px-4 py-3 font-pretendard text-[15px] leading-[1.7] text-white outline-none focus:border-white/30"
      />
    </RecruitModal>
  );
}

function HistoryModal({
  init,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  init: RecruitHistory;
  isNew: boolean;
  onClose: () => void;
  onSave: (h: RecruitHistory) => void;
  onDelete: () => void;
}) {
  const [h, setH] = useState(init);
  return (
    <RecruitModal
      title={isNew ? "지난 경쟁률 추가" : `${init.cohort}기 경쟁률`}
      label="지난 경쟁률"
      width={480}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <GhostButton className="mr-auto" onClick={onDelete}>
              지우기
            </GhostButton>
          )}
          <GhostButton onClick={onClose}>취소</GhostButton>
          <NeonButton
            className="w-[150px]"
            disabled={!h.cohort || !h.quota}
            onClick={() => onSave(h)}
          >
            저장
          </NeonButton>
        </>
      }
    >
      <div className="mt-5">
        <Row label="기수">
          <NumberField
            label="기수"
            value={h.cohort}
            max={99}
            width={150}
            onChange={(n) => setH({ ...h, cohort: n ?? 0 })}
            unit="기"
          />
        </Row>
        <Row label="지원">
          <NumberField
            label="지원 수"
            value={h.applied}
            max={5000}
            width={150}
            onChange={(n) => setH({ ...h, applied: n ?? 0 })}
            unit="명"
          />
        </Row>
        <Row label="모집">
          <NumberField
            label="모집 인원"
            value={h.quota}
            max={500}
            width={150}
            onChange={(n) => setH({ ...h, quota: n ?? 0 })}
            unit="명"
          />
        </Row>
      </div>
    </RecruitModal>
  );
}
