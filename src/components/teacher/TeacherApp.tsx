"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Calendar, Check, ChevronLeft, Clock, Film, Lock, Mail, Minus, Pencil, Play, Plus, Send } from "lucide-react";
import OnairMark from "@/components/common/OnairMark";
import { ToastHost, toast } from "@/components/common/Toast";
import { backendBase } from "@/lib/backend";
import { cn } from "@/lib/utils";
import {
  BELL_MODE_LABEL,
  HALL_LABEL,
  dayLabel,
  targetLabel,
  whenOf,
  whereOf,
  type Kind,
  type Scope,
  type Teacher,
  type TeacherRequest,
} from "@/lib/teacherRequests";
import {
  ChoiceChip,
  FieldLabel,
  Glass,
  KindIcon,
  Seg,
  StatusPill,
  TierChip,
  ghostBtn,
  inputCls,
  redBtn,
} from "@/components/teacher/parts";

/** 선생님 요청(teacher.bssmcast.com) — 학교 계정으로 들어와 등록 → 방송부 승인 → 요청 보내기·확인.
 *  화면은 주소 쿼리로 나눈다: ?v=new&k=announce · ?v=req&id=… · ?v=list */

interface Me {
  email: string;
  status: "none" | "pending" | "approved" | "revoked";
  teacher: Teacher | null;
  allowed: { kinds: Kind[]; announceScopes: Scope[] };
}

interface Places {
  classes: string[];
  grades: number[];
  channels: { channel: number; label: string; hallName: string | null }[];
}

/** 시험용 — 서버 자신(localhost)에서 열면 이 칸의 이메일을 선생님으로 (서버도 그 주소에서만 받는다) */
function devHeaders(): Record<string, string> {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return {};
  try {
    const e = localStorage.getItem("onair.teacher.devEmail");
    return e ? { "x-teacher-email": e } : {};
  } catch {
    return {};
  }
}

