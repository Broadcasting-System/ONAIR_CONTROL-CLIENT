"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Popover as P } from "radix-ui";
import { Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import SectionHeader from "@/components/common/SectionHeader";
import { DatePicker } from "@/components/common/DateTimePicker";
import { ghostBtn } from "@/components/time/TimeToolbar";
import { HttpError, request, retryUnlessClientError } from "@/lib/http";
import { describe, failWord, toRows, type LogEntry, type LogRow, type Person } from "@/lib/accessLog";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { Avatar, GroupIcon, groupRank } from "./logMeta";

/* 로그 — 활동 흐름 (시안 A). 서버는 최근 기록을 limit 개까지만 준다(최대 2000).
   아래로 내리면 화면에 더 그리고, 받은 기록을 다 그렸거나 고른 날짜가 받은 범위보다 이르면 limit 을 늘려 다시 받는다. */

const FIRST_LIMIT = 500;
const STEP_LIMIT = 500;
const MAX_LIMIT = 2000;
const PAGE = 80;

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const monthDay = (s: string) => {
  const d = parseDay(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

type Range = { kind: "today" } | { kind: "yesterday" } | { kind: "week" } | { kind: "day"; day: string };

function rangeOf(r: Range, now: Date): { from: string; to: string } {
  const today = dayKey(now);
  if (r.kind === "today") return { from: today, to: today };
  if (r.kind === "yesterday") {
    const y = dayKey(addDays(now, -1));
    return { from: y, to: y };
  }
  if (r.kind === "week") return { from: dayKey(addDays(now, -((now.getDay() + 6) % 7))), to: today };
  return { from: r.day, to: r.day };
}

const RANGE_LABEL = { today: "오늘", yesterday: "어제", week: "이번 주" } as const;
const rangeLabel = (r: Range) => (r.kind === "day" ? monthDay(r.day) : RANGE_LABEL[r.kind]);

/** 날짜 머리줄 — 오늘 · 10월 15일 목 */
function dayHead(day: string, now: Date): string {
  const d = parseDay(day);
  const base = `${monthDay(day)} ${DOW[d.getDay()]}`;
  if (day === dayKey(now)) return `오늘 · ${base}`;
  if (day === dayKey(addDays(now, -1))) return `어제 · ${base}`;
  return base;
}

const rowKey = (r: LogRow) => `${r.firstTs}|${r.person.key}|${r.what.label}|${r.what.extra ?? ""}`;

/** 지금 시각 — 분마다 (서버 렌더와 어긋나지 않게 처음엔 null) */
function useMinuteNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      t = setTimeout(tick, 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 30);
    };
    tick();
    return () => clearTimeout(t);
  }, []);
  return now;
}

// ---------------------------------------------------------------- 화면

