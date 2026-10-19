"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, ChevronLeft, Ellipsis, FileText, Play, X } from "lucide-react";
import NeonButton from "@/components/common/NeonButton";
import PageTabs from "@/components/common/PageTabs";
import SectionHeader from "@/components/common/SectionHeader";
import ConfirmModal from "@/components/common/ConfirmModal";
import { toast } from "@/components/common/Toast";
import { useMe } from "@/hooks/useMe";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import {
  BELL_MODE_LABEL,
  HALL_LABEL,
  TIER_LABEL,
  dayLabel,
  requestsApi,
  targetLabel,
  whenOf,
  type Teacher,
  type TeacherRequest,
  type Tier,
} from "@/lib/teacherRequests";
import Select from "@/components/common/Select";
import { ChoiceChip, Glass, KindIcon, NewDot, Seg, StatusPill, TierChip, YouTubeLink, ghostBtn, inputCls, redBtn } from "@/components/teacher/parts";

/** 요청함 — 선생님(teacher.bssmcast.com) 요청을 수락·거절·완료 (부원 이상), 선생님 목록은 부원 누구나 보고 승인·등급·내보내기는 부장 이상 */

type Filter = "new" | "accepted" | "closed";

export function useRequestCounts(enabled: boolean) {
  return useQuery({ queryKey: ["request-counts"], queryFn: requestsApi.counts, enabled, refetchInterval: 20_000, retry: false });
}

