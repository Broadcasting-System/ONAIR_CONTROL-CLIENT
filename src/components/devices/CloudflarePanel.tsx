"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import ConfirmModal from "@/components/common/ConfirmModal";
import Select from "@/components/common/Select";
import { toast } from "@/components/common/Toast";
import { Panel } from "@/components/hall/HallControls";
import { ActionButton } from "@/components/hall/setup/ui";
import { useMe } from "@/hooks/useMe";
import { cloudflareApi } from "@/lib/cloudflareApi";
import { cn } from "@/lib/utils";
import type {
  CfAddress,
  CfCheck,
  CfDevice,
  CfSettingField,
  CfSettings,
  CfSettingsUpdate,
  CfStatus,
} from "@/types/cloudflare";

/* ---------------- 공통 조각 ---------------- */

const field =
  "h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 font-pretendard text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

/** 상태 점 — 정상(흰 점) · 문제(빨간 점) · 확인 못 함·꺼짐(회색) */
function Dot({ ok }: { ok: boolean | null }) {
  return (
    <span
      className={cn(
        "mt-[7px] h-2 w-2 shrink-0 rounded-full",
        ok === true && "bg-white/85",
        ok === false && "bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]",
        ok === null && "bg-white/25",
      )}
    />
  );
}

/** 불러오기 실패·권한 없음 같은 안내 — 색 배지 없이 */
function Problem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-pretendard text-[14px] leading-relaxed text-white/75">
      <Dot ok={false} />
      <span>{children}</span>
    </div>
  );
}

function Loading() {
  return <p className="font-pretendard text-[14px] text-white/45">불러오는 중…</p>;
}

function errText(e: unknown) {
  return e instanceof Error ? e.message : "요청을 처리하지 못했어요.";
}

function day(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10) : "—";
}

type Confirm = { title: string; message: string; confirmText: string; run: () => Promise<unknown>; done: string } | null;

/** 확인 창 + 실행 → 토스트 */
function useConfirmRun(invalidate: string[][]) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const act = useMutation({
    mutationFn: async (c: NonNullable<Confirm>) => {
      await c.run();
      return c.done;
    },
    onSuccess: (done) => {
      toast.success(done);
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
    onError: (e) => toast.error(errText(e)),
  });
  const modal = (
    <ConfirmModal
      isOpen={!!confirm}
      onClose={() => setConfirm(null)}
      title={confirm?.title ?? ""}
      message={confirm?.message ?? ""}
      confirmText={confirm?.confirmText}
      onConfirm={() => {
        if (confirm) act.mutate(confirm);
      }}
    />
  );
  return { setConfirm, modal, busy: act.isPending };
}

/* ---------------- 1. 연결 상태 ---------------- */

function CheckRow({ c }: { c: CfCheck }) {
  return (
    <li className="flex gap-3 border-b border-white/[0.06] py-3 last:border-b-0">
      <Dot ok={c.ok} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="font-mbc text-[15px] text-white">{c.label}</span>
          <span className={cn("font-pretendard text-[14px]", c.ok === false ? "text-white/80" : "text-white/55")}>
            {c.detail}
          </span>
        </div>
        {c.fix && (
          <p className="font-pretendard text-[13.5px] leading-relaxed text-white/70">
            <span className="mr-1.5 font-semibold text-white/90">고치는 법</span>
            {c.fix}
          </p>
        )}
      </div>
    </li>
  );
}