export default function LogsView() {
  const [limit, setLimit] = useState(FIRST_LIMIT);
  const logs = useQuery({
    queryKey: ["access-logs", limit],
    queryFn: () => request<{ logs: LogEntry[] }>(`/logs?limit=${limit}`),
    refetchInterval: 5000,
    retry: retryUnlessClientError,
    placeholderData: (prev) => prev,
  });
  const now = useMinuteNow();
  const isMobile = useIsMobile();

  const [range, setRange] = useState<Range>({ kind: "today" });
  const [q, setQ] = useState("");
  const [person, setPerson] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [failOnly, setFailOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const data = logs.data?.logs;
  const rows = useMemo(() => toRows(data ?? []), [data]);
  const span = useMemo(() => (now ? rangeOf(range, now) : null), [range, now]);
  const inRange = useMemo(() => (span ? rows.filter((r) => r.day >= span.from && r.day <= span.to) : []), [rows, span]);

  // 고르기 목록 — 고른 날짜 안의 사람(많이 한 순)·분류
  const people = useMemo(() => {
    const m = new Map<string, { person: Person; n: number }>();
    for (const r of inRange) {
      const p = m.get(r.person.key);
      if (p) p.n += r.count;
      else m.set(r.person.key, { person: r.person, n: r.count });
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [inRange]);
  const groupList = useMemo(() => {
    const set = new Set([...inRange.map((r) => r.what.group), ...groups]);
    return [...set].sort((a, b) => groupRank(a) - groupRank(b));
  }, [inRange, groups]);

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      inRange.filter(
        (r) =>
          (!person || r.person.key === person) &&
          (groups.length === 0 || groups.includes(r.what.group)) &&
          (!failOnly || r.failed) &&
          (!needle ||
            [r.person.name, r.person.sub, r.what.label, r.what.extra, r.what.group].some((t) => t?.toLowerCase().includes(needle))),
      ),
    [inRange, person, groups, failOnly, needle],
  );

  const total = filtered.reduce((n, r) => n + r.count, 0);
  const fails = filtered.reduce((n, r) => n + (r.failed ? r.count : 0), 0);
  const heads = new Set(filtered.map((r) => r.person.key)).size;

  // 받은 기록이 고른 날짜를 다 덮지 못하면 더 받는다
  const more = !!data && data.length >= limit && limit < MAX_LIMIT;
  const oldestDay = data?.length ? data[data.length - 1].ts.slice(0, 10) : "";
  useEffect(() => {
    if (more && span && oldestDay >= span.from) setLimit((l) => Math.min(MAX_LIMIT, l + STEP_LIMIT));
  }, [more, span, oldestDay]);

  // 거르기가 바뀌면 처음부터
  useEffect(() => {
    setShown(PAGE);
    listRef.current?.scrollTo({ top: 0 });
  }, [range, person, groups, failOnly, needle]);

  const visible = filtered.slice(0, shown);
  const hasMore = filtered.length > shown || more;

  // 아래 끝이 보이면 더 그리기 (PC 는 목록 칸이, 폰은 화면이 스크롤된다)
  useEffect(() => {
    const el = endRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        if (filtered.length > shown) setShown((n) => n + PAGE);
        else if (more) setLimit((l) => Math.min(MAX_LIMIT, l + STEP_LIMIT));
      },
      { root: isMobile ? null : listRef.current, rootMargin: "0px 0px 600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, filtered.length, shown, more, isMobile]);

  const filtering = !!person || groups.length > 0 || failOnly;
  const reset = () => {
    setPerson("");
    setGroups([]);
    setFailOnly(false);
  };
  const toggleGroup = (g: string) => setGroups((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g]));
  const toggleRow = (k: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const denied = logs.error instanceof HttpError && logs.error.status === 403;
  if (denied) return <p className="font-pretendard text-white/40">권한이 없어요</p>;

  const filters = (
    <Filters
      people={people}
      person={person}
      onPerson={(k) => setPerson((p) => (p === k ? "" : k))}
      groups={groupList}
      picked={groups}
      onGroup={toggleGroup}
      failOnly={failOnly}
      onFail={() => setFailOnly((v) => !v)}
      onReset={filtering ? reset : undefined}
    />
  );
  const sheetFilters = (
    <Filters
      people={people}
      person={person}
      onPerson={(k) => setPerson((p) => (p === k ? "" : k))}
      groups={groupList}
      picked={groups}
      onGroup={toggleGroup}
      failOnly={failOnly}
      onFail={() => setFailOnly((v) => !v)}
    />
  );
  const activeCount = (person ? 1 : 0) + groups.length + (failOnly ? 1 : 0);

  return (
    <div className="flex w-full flex-col md:h-[calc(100dvh-80px)] md:min-h-[560px]">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <SectionHeader className="mb-0 mr-auto max-md:mt-1 max-md:text-[26px] max-md:leading-none">로그</SectionHeader>
        <div className="order-1 flex w-full items-center gap-2 md:order-2 md:w-auto">
          <label
            data-tour="logs.search"
            className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[11px] border border-white/10 bg-[#0c0d0f] px-3.5 md:h-[38px] md:w-[260px] md:flex-none"
          >
            <Search size={15} className="shrink-0 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="사람·동작·대상 찾기"
              aria-label="찾기"
              className="min-w-0 flex-1 bg-transparent font-pretendard text-[15px] text-white outline-none placeholder:text-white/35 md:text-[13.5px]"
            />
            {q && (
              <button type="button" aria-label="지우기" onClick={() => setQ("")} className="shrink-0 text-white/40 hover:text-white">
                <X size={15} />
              </button>
            )}
          </label>
          <button
            type="button"
            data-tour="logs.filter.open"
            onClick={() => setSheet(true)}
            className={cn(ghostBtn, "lg:hidden", activeCount > 0 && "border-white/50 text-white")}
          >
            <SlidersHorizontal size={15} />
            거르기
            {activeCount > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF3B3B] px-1 font-orbitron text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>
        <DateMenu range={range} onChange={setRange} today={now ? dayKey(now) : undefined} className="md:order-3" />
      </header>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 md:mt-[18px] lg:grid-cols-[236px_minmax(0,1fr)]">
        <aside className={cn(panel, "hidden min-h-0 flex-col overflow-y-auto px-3.5 py-4 lg:flex")}>{filters}</aside>

        <section className={cn(panel, "flex min-h-0 flex-col")}>
          <div data-tour="logs.count" className="flex items-center gap-4 border-b border-white/[0.06] px-4 pb-3.5 pt-3.5 md:px-5">
            <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1 font-pretendard text-[13.5px] text-white/60">
              <span>
                <b className="mr-1 font-orbitron text-[18px] font-bold text-white tabular-nums">{total}</b>건
              </span>
              <span>
                <b className={cn("mr-1 font-orbitron text-[18px] font-bold tabular-nums", fails ? "text-[#ff6a62]" : "text-white")}>{fails}</b>실패
              </span>
              <span>
                <b className="mr-1 font-orbitron text-[18px] font-bold text-white tabular-nums">{heads}</b>명
              </span>
            </div>
            <Hours rows={filtered} nowHour={now && span && span.to === dayKey(now) ? now.getHours() : null} className="ml-auto" />
          </div>

          <div ref={listRef} data-tour="logs.table" className="pb-2 md:min-h-0 md:flex-1 md:overflow-y-auto [scrollbar-width:thin]">
            {logs.isLoading || !now ? (
              <p className="px-5 py-16 text-center font-pretendard text-[15px] text-white/35">불러오는 중…</p>
            ) : visible.length === 0 ? (
              <p className="px-5 py-16 text-center font-pretendard text-[15px] text-white/35">기록이 없어요</p>
            ) : (
              visible.map((r, i) => {
                const k = rowKey(r);
                return (
                  <div key={k}>
                    {(i === 0 || visible[i - 1].day !== r.day) && (
                      <div className="sticky top-0 z-[5] bg-[#0e0e11]/95 px-4 pb-1.5 pt-3.5 font-mbc text-[13px] text-white/45 backdrop-blur md:px-5">
                        {dayHead(r.day, now)}
                      </div>
                    )}
                    <Row row={r} open={open.has(k)} onToggle={() => toggleRow(k)} />
                  </div>
                );
              })
            )}
            {hasMore && visible.length > 0 && (
              <div ref={endRef} data-tour="logs.more" className="py-4 text-center font-pretendard text-[13px] text-white/30">
                불러오는 중…
              </div>
            )}
          </div>
        </section>
      </div>

      {sheet && <Sheet onClose={() => setSheet(false)} onReset={filtering ? reset : undefined} count={total}>{sheetFilters}</Sheet>}
    </div>
  );
}

const panel = "rounded-[20px] border border-white/[0.08] bg-[rgba(14,14,17,0.74)] backdrop-blur-[10px]";

// ---------------------------------------------------------------- 날짜 고르기

function DateMenu({ range, onChange, today, className }: { range: Range; onChange: (r: Range) => void; today?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const pick = (r: Range) => {
    onChange(r);
    setOpen(false);
  };
  const item = (r: Range, label: string) => {
    const on = range.kind === r.kind;
    return (
      <button
        key={r.kind}
        type="button"
        onClick={() => pick(r)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-[10px] px-3 font-mbc text-[14px] transition-colors",
          on ? "bg-white/[0.1] text-white" : "text-white/65 hover:bg-white/[0.05] hover:text-white",
        )}
      >
        {label}
        {on && <Check size={15} />}
      </button>
    );
  };
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger data-tour="logs.filter.day" className={cn(ghostBtn, "min-w-[84px] justify-between", className)}>
        {rangeLabel(range)}
        <ChevronDown size={14} className="text-white/50" />
      </P.Trigger>
      <P.Portal>
        <P.Content
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-[900] w-[248px] rounded-[18px] border border-white/[0.12] bg-[#141416] p-2 text-white shadow-[0_24px_60px_rgba(0,0,0,0.65)] outline-none"
        >
          {item({ kind: "today" }, "오늘")}
          {item({ kind: "yesterday" }, "어제")}
          {item({ kind: "week" }, "이번 주")}
          <div className="mx-1 my-2 h-px bg-white/[0.08]" />
          <DatePicker
            value={range.kind === "day" ? range.day : ""}
            max={today}
            placeholder="날짜 고르기"
            aria-label="날짜 고르기"
            onChange={(day) => pick({ kind: "day", day })}
            className="h-10 rounded-[10px] text-[14px]"
          />
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

// ---------------------------------------------------------------- 거르기

function Filters({
  people,
  person,
  onPerson,
  groups,
  picked,
  onGroup,
  failOnly,
  onFail,
  onReset,
}: {
  people: { person: Person; n: number }[];
  person: string;
  onPerson: (key: string) => void;
  groups: string[];
  picked: string[];
  onGroup: (g: string) => void;
  failOnly: boolean;
  onFail: () => void;
  onReset?: () => void;
}) {
  return (
    <div data-tour="logs.filters" className="flex min-h-full flex-col gap-4">
      <div data-tour="logs.filter.person">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-mbc text-[13px] text-white/45">사람</h4>
          {onReset && (
            <button type="button" data-tour="logs.filter.reset" onClick={onReset} className="font-mbc text-[12.5px] text-white/45 hover:text-white">
              초기화
            </button>
          )}
        </div>
        {people.length === 0 ? (
          <p className="px-2 py-2 font-pretendard text-[13px] text-white/30">기록이 없어요</p>
        ) : (
          people.map(({ person: p, n }) => {
            const on = person === p.key;
            // 이름이 같은 사람이 둘이면 기수·역할, 그것도 같으면 아이디 끝을 붙여 가른다
            const twins = people.filter((x) => x.person.name === p.name);
            const tag =
              twins.length < 2
                ? ""
                : twins.filter((x) => x.person.sub === p.sub).length < 2 && p.sub
                  ? p.sub
                  : p.key.slice(-4);
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={on}
                onClick={() => onPerson(p.key)}
                className={cn(
                  "flex h-11 w-full items-center gap-[9px] rounded-[10px] px-2 text-left font-pretendard text-[14px] font-medium transition-colors lg:h-9 lg:text-[13.5px]",
                  on ? "bg-white/[0.08] text-white" : "text-white/75 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                <Avatar person={p} />
                <span className="min-w-0 flex-1 truncate">
                  {p.name}
                  {tag && <small className="ml-1.5 text-[12px] text-white/35">{tag}</small>}
                </span>
                <span className="font-orbitron text-[11px] font-semibold text-white/35 tabular-nums">{n}</span>
              </button>
            );
          })
        )}
      </div>

      {groups.length > 0 && (
        <div data-tour="logs.filter.action">
          <h4 className="mb-2 font-mbc text-[13px] text-white/45">분류</h4>
          <div className="flex flex-wrap gap-[5px]">
            {groups.map((g) => {
              const on = picked.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onGroup(g)}
                  className={cn(
                    "flex h-10 items-center gap-1.5 rounded-[9px] border px-2.5 font-mbc text-[13px] transition-colors lg:h-[30px] lg:text-[12.5px]",
                    on ? "border-white bg-white text-[#0b0b0d]" : "border-white/10 text-white/60 hover:text-white",
                  )}
                >
                  <GroupIcon group={g} size={13} />
                  {g}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={failOnly}
        data-tour="logs.filter.result"
        onClick={onFail}
        className="mt-auto flex h-12 w-full items-center gap-2.5 border-t border-white/[0.06] pt-3 font-mbc text-[14px] text-white/70 hover:text-white lg:h-11 lg:text-[13.5px]"
      >
        실패만 보기
        <span className={cn("relative ml-auto h-5 w-[34px] shrink-0 rounded-full transition-colors", failOnly ? "bg-[#FF3B3B]" : "bg-white/15")}>
          <i className={cn("absolute top-[3px] h-[14px] w-[14px] rounded-full transition-all", failOnly ? "left-[17px] bg-white" : "left-[3px] bg-white/70")} />
        </span>
      </button>
    </div>
  );
}

/** 폰·좁은 화면 — 아래에서 올라오는 거르기 판 */
function Sheet({ children, onClose, onReset, count }: { children: ReactNode; onClose: () => void; onReset?: () => void; count: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal aria-label="거르기">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-[22px] border-t border-white/10 bg-[#121214] shadow-[0_-20px_40px_rgba(0,0,0,0.6)]">
        <div className="flex shrink-0 items-center px-4 pb-1 pt-3">
          <h3 className="font-mbc text-[18px] text-white">거르기</h3>
          <button type="button" aria-label="닫기" onClick={onClose} className="-mr-2 ml-auto flex h-11 w-11 items-center justify-center rounded-xl text-white/60 active:bg-white/10">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">{children}</div>
        <div className="flex shrink-0 gap-2 border-t border-white/[0.06] px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
          <button type="button" disabled={!onReset} onClick={onReset} className={cn(ghostBtn, "h-11 flex-1 md:h-11")}>
            초기화
          </button>
          <button type="button" onClick={onClose} className="h-11 flex-[2] rounded-[11px] bg-white font-mbc text-[14px] text-[#0b0b0d]">
            {count}건 보기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- 시간대 막대

function Hours({ rows, nowHour, className }: { rows: LogRow[]; nowHour: number | null; className?: string }) {
  const counts = new Map<number, number>();
  for (const r of rows) for (const e of r.items) {
    const h = Number(e.ts.slice(11, 13));
    if (!Number.isNaN(h)) counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  const hours = [...counts.keys(), ...(nowHour != null ? [nowHour] : [])];
  const from = Math.min(8, ...hours);
  const to = Math.max(18, ...hours);
  const max = Math.max(1, ...counts.values());
  const bars = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const mid = Math.round((from + to) / 2);
  return (
    <div className={cn("shrink-0", className)} aria-label="시간대별 건수">
      <div className="flex h-[34px] items-end gap-[2px] md:gap-[3px]">
        {bars.map((h) => {
          const n = counts.get(h) ?? 0;
          return (
            <i
              key={h}
              title={`${pad(h)}시 ${n}건`}
              style={{ height: n ? Math.max(4, Math.round((n / max) * 34)) : 2 }}
              className={cn(
                "w-[5px] rounded-[2px] md:w-[9px]",
                h === nowHour ? "bg-[#FF3B3B]" : n ? "bg-white/[0.22]" : "bg-white/[0.08]",
              )}
            />
          );
        })}
      </div>
      <div className="mt-[3px] flex justify-between font-orbitron text-[9px] font-semibold text-white/30">
        <span>{pad(from)}</span>
        <span>{pad(mid)}</span>
        <span>{pad(to)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 한 줄

const tagCls = "shrink-0 rounded-md bg-white/[0.07] px-[7px] py-[2px] font-orbitron text-[11px] font-semibold text-white/55 tabular-nums";
const failCls =
  "inline-flex h-6 shrink-0 items-center rounded-[7px] border border-[#FF3B3B]/45 bg-[#FF3B3B]/[0.14] px-[9px] font-pretendard text-[12px] font-semibold text-[#ff8a8a]";

/** 펼친 줄에 쓸 값 — 서버가 남긴 값, 없으면 대상·동작 이름 */
function itemText(e: LogEntry): string {
  const d = describe(e);
  return d.detail ?? d.extra ?? (e.action || d.label);
}

function Row({ row, open, onToggle }: { row: LogRow; open: boolean; onToggle: () => void }) {
  const { entry, person, what, failed, count, items } = row;
  const canOpen = count > 1 || !!what.detail;
  const time = entry.ts.slice(11, 16);
  const burst = count > 1 && <span className={tagCls}>×{count} · {row.firstTs.slice(11, 16)}부터</span>;
  const fail = failed && <span className={failCls}>{failWord(entry.status)}</span>;
  const icon = (
    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/65">
      <GroupIcon group={what.group} size={14} />
    </span>
  );
  const name = (
    <>
      <b className="shrink-0 font-bold text-white">{person.name}</b>
      {person.sub && <small className="min-w-0 shrink truncate text-[12px] font-medium text-white/40">{person.sub}</small>}
    </>
  );
  const act = (
    <>
      <span className="shrink-0 font-semibold text-white">{what.label}</span>
      {what.extra && <span className="min-w-0 truncate text-white/55">{what.extra}</span>}
    </>
  );
  return (
    <div className={cn(failed && "shadow-[inset_2px_0_0_#FF3B3B]")}>
      <div
        role={canOpen ? "button" : undefined}
        tabIndex={canOpen ? 0 : undefined}
        aria-expanded={canOpen ? open : undefined}
        onClick={canOpen ? onToggle : undefined}
        onKeyDown={
          canOpen
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle();
                }
              }
            : undefined
        }
        className={cn("font-pretendard outline-none", canOpen && "cursor-pointer focus-visible:bg-white/[0.04]", "hover:bg-white/[0.03]")}
      >
        {/* PC — 한 줄 */}
        <div className="hidden h-12 grid-cols-[64px_34px_minmax(0,1fr)_auto] items-center px-5 md:grid">
          <span className="font-orbitron text-[12.5px] font-semibold text-white/50 tabular-nums">{time}</span>
          <Avatar person={person} />
          <span className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[14px] font-medium text-white/70">
            {name}
            {icon}
            {act}
            {burst}
          </span>
          <span className="pl-3">{fail}</span>
        </div>
        {/* 폰 — 두 줄 */}
        <div className="flex flex-col gap-1 px-4 py-2 md:hidden">
          <div className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[14.5px] font-medium text-white/70">
            <span className="w-[42px] shrink-0 font-orbitron text-[12px] font-semibold text-white/50 tabular-nums">{time}</span>
            <Avatar person={person} size={22} />
            {name}
            <span className="ml-auto pl-1">{fail}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 whitespace-nowrap pl-[50px] text-[14px] text-white/70">
            {icon}
            {act}
            {burst}
          </div>
        </div>
      </div>

      {open && (
        <ul className="pb-2 pl-[84px] pr-4 md:pl-[118px] md:pr-5">
          {items.map((e, i) => (
            <li key={`${e.ts}-${i}`} className="flex min-h-8 items-center gap-3 border-l border-white/[0.08] pl-3 font-pretendard text-[13px] text-white/60">
              <span className="shrink-0 font-orbitron text-[11.5px] font-semibold text-white/40 tabular-nums">{e.ts.slice(11, 19)}</span>
              <span className="min-w-0 flex-1 break-words">{itemText(e)}</span>
              {e.status >= 400 && <span className="shrink-0 text-[12px] font-semibold text-[#ff8a8a]">{failWord(e.status)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