function ago(at: string): string {
  const m = Math.floor((Date.now() - new Date(at).getTime()) / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 1440) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 1440)}일 전`;
}

function preview(r: TeacherRequest): string {
  const p = r.payload;
  if (r.kind === "announce") return p.text ? `"${p.text}"` : "";
  if (r.kind === "media") return [p.source === "youtube" ? `유튜브 youtu.be/${p.videoId}` : r.upload?.name, p.memo].filter(Boolean).join(" · ");
  if (r.kind === "event") {
    const n = p.needs;
    return [p.title, p.place ? HALL_LABEL[p.place] : "", n?.mics ? `무선 마이크 ${n.mics}` : "", n?.screen ? "스크린" : "", n?.record ? "녹화" : ""].filter(Boolean).join(" · ");
  }
  return [p.mode ? BELL_MODE_LABEL[p.mode] : "", p.memo].filter(Boolean).join(" · ");
}

function Row({ r, on, onClick }: { r: TeacherRequest; on: boolean; onClick: () => void }) {
  const fresh = r.status === "new";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid w-full grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-2xl border p-3.5 text-left transition-colors",
        on ? "border-white/35 bg-white/[0.08]" : "border-white/[0.09] bg-white/[0.045] hover:bg-white/[0.07]",
        !fresh && !on && "opacity-75",
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.07] text-white">
        <KindIcon kind={r.kind} size={19} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2">
          <b className="truncate font-pretendard text-[15.5px] text-white">
            {r.kindLabel} · {whenOf(r)}
          </b>
          {fresh ? <NewDot /> : <StatusPill r={r} />}
        </span>
        <span className="mt-0.5 block font-pretendard text-[13px] text-white/45">
          {r.teacher?.name ?? "?"} · {r.teacher?.tierLabel ?? ""} · {ago(r.createdAt)}
        </span>
        {preview(r) && <span className="mt-1.5 block truncate font-pretendard text-[13.5px] text-white/65">{preview(r)}</span>}
      </span>
    </button>
  );
}

function Meta({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="m-0 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-[18px] gap-y-2.5 font-pretendard text-[15px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-white/45">{k}</dt>
          <dd className="m-0 font-medium text-white">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Detail({ r, onBack }: { r: TeacherRequest; onBack?: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [playing, setPlaying] = useState(false);
  useEffect(() => setText(""), [r.id]);
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["request-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const p = r.payload;
  const listen = async () => {
    if (!p.text) return;
    setPlaying(true);
    try {
      const { getApiBase } = await import("@/lib/apiBase");
      // 실제 방송과 같은 목소리(TTS 설정의 기본 목소리)로
      const v = await fetch(`${getApiBase()}/tts/voices`).then((x) => x.json()).catch(() => ({}));
      const res = await fetch(`${getApiBase()}/tts/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: v.defaultVoice || "gtts", text: p.text }),
      });
      if (!res.ok) throw new Error("소리를 만들지 못했어요");
      const a = new Audio(URL.createObjectURL(await res.blob()));
      a.onended = () => setPlaying(false);
      await a.play();
    } catch (e) {
      toast.error((e as Error).message);
      setPlaying(false);
    }
  };
  const rows: [string, ReactNode][] =
    r.kind === "announce"
      ? [["언제", `${dayLabel(p.date)} ${p.time}`], ["누구에게", `${targetLabel(p.target)} 스피커`], ["어떻게", p.method === "tts" ? "글 읽어 주기" : "방송부가 읽기"]]
      : r.kind === "media"
        ? [p.source === "youtube" ? ["유튜브", <YouTubeLink key="y" id={p.videoId} />] : ["파일", r.upload ? <a key="f" href={requestsApi.fileUrl(r.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 underline underline-offset-4"><FileText size={15} />{r.upload.name}</a> : "-"], ["언제", `${dayLabel(p.date)} ${p.time}`], ["어디서", `CH${p.channel}`], ...(p.memo ? ([["메모", p.memo]] as [string, ReactNode][]) : [])]
        : r.kind === "event"
          ? [["행사", p.title], ["언제", `${dayLabel(p.date)} ${p.period ?? ""}`], ["장소", p.place ? HALL_LABEL[p.place] : "-"], ["필요한 것", preview(r).split(" · ").slice(2).join(" · ") || "-"]]
          : [["날짜", (p.dates ?? []).map(dayLabel).join(", ")], ["바꾸기", p.mode ? BELL_MODE_LABEL[p.mode] : "-"]];
  const auto =
    r.kind === "announce" && p.method === "tts"
      ? `수락하면 ${dayLabel(p.date)} ${p.time} ${targetLabel(p.target)}에 TTS 예약 방송이 걸려요`
      : r.kind === "media"
        ? p.source === "youtube"
          ? `수락하면 ${dayLabel(p.date)} ${p.time} CH${p.channel} 유튜브 예약 송출이 걸려요`
          : `수락하면 파일을 파일 보관함에 넣고 ${dayLabel(p.date)} ${p.time} CH${p.channel} 예약 송출이 걸려요`
        : "";
  const open = r.status === "new" || r.status === "accepted";
  return (
    <div className="flex min-h-0 flex-col gap-5 rounded-[22px] border border-white/[0.09] bg-[rgba(16,16,19,0.7)] p-5 backdrop-blur-md md:p-7">
      {onBack && (
        <button type="button" onClick={onBack} className="-ml-1 flex w-fit items-center gap-1 font-pretendard text-[14px] font-bold text-white/70">
          <ChevronLeft size={18} />
          목록
        </button>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] font-pretendard text-[15px] font-bold">
            {r.teacher?.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <b className="font-pretendard text-[17px] text-white">{r.teacher?.name} 선생님</b>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {r.teacher && <TierChip tier={r.teacher.tier} />}
              <span className="font-pretendard text-[13px] text-white/45">{r.teacher?.dept} · {ago(r.createdAt)}</span>
            </div>
          </div>
        </div>
        {r.status === "new" ? <NewDot /> : <StatusPill r={r} big />}
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-[#ff8a84]">
          <KindIcon kind={r.kind} size={22} />
        </span>
        <h2 className="font-mbc text-[24px] text-white md:text-[26px]">{r.kindLabel}</h2>
      </div>
      {r.kind === "announce" && p.text && <p className="m-0 font-pretendard text-[19px] font-medium leading-relaxed text-white md:text-[20px]">&quot;{p.text}&quot;</p>}
      {(r.kind === "event" || r.kind === "bell") && p.memo ? <p className="m-0 font-pretendard text-[16px] leading-relaxed text-white/85">{p.memo}</p> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Meta rows={rows} />
        {r.kind === "announce" && p.text && (
          <button type="button" onClick={listen} disabled={playing} className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/15 px-3 py-2 font-pretendard text-[13.5px] font-bold text-white disabled:opacity-40">
            <Play size={14} />
            {playing ? "듣는 중" : "TTS로 들어 보기"}
          </button>
        )}
      </div>
      {r.status === "new" && auto && (
        <div className="flex items-start gap-2.5 rounded-[14px] border border-white/[0.09] bg-white/[0.04] px-4 py-3 font-pretendard text-[14.5px] leading-relaxed text-white/80">
          <CalendarClock size={19} className="mt-0.5 shrink-0 text-[#ff8a84]" />
          {auto}
        </div>
      )}
      {r.autoError && <p className="m-0 font-pretendard text-[14px] text-[#ff8a84]">{r.autoError}</p>}
      {r.comments.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-white/[0.09] pt-4">
          {r.comments.map((c, i) => (
            <div key={i} className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 font-pretendard text-[14.5px] leading-relaxed text-white", c.side === "teacher" ? "self-start rounded-bl-[4px] bg-white/[0.07]" : "self-end rounded-br-[4px] border border-white/15")}>
              <small className="mb-0.5 block text-[12px] text-white/45">{c.side === "teacher" ? `${c.by} 선생님` : `방송부 · ${c.by}`}</small>
              {c.text}
            </div>
          ))}
        </div>
      )}
      {open && (
        <div className="mt-auto flex flex-col gap-3 md:flex-row md:items-center">
          <input value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} placeholder="선생님께 한마디" className={cn(inputCls, "md:flex-1")} />
          <div className="grid grid-cols-2 gap-2 md:flex">
            {r.status === "new" ? (
              <>
                <button type="button" className={ghostBtn} disabled={act.isPending} onClick={() => act.mutate(() => requestsApi.reject(r.id, text))}>
                  <X size={18} />
                  거절
                </button>
                <NeonButton size="lg" icon={<Check />} disabled={act.isPending} onClick={() => act.mutate(() => requestsApi.accept(r.id, text))}>
                  수락
                </NeonButton>
              </>
            ) : (
              <>
                <button type="button" className={ghostBtn} disabled={act.isPending || !text.trim()} onClick={() => act.mutate(() => requestsApi.comment(r.id, text))}>
                  보내기
                </button>
                <NeonButton size="lg" icon={<Check />} disabled={act.isPending} onClick={() => act.mutate(() => requestsApi.done(r.id, text))}>
                  완료
                </NeonButton>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RequestsView() {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<Filter>("new");
  const [sel, setSel] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["requests"], queryFn: requestsApi.list, refetchInterval: 15_000 });
  const all = q.data?.requests ?? [];
  const rows = all.filter((r) => (filter === "new" ? r.status === "new" : filter === "accepted" ? r.status === "accepted" : !["new", "accepted"].includes(r.status)));
  const cur = all.find((r) => r.id === sel) ?? (isMobile ? undefined : rows[0]);
  const counts = q.data?.counts;
  const filters = (
    <div className="flex flex-wrap gap-2">
      <ChoiceChip on={filter === "new"} onClick={() => setFilter("new")}>
        새 요청 <small className="font-medium opacity-70">{counts?.new ?? 0}</small>
      </ChoiceChip>
      <ChoiceChip on={filter === "accepted"} onClick={() => setFilter("accepted")}>
        수락 <small className="font-medium opacity-70">{counts?.accepted ?? 0}</small>
      </ChoiceChip>
      <ChoiceChip on={filter === "closed"} onClick={() => setFilter("closed")}>
        완료
      </ChoiceChip>
    </div>
  );
  if (isMobile && sel && cur) return <Detail r={cur} onBack={() => setSel(null)} />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {filters}
      {rows.length === 0 ? (
        <Glass className="flex flex-1 items-center justify-center p-10">
          <p className="font-pretendard text-[15px] text-white/40">{q.isLoading ? "불러오는 중…" : filter === "new" ? "새 요청이 없어요" : "없어요"}</p>
        </Glass>
      ) : (
        <div className="grid min-h-0 flex-1 gap-5 md:grid-cols-[430px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto md:pr-1">
            {rows.map((r) => (
              <Row key={r.id} r={r} on={!isMobile && cur?.id === r.id} onClick={() => setSel(r.id)} />
            ))}
          </div>
          {!isMobile && cur && <Detail r={cur} />}
        </div>
      )}
    </div>
  );
}

/** canDecide = 부장 이상. 아니면 목록만 보여 주고 승인·등급·내보내기 버튼은 그리지 않는다 */
function TeachersView({ canDecide }: { canDecide: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["request-teachers"], queryFn: requestsApi.teachers, refetchInterval: 20_000 });
  const [tiers, setTiers] = useState<Record<string, Tier>>({});
  const [confirm, setConfirm] = useState<Teacher | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request-teachers"] });
      qc.invalidateQueries({ queryKey: ["request-counts"] });
      setMenu(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const list = q.data?.teachers ?? [];
  const pending = list.filter((t) => t.status === "pending");
  const approved = list.filter((t) => t.status === "approved");
  const can = (t: Tier) =>
    t === "general" ? "반·학년 방송 · 영상 송출" : t === "lead" ? "+ 학교 전체 방송 · 행사 지원" : "+ 시보 변경";
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {pending.map((t) => (
        <Glass
          key={t.id}
          className={cn(
            "grid items-center gap-4 border-white/25 p-5 md:px-6",
            canDecide ? "md:grid-cols-[auto_minmax(0,1fr)_minmax(0,460px)_auto]" : "md:grid-cols-[auto_minmax(0,1fr)]",
          )}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] font-pretendard font-bold">{t.name.slice(0, 1)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <b className="font-pretendard text-[17px] text-white">{t.name} 선생님</b>
              <NewDot label="승인 대기" />
            </div>
            <p className="mt-1 truncate font-pretendard text-[13.5px] text-white/45">{[t.dept, t.duty, t.email].filter(Boolean).join(" · ")}</p>
          </div>
          {canDecide && (
            <>
              <Seg
                value={tiers[t.id] ?? "general"}
                onChange={(v) => setTiers((x) => ({ ...x, [t.id]: v }))}
                options={(["general", "lead", "admin"] as Tier[]).map((v) => ({ value: v, label: TIER_LABEL[v] }))}
              />
              <div className="grid grid-cols-2 gap-2 md:flex">
                <button type="button" className={cn(ghostBtn, "h-11 text-[15px]")} disabled={act.isPending} onClick={() => act.mutate(() => requestsApi.revoke(t.id))}>
                  거절
                </button>
                <button type="button" className={cn(redBtn, "h-11 text-[15px]")} disabled={act.isPending} onClick={() => act.mutate(() => requestsApi.approve(t.id, tiers[t.id] ?? "general"))}>
                  승인
                </button>
              </div>
            </>
          )}
        </Glass>
      ))}
      <Glass className="flex-1 p-5 md:px-6">
        <h2 className="mb-2 font-mbc text-[24px] text-white md:text-[26px]">선생님 {approved.length}</h2>
        {approved.length === 0 ? (
          <p className="py-8 text-center font-pretendard text-[15px] text-white/40">{q.isLoading ? "불러오는 중…" : "승인한 선생님이 없어요"}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse font-pretendard text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-white/40">
                  <th className="px-3 pb-3 font-bold">선생님</th>
                  <th className="px-3 pb-3 font-bold">담당</th>
                  <th className="px-3 pb-3 font-bold">등급</th>
                  <th className="px-3 pb-3 font-bold">할 수 있는 요청</th>
                  <th className="px-3 pb-3 font-bold">요청</th>
                  {canDecide && <th className="w-12 px-3 pb-3" />}
                </tr>
              </thead>
              <tbody>
                {approved.map((t) => (
                  <tr key={t.id} className="border-t border-white/[0.09]">
                    <td className="px-3 py-3.5">
                      <span className="flex items-center gap-2.5 font-bold text-white">
                        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[14px]">{t.name.slice(0, 1)}</span>
                        {t.name}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-white/80">{t.dept || t.duty}</td>
                    <td className="px-3 py-3.5">
                      {canDecide ? (
                        <Select
                          value={t.tier}
                          onChange={(v) => act.mutate(() => requestsApi.setTier(t.id, v))}
                          className="h-9 rounded-lg border-white/15 bg-[#0c0d0f] text-[13.5px] font-bold"
                          aria-label={`${t.name} 등급`}
                          options={(["general", "lead", "admin"] as Tier[]).map((v) => ({ value: v, label: TIER_LABEL[v] }))}
                        />
                      ) : (
                        <span className="text-[13.5px] font-bold text-white">{TIER_LABEL[t.tier]}</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-[14px] text-white/45">{can(t.tier)}</td>
                    <td className="px-3 py-3.5 tabular-nums text-white/80">{t.requests}</td>
                    {canDecide && (
                      <td className="relative px-3 py-3.5 text-right">
                        <button type="button" aria-label="더 보기" onClick={() => setMenu(menu === t.id ? null : t.id)} className="rounded-md p-1.5 text-white/45 hover:bg-white/10 hover:text-white">
                          <Ellipsis size={20} />
                        </button>
                        {menu === t.id && (
                          <div className="absolute right-3 top-12 z-10 min-w-[130px] rounded-xl border border-white/10 bg-[#18181b] p-1 shadow-2xl">
                            <button type="button" onClick={() => setConfirm(t)} className="w-full rounded-lg px-3 py-2 text-left font-pretendard text-[14px] text-[#ff8a84] hover:bg-white/[0.06]">
                              내보내기
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Glass>
      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) act.mutate(() => requestsApi.revoke(confirm.id));
          setConfirm(null);
        }}
        title="선생님 내보내기"
        message={`${confirm?.name ?? ""} 선생님은 더 이상 요청을 보낼 수 없어요`}
        confirmText="내보내기"
        isDestructive
      />
    </div>
  );
}

export default function RequestsPanel() {
  const { isAdmin, canOperate, loading } = useMe();
  const counts = useRequestCounts(canOperate);
  const [tab, setTab] = useState<"requests" | "teachers">("requests");
  if (!canOperate) return loading ? null : <p className="font-pretendard text-white/40">부원 이상만 볼 수 있어요</p>;
  return (
    <div className="flex min-h-0 flex-col gap-4 md:h-full md:gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <SectionHeader className="mb-0 max-md:mt-1 max-md:text-[26px] max-md:leading-none">요청함</SectionHeader>
        <PageTabs
          tour="requests.tab"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "requests", label: "요청" },
            { key: "teachers", label: counts.data?.pendingTeachers ? `선생님 ${counts.data.pendingTeachers}` : "선생님" },
          ]}
        />
      </div>
      {tab === "teachers" ? <TeachersView canDecide={isAdmin} /> : <RequestsView />}
    </div>
  );
}