async function tapi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${backendBase()}/api/teacher${path}`, {
    ...init,
    headers: { ...(init.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}), ...devHeaders(), ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      msg = ((await r.json()) as { detail?: string }).detail ?? msg;
    } catch {}
    throw new Error(msg);
  }
  const type = r.headers.get("content-type") ?? "";
  return (type.includes("json") ? await r.json() : await r.blob()) as T;
}

const KINDS: { kind: Kind; title: string; sub: string; lock: string }[] = [
  { kind: "announce", title: "안내 방송", sub: "정한 시각에 교실 스피커로", lock: "" },
  { kind: "media", title: "영상·자료 송출", sub: "강당·다목적홀 화면에", lock: "" },
  { kind: "event", title: "행사 지원", sub: "강당·다목적홀 장비와 운영", lock: "부장·학년부부터" },
  { kind: "bell", title: "시보 변경", sub: "단축 수업·시험 날 종 시간", lock: "교무·관리자" },
];
const DUTIES = ["담임", "학년부", "교과", "교무·관리", "기타"];
const TIMES = [
  { label: "조회", time: "08:20" },
  { label: "점심", time: "12:40" },
  { label: "종례", time: "16:30" },
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => iso(new Date());
const tomorrow = () => iso(new Date(Date.now() + 86400_000));

// ======================================================================
// 뼈대
// ======================================================================

function Header({ me, onHome, onList, view }: { me: Me | undefined; onHome: () => void; onList: () => void; view: string }) {
  const t = me?.teacher;
  const approved = me?.status === "approved";
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center gap-2.5 border-b border-white/[0.07] bg-[#0a0a0c]/70 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md md:px-12">
      <button type="button" onClick={onHome} className="flex items-center gap-2.5">
        <OnairMark size={30} className="text-[#FF3B3B]" />
        <span className="font-mbc text-[22px] text-white md:text-[24px]">ONAIR</span>
        <span className="ml-1 font-orbitron text-[11px] font-bold tracking-[0.32em] text-[#FF3B3B] max-sm:hidden">TEACHER</span>
      </button>
      {approved && (
        <nav className="ml-4 flex gap-1 md:ml-10">
          {[
            { k: "home", label: "홈", go: onHome },
            { k: "list", label: "내 요청", go: onList },
          ].map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={x.go}
              className={cn(
                "rounded-[10px] px-3.5 py-2 font-pretendard text-[15px] font-bold",
                view === x.k ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/70",
              )}
            >
              {x.label}
            </button>
          ))}
        </nav>
      )}
      {t && (
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right max-md:hidden">
            <p className="font-pretendard text-[15px] font-bold text-white">{t.name} 선생님</p>
            <p className="font-pretendard text-[13px] text-white/45">{t.dept || t.duty}</p>
          </div>
          {approved && <TierChip tier={t.tier} />}
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/15 bg-white/[0.06] font-pretendard text-[15px] font-bold text-white">
            {t.name.slice(0, 1)}
          </span>
        </div>
      )}
    </header>
  );
}

function PageHead({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3.5">
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로"
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.045] text-white"
      >
        <ChevronLeft size={22} />
      </button>
      <h1 className="font-mbc text-[30px] leading-none text-white md:text-[40px]">{title}</h1>
      {right}
    </div>
  );
}

/** 왼쪽 입력 · 오른쪽 미리보기와 보내기 (좁으면 위아래) */
function FormLayout({ form, side }: { form: ReactNode; side: ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-6">
      <Glass className="flex flex-col gap-6 p-5 md:p-6">{form}</Glass>
      <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">{side}</div>
    </div>
  );
}

function Meta({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-[18px] gap-y-2.5 font-pretendard text-[15px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-white/45">{k}</dt>
          <dd className="m-0 font-medium text-white">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function DateTimePick({
  date,
  time,
  onDate,
  onTime,
  presets = true,
}: {
  date: string;
  time: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
  presets?: boolean;
}) {
  const custom = !TIMES.some((t) => t.time === time);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <FieldLabel>언제</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <ChoiceChip on={date === today()} onClick={() => onDate(today())}>
            오늘 <small className="font-medium opacity-70">{dayLabel(today())}</small>
          </ChoiceChip>
          <ChoiceChip on={date === tomorrow()} onClick={() => onDate(tomorrow())}>
            내일 <small className="font-medium opacity-70">{dayLabel(tomorrow())}</small>
          </ChoiceChip>
          <label className={cn("relative inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 font-pretendard text-[14.5px] font-bold",
            date !== today() && date !== tomorrow() ? "border-white bg-white text-[#0a0a0c]" : "border-white/10 bg-white/[0.06] text-white")}>
            <Calendar size={16} />
            {date !== today() && date !== tomorrow() ? dayLabel(date) : "날짜"}
            <input type="date" value={date} min={today()} onChange={(e) => e.target.value && onDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="날짜 고르기" />
          </label>
        </div>
      </div>
      <div>
        <FieldLabel>몇 시</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {presets &&
            TIMES.map((t) => (
              <ChoiceChip key={t.time} on={time === t.time} onClick={() => onTime(t.time)}>
                {t.label} <small className="font-medium opacity-70">{t.time}</small>
              </ChoiceChip>
            ))}
          <label className={cn("relative inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 font-pretendard text-[14.5px] font-bold",
            custom ? "border-white bg-white text-[#0a0a0c]" : "border-white/10 bg-white/[0.06] text-white")}>
            <Clock size={16} />
            {custom ? time : "직접"}
            <input type="time" value={time} onChange={(e) => e.target.value && onTime(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="시각 고르기" />
          </label>
        </div>
      </div>
    </div>
  );
}

// ======================================================================
// 등록 · 승인 대기
// ======================================================================

function Register({ me }: { me: Me }) {
  const qc = useQueryClient();
  const [name, setName] = useState(me.teacher?.name ?? "");
  const [dept, setDept] = useState(me.teacher?.dept ?? "");
  const [duty, setDuty] = useState(me.teacher?.duty ?? "담임");
  const send = useMutation({
    mutationFn: () => tapi("/register", { method: "POST", body: JSON.stringify({ name, dept, duty }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-me"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex min-h-[calc(100dvh-72px)] items-center justify-center px-4 py-10">
      <Glass className="flex w-full max-w-[620px] flex-col gap-5 bg-[rgba(32,32,32,0.6)] p-6 md:p-10">
        <h1 className="font-mbc text-[32px] text-white md:text-[40px]">선생님 등록</h1>
        <div className="flex items-center gap-3 rounded-[14px] border border-white/[0.09] bg-white/[0.045] px-4 py-3.5">
          <Mail size={19} className="text-white/45" />
          <span className="min-w-0 truncate font-pretendard text-[16px] text-white">{me.email}</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2.5 py-1 font-pretendard text-[12.5px] font-bold text-white/75">
            <Check size={13} />
            학교 계정
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>이름</FieldLabel>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="김지현" className={inputCls} autoFocus />
          </div>
          <div>
            <FieldLabel>담당</FieldLabel>
            <input value={dept} onChange={(e) => setDept(e.target.value.slice(0, 40))} placeholder="2학년 3반 담임 · 국어" className={inputCls} />
          </div>
        </div>
        <div>
          <FieldLabel>하는 일</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {DUTIES.map((d) => (
              <ChoiceChip key={d} on={duty === d} onClick={() => setDuty(d)}>
                {d}
              </ChoiceChip>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <button type="button" className={redBtn} disabled={!name.trim() || send.isPending} onClick={() => send.mutate()}>
            {me.status === "pending" ? "고친 내용 보내기" : "등록 신청"}
          </button>
        </div>
      </Glass>
    </div>
  );
}

function Waiting({ me, onEdit }: { me: Me; onEdit: () => void }) {
  const t = me.teacher!;
  return (
    <div className="flex min-h-[calc(100dvh-72px)] items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[520px] flex-col items-center gap-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-[10px] border border-white/20 bg-white/[0.05] px-4 py-2 font-orbitron text-[12.5px] tracking-[0.22em] text-white/80">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
          STANDBY
        </span>
        <h1 className="font-mbc text-[32px] leading-tight text-white [text-wrap:balance]">방송부 확인을 기다리고 있어요</h1>
        <Glass className="w-full p-6 text-left">
          <Meta rows={[["이름", t.name], ["담당", t.dept || "-"], ["하는 일", t.duty], ["계정", me.email]]} />
        </Glass>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/15 px-3.5 py-2 font-pretendard text-[14px] font-bold text-white/80">
          <Pencil size={15} />
          정보 고치기
        </button>
      </div>
    </div>
  );
}

// ======================================================================
// 홈 · 내 요청
// ======================================================================

function RequestTable({ rows, open }: { rows: TeacherRequest[]; open: (id: string) => void }) {
  if (!rows.length) return <p className="py-10 text-center font-pretendard text-[15px] text-white/40">요청이 없어요</p>;
  const last = (r: TeacherRequest) => [...r.comments].reverse().find((c) => c.side === "crew");
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse font-pretendard text-[15px]">
        <thead>
          <tr className="text-left text-[13px] text-white/40">
            <th className="px-3 pb-3 font-bold">요청</th>
            <th className="px-3 pb-3 font-bold">언제</th>
            <th className="px-3 pb-3 font-bold">어디로</th>
            <th className="px-3 pb-3 font-bold">방송부</th>
            <th className="px-3 pb-3 text-right font-bold">상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = last(r);
            const dim = r.status === "rejected" || r.status === "canceled" || r.status === "done";
            return (
              <tr key={r.id} onClick={() => open(r.id)} className="cursor-pointer border-t border-white/[0.09] hover:bg-white/[0.03]">
                <td className="px-3 py-4">
                  <span className={cn("flex items-center gap-2.5 font-bold", dim ? "text-white/55" : "text-white")}>
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-white/[0.07]">
                      <KindIcon kind={r.kind} size={17} />
                    </span>
                    {r.kindLabel}
                    {r.kind === "announce" && r.payload.text ? <span className="truncate font-medium text-white/45">· {String(r.payload.text).slice(0, 14)}</span> : null}
                    {r.kind === "event" && r.payload.title ? <span className="truncate font-medium text-white/45">· {r.payload.title}</span> : null}
                  </span>
                </td>
                <td className={cn("px-3 py-4 tabular-nums", dim && "text-white/45")}>{whenOf(r)}</td>
                <td className={cn("px-3 py-4", dim && "text-white/45")}>{whereOf(r)}</td>
                <td className="max-w-[320px] truncate px-3 py-4 text-[14px] text-white/45">
                  {c ? `${c.by} · "${c.text}"` : r.status === "new" ? "아직 확인 전" : r.handledBy || ""}
                </td>
                <td className="px-3 py-4 text-right">
                  <StatusPill r={r} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Home({ me, reqs, go, open, full }: { me: Me; reqs: TeacherRequest[]; go: (k: Kind) => void; open: (id: string) => void; full?: boolean }) {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const openRows = reqs.filter((r) => r.status === "new" || r.status === "accepted");
  const closed = reqs.filter((r) => !(r.status === "new" || r.status === "accepted"));
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-8 md:px-12 md:py-9">
      {!full && (
        <>
          <div>
            <p className="font-orbitron text-[11px] tracking-[0.28em] text-white/40">REQUEST</p>
            <h1 className="mt-2 font-mbc text-[32px] leading-tight text-white md:text-[40px]">무엇을 부탁할까요</h1>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {KINDS.map((k) => {
              const ok = me.allowed.kinds.includes(k.kind);
              return (
                <button
                  key={k.kind}
                  type="button"
                  disabled={!ok}
                  onClick={() => go(k.kind)}
                  className={cn(
                    "group relative flex min-h-[150px] flex-col gap-2.5 rounded-[22px] border border-white/[0.09] bg-white/[0.045] p-5 text-left backdrop-blur-md transition-colors md:min-h-[168px] md:p-[22px]",
                    ok ? "hover:border-white/20 hover:bg-white/[0.07]" : "cursor-not-allowed opacity-40",
                  )}
                >
                  {!ok && (
                    <span className="absolute right-4 top-4 flex items-center gap-1 font-pretendard text-[12.5px] text-white/60">
                      <Lock size={13} />
                      <span className="max-md:hidden">{k.lock}</span>
                    </span>
                  )}
                  <span className={cn("flex h-12 w-12 items-center justify-center rounded-[14px]", ok ? "bg-[#FF3B3B]/15 text-[#ff8a84]" : "bg-white/[0.06] text-white/50")}>
                    <KindIcon kind={k.kind} size={24} />
                  </span>
                  <b className="font-pretendard text-[18px] text-white md:text-[19px]">{k.title}</b>
                  <span className="font-pretendard text-[14px] leading-snug text-white/45">{k.sub}</span>
                  {ok && <ArrowRight size={20} className="absolute bottom-5 right-5 text-white/35 transition-transform group-hover:translate-x-0.5" />}
                </button>
              );
            })}
          </div>
        </>
      )}
      <Glass className="px-4 pb-2 pt-5 md:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-mbc text-[24px] text-white md:text-[26px]">내 요청</h2>
          <div className="flex gap-2">
            <ChoiceChip on={tab === "open"} onClick={() => setTab("open")}>
              진행 중 <small className="font-medium opacity-70">{openRows.length}</small>
            </ChoiceChip>
            <ChoiceChip on={tab === "closed"} onClick={() => setTab("closed")}>
              끝난 것 <small className="font-medium opacity-70">{closed.length}</small>
            </ChoiceChip>
          </div>
        </div>
        <RequestTable rows={tab === "open" ? openRows : closed} open={open} />
      </Glass>
    </div>
  );
}

// ======================================================================
// 요청 쓰기
// ======================================================================

function useSend(onDone: (id: string) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind: Kind; payload: Record<string, unknown> }) =>
      tapi<{ request: TeacherRequest }>("/requests", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["teacher-requests"] });
      toast.success("요청을 보냈어요");
      onDone(res.request.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function SendButton({ disabled, busy, onClick }: { disabled?: boolean; busy?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={cn(redBtn, "w-full")} disabled={disabled || busy} onClick={onClick}>
      <Send size={19} />
      {busy ? "보내는 중…" : "요청 보내기"}
    </button>
  );
}

function AnnounceForm({ me, places, back, done }: { me: Me; places?: Places; back: () => void; done: (id: string) => void }) {
  const [date, setDate] = useState(tomorrow());
  const [time, setTime] = useState("08:20");
  const [scope, setScope] = useState<Scope>("class");
  const [cls, setCls] = useState("");
  const [grade, setGrade] = useState("");
  const [method, setMethod] = useState<"tts" | "crew">("tts");
  const [text, setText] = useState("");
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const send = useSend(done);
  const can = me.allowed.announceScopes;
  const value = scope === "class" ? cls : scope === "grade" ? grade : "";
  const target = { scope, value };
  const ok = text.trim() && (scope === "school" || value);

  // 담당에 '2학년 3반' 이 있으면 그 반·학년부터
  useEffect(() => {
    if (!places) return;
    const m = /(\d+)\s*학년\s*(\d+)\s*반/.exec(me.teacher?.dept ?? "");
    const mine = m ? `${m[1]}-${m[2]}` : "";
    if (!cls && places.classes.length) setCls(places.classes.includes(mine) ? mine : places.classes[0]);
    if (!grade && places.grades.length) setGrade(m && places.grades.includes(Number(m[1])) ? m[1] : String(places.grades[0]));
  }, [places, cls, grade, me.teacher?.dept]);

  const listen = async () => {
    if (!text.trim()) return;
    setPlaying(true);
    try {
      const blob = await tapi<Blob>("/tts-preview", { method: "POST", body: JSON.stringify({ text }) });
      audio.current?.pause();
      audio.current = new Audio(URL.createObjectURL(blob));
      audio.current.onended = () => setPlaying(false);
      await audio.current.play();
    } catch (e) {
      toast.error((e as Error).message);
      setPlaying(false);
    }
  };

  const selectCls = "h-[42px] rounded-xl border border-white/10 bg-[#0c0d0f] px-3 font-pretendard text-[14.5px] font-bold text-white";
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-8 md:px-12">
      <PageHead title="안내 방송" onBack={back} />
      <FormLayout
        form={
          <>
            <DateTimePick date={date} time={time} onDate={setDate} onTime={setTime} />
            <div>
              <FieldLabel>누구에게</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <ChoiceChip on={scope === "class"} disabled={!can.includes("class")} onClick={() => setScope("class")}>
                  반
                </ChoiceChip>
                {scope === "class" && (
                  <select value={cls} onChange={(e) => setCls(e.target.value)} className={selectCls} aria-label="반 고르기">
                    {places?.classes.map((c) => (
                      <option key={c} value={c}>
                        {targetLabel({ scope: "class", value: c })}
                      </option>
                    ))}
                  </select>
                )}
                <ChoiceChip on={scope === "grade"} disabled={!can.includes("grade")} onClick={() => setScope("grade")}>
                  학년 전체
                </ChoiceChip>
                {scope === "grade" && (
                  <select value={grade} onChange={(e) => setGrade(e.target.value)} className={selectCls} aria-label="학년 고르기">
                    {places?.grades.map((g) => (
                      <option key={g} value={g}>
                        {g}학년
                      </option>
                    ))}
                  </select>
                )}
                <ChoiceChip on={scope === "school"} disabled={!can.includes("school")} onClick={() => setScope("school")}>
                  {!can.includes("school") && <Lock size={14} />}학교 전체
                </ChoiceChip>
              </div>
            </div>
            <div className="max-w-[560px]">
              <FieldLabel>어떻게</FieldLabel>
              <Seg
                value={method}
                onChange={setMethod}
                options={[
                  { value: "tts", label: "글 읽어 주기", sub: "그 시각에 TTS 로" },
                  { value: "crew", label: "방송부가 읽기", sub: "방송부원이 직접" },
                ]}
              />
            </div>
            <div>
              <FieldLabel
                right={
                  <button type="button" onClick={listen} disabled={!text.trim() || playing} className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/15 px-3 py-1.5 text-[13.5px] font-bold text-white disabled:opacity-40">
                    <Play size={14} />
                    {playing ? "듣는 중" : "들어 보기"}
                  </button>
                }
              >
                내용
              </FieldLabel>
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 500))}
                  rows={5}
                  placeholder="2학년 3반 학생들은 1교시 시작 전까지 체육복으로 갈아입고 운동장 스탠드 앞에 모여 주세요."
                  className={cn(inputCls, "h-auto min-h-[136px] resize-none py-3 leading-relaxed")}
                />
                <span className="pointer-events-none absolute bottom-2.5 right-3.5 font-pretendard text-[12.5px] tabular-nums text-white/40">{text.length}/500</span>
              </div>
            </div>
          </>
        }
        side={
          <>
            <Glass className="flex flex-col gap-4 p-6">
              <p className="font-orbitron text-[11px] tracking-[0.28em] text-white/40">PREVIEW</p>
              <p className={cn("m-0 font-pretendard text-[19px] font-medium leading-relaxed", text.trim() ? "text-white" : "text-white/25")}>
                {text.trim() ? `"${text.trim()}"` : "내용을 적으면 여기 보여요"}
              </p>
              <Meta rows={[["언제", `${dayLabel(date)} ${time}`], ["누구에게", scope === "school" || value ? targetLabel(target) : "-"], ["어떻게", method === "tts" ? "글 읽어 주기" : "방송부가 읽기"]]} />
            </Glass>
            <SendButton
              disabled={!ok}
              busy={send.isPending}
              onClick={() => send.mutate({ kind: "announce", payload: { date, time, target, method, text: text.trim() } })}
            />
          </>
        }
      />
    </div>
  );
}

function MediaForm({ places, back, done }: { places?: Places; back: () => void; done: (id: string) => void }) {
  const [file, setFile] = useState<{ id: string; name: string; size: number } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [date, setDate] = useState(tomorrow());
  const [time, setTime] = useState("13:00");
  const [channel, setChannel] = useState(1);
  const [memo, setMemo] = useState("");
  const send = useSend(done);

  const upload = (f: File) => {
    const fd = new FormData();
    fd.append("file", f);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${backendBase()}/api/teacher/uploads`);
    Object.entries(devHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(e.loaded / e.total);
    xhr.onload = () => {
      setProgress(null);
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 400) throw new Error(body.detail ?? `HTTP ${xhr.status}`);
        setFile(body);
      } catch (e) {
        toast.error((e as Error).message);
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      toast.error("파일을 올리지 못했어요");
    };
    setProgress(0);
    xhr.send(fd);
  };

  const ch = places?.channels.find((c) => c.channel === channel);
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-8 md:px-12">
      <PageHead title="영상·자료 송출" onBack={back} />
      <FormLayout
        form={
          <>
            <div>
              <FieldLabel>파일</FieldLabel>
              <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-white/[0.09] bg-white/[0.045] p-4 hover:bg-white/[0.07]">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-white/[0.08] text-white/70">
                  <Film size={28} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-pretendard text-[16.5px] text-white">{file ? file.name : progress !== null ? "올리는 중…" : "파일 고르기"}</b>
                  <span className="font-pretendard text-[13.5px] text-white/45">
                    {file ? `${(file.size / 1048576).toFixed(1)}MB` : "영상 · 이미지 · PPT · PDF"}
                  </span>
                  {progress !== null && (
                    <span className="mt-2 block h-1.5 overflow-hidden rounded bg-white/10">
                      <span className="block h-full bg-white" style={{ width: `${Math.round(progress * 100)}%` }} />
                    </span>
                  )}
                </span>
                <span className="rounded-[10px] border border-white/15 px-3 py-1.5 font-pretendard text-[13.5px] font-bold text-white">{file ? "바꾸기" : "고르기"}</span>
                <input type="file" className="hidden" accept="video/*,image/*,.pdf,.ppt,.pptx" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
            </div>
            <DateTimePick date={date} time={time} onDate={setDate} onTime={setTime} presets={false} />
            <div>
              <FieldLabel>어디서</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {(places?.channels ?? []).map((c) => (
                  <ChoiceChip key={c.channel} on={channel === c.channel} onClick={() => setChannel(c.channel)}>
                    {c.hallName ?? c.label} <small className="font-medium opacity-70">CH{c.channel}</small>
                  </ChoiceChip>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>메모</FieldLabel>
              <input value={memo} onChange={(e) => setMemo(e.target.value.slice(0, 200))} placeholder="소리 크게 부탁드려요" className={inputCls} />
            </div>
          </>
        }
        side={
          <>
            <Glass className="flex flex-col gap-4 p-6">
              <p className="font-orbitron text-[11px] tracking-[0.28em] text-white/40">PREVIEW</p>
              <div className="flex aspect-video items-center justify-center rounded-[14px] bg-white/[0.06] text-white/40">
                <Play size={36} />
              </div>
              <Meta rows={[["파일", file?.name ?? "-"], ["언제", `${dayLabel(date)} ${time}`], ["어디서", ch ? `${ch.hallName ?? ch.label} · CH${ch.channel}` : `CH${channel}`]]} />
            </Glass>
            <SendButton
              disabled={!file}
              busy={send.isPending}
              onClick={() => send.mutate({ kind: "media", payload: { uploadId: file!.id, date, time, channel, memo } })}
            />
          </>
        }
      />
    </div>
  );
}

function EventForm({ back, done }: { back: () => void; done: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(tomorrow());
  const [period, setPeriod] = useState("");
  const [place, setPlace] = useState<"auditorium" | "multipurpose">("auditorium");
  const [mics, setMics] = useState(2);
  const [needs, setNeeds] = useState({ screen: true, lights: false, record: false, music: false });
  const [memo, setMemo] = useState("");
  const send = useSend(done);
  const toggles: [keyof typeof needs, string][] = [["screen", "스크린에 자료"], ["lights", "무대 조명"], ["record", "녹화"], ["music", "입장 음악"]];
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-8 md:px-12">
      <PageHead title="행사 지원" onBack={back} />
      <FormLayout
        form={
          <>
            <div>
              <FieldLabel>행사 이름</FieldLabel>
              <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="2학년 진로 집회" className={inputCls} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <FieldLabel>날짜</FieldLabel>
                <input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <FieldLabel>시간</FieldLabel>
                <input value={period} onChange={(e) => setPeriod(e.target.value.slice(0, 40))} placeholder="3~4교시" className={inputCls} />
              </div>
              <div>
                <FieldLabel>장소</FieldLabel>
                <Seg value={place} onChange={setPlace} options={[{ value: "auditorium", label: "강당" }, { value: "multipurpose", label: "다목적홀" }]} />
              </div>
            </div>
            <div>
              <FieldLabel>메모</FieldLabel>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value.slice(0, 500))} rows={4} placeholder="외부 강사님 1분, 질문 시간에 객석 마이크 필요해요." className={cn(inputCls, "h-auto min-h-[110px] resize-none py-3 leading-relaxed")} />
            </div>
          </>
        }
        side={
          <>
            <Glass className="p-6">
              <p className="mb-3.5 font-orbitron text-[11px] tracking-[0.28em] text-white/40">NEEDS</p>
              <div className="flex items-center justify-between py-1 font-pretendard text-[15.5px] text-white">
                무선 마이크
                <span className="flex items-center overflow-hidden rounded-[11px] border border-white/15">
                  <button type="button" aria-label="하나 빼기" onClick={() => setMics((m) => Math.max(0, m - 1))} className="flex h-[34px] w-[38px] items-center justify-center text-white/70"><Minus size={15} /></button>
                  <b className="w-9 text-center tabular-nums">{mics}</b>
                  <button type="button" aria-label="하나 더" onClick={() => setMics((m) => Math.min(10, m + 1))} className="flex h-[34px] w-[38px] items-center justify-center text-white/70"><Plus size={15} /></button>
                </span>
              </div>
              {toggles.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setNeeds((n) => ({ ...n, [k]: !n[k] }))}
                  aria-pressed={needs[k]}
                  className="flex w-full items-center justify-between border-t border-white/[0.09] py-3.5 font-pretendard text-[15.5px] text-white"
                >
                  {label}
                  <span className={cn("relative h-7 w-12 rounded-full transition-colors", needs[k] ? "bg-[#FF3B3B]" : "bg-white/15")}>
                    <span className={cn("absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-all", needs[k] ? "left-[23px]" : "left-[3px]")} />
                  </span>
                </button>
              ))}
            </Glass>
            <SendButton
              disabled={!title.trim()}
              busy={send.isPending}
              onClick={() => send.mutate({ kind: "event", payload: { title, date, period, place, needs: { mics, ...needs }, memo } })}
            />
          </>
        }
      />
    </div>
  );
}