function StatusSection() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["cf", "status"], queryFn: () => cloudflareApi.status(), refetchInterval: 60_000 });
  const refresh = useMutation({
    mutationFn: () => cloudflareApi.status(true),
    onSuccess: (s) => qc.setQueryData(["cf", "status"], s),
    onError: (e) => toast.error(errText(e)),
  });
  const [showPerms, setShowPerms] = useState(false);
  const s = status.data;

  return (
    <Panel title="연결 상태" hint="Cloudflare 가 제대로 연결됐는지 — 빨간 점의 '고치는 법'을 따라 하면 돼요">
      {status.error ? (
        <Problem>{errText(status.error)}</Problem>
      ) : !s ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mbc text-[17px] text-white">
              {s.driver === "mock" ? "가짜(mock)로 시험 중" : s.problems === 0 ? "모두 정상이에요" : `고칠 곳 ${s.problems}개`}
            </span>
            <span className="font-pretendard text-[13px] text-white/45">
              {s.checkedAt.replace("T", " ").slice(5, 16)} 확인
            </span>
            <ActionButton
              className="ml-auto"
              busy={refresh.isPending}
              icon={<RefreshCw size={14} />}
              onClick={() => refresh.mutate()}
            >
              다시 확인
            </ActionButton>
          </div>
          <ul className="flex flex-col">
            {[...s.checks]
              .sort((a, b) => (a.ok === false ? 0 : 1) - (b.ok === false ? 0 : 1))
              .map((c) => (
                <CheckRow key={c.key} c={c} />
              ))}
          </ul>
          <button
            type="button"
            onClick={() => setShowPerms(!showPerms)}
            className="w-fit font-pretendard text-[13.5px] text-white/60 underline-offset-4 hover:text-white hover:underline"
          >
            {showPerms ? "토큰 권한 접기" : "토큰 권한 자세히 보기"}
          </button>
          {showPerms && (
            <div className="rounded-xl border border-white/10 bg-black/20">
              <table className="w-full text-left font-pretendard text-[14px]">
                <thead className="text-white/45">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-2.5 font-normal">권한 (토큰 편집 화면 이름)</th>
                    <th className="px-4 py-2.5 font-normal">쓰는 곳</th>
                    <th className="px-4 py-2.5 font-normal">있음</th>
                  </tr>
                </thead>
                <tbody>
                  {s.permissions.map((p) => (
                    <tr key={p.key} className="border-b border-white/[0.06] last:border-b-0">
                      <td className="px-4 py-2.5 font-mono text-[13px] text-white/90">{p.name}</td>
                      <td className="px-4 py-2.5 text-white/60">{p.usedFor}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2 text-white/80">
                          <Dot ok={p.ok} />
                          <span className="mt-0.5">{p.ok === true ? "있음" : p.ok === false ? "없음" : "확인 못 함"}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-white/10 px-4 py-2.5 font-pretendard text-[13px] text-white/50">
                읽기로만 확인해요. 고치기(Edit) 권한이 없으면 실제로 바꿀 때 어떤 권한이 빠졌는지 알려 줘요.
              </p>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ---------------- 2. 메일 주소 ---------------- */

type AddrFilter = "all" | "member" | "role" | "extra";
const ADDR_FILTERS: { key: AddrFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "extra", label: "추가 주소" },
  { key: "role", label: "역할 주소" },
  { key: "member", label: "부원" },
];

function Seg<T extends string>({ items, value, onChange }: { items: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          aria-pressed={value === it.key}
          onClick={() => onChange(it.key)}
          className={cn(
            "h-9 rounded-lg border px-3.5 font-pretendard text-[14px] font-semibold transition-colors",
            value === it.key
              ? "border-[#FF3B3B]/60 bg-white/[0.06] text-white"
              : "border-white/10 text-white/60 hover:bg-white/[0.05] hover:text-white",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function AddrStatus({ a }: { a: CfAddress }) {
  const ok = a.status === "active" ? true : a.status === "pending" || a.status === "error" ? false : null;
  return (
    <span className="flex items-start gap-2 font-pretendard text-[14px] text-white/85">
      <Dot ok={ok} />
      <span className="mt-0.5">{a.statusLabel}</span>
    </span>
  );
}

const LOCAL_RE = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s.]+$/;

function IssueForm({ domain, onDone }: { domain: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [local, setLocal] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const emails = to
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const l = local.trim().toLowerCase();
  const problem = !l
    ? ""
    : !/^[a-z0-9.]+$/.test(l)
      ? "영문 소문자·숫자·점(.)만 쓸 수 있어요."
      : l.length < 3 || l.length > 20
        ? "3~20자로 적어 주세요."
        : !LOCAL_RE.test(l)
          ? "점(.)으로 시작·끝나거나 두 번 이어 쓸 수 없어요."
          : /^\d{2}/.test(l)
            ? "숫자 두 자리로 시작하면 부원 주소와 헷갈려요."
            : emails.some((e) => !EMAIL_RE.test(e))
              ? "받을 메일 주소를 다시 확인해 주세요."
              : emails.length > 5
                ? "받을 메일은 5개까지예요."
                : "";
  const issue = useMutation({
    mutationFn: () => cloudflareApi.addAddress({ localPart: l, forwardTo: emails, note: note.trim() }),
    onSuccess: (r) => {
      toast.success(`${r.address.address}@${domain} 를 만들었어요. 처음 쓰는 받을 메일에는 확인 메일이 가요.`);
      qc.invalidateQueries({ queryKey: ["cf", "mail"] });
      onDone();
    },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/25 px-5 py-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="flex flex-col gap-1.5">
          <span className="font-pretendard text-[13px] font-semibold text-white/70">주소</span>
          <div className="flex items-center gap-2">
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="event"
              autoComplete="off"
              spellCheck={false}
              className={cn(field, "font-mono")}
            />
            <span className="shrink-0 font-mono text-[14px] text-white/45">@{domain}</span>
          </div>
          <span className={cn("font-pretendard text-[12.5px]", problem ? "text-[#FF8B8B]" : "text-white/45")}>
            {problem || "영문 소문자·숫자·점 3~20자. admin·lead·all 같은 이름은 못 써요."}
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-pretendard text-[13px] font-semibold text-white/70">받을 메일 (최대 5개)</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="teacher@school.kr, pd@gmail.com"
            autoComplete="off"
            spellCheck={false}
            className={field}
          />
          <span className="font-pretendard text-[12.5px] text-white/45">
            쉼표나 띄어쓰기로 나눠요. 처음 쓰는 메일에는 Cloudflare 가 확인 메일을 보내요.
          </span>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="font-pretendard text-[13px] font-semibold text-white/70">메모 (선택)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={100}
          placeholder="예: 축제 문의 · 담당 선생님"
          className={field}
        />
      </label>
      <div className="flex items-center gap-2">
        <span className="mr-auto font-pretendard text-[13px] text-white/50">
          {l && !problem ? `${l}@${domain} → ${emails.length ? emails.join(", ") : "받을 메일을 적어 주세요"}` : ""}
        </span>
        <ActionButton tone="ghost" onClick={onDone}>
          닫기
        </ActionButton>
        <ActionButton
          tone="primary"
          busy={issue.isPending}
          disabled={!l || !emails.length || !!problem}
          onClick={() => issue.mutate()}
        >
          발급
        </ActionButton>
      </div>
    </div>
  );
}

function MailSection() {
  const qc = useQueryClient();
  const mail = useQuery({ queryKey: ["cf", "mail"], queryFn: cloudflareApi.mail, refetchInterval: 30_000 });
  const [filter, setFilter] = useState<AddrFilter>("all");
  const [issuing, setIssuing] = useState(false);
  const { setConfirm, modal } = useConfirmRun([["cf", "mail"], ["cf", "status"]]);
  const sync = useMutation({
    mutationFn: cloudflareApi.syncMail,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["cf"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      if (r.failed.length) toast.error(`못 맞춘 곳: ${r.failed.join(", ")}`);
      else toast.success(r.extrasFixed ? `규칙을 다시 맞췄어요. 사라진 추가 주소 ${r.extrasFixed}개도 다시 만들었어요.` : "메일 규칙을 다시 맞췄어요.");
    },
    onError: (e) => toast.error(errText(e)),
  });
  const resend = useMutation({
    mutationFn: (id: string) => cloudflareApi.resendDestination(id),
    onSuccess: (r) => {
      toast.success(`${r.destination.email} 로 확인 메일을 다시 보냈어요.`);
      qc.invalidateQueries({ queryKey: ["cf", "mail"] });
    },
    onError: (e) => toast.error(errText(e)),
  });

  const d = mail.data;
  const domain = d?.domain ?? "bssmcast.com";
  const rows = (d?.addresses ?? []).filter((a) => filter === "all" || a.kind === filter);
  const counts = {
    extra: d?.addresses.filter((a) => a.kind === "extra").length ?? 0,
    member: d?.addresses.filter((a) => a.kind === "member").length ?? 0,
  };
  const s = d?.settings;

  return (
    <Panel title="메일 주소" hint={`@${domain} 받기 전용 · 부원 주소는 '부원' 탭에서, 행사·선생님 주소는 여기서 발급해요`}>
      {mail.error ? (
        <Problem>{errText(mail.error)}</Problem>
      ) : !d ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-pretendard text-[14px]">
            <span className="flex items-start gap-2 text-white/85">
              <Dot ok={d.driver === "mock" ? null : s?.connection.ok ?? null} />
              <span className="mt-0.5">
                {d.driver === "mock"
                  ? "가짜(mock) — 실제 메일은 오지 않아요"
                  : s?.connection.ok
                    ? `Cloudflare 연결됨${s.connection.enabled === false ? " · Email Routing 꺼짐" : ""}`
                    : "Cloudflare 메일에 연결하지 못했어요"}
              </span>
            </span>
            <span className="text-white/55">
              추가 주소 {counts.extra}개 · 부원 주소 {counts.member}개
            </span>
            <span className="text-white/55">
              워커 비밀값 {s?.workerSecretSet ? "있음" : "없음 (역할 주소가 동작하지 않아요)"}
            </span>
            <div className="ml-auto flex gap-2">
              <ActionButton busy={sync.isPending} icon={<RefreshCw size={14} />} onClick={() => sync.mutate()}>
                규칙 다시 맞추기
              </ActionButton>
              <ActionButton tone="primary" icon={<Plus size={15} />} onClick={() => setIssuing(true)} disabled={issuing}>
                주소 발급
              </ActionButton>
            </div>
          </div>
          {(d.problem || d.error || s?.connection.message) && (
            <Problem>{d.problem || d.error || s?.connection.message}</Problem>
          )}

          {issuing && <IssueForm domain={domain} onDone={() => setIssuing(false)} />}

          <Seg items={ADDR_FILTERS} value={filter} onChange={setFilter} />
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[720px] text-left font-pretendard text-[14px]">
              <thead className="text-white/45">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 font-normal">주소</th>
                  <th className="px-4 py-3 font-normal">받는 곳</th>
                  <th className="px-4 py-3 font-normal">상태</th>
                  <th className="px-4 py-3 font-normal">메모</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-white/45">
                      {filter === "extra" ? "발급한 추가 주소가 없어요. [주소 발급]으로 만들어요." : "주소가 없어요."}
                    </td>
                  </tr>
                ) : (
                  rows.map((a) => (
                    <tr key={`${a.kind}-${a.id}`} className="border-b border-white/[0.06] last:border-b-0">
                      <td className="px-4 py-3">
                        <span className="font-mono text-[15px] font-semibold text-white">
                          {a.address}
                          <span className="font-medium text-white/40">@{domain}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/80">
                        {a.kind === "member" ? (
                          <span>
                            {a.cohort}기 {a.memberName}
                            {a.forwardHint && <span className="text-white/45"> · {a.forwardHint}</span>}
                          </span>
                        ) : a.kind === "role" ? (
                          a.forwardHint
                        ) : (
                          <span className="break-all">{a.forwardTo.join(", ")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AddrStatus a={a} />
                        {a.kind === "member" && a.error && (
                          <span className="mt-1 block text-[13px] text-[#FF8B8B]" title={a.error}>
                            Cloudflare 실패 — [규칙 다시 맞추기]
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/55">
                        {a.kind === "extra"
                          ? [a.note, a.createdBy && `${a.createdBy} · ${day(a.createdAt)}`].filter(Boolean).join(" · ")
                          : a.kind === "role"
                            ? "역할로 받는 사람을 정해요"
                            : a.roleLabel}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.kind === "extra" && (
                          <ActionButton
                            tone="ghost"
                            className="ml-auto h-9 px-3"
                            onClick={() =>
                              setConfirm({
                                title: "주소 지우기",
                                message: `${a.address}@${domain} 를 지울까요?\n이 주소로 오는 메일은 더는 전달되지 않아요.`,
                                confirmText: "지우기",
                                run: () => cloudflareApi.deleteAddress(a.id),
                                done: `${a.address}@${domain} 를 지웠어요.`,
                              })
                            }
                          >
                            지우기
                          </ActionButton>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2">
            <h4 className="font-mbc text-[17px] text-white">받을 메일</h4>
            <p className="font-pretendard text-[13px] text-white/50">
              Cloudflare 가 보낸 확인 메일의 링크를 눌러야 전달돼요. 부원 개인 메일은 가려서 보여요.
            </p>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[560px] text-left font-pretendard text-[14px]">
                <thead className="text-white/45">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 font-normal">메일</th>
                    <th className="px-4 py-3 font-normal">쓰는 곳</th>
                    <th className="px-4 py-3 font-normal">확인</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {d.destinations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-white/45">
                        등록된 받을 메일이 없어요.
                      </td>
                    </tr>
                  ) : (
                    d.destinations.map((x) => (
                      <tr key={x.id} className="border-b border-white/[0.06] last:border-b-0">
                        <td className="px-4 py-3 font-mono text-[14px] text-white/90">{x.email}</td>
                        <td className="px-4 py-3 text-white/60">{x.usedBy.join(", ") || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-start gap-2 text-white/85">
                            <Dot ok={x.verified} />
                            <span className="mt-0.5">{x.verified ? "확인됨" : "확인 대기"}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!x.verified && (
                            <ActionButton
                              tone="ghost"
                              className="ml-auto h-9 px-3"
                              busy={resend.isPending && resend.variables === x.id}
                              onClick={() => resend.mutate(x.id)}
                            >
                              확인 메일 다시 보내기
                            </ActionButton>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {modal}
    </Panel>
  );
}

/* ---------------- 3. 로그인 허용 이메일 ---------------- */

function AccessEmailSection() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["cf", "access-emails"], queryFn: cloudflareApi.accessEmails });
  const [email, setEmail] = useState("");
  const { setConfirm, modal } = useConfirmRun([["cf", "access-emails"], ["cf", "status"]]);
  const add = useMutation({
    mutationFn: (e: string) => cloudflareApi.addAccessEmail(e),
    onSuccess: (res, e) => {
      qc.setQueryData(["cf", "access-emails"], res);
      setEmail("");
      toast.success(`${e} 로 로그인할 수 있어요.`);
    },
    onError: (e) => toast.error(errText(e)),
  });
  const d = list.data;
  const value = email.trim().toLowerCase();
  const valid = EMAIL_RE.test(value);

  return (
    <Panel
      title="로그인 허용 이메일"
      hint={d ? `${d.app.domain} 에 브라우저로 들어올 때 · 정책 '${d.policy.name}'` : "브라우저로 ONAIR 에 들어올 수 있는 이메일"}
    >
      {list.error ? (
        <Problem>{errText(list.error)}</Problem>
      ) : !d ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid && !add.isPending) add.mutate(value);
              }}
              placeholder="name@gmail.com"
              autoComplete="off"
              spellCheck={false}
              className={cn(field, "max-w-[420px]")}
            />
            <ActionButton tone="primary" busy={add.isPending} disabled={!valid} onClick={() => add.mutate(value)}>
              더하기
            </ActionButton>
          </div>
          <ul className="flex flex-col rounded-xl border border-white/10">
            {d.emails.map((e) => (
              <li key={e.email} className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 last:border-b-0">
                <span className="font-mono text-[14.5px] text-white">{e.email}</span>
                {e.member && <span className="font-pretendard text-[14px] text-white/55">{e.member}</span>}
                <span className="ml-auto font-pretendard text-[13.5px] text-white/50">
                  {e.protected ? `${e.reason} — 뺄 수 없어요` : ""}
                </span>
                {!e.protected && (
                  <ActionButton
                    tone="ghost"
                    className="h-9 px-3"
                    onClick={() =>
                      setConfirm({
                        title: "로그인 허용 빼기",
                        message: `${e.email} 을 허용 목록에서 뺄까요?\n이 이메일로는 브라우저 로그인이 더는 안 돼요. (데스크톱 앱 기기 키는 그대로예요)`,
                        confirmText: "빼기",
                        run: () => cloudflareApi.removeAccessEmail(e.email),
                        done: `${e.email} 을 뺐어요.`,
                      })
                    }
                  >
                    빼기
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
          {d.otherRules > 0 && (
            <p className="font-pretendard text-[13px] text-white/50">
              이메일 말고 다른 규칙(이메일 도메인·그룹 등) {d.otherRules}개는 그대로 두었어요 — Cloudflare 대시보드에서 바꿔요.
            </p>
          )}
          {d.driver === "mock" && (
            <p className="font-pretendard text-[13px] text-white/50">지금은 가짜(mock)라 실제 Cloudflare 에는 반영되지 않아요.</p>
          )}
        </div>
      )}
      {modal}
    </Panel>
  );
}

/* ---------------- 4. 기기 접속 키 ---------------- */

function ownerText(d: CfDevice) {
  const o = d.owner;
  if (o.kind === "member") return `${o.cohort ?? ""}기 ${o.name}`;
  if (o.kind === "invite") return `등록 전 초대 · ${o.name}`;
  return "ONAIR 부원 기기 아님";
}

function disconnectMessage(d: CfDevice) {
  const o = d.owner;
  if (o.kind === "member")
    return `${o.name} 님의 기기 키를 끊을까요?\n부원 내보내기와 같아요 — 이 기기는 더는 ONAIR 에 들어올 수 없고, ONAIR 메일 전달도 꺼져요.`;
  if (o.kind === "invite") return "아직 등록하지 않은 초대를 취소할까요?\nQR·코드로 더는 등록할 수 없어요.";
  return `'${d.name}' 키를 Cloudflare 에서 지울까요?\n이 키를 쓰는 기기(봇·송출 PC 등)는 더는 들어오지 못해요.`;
}

function DeviceSection() {
  const list = useQuery({ queryKey: ["cf", "devices"], queryFn: cloudflareApi.devices, refetchInterval: 30_000 });
  const { setConfirm, modal } = useConfirmRun([["cf", "devices"], ["members"], ["member-invites"]]);
  const d = list.data;

  return (
    <Panel title="기기 접속 키" hint="데스크톱 앱이 쓰는 Cloudflare 서비스 토큰 · 끊으면 그 기기는 들어오지 못해요">
      {list.error ? (
        <Problem>{errText(list.error)}</Problem>
      ) : !d ? (
        <Loading />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left font-pretendard text-[14px]">
            <thead className="text-white/45">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 font-normal">누구</th>
                <th className="px-4 py-3 font-normal">키 이름</th>
                <th className="px-4 py-3 font-normal">클라이언트 ID 끝</th>
                <th className="px-4 py-3 font-normal">만든 날</th>
                <th className="px-4 py-3 font-normal">만료</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {d.devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/45">
                    기기 접속 키가 없어요.
                  </td>
                </tr>
              ) : (
                d.devices.map((x) => (
                  <tr key={x.tokenId} className="border-b border-white/[0.06] last:border-b-0">
                    <td className="px-4 py-3">
                      <span className={cn("font-mbc text-[15px]", x.owner.kind === "member" ? "text-white" : "text-white/60")}>
                        {ownerText(x)}
                      </span>
                      {x.owner.roleLabel && <span className="ml-2 text-[13px] text-white/45">{x.owner.roleLabel}</span>}
                      {x.mine && <span className="ml-2 text-[13px] text-white/45">· 지금 이 기기</span>}
                    </td>
                    <td className="px-4 py-3 text-white/70">{x.name}</td>
                    <td className="px-4 py-3 font-mono text-[13px] text-white/60">{x.clientIdTail || "—"}</td>
                    <td className="px-4 py-3 font-mono text-[13px] tabular-nums text-white/70">{day(x.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-[13px] tabular-nums text-white/70">{day(x.expiresAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {x.canDisconnect ? (
                        <ActionButton
                          tone="ghost"
                          className="ml-auto h-9 px-3 text-[#ff9b9b] enabled:hover:text-[#ffb3b3]"
                          onClick={() =>
                            setConfirm({
                              title: "기기 키 끊기",
                              message: disconnectMessage(x),
                              confirmText: "끊기",
                              run: () => cloudflareApi.disconnect(x.tokenId),
                              done: x.owner.kind === "member" ? `${x.owner.name} 님의 기기를 끊었어요.` : "키를 끊었어요.",
                            })
                          }
                        >
                          끊기
                        </ActionButton>
                      ) : (
                        <span className="font-pretendard text-[13px] text-white/35">
                          {x.mine ? "내 기기" : x.owner.superadmin ? "최고 관리자" : x.owner.kind === "other" ? "최고 관리자만" : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {d?.driver === "mock" && (
        <p className="mt-3 font-pretendard text-[13px] text-white/50">지금은 가짜(mock) — 부원 기록에 남은 키를 보여 줘요.</p>
      )}
      {modal}
    </Panel>
  );
}

/* ---------------- 5. 연결 설정 (최고 관리자) ---------------- */

const SETTING_ROWS: { key: CfSettingField; placeholder: string; hint: string }[] = [
  { key: "accountId", placeholder: "32자리 영문·숫자", hint: "Cloudflare 대시보드 오른쪽 아래 Account ID" },
  { key: "zoneId", placeholder: "32자리 영문·숫자", hint: "bssmcast.com 개요 오른쪽 아래 Zone ID" },
  { key: "teamDomain", placeholder: "junghyun001", hint: "Zero Trust 팀 이름 (로그인 확인에 써요)" },
  { key: "appDomain", placeholder: "onair.bssmcast.com", hint: "이 주소를 지키는 Access 앱을 찾아요" },
  { key: "accessAppId", placeholder: "비우면 위 주소로 찾아요", hint: "Access › Applications › 앱 › Overview 의 Application ID" },
  { key: "emailPolicyId", placeholder: "비우면 이메일 허용 정책을 찾아요", hint: "로그인 허용 이메일이 들어 있는 정책" },
  { key: "devicePolicyId", placeholder: "비우면 Service Auth 정책을 찾아요", hint: "부원 기기(서비스 토큰) 정책" },
  { key: "tunnelId", placeholder: "비우면 정상인 터널을 찾아요", hint: "Networks › Tunnels 의 Tunnel ID" },
];

function sourceText(src: "settings" | "env" | "default" | "") {
  return src === "settings" ? "화면에서 넣은 값" : src === "env" ? "서버 .env 값" : src === "default" ? "기본값" : "비어 있음";
}

function SettingsSection() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["cf", "settings"], queryFn: cloudflareApi.settings });
  const s = settings.data;
  const [form, setForm] = useState<Partial<Record<CfSettingField, string>>>({});
  const [token, setToken] = useState("");
  const [clearArmed, setClearArmed] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [test, setTest] = useState<CfStatus | null>(null);

  useEffect(() => {
    if (!s) return;
    const next: Partial<Record<CfSettingField, string>> = {};
    for (const r of SETTING_ROWS) next[r.key] = s[r.key] ?? "";
    next.mailDriver = s.mailDriver;
    setForm(next);
  }, [s]);

  const save = useMutation({
    mutationFn: (body: CfSettingsUpdate) => cloudflareApi.saveSettings(body),
    onSuccess: (next: CfSettings, body) => {
      qc.setQueryData(["cf", "settings"], next);
      qc.invalidateQueries({ queryKey: ["cf"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      setToken("");
      setClearArmed(false);
      setMsg({ text: body.apiToken === null ? "토큰을 지웠어요. .env 값이 있으면 그걸 써요." : "저장했어요. 서버를 다시 켜지 않아도 바로 써요." });
    },
    onError: (e) => setMsg({ text: errText(e), error: true }),
  });
  const runTest = useMutation({
    mutationFn: cloudflareApi.testSettings,
    onSuccess: (r) => {
      setTest(r);
      qc.setQueryData(["cf", "status"], r);
    },
    onError: (e) => setMsg({ text: errText(e), error: true }),
  });

  if (settings.error) return <Panel title="연결 설정"><Problem>{errText(settings.error)}</Problem></Panel>;
  if (!s) return <Panel title="연결 설정"><Loading /></Panel>;

  const submit = () => {
    setMsg(null);
    const body: CfSettingsUpdate = {};
    for (const r of SETTING_ROWS) {
      const v = (form[r.key] ?? "").trim();
      if (v !== (s[r.key] ?? "")) body[r.key] = v;
    }
    if (form.mailDriver && form.mailDriver !== s.mailDriver) body.mailDriver = form.mailDriver;
    if (token.trim()) body.apiToken = token.trim();
    if (!Object.keys(body).length) {
      setMsg({ text: "바뀐 게 없어요." });
      return;
    }
    save.mutate(body);
  };

  return (
    <Panel title="연결 설정" hint="최고 관리자만 보여요 · 비운 칸은 서버 .env 값을 써요 · 토큰은 다시 보여 주지 않아요">
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="font-pretendard text-[13px] font-semibold text-white/70">API 토큰</span>
          <div className="flex max-w-[640px] gap-2">
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={s.tokenSet ? "새 토큰으로 바꾸기" : "Cloudflare › My Profile › API Tokens 에서 만든 토큰"}
              className={field}
            />
            {s.tokenSource === "settings" && (
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => (clearArmed ? save.mutate({ apiToken: null }) : setClearArmed(true))}
                className={cn(
                  "h-10 shrink-0 rounded-lg border px-3 font-pretendard text-[13px] transition-colors disabled:opacity-50",
                  clearArmed
                    ? "border-[#FF3B3B] bg-[#FF3B3B] text-white"
                    : "border-white/10 text-white/60 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                {clearArmed ? "정말 지우기" : "토큰 지우기"}
              </button>
            )}
          </div>
          <span className="font-pretendard text-[12.5px] text-white/50">
            {s.tokenSet
              ? `저장된 토큰 ${s.tokenHint ?? ""} (${s.tokenSource === "settings" ? "화면에서 넣음" : "서버 .env"}) · 화면에서 넣으면 초대·메일·이 화면이 모두 이 토큰 하나를 써요`
              : "토큰이 없어요 — 지금은 가짜(mock)로 돌아요"}
          </span>
        </label>

        <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
          {SETTING_ROWS.map((r) => (
            <label key={r.key} className="flex flex-col gap-1.5">
              <span className="flex items-baseline gap-2 font-pretendard text-[13px] font-semibold text-white/70">
                {s.labels[r.key] ?? r.key}
                <span className="font-normal text-white/40">{sourceText(s.sources[r.key])}</span>
              </span>
              <input
                value={form[r.key] ?? ""}
                onChange={(e) => setForm({ ...form, [r.key]: e.target.value })}
                placeholder={r.placeholder}
                autoComplete="off"
                spellCheck={false}
                className={cn(field, "font-mono text-[13.5px]")}
              />
              <span className="font-pretendard text-[12.5px] text-white/45">{r.hint}</span>
            </label>
          ))}
          <label className="flex flex-col gap-1.5">
            <span className="flex items-baseline gap-2 font-pretendard text-[13px] font-semibold text-white/70">
              메일 드라이버
              <span className="font-normal text-white/40">{sourceText(s.sources.mailDriver)}</span>
            </span>
            <Select
              value={form.mailDriver ?? s.mailDriver}
              onChange={(mailDriver) => setForm({ ...form, mailDriver })}
              options={[
                { value: "mock", label: "mock — 가짜 (시험용)" },
                { value: "cloudflare", label: "cloudflare — 진짜 Email Routing" },
              ]}
              className={field}
            />
            <span className="font-pretendard text-[12.5px] text-white/45">Email Routing 을 켠 뒤에 cloudflare 로 바꿔요</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={save.isPending}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-white/20 bg-white px-4 font-pretendard text-[14px] font-semibold text-black transition-colors enabled:hover:bg-white/85 disabled:opacity-50"
          >
            {save.isPending && <Loader2 size={14} className="animate-spin" />}
            저장
          </button>
          <ActionButton
            busy={runTest.isPending}
            onClick={() => {
              setTest(null);
              runTest.mutate();
            }}
          >
            연결 확인
          </ActionButton>
          {msg && (
            <span className={cn("ml-2 font-pretendard text-[13.5px]", msg.error ? "text-[#FF8B8B]" : "text-white/70")}>
              {msg.text}
            </span>
          )}
        </div>
        {test && (
          <p className="font-pretendard text-[14px] text-white/80">
            {test.driver === "mock"
              ? "가짜(mock)로 돌고 있어요 — 계정 ID 와 토큰을 넣어야 진짜 Cloudflare 를 확인해요."
              : test.problems === 0
                ? "연결됐어요. 모든 항목이 정상이에요."
                : `연결 확인 — 고칠 곳 ${test.problems}개. 위 '연결 상태'에서 고치는 법을 봐요.`}
          </p>
        )}
      </div>
    </Panel>
  );
}

/* ---------------- 탭 ---------------- */

/** 기기·부원 관리 › Cloudflare — 부장 이상 (연결 설정은 최고 관리자) */
export default function CloudflarePanel() {
  const { isSuperadmin } = useMe();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto pb-4">
      <StatusSection />
      <MailSection />
      <AccessEmailSection />
      <DeviceSection />
      {isSuperadmin && <SettingsSection />}
    </div>
  );
}
