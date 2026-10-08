"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Select from "@/components/common/Select";
import { HttpError, request, retryUnlessClientError } from "@/lib/http";
import { failWord, toRows, type LogEntry, type LogRow } from "@/lib/accessLog";
import { cn } from "@/lib/utils";

const PAGE = 300;

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 'YYYY-MM-DD' → 오늘 · 어제 · 10월 6일 월요일 */
function dayLabel(day: string): string {
  const now = new Date();
  if (day === dayKey(now)) return "오늘";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (day === dayKey(y)) return "어제";
  const [yy, mm, dd] = day.split("-").map(Number);
  if (!yy || !mm || !dd) return day;
  return new Date(yy, mm - 1, dd).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });
}

type Result = "all" | "fail";

/** 접근 로그 — 누가 무엇을 했는지 (관리자). 로그 메뉴와 관리 › 접근 로그 탭이 같이 쓴다 */
export default function AccessLogPanel() {
  const logs = useQuery({
    queryKey: ["access-logs"],
    queryFn: () => request<{ logs: LogEntry[] }>("/logs?limit=2000"),
    refetchInterval: 5000,
    retry: retryUnlessClientError,
  });
  const [person, setPerson] = useState("");
  const [group, setGroup] = useState("");
  const [day, setDay] = useState("");
  const [result, setResult] = useState<Result>("all");
  const [shown, setShown] = useState(PAGE);

  const rows = useMemo(() => toRows(logs.data?.logs ?? []), [logs.data]);

  // 고르기 목록 — 기록에 있는 사람(많이 한 순)·동작 종류·날짜
  const options = useMemo(() => {
    const people = new Map<string, { name: string; sub: string; n: number }>();
    const groups = new Map<string, number>();
    const days: string[] = [];
    for (const r of rows) {
      const p = people.get(r.person.key);
      if (p) p.n += r.count;
      else people.set(r.person.key, { name: r.person.name, sub: r.person.sub, n: r.count });
      groups.set(r.what.group, (groups.get(r.what.group) ?? 0) + r.count);
      if (!days.includes(r.day)) days.push(r.day);
    }
    const names = [...people.values()].map((p) => p.name);
    return {
      people: [...people.entries()]
        .sort((a, b) => b[1].n - a[1].n)
        .map(([key, p]) => ({
          value: key,
          // 이름이 같은 사람이 둘이면 기수·IP 를 붙여 가른다
          label: names.filter((n) => n === p.name).length > 1 && p.sub ? `${p.name} ${p.sub}` : p.name,
        })),
      groups: [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => ({ value: g, label: g })),
      days: days.map((d) => ({ value: d, label: dayLabel(d) })),
    };
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!person || r.person.key === person) &&
          (!group || r.what.group === group) &&
          (!day || r.day === day) &&
          (result === "all" || r.failed),
      ),
    [rows, person, group, day, result],
  );

  const denied = logs.error instanceof HttpError && logs.error.status === 403;
  if (denied) return <p className="font-pretendard text-white/40">권한이 없어요</p>;

  const filtering = !!(person || group || day || result !== "all");
  const visible = filtered.slice(0, shown);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Select
          value={person}
          onChange={(v) => {
            setPerson(v);
            setShown(PAGE);
          }}
          options={[{ value: "", label: "모든 사람" }, ...options.people]}
          aria-label="사람"
          className="h-10 min-w-[150px]"
        />
        <Select
          value={group}
          onChange={(v) => {
            setGroup(v);
            setShown(PAGE);
          }}
          options={[{ value: "", label: "모든 동작" }, ...options.groups]}
          aria-label="동작"
          className="h-10 min-w-[140px]"
        />
        <Select
          value={day}
          onChange={(v) => {
            setDay(v);
            setShown(PAGE);
          }}
          options={[{ value: "", label: "모든 날짜" }, ...options.days]}
          aria-label="날짜"
          className="h-10 min-w-[140px]"
        />
        <Select<Result>
          value={result}
          onChange={(v) => {
            setResult(v);
            setShown(PAGE);
          }}
          options={[
            { value: "all", label: "모든 결과" },
            { value: "fail", label: "실패만" },
          ]}
          aria-label="결과"
          className="h-10 min-w-[120px]"
        />
        {filtering && (
          <button
            type="button"
            onClick={() => {
              setPerson("");
              setGroup("");
              setDay("");
              setResult("all");
              setShown(PAGE);
            }}
            className="h-10 rounded-lg px-3 font-pretendard text-sm text-white/50 hover:bg-white/5 hover:text-white"
          >
            초기화
          </button>
        )}
        <span className="ml-auto font-pretendard text-sm tabular-nums text-white/40">
          {filtered.reduce((n, r) => n + r.count, 0)}건
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-white/5 bg-[#0a0a0a]">
        <table className="w-full border-separate border-spacing-0 text-left font-pretendard">
          <thead className="sticky top-0 z-10 bg-[#0a0a0a] text-white/40">
            <tr>
              <th className="w-[112px] border-b border-white/10 px-5 py-3 text-[13px] font-semibold">시각</th>
              <th className="w-[26%] border-b border-white/10 px-4 py-3 text-[13px] font-semibold">사람</th>
              <th className="border-b border-white/10 px-4 py-3 text-[13px] font-semibold">동작</th>
              <th className="w-[120px] border-b border-white/10 px-5 py-3 text-right text-[13px] font-semibold">결과</th>
            </tr>
          </thead>
          <tbody>
            {logs.isLoading ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-[15px] text-white/35">
                  불러오는 중…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-[15px] text-white/35">
                  {rows.length === 0 ? "기록이 없어요" : "맞는 기록이 없어요"}
                </td>
              </tr>
            ) : (
              visible.map((r, i) => (
                <Row key={`${r.entry.ts}-${i}`} row={r} dayHead={i === 0 || visible[i - 1].day !== r.day} />
              ))
            )}
          </tbody>
        </table>
        {filtered.length > shown && (
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="h-10 rounded-lg border border-white/10 bg-white/[0.04] px-5 font-pretendard text-sm text-white/70 hover:bg-white/10 hover:text-white"
            >
              더 보기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ row, dayHead }: { row: LogRow; dayHead: boolean }) {
  const { entry, person, what, failed, count } = row;
  return (
    <>
      {dayHead && (
        <tr>
          <td
            colSpan={4}
            className="sticky top-[45px] z-[5] border-b border-white/[0.06] bg-[#111113] px-5 py-2 text-[13px] font-semibold text-white/55"
          >
            {dayLabel(row.day)}
          </td>
        </tr>
      )}
      <tr className={cn("group", failed ? "bg-[#e5484d]/[0.045]" : "hover:bg-white/[0.02]")}>
        <td
          className={cn(
            "whitespace-nowrap border-b border-l-2 border-b-white/[0.04] px-5 py-3 font-orbitron text-[13px] tabular-nums text-white/50",
            failed ? "border-l-[#e5484d]/70" : "border-l-transparent",
          )}
        >
          {entry.ts.slice(11, 19)}
        </td>
        <td className="border-b border-white/[0.04] px-4 py-3">
          <span className="text-[15px] font-semibold text-white/90">{person.name}</span>
          {person.sub && <span className="ml-2 text-[13px] text-white/35">{person.sub}</span>}
        </td>
        <td className="border-b border-white/[0.04] px-4 py-3">
          <span className={cn("text-[15px]", failed ? "text-white/60" : "text-white/85")}>{what.label}</span>
          {what.extra && <span className="ml-2 text-[14px] text-white/40">{what.extra}</span>}
          {count > 1 && (
            <span className="ml-2 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-orbitron text-[11px] tabular-nums text-white/45">
              ×{count}
            </span>
          )}
        </td>
        <td className="whitespace-nowrap border-b border-white/[0.04] px-5 py-3 text-right text-[13px]">
          {failed ? (
            <span className="text-[#ff8a8d]">
              {failWord(entry.status)}
              <span className="ml-1.5 font-orbitron text-[11px] text-[#ff8a8d]/60">{entry.status}</span>
            </span>
          ) : (
            <span className="text-white/25">완료</span>
          )}
        </td>
      </tr>
    </>
  );
}