function BellForm({ back, done }: { back: () => void; done: (id: string) => void }) {
  const [dates, setDates] = useState<string[]>([tomorrow()]);
  const [mode, setMode] = useState<"short" | "exam" | "off" | "custom">("short");
  const [memo, setMemo] = useState("");
  const send = useSend(done);
  const first = dates[0];
  const bells = useQuery({
    queryKey: ["teacher-day-bells", first],
    queryFn: () => tapi<{ bells: { time: string; label: string }[]; special: boolean }>(`/day-bells?date=${first}`),
    enabled: !!first,
  });
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-8 md:px-12">
      <PageHead title="시보 변경" onBack={back} />
      <div className="grid gap-5 lg:grid-cols-[520px_minmax(0,1fr)] lg:gap-6">
        <Glass className="flex flex-col gap-6 p-5 md:p-6">
          <div>
            <FieldLabel>날짜</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {dates.map((d) => (
                <ChoiceChip key={d} on onClick={() => setDates((x) => (x.length > 1 ? x.filter((y) => y !== d) : x))}>
                  {dayLabel(d)}
                </ChoiceChip>
              ))}
              <label className="relative inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 font-pretendard text-[14.5px] font-bold text-white">
                <Plus size={15} />
                날짜 더하기
                <input type="date" min={today()} onChange={(e) => e.target.value && setDates((x) => Array.from(new Set([...x, e.target.value])).sort())} className="absolute inset-0 cursor-pointer opacity-0" aria-label="날짜 더하기" />
              </label>
            </div>
          </div>
          <div>
            <FieldLabel>어떻게 바꿀까요</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BELL_MODE_LABEL) as (keyof typeof BELL_MODE_LABEL)[]).map((m) => (
                <ChoiceChip key={m} on={mode === m} onClick={() => setMode(m)}>
                  {BELL_MODE_LABEL[m]}
                </ChoiceChip>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>메모</FieldLabel>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value.slice(0, 500))} rows={4} placeholder="교직원 연수로 7교시까지 40분 수업" className={cn(inputCls, "h-auto min-h-[110px] resize-none py-3 leading-relaxed")} />
          </div>
          <SendButton busy={send.isPending} disabled={!dates.length} onClick={() => send.mutate({ kind: "bell", payload: { dates, mode, memo } })} />
        </Glass>
        <Glass className="p-5 md:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mbc text-[24px] text-white">{dayLabel(first)} 지금 종</h2>
            {bells.data?.special && <span className="rounded-md border border-white/15 px-2 py-0.5 font-pretendard text-[12px] font-bold text-white/70">특별(P) 모드</span>}
          </div>
          {bells.data?.bells.length ? (
            <div className="grid grid-cols-[90px_minmax(0,1fr)] font-pretendard text-[15px] tabular-nums">
              {bells.data.bells.map((b, i) => (
                <div key={i} className="contents">
                  <div className="border-t border-white/[0.09] py-2.5 text-white">{b.time}</div>
                  <div className="truncate border-t border-white/[0.09] py-2.5 text-white/65">{b.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center font-pretendard text-[15px] text-white/40">{bells.isLoading ? "불러오는 중…" : "그날 걸린 종이 없어요"}</p>
          )}
        </Glass>
      </div>
    </div>
  );
}

// ======================================================================
// 요청 보기
// ======================================================================

function Detail({ id, back }: { id: string; back: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const q = useQuery({
    queryKey: ["teacher-request", id],
    queryFn: () => tapi<{ request: TeacherRequest }>(`/requests/${encodeURIComponent(id)}`),
    refetchInterval: 15_000,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["teacher-request", id] });
    qc.invalidateQueries({ queryKey: ["teacher-requests"] });
  };
  const say = useMutation({
    mutationFn: () => tapi(`/requests/${encodeURIComponent(id)}/comment`, { method: "POST", body: JSON.stringify({ text }) }),
    onSuccess: () => {
      setText("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: () => tapi(`/requests/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast.success("요청을 취소했어요");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const r = q.data?.request;
  if (!r) return <p className="p-12 text-center font-pretendard text-white/40">{q.isError ? (q.error as Error).message : "불러오는 중…"}</p>;
  const p = r.payload;
  const rows: [string, ReactNode][] =
    r.kind === "announce"
      ? [["언제", `${dayLabel(p.date)} ${p.time}`], ["누구에게", targetLabel(p.target)], ["어떻게", p.method === "tts" ? "글 읽어 주기" : "방송부가 읽기"]]
      : r.kind === "media"
        ? [["파일", r.upload?.name ?? "-"], ["언제", `${dayLabel(p.date)} ${p.time}`], ["어디서", `CH${p.channel}`], ...(p.memo ? ([["메모", p.memo]] as [string, ReactNode][]) : [])]
        : r.kind === "event"
          ? [["행사", p.title], ["언제", `${dayLabel(p.date)} ${p.period ?? ""}`], ["장소", p.place ? HALL_LABEL[p.place] : "-"],
             ["필요한 것", [p.needs?.mics ? `무선 마이크 ${p.needs.mics}` : "", p.needs?.screen ? "스크린" : "", p.needs?.lights ? "조명" : "", p.needs?.record ? "녹화" : "", p.needs?.music ? "입장 음악" : ""].filter(Boolean).join(" · ") || "-"]]
          : [["날짜", (p.dates ?? []).map(dayLabel).join(", ")], ["바꾸기", p.mode ? BELL_MODE_LABEL[p.mode] : "-"]];
  const open = r.status === "new" || r.status === "accepted";
  // 수락된 글 읽어 주기 — 아직 남은 '방송' 단계
  const upcoming = r.status === "accepted" && r.kind === "announce" && p.method === "tts";
  const fmt = (at: string) => {
    const d = new Date(at);
    return `${dayLabel(iso(d))} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-8 md:px-12">
      <PageHead title={r.kindLabel} onBack={back} right={<StatusPill r={r} big />} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-6">
        <Glass className="flex flex-col gap-5 p-5 md:p-7">
          {r.kind === "announce" && p.text && <p className="m-0 font-pretendard text-[20px] font-medium leading-relaxed text-white md:text-[21px]">&quot;{p.text}&quot;</p>}
          {(r.kind === "event" || r.kind === "bell") && p.memo ? <p className="m-0 font-pretendard text-[17px] leading-relaxed text-white/85">{p.memo}</p> : null}
          <Meta rows={rows} />
          <div className="mt-2 flex flex-col gap-3 border-t border-white/[0.09] pt-5">
            {r.comments.map((c, i) => (
              <div key={i} className={cn("max-w-[85%] rounded-2xl px-4 py-3 font-pretendard text-[15px] leading-relaxed text-white", c.side === "crew" ? "self-start rounded-bl-[4px] bg-white/[0.07]" : "self-end rounded-br-[4px] border border-white/15")}>
                <small className="mb-1 block text-[12.5px] text-white/45">
                  {c.side === "crew" ? `방송부 · ${c.by}` : "나"} · {fmt(c.at)}
                </small>
                {c.text}
              </div>
            ))}
            {open && (
              <div className="flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} onKeyDown={(e) => e.key === "Enter" && text.trim() && say.mutate()} placeholder="방송부에 한마디" className={inputCls} />
                <button type="button" disabled={!text.trim() || say.isPending} onClick={() => say.mutate()} className={cn(ghostBtn, "h-[50px] shrink-0 px-4")}>
                  <Send size={17} />
                </button>
              </div>
            )}
          </div>
        </Glass>
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Glass className="p-6">
            <p className="mb-4 font-orbitron text-[11px] tracking-[0.28em] text-white/40">PROGRESS</p>
            {r.history.map((h, i) => (
              <div key={i} className={cn("relative grid grid-cols-[26px_minmax(0,1fr)] gap-3", (i < r.history.length - 1 || upcoming) && "pb-5")}>
                {(i < r.history.length - 1 || upcoming) && <span className="absolute bottom-0 left-3 top-7 w-0.5 bg-white/[0.12]" />}
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white text-[#0a0a0c]">
                  <Check size={14} />
                </span>
                <div>
                  <b className="font-pretendard text-[15.5px] text-white">{{ new: "보냄", accepted: "수락", rejected: "거절", done: "완료", canceled: "취소" }[h.status]}</b>
                  <small className="mt-0.5 block font-pretendard text-[13px] text-white/45">{fmt(h.at)} · {h.by}</small>
                </div>
              </div>
            ))}
            {upcoming && (
              <div className="relative grid grid-cols-[26px_minmax(0,1fr)] gap-3">
                <span className="h-[26px] w-[26px] rounded-full border-2 border-white/40" />
                <div>
                  <b className="font-pretendard text-[15.5px] text-white">방송</b>
                  <small className="mt-0.5 block font-pretendard text-[13px] text-white/45">{dayLabel(p.date)} {p.time} 예정</small>
                </div>
              </div>
            )}
          </Glass>
          {open && (
            <button type="button" className={cn(ghostBtn, "w-full")} disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              요청 취소
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================================================================

export default function TeacherApp() {
  const router = useRouter();
  const params = useSearchParams();
  const v = params.get("v") ?? "home";
  const me = useQuery({ queryKey: ["teacher-me"], queryFn: () => tapi<Me>("/me"), refetchInterval: (q) => (q.state.data?.status === "pending" ? 5000 : false) });
  const approved = me.data?.status === "approved";
  const reqs = useQuery({ queryKey: ["teacher-requests"], queryFn: () => tapi<{ requests: TeacherRequest[] }>("/requests"), enabled: approved, refetchInterval: 20_000 });
  const places = useQuery({ queryKey: ["teacher-places"], queryFn: () => tapi<Places>("/places"), enabled: approved, staleTime: 300_000 });
  const [editing, setEditing] = useState(false);

  const go = (q: string) => {
    router.push(q ? `?${q}` : "?", { scroll: false });
    window.scrollTo({ top: 0 });
  };
  const home = () => go("");
  const open = (id: string) => go(`v=req&id=${encodeURIComponent(id)}`);
  const kind = params.get("k") as Kind | null;

  const body = useMemo(() => {
    if (me.isLoading) return <p className="p-16 text-center font-pretendard text-white/40">불러오는 중…</p>;
    if (me.isError || !me.data) return <p className="p-16 text-center font-pretendard text-white/55">{(me.error as Error)?.message ?? "연결하지 못했어요"}</p>;
    const m = me.data;
    if (m.status === "revoked") return <p className="p-16 text-center font-pretendard text-[16px] text-white/60">방송부가 등록을 막아 둔 계정이에요. 방송부에 말씀해 주세요.</p>;
    if (m.status === "none" || (m.status === "pending" && editing)) return <Register me={m} />;
    if (m.status === "pending") return <Waiting me={m} onEdit={() => setEditing(true)} />;
    const rows = reqs.data?.requests ?? [];
    if (v === "new" && kind && m.allowed.kinds.includes(kind)) {
      if (kind === "announce") return <AnnounceForm me={m} places={places.data} back={home} done={open} />;
      if (kind === "media") return <MediaForm places={places.data} back={home} done={open} />;
      if (kind === "event") return <EventForm back={home} done={open} />;
      return <BellForm back={home} done={open} />;
    }
    if (v === "req" && params.get("id")) return <Detail id={params.get("id")!} back={() => router.back()} />;
    return <Home me={m} reqs={rows} go={(k) => go(`v=new&k=${k}`)} open={open} full={v === "list"} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data, me.isLoading, me.isError, reqs.data, places.data, v, kind, params, editing]);

  useEffect(() => {
    if (me.data?.status === "approved") setEditing(false);
  }, [me.data?.status]);

  return (
    <main className="relative min-h-[100dvh] bg-[#101010] text-white">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0505] to-black opacity-80" />
        <div className="absolute inset-0 bg-[url('/onair_background.png')] bg-cover bg-center opacity-40 mix-blend-screen" />
      </div>
      <div className="relative z-10">
        <Header me={me.data} view={v === "list" ? "list" : v === "home" ? "home" : ""} onHome={home} onList={() => go("v=list")} />
        {body}
      </div>
      <ToastHost />
    </main>
  );
}
