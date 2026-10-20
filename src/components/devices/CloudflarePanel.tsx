"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import NeonButton from "@/components/common/NeonButton";
import Select from "@/components/common/Select";
import { toast } from "@/components/common/Toast";
import { TimeConfirm } from "@/components/time/TimeToolbar";
import { StatusDot, adminPanel } from "@/components/devices/adminUi";
import { useMe } from "@/hooks/useMe";
import { cloudflareApi } from "@/lib/cloudflareApi";
import { retryUnlessClientError } from "@/lib/http";
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

/* 관리 › Cloudflare (시안 Cloudflare)
   연결 상태: 고칠 곳 번호 카드(제목·짧은 설명·바로 고치는 버튼) + 정상 칩
   아래: 메일 주소 · 로그인 허용 이메일 · 기기 접속 키 · 연결 설정(최고 관리자) — 기능은 그대로, 모양만 같은 언어로 */

/* ---------------- 공통 조각 ---------------- */

const field =
  "h-11 w-full rounded-[12px] border border-white/10 bg-[#0c0d0f] px-3 font-pretendard text-base text-white outline-none placeholder:text-white/30 focus:border-white/30 md:h-10 md:text-[14px]";

/** 폰 카드 목록의 한 줄 */
const mRow = "flex flex-col gap-1.5 border-b border-white/[0.06] px-4 py-3 last:border-b-0";

const DASH = "https://dash.cloudflare.com/";
const TOKENS = "https://dash.cloudflare.com/profile/api-tokens";
const ZERO_TRUST = "https://one.dash.cloudflare.com/";

/** 상태 점 — 정상(흰 점) · 문제(빨간 점) · 확인 못 함·꺼짐(흐린 점) */
function Dot({ ok }: { ok: boolean | null }) {
  return <StatusDot ok={ok} className="mt-[7px]" />;
}

/** 판 — 제목·옆 글·오른쪽 버튼 */
function Sec({
  title,
  hint,
  right,
  tour,
  id,
  children,
}: {
  title: string;
  hint?: ReactNode;
  right?: ReactNode;
  tour?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} data-tour={tour} className={cn(adminPanel, "scroll-mt-4 p-4 md:px-5 md:py-[18px]")}>
      <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <h3 className="whitespace-nowrap font-mbc text-[17px] text-white">{title}</h3>
        {hint && <span className="min-w-0 font-pretendard text-[12.5px] font-medium text-white/45">{hint}</span>}
        {right && <div className="flex flex-wrap gap-2 max-md:w-full md:ml-auto">{right}</div>}
      </div>
      {children}
    </section>
  );
}

/** 흰 네온(보조) · 빨간 네온(주 동작) · 글자만(펼치기) */
function Btn({
  onClick,
  children,
  tone = "white",
  busy,
  disabled,
  icon,
  className,
  tour,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "white" | "red" | "text";
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  tour?: string;
}) {
  if (tone === "text") {
    return (
      <button
        type="button"
        data-tour={tour}
        onClick={onClick}
        disabled={disabled || busy}
        className={cn(
          "flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 font-mbc text-[13.5px] text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-35 md:h-9",
          className,
        )}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : icon}
        {children}
      </button>
    );
  }
  return (
    <NeonButton
      tone={tone}
      data-tour={tour}
      onClick={onClick}
      disabled={disabled || busy}
      icon={busy ? <Loader2 className="animate-spin" /> : icon}
      className={cn("shrink-0 md:h-[38px]", className)}
    >
      {children}
    </NeonButton>
  );
}

/** 불러오기 실패·권한 없음 같은 안내 */
function Problem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-[14px] border border-white/[0.07] bg-black/30 px-4 py-3 font-pretendard text-[14px] leading-relaxed text-white/75">
      <Dot ok={false} />
      <span>{children}</span>
    </div>
  );
}

function Loading() {
  return <p className="font-pretendard text-[14px] text-white/45">불러오는 중…</p>;
}

/** 불러오기 실패 — 다시 해 보는 중이어도(창이 뒤에 있으면 다시 하기가 멈춘다) 데이터가 없으면 이유를 바로 보여 준다 */
function loadError(q: { error: unknown; failureReason: unknown; data: unknown }) {
  return q.error ?? (q.data === undefined ? q.failureReason : null);
}

function errText(e: unknown) {
  return e instanceof Error ? e.message : "요청을 처리하지 못했어요";
}

function day(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10) : "";
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
    <TimeConfirm
      open={!!confirm}
      onClose={() => setConfirm(null)}
      title={confirm?.title ?? ""}
      message={confirm?.message ?? ""}
      confirmText={confirm?.confirmText ?? "확인"}
      danger
      onConfirm={() => {
        if (confirm) act.mutate(confirm);
      }}
    />
  );
  return { setConfirm, modal, busy: act.isPending };
}

/* ---------------- 1. 연결 상태 ---------------- */

/** 고칠 곳 카드 하나 — 서버 상태 항목(key·label·detail)을 한국어 제목·짧은 설명·바로 고치는 버튼으로 */
type Fix = { title: string; desc?: ReactNode; action?: { label: string; href?: string; onClick?: () => void } };

interface FixCtx {
  status: CfStatus;
  /** 연결 설정 판(최고 관리자)을 열 수 있으면 그 칸으로 */
  openSettings?: (field: string) => void;
  recheck: () => void;
  syncMail: () => void;
}

const Code = ({ children }: { children: ReactNode }) => (
  <span className="rounded-[6px] bg-white/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-white/60 [overflow-wrap:anywhere] md:whitespace-nowrap">{children}</span>
);

function fixOf(c: CfCheck, ctx: FixCtx): Fix {
  const d = c.detail;
  const settings = (label: string, f: string, fallback: Fix["action"]): Fix["action"] =>
    ctx.openSettings ? { label, onClick: () => ctx.openSettings?.(f) } : fallback;
  const noPerm = d === "읽기 권한 없음";
  switch (c.key) {
    case "token":
      if (/인터넷/.test(c.fix)) return { title: "Cloudflare 에 닿지 않아요", desc: d, action: { label: "다시 확인", onClick: ctx.recheck } };
      return {
        title: "API 토큰이 맞지 않아요",
        desc: d === "토큰이 맞지 않아요" ? "새 토큰을 만들어 연결 설정에 넣어야 해요" : d,
        action: settings("토큰 넣기", "apiToken", { label: "토큰 만들러 가기", href: TOKENS }),
      };
    case "permissions": {
      const missing = ctx.status.permissions.filter((p) => p.ok === false);
      return {
        title: missing.length === 1 ? "토큰 권한이 하나 빠졌어요" : `토큰 권한이 ${missing.length || ""}개 빠졌어요`,
        desc: missing.length ? (
          <span className="flex flex-col gap-1">
            {missing.map((p) => (
              <span key={p.key} className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                {p.usedFor} 권한 <Code>{p.name}</Code>
              </span>
            ))}
          </span>
        ) : (
          d
        ),
        action: { label: "토큰 고치러 가기", href: TOKENS },
      };
    }
    case "zone": {
      const domain = c.label.replace(/^도메인\s*/, "");
      return {
        title: `${domain} 도메인을 못 찾았어요`,
        desc: noPerm
          ? "토큰에 도메인 읽기 권한이 없어요"
          : d === "도메인을 찾지 못했어요"
            ? "Cloudflare 계정에 도메인이 아직 없거나 토큰이 그 도메인을 못 봐요"
            : d,
        action: { label: "도메인 확인", href: DASH },
      };
    }
    case "emailRouting":
      return {
        title: noPerm ? "Email Routing 을 읽을 권한이 없어요" : d === "꺼짐" ? "Email Routing 이 꺼져 있어요" : "Email Routing DNS 가 맞지 않아요",
        desc: noPerm ? "토큰에 Email Routing Rules 권한을 더해야 해요" : d === "꺼짐" ? "켜고 MX 레코드를 넣어야 메일이 와요" : d,
        action: noPerm ? { label: "토큰 고치러 가기", href: TOKENS } : { label: "Email Routing 열기", href: DASH },
      };
    case "mailDriver":
      return { title: "메일 규칙을 못 읽었어요", desc: d.replace(/^메일 규칙을 읽지 못했어요:\s*/, ""), action: { label: "토큰 고치러 가기", href: TOKENS } };
    case "roleRules":
      return { title: "역할 주소 규칙이 없어요", desc: d, action: { label: "규칙 다시 맞추기", onClick: ctx.syncMail } };
    case "workerSecret":
      return { title: "메일 워커 비밀값이 없어요", desc: "서버 .env 와 워커에 MAIL_WORKER_SECRET 을 같은 값으로 넣어야 해요", action: { label: "워커 열기", href: DASH } };
    case "accessApp": {
      if (noPerm) return { title: "Access 앱을 읽을 권한이 없어요", desc: "토큰에 Access: Apps and Policies 권한을 더해야 해요", action: { label: "토큰 고치러 가기", href: TOKENS } };
      const m = d.match(/^(.+) 앱을 찾지 못했어요$/);
      if (m)
        return {
          title: `${m[1]} 로그인 앱이 없어요`,
          desc: "Access 앱이 있어야 학교 밖에서 로그인 화면이 떠요",
          action: { label: "앱 만들기", href: ZERO_TRUST },
        };
      return { title: "Access 앱을 확인하지 못했어요", desc: d, action: { label: "다시 확인", onClick: ctx.recheck } };
    }
    case "emailPolicy":
      return { title: "로그인 허용 정책이 없어요", desc: d === "이메일 허용 정책 없음" ? "Allow · Include Emails 정책이 있어야 이메일로 들어와요" : d, action: { label: "정책 만들기", href: ZERO_TRUST } };
    case "devicePolicy":
      return { title: "기기 접속 정책이 없어요", desc: d === "Service Auth 정책 없음" ? "Service Auth 정책이 있어야 부원 앱이 들어와요" : d, action: { label: "정책 만들기", href: ZERO_TRUST } };
    case "jwt":
      return {
        title: "로그인 확인이 꺼져 있어요",
        desc: "팀 도메인과 서버 .env 의 CF_ACCESS_AUD 가 있어야 해요",
        action: settings("설정 열기", "teamDomain", { label: "Zero Trust 열기", href: ZERO_TRUST }),
      };
    case "tunnel": {
      const open = settings("터널 고르기", "tunnelId", { label: "터널 열기", href: ZERO_TRUST });
      if (noPerm) return { title: "터널을 읽을 권한이 없어요", desc: "토큰에 Cloudflare Tunnel 권한을 더해야 해요", action: { label: "토큰 고치러 가기", href: TOKENS } };
      if (d === "터널을 찾지 못했어요")
        return { title: "터널을 못 찾았어요", desc: "토큰이 터널을 못 보거나 서버 PC 의 cloudflared 터널 id 를 아직 안 넣었어요", action: open };
      if (/^터널 ID .+ 를 찾지 못했어요$/.test(d)) return { title: "터널 id 가 맞지 않아요", desc: d, action: open };
      const word = d.split(" · ").pop() ?? d;
      return { title: `터널이 ${word.replace(/^상태: /, "")}`, desc: "서버 PC 에서 cloudflared 가 도는지 확인해요", action: { label: "다시 확인", onClick: ctx.recheck } };
    }
    default:
      return { title: `${c.label} ${d}`.trim(), desc: c.fix.replace(/[[\]]/g, "") || undefined };
  }
}

function FixCard({ n, fix, first }: { n: number; fix: Fix; first: boolean }) {
  const a = fix.action;
  const open = () => (a?.href ? window.open(a.href, "_blank", "noopener,noreferrer") : a?.onClick?.());
  return (
    <li className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 rounded-[14px] border border-white/[0.07] bg-black/30 px-3.5 py-3.5 md:grid-cols-[26px_minmax(0,1fr)_auto] md:px-4">
      <span className="flex h-6 w-6 items-center justify-center self-start rounded-full border-[1.5px] border-[#ff4a43] font-orbitron text-[11px] font-bold text-[#ff8a8a] shadow-[0_0_8px_-2px_#ff3b3b] md:self-center">
        {n}
      </span>
      <div className="min-w-0">
        <b className="block font-pretendard text-[15px] font-bold text-white">{fix.title}</b>
        {fix.desc && <div className="mt-[3px] break-words font-pretendard text-[13px] font-medium leading-relaxed text-white/55">{fix.desc}</div>}
      </div>
      {a &&
        (first ? (
          <NeonButton className="min-w-[160px] max-md:col-span-2 md:min-w-[178px]" onClick={open}>
            {a.label}
          </NeonButton>
        ) : (
          <NeonButton tone="white" onClick={open} icon={a.href ? <ExternalLink /> : undefined} className="max-md:col-span-2">
            {a.label}
          </NeonButton>
        ))}
    </li>
  );
}

function StatusSection({ canSettings }: { canSettings: boolean }) {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["cf", "status"],
    queryFn: () => cloudflareApi.status(),
    refetchInterval: 60_000,
    retry: retryUnlessClientError,
  });
  const refresh = useMutation({
    mutationFn: () => cloudflareApi.status(true),
    onSuccess: (s) => qc.setQueryData(["cf", "status"], s),
    onError: (e) => toast.error(errText(e)),
  });
  const sync = useMutation({
    mutationFn: cloudflareApi.syncMail,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["cf"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      if (r.failed.length) toast.error(`못 맞춘 곳: ${r.failed.join(", ")}`);
      else toast.success("규칙을 다시 맞췄어요");
    },
    onError: (e) => toast.error(errText(e)),
  });
  const [showPerms, setShowPerms] = useState(false);
  const s = status.data;

  const openSettings = (f: string) => {
    const box = document.getElementById("cf-settings");
    box?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => box?.querySelector<HTMLInputElement>(`[name="${f}"]`)?.focus({ preventScroll: true }), 400);
  };
  const ctx: FixCtx | null = s
    ? { status: s, openSettings: canSettings ? openSettings : undefined, recheck: () => refresh.mutate(), syncMail: () => sync.mutate() }
    : null;
  const bad = s ? s.checks.filter((c) => c.ok === false) : [];
  const good = s ? [...s.checks.filter((c) => c.ok === true), ...s.checks.filter((c) => c.ok === null)] : [];

  return (
    <Sec
      tour="cloudflare.status"
      title="연결 상태"
      hint={s ? `${s.checkedAt.replace("T", " ").slice(5, 16)} 확인` : undefined}
      right={
        s && (
          <>
            <Btn tour="cloudflare.status.perms" tone="text" onClick={() => setShowPerms(!showPerms)}>
              {showPerms ? "토큰 권한 접기" : "토큰 권한"}
            </Btn>
            <Btn tour="cloudflare.status.recheck" busy={refresh.isPending} icon={<RefreshCw size={14} />} onClick={() => refresh.mutate()}>
              다시 확인
            </Btn>
          </>
        )
      }
    >
      {loadError(status) ? (
        <Problem>{errText(loadError(status))}</Problem>
      ) : !s || !ctx ? (
        <Loading />
      ) : (
        <div className="flex flex-col">
          {bad.length > 0 && (
            <>
              <span className="mb-2.5 mt-1 font-mbc text-[15px] text-[#ff8a8a]">고칠 곳 {bad.length}</span>
              <ol data-tour="cloudflare.status.fixes" className="flex flex-col gap-2">
                {bad.map((c, i) => (
                  <FixCard key={c.key} n={i + 1} fix={fixOf(c, ctx)} first={i === 0} />
                ))}
              </ol>
            </>
          )}
          {good.length > 0 && (
            <>
              <span className={cn("mb-2 font-mbc text-[15px] text-white/60", bad.length > 0 ? "mt-4" : "mt-1")}>
                정상 {good.filter((c) => c.ok === true).length}
                {good.some((c) => c.ok === null) && <span className="text-white/35"> · 확인 못 함 {good.filter((c) => c.ok === null).length}</span>}
              </span>
              <ul data-tour="cloudflare.status.ok" className="flex flex-wrap gap-1.5">
                {good.map((c) => (
                  <li
                    key={c.key}
                    title={c.fix || undefined}
                    className="flex min-h-8 items-center gap-[7px] rounded-[9px] border border-white/10 px-3 py-1 font-pretendard text-[13px] font-medium text-white/85"
                  >
                    <StatusDot ok={c.ok} className={c.ok ? "shadow-none" : undefined} />
                    {c.label} {c.detail}
                  </li>
                ))}
              </ul>
            </>
          )}
          {showPerms && (
            <div className="mt-4 rounded-[14px] border border-white/[0.07] bg-black/30">
              <ul className="font-pretendard text-[14px] md:hidden">
                {s.permissions.map((p) => (
                  <li key={p.key} className={mRow}>
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words font-mono text-[13px] text-white/90">{p.name}</span>
                      <span className="flex shrink-0 items-center gap-2 text-white/80">
                        <Dot ok={p.ok} />
                        <span className="mt-0.5">{p.ok === true ? "있음" : p.ok === false ? "없음" : "확인 못 함"}</span>
                      </span>
                    </span>
                    <span className="text-[13px] text-white/60">{p.usedFor}</span>
                  </li>
                ))}
              </ul>
              <table className="hidden w-full text-left font-pretendard text-[14px] md:table">
                <thead className="font-mbc text-[12.5px] text-white/40">
                  <tr className="border-b border-white/[0.07]">
                    <th className="px-4 py-2.5 font-normal">권한</th>
                    <th className="px-4 py-2.5 font-normal">쓰는 곳</th>
                    <th className="px-4 py-2.5 font-normal">있음</th>
                  </tr>
                </thead>
                <tbody>
                  {s.permissions.map((p) => (
                    <tr key={p.key} className="border-b border-white/[0.05] last:border-b-0">
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
            </div>
          )}
        </div>
      )}
    </Sec>
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
            "h-11 rounded-[9px] border px-3.5 font-mbc text-[13.5px] transition-colors md:h-8",
            value === it.key
              ? "border-white bg-white text-[#0b0b0d]"
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
      ? "쓸 수 없는 글자가 있어요"
      : l.length < 3 || l.length > 20
        ? "3~20자"
        : !LOCAL_RE.test(l)
          ? "점 위치가 잘못됐어요"
          : /^\d{2}/.test(l)
            ? "숫자 두 자리로 시작할 수 없어요"
            : emails.some((e) => !EMAIL_RE.test(e))
              ? "받을 메일 주소가 잘못됐어요"
              : emails.length > 5
                ? "받을 메일은 5개까지예요"
                : "";
  const issue = useMutation({
    mutationFn: () => cloudflareApi.addAddress({ localPart: l, forwardTo: emails, note: note.trim() }),
    onSuccess: (r) => {
      toast.success(`${r.address.address}@${domain} 를 만들었어요`);
      qc.invalidateQueries({ queryKey: ["cf", "mail"] });
      onDone();
    },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-white/[0.07] bg-black/30 px-4 py-4 md:px-5 md:py-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="flex flex-col gap-1.5">
          <span className="font-mbc text-[12.5px] text-white/50">주소</span>
          <div className="flex items-center gap-2">
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="event"
              autoComplete="off"
              spellCheck={false}
              className={cn(field, "font-mono")}
            />
            <span className="min-w-0 shrink truncate font-mono text-[14px] text-white/45 md:shrink-0">@{domain}</span>
          </div>
          {problem && <span className="font-pretendard text-[12.5px] text-[#ff8a8a]">{problem}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mbc text-[12.5px] text-white/50">받을 메일</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="teacher@school.kr, pd@gmail.com"
            autoComplete="off"
            spellCheck={false}
            className={field}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="font-mbc text-[12.5px] text-white/50">메모</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={100}
          placeholder="예: 축제 문의"
          className={field}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto min-w-0 break-all font-pretendard text-[13px] text-white/50 max-md:w-full">
          {l && !problem && emails.length ? `${l}@${domain} → ${emails.join(", ")}` : ""}
        </span>
        <Btn onClick={onDone}>
          닫기
        </Btn>
        <Btn
          tone="red"
          busy={issue.isPending}
          disabled={!l || !emails.length || !!problem}
          onClick={() => issue.mutate()}
        >
          만들기
        </Btn>
      </div>
    </div>
  );
}

function MailSection() {
  const qc = useQueryClient();
  const mail = useQuery({
    queryKey: ["cf", "mail"],
    queryFn: cloudflareApi.mail,
    refetchInterval: 30_000,
    retry: retryUnlessClientError,
  });
  const [filter, setFilter] = useState<AddrFilter>("all");
  const [issuing, setIssuing] = useState(false);
  const { setConfirm, modal } = useConfirmRun([["cf", "mail"], ["cf", "status"]]);
  const sync = useMutation({
    mutationFn: cloudflareApi.syncMail,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["cf"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      if (r.failed.length) toast.error(`못 맞춘 곳: ${r.failed.join(", ")}`);
      else toast.success(r.extrasFixed ? `규칙을 다시 맞췄어요 · 추가 주소 ${r.extrasFixed}개 복구` : "규칙을 다시 맞췄어요");
    },
    onError: (e) => toast.error(errText(e)),
  });
  const resend = useMutation({
    mutationFn: (id: string) => cloudflareApi.resendDestination(id),
    onSuccess: (r) => {
      toast.success(`${r.destination.email} 로 확인 메일을 보냈어요`);
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
    <Sec
      tour="cloudflare.mail"
      title="메일 주소"
      hint={d ? `@${domain} · 부원 주소 ${counts.member} · 추가 주소 ${counts.extra}` : `@${domain}`}
      right={
        d && (
          <div data-tour="cloudflare.mail.actions" className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto">
            <Btn busy={sync.isPending} onClick={() => sync.mutate()}>
              규칙 다시 맞추기
            </Btn>
            <NeonButton tone="white" className="md:min-w-[170px]" onClick={() => setIssuing(true)} disabled={issuing}>
              주소 만들기
            </NeonButton>
          </div>
        )
      }
    >
      {loadError(mail) ? (
        <Problem>{errText(loadError(mail))}</Problem>
      ) : !d ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-pretendard text-[13.5px] font-medium">
            <span className="flex items-start gap-2 text-white/80">
              <Dot ok={d.driver === "mock" ? null : s?.connection.ok ?? null} />
              <span className="mt-0.5">
                {d.driver === "mock"
                  ? "메일 연결 mock"
                  : s?.connection.ok
                    ? `Cloudflare 연결됨${s.connection.enabled === false ? " · Email Routing 꺼짐" : ""}`
                    : "Cloudflare 메일에 연결하지 못했어요"}
              </span>
            </span>
            <span className="text-white/50">워커 비밀값 {s?.workerSecretSet ? "있음" : "없음"}</span>
          </div>
          {(d.problem || d.error || s?.connection.message) && (
            <Problem>{d.problem || d.error || s?.connection.message}</Problem>
          )}

          {issuing && <IssueForm domain={domain} onDone={() => setIssuing(false)} />}

          <Seg items={ADDR_FILTERS} value={filter} onChange={setFilter} />
          <div data-tour="cloudflare.mail.table" className="overflow-x-auto rounded-[14px] border border-white/[0.07] bg-black/30">
            <ul className="font-pretendard text-[14px] md:hidden">
              {rows.length === 0 ? (
                <li>
                  <EmptyState size="sm">{filter === "extra" ? "추가 주소가 없어요" : "주소가 없어요"}</EmptyState>
                </li>
              ) : (
                rows.map((a) => (
                  <li key={`${a.kind}-${a.id}`} className={mRow}>
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-all font-mono text-[15px] font-semibold text-white">
                        {a.address}
                        <span className="font-medium text-white/40">@{domain}</span>
                      </span>
                      <span className="shrink-0">
                        <AddrStatus a={a} />
                      </span>
                    </span>
                    <span className="min-w-0 break-all text-[13px] text-white/75">
                      {a.kind === "member" ? (
                        <>
                          {a.cohort}기 {a.memberName}
                          {a.forwardHint && <span className="text-white/45"> · {a.forwardHint}</span>}
                        </>
                      ) : a.kind === "role" ? (
                        a.forwardHint
                      ) : (
                        a.forwardTo.join(", ")
                      )}
                    </span>
                    {a.kind === "member" && a.error && (
                      <span className="text-[13px] text-[#ff8a8a]" title={a.error}>
                        Cloudflare 실패
                      </span>
                    )}
                    {(a.kind === "extra" || a.kind === "member") && (
                      <span className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 text-[13px] text-white/55">
                          {a.kind === "extra"
                            ? [a.note, a.createdBy && `${a.createdBy} · ${day(a.createdAt)}`].filter(Boolean).join(" · ")
                            : a.roleLabel}
                        </span>
                        {a.kind === "extra" && (
                          <Btn
                            className="h-10 md:h-9"
                            onClick={() =>
                              setConfirm({
                                title: "주소 지우기",
                                message: `${a.address}@${domain} 를 지울까요?\n메일이 더는 전달되지 않아요.`,
                                confirmText: "지우기",
                                run: () => cloudflareApi.deleteAddress(a.id),
                                done: `${a.address}@${domain} 를 지웠어요`,
                              })
                            }
                          >
                            지우기
                          </Btn>
                        )}
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>
            <table className="hidden w-full min-w-[720px] text-left font-pretendard text-[14px] md:table">
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
                    <td colSpan={5}>
                      <EmptyState size="sm">{filter === "extra" ? "추가 주소가 없어요" : "주소가 없어요"}</EmptyState>
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
                          <span className="mt-1 block text-[13px] text-[#ff8a8a]" title={a.error}>
                            Cloudflare 실패
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/55">
                        {a.kind === "extra"
                          ? [a.note, a.createdBy && `${a.createdBy} · ${day(a.createdAt)}`].filter(Boolean).join(" · ")
                          : a.kind === "role"
                            ? ""
                            : a.roleLabel}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.kind === "extra" && (
                          <Btn
                            className="ml-auto h-9 md:h-9"
                            onClick={() =>
                              setConfirm({
                                title: "주소 지우기",
                                message: `${a.address}@${domain} 를 지울까요?\n메일이 더는 전달되지 않아요.`,
                                confirmText: "지우기",
                                run: () => cloudflareApi.deleteAddress(a.id),
                                done: `${a.address}@${domain} 를 지웠어요`,
                              })
                            }
                          >
                            지우기
                          </Btn>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div data-tour="cloudflare.mail.inbox" className="flex flex-col gap-2">
            <h4 className="font-mbc text-[15px] text-white/80">받을 메일</h4>
            <div className="overflow-x-auto rounded-[14px] border border-white/[0.07] bg-black/30">
              <ul className="font-pretendard text-[14px] md:hidden">
                {d.destinations.length === 0 ? (
                  <li>
                    <EmptyState size="sm">받을 메일이 없어요</EmptyState>
                  </li>
                ) : (
                  d.destinations.map((x) => (
                    <li key={x.id} className={mRow}>
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 break-all font-mono text-[14px] text-white/90">{x.email}</span>
                        <span className="flex shrink-0 items-start gap-2 text-white/85">
                          <Dot ok={x.verified} />
                          <span className="mt-0.5">{x.verified ? "확인됨" : "확인 대기"}</span>
                        </span>
                      </span>
                      {x.usedBy.length > 0 && <span className="text-[13px] text-white/60">{x.usedBy.join(", ")}</span>}
                      {!x.verified && (
                        <Btn
                          className="h-10 w-fit md:h-9"
                          busy={resend.isPending && resend.variables === x.id}
                          onClick={() => resend.mutate(x.id)}
                        >
                          확인 메일 다시 보내기
                        </Btn>
                      )}
                    </li>
                  ))
                )}
              </ul>
              <table className="hidden w-full min-w-[560px] text-left font-pretendard text-[14px] md:table">
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
                      <td colSpan={4}>
                        <EmptyState size="sm">받을 메일이 없어요</EmptyState>
                      </td>
                    </tr>
                  ) : (
                    d.destinations.map((x) => (
                      <tr key={x.id} className="border-b border-white/[0.06] last:border-b-0">
                        <td className="px-4 py-3 font-mono text-[14px] text-white/90">{x.email}</td>
                        <td className="px-4 py-3 text-white/60">{x.usedBy.join(", ")}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-start gap-2 text-white/85">
                            <Dot ok={x.verified} />
                            <span className="mt-0.5">{x.verified ? "확인됨" : "확인 대기"}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!x.verified && (
                            <Btn
                              className="ml-auto h-9 md:h-9"
                              busy={resend.isPending && resend.variables === x.id}
                              onClick={() => resend.mutate(x.id)}
                            >
                              확인 메일 다시 보내기
                            </Btn>
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
    </Sec>
  );
}

/* ---------------- 3. 로그인 허용 이메일 ---------------- */

function AccessEmailSection() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["cf", "access-emails"],
    queryFn: cloudflareApi.accessEmails,
    retry: retryUnlessClientError,
  });
  const [email, setEmail] = useState("");
  const { setConfirm, modal } = useConfirmRun([["cf", "access-emails"], ["cf", "status"]]);
  const add = useMutation({
    mutationFn: (e: string) => cloudflareApi.addAccessEmail(e),
    onSuccess: (res, e) => {
      qc.setQueryData(["cf", "access-emails"], res);
      setEmail("");
      toast.success(`${e} 를 더했어요`);
    },
    onError: (e) => toast.error(errText(e)),
  });
  const d = list.data;
  const value = email.trim().toLowerCase();
  const valid = EMAIL_RE.test(value);

  return (
    <Sec
      tour="cloudflare.access"
      title="로그인 허용 이메일"
      hint={d ? `${d.app.domain} · 정책 '${d.policy.name}'` : undefined}
    >
      {loadError(list) ? (
        <Problem>{errText(loadError(list))}</Problem>
      ) : !d ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-4">
          <div data-tour="cloudflare.access.add" className="flex gap-2">
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
            <Btn tone="red" busy={add.isPending} disabled={!valid} onClick={() => add.mutate(value)}>
              추가
            </Btn>
          </div>
          <ul className="flex flex-col rounded-[14px] border border-white/[0.07] bg-black/30">
            {d.emails.map((e) => (
              <li key={e.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.06] px-4 py-3 last:border-b-0 md:flex-nowrap">
                <span className="min-w-0 break-all font-mono text-[14.5px] text-white">{e.email}</span>
                {e.member && <span className="font-pretendard text-[14px] text-white/55">{e.member}</span>}
                <span className="ml-auto font-pretendard text-[13.5px] text-white/50">
                  {e.protected ? `${e.reason} · 고정` : ""}
                </span>
                {!e.protected && (
                  <Btn
                    className="h-10 md:h-9"
                    onClick={() =>
                      setConfirm({
                        title: "로그인 허용 빼기",
                        message: `${e.email} 을 뺄까요?\n브라우저 로그인이 더는 안 돼요.`,
                        confirmText: "빼기",
                        run: () => cloudflareApi.removeAccessEmail(e.email),
                        done: `${e.email} 을 뺐어요`,
                      })
                    }
                  >
                    빼기
                  </Btn>
                )}
              </li>
            ))}
          </ul>
          {d.otherRules > 0 && (
            <p className="font-pretendard text-[13px] text-white/50">다른 규칙 {d.otherRules}개</p>
          )}
        </div>
      )}
      {modal}
    </Sec>
  );
}

/* ---------------- 4. 기기 접속 키 ---------------- */

function ownerText(d: CfDevice) {
  const o = d.owner;
  if (o.kind === "member") return `${o.cohort ?? ""}기 ${o.name}`;
  if (o.kind === "invite") return `등록 전 초대 · ${o.name}`;
  return "부원 기기 아님";
}

function disconnectMessage(d: CfDevice) {
  const o = d.owner;
  if (o.kind === "member")
    return `${o.name} 님의 기기 키를 끊을까요?\n부원 내보내기와 같아요.`;
  if (o.kind === "invite") return "초대를 취소할까요?";
  return `'${d.name}' 키를 지울까요?\n되돌릴 수 없어요.`;
}

function DeviceSection() {
  const list = useQuery({
    queryKey: ["cf", "devices"],
    queryFn: cloudflareApi.devices,
    refetchInterval: 30_000,
    retry: retryUnlessClientError,
  });
  const { setConfirm, modal } = useConfirmRun([["cf", "devices"], ["members"], ["member-invites"]]);
  const d = list.data;

  return (
    <Sec tour="cloudflare.device-keys" title="기기 접속 키">
      {loadError(list) ? (
        <Problem>{errText(loadError(list))}</Problem>
      ) : !d ? (
        <Loading />
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-white/[0.07] bg-black/30">
          <ul className="font-pretendard text-[14px] md:hidden">
            {d.devices.length === 0 ? (
              <li>
                <EmptyState size="sm">기기 접속 키가 없어요</EmptyState>
              </li>
            ) : (
              d.devices.map((x) => (
                <li key={x.tokenId} className={mRow}>
                  <span>
                    <span className={cn("font-mbc text-[15px]", x.owner.kind === "member" ? "text-white" : "text-white/60")}>
                      {ownerText(x)}
                    </span>
                    {x.owner.roleLabel && <span className="ml-2 text-[13px] text-white/45">{x.owner.roleLabel}</span>}
                    {x.mine && <span className="ml-2 text-[13px] text-white/45">· 이 기기</span>}
                  </span>
                  <span className="break-all text-[13px] text-white/70">
                    {x.name} <span className="font-mono text-white/45">· {x.clientIdTail}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 font-mono text-[12.5px] tabular-nums text-white/60">
                      {day(x.createdAt)} → {day(x.expiresAt)}
                    </span>
                    {x.canDisconnect ? (
                      <Btn
                        className="h-10 md:h-9"
                        onClick={() =>
                          setConfirm({
                            title: "기기 키 끊기",
                            message: disconnectMessage(x),
                            confirmText: "끊기",
                            run: () => cloudflareApi.disconnect(x.tokenId),
                            done: x.owner.kind === "member" ? `${x.owner.name} 님의 기기를 끊었어요` : "키를 끊었어요",
                          })
                        }
                      >
                        끊기
                      </Btn>
                    ) : (
                      <span className="shrink-0 text-[13px] text-white/35">
                        {x.mine ? "내 기기" : x.owner.superadmin ? "최고 관리자" : x.owner.kind === "other" ? "최고 관리자만" : ""}
                      </span>
                    )}
                  </span>
                </li>
              ))
            )}
          </ul>
          <table className="hidden w-full min-w-[720px] text-left font-pretendard text-[14px] md:table">
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
                  <td colSpan={6}>
                    <EmptyState size="sm">기기 접속 키가 없어요</EmptyState>
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
                      {x.mine && <span className="ml-2 text-[13px] text-white/45">· 이 기기</span>}
                    </td>
                    <td className="px-4 py-3 text-white/70">{x.name}</td>
                    <td className="px-4 py-3 font-mono text-[13px] text-white/60">{x.clientIdTail}</td>
                    <td className="px-4 py-3 font-mono text-[13px] tabular-nums text-white/70">{day(x.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-[13px] tabular-nums text-white/70">{day(x.expiresAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {x.canDisconnect ? (
                        <Btn
                          className="ml-auto h-9 md:h-9"
                          onClick={() =>
                            setConfirm({
                              title: "기기 키 끊기",
                              message: disconnectMessage(x),
                              confirmText: "끊기",
                              run: () => cloudflareApi.disconnect(x.tokenId),
                              done: x.owner.kind === "member" ? `${x.owner.name} 님의 기기를 끊었어요` : "키를 끊었어요",
                            })
                          }
                        >
                          끊기
                        </Btn>
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
      {modal}
    </Sec>
  );
}

/* ---------------- 5. 연결 설정 (최고 관리자) ---------------- */

const SETTING_ROWS: { key: CfSettingField; placeholder?: string }[] = [
  { key: "accountId" },
  { key: "zoneId" },
  { key: "teamDomain", placeholder: "junghyun001" },
  { key: "appDomain", placeholder: "onair.bssmcast.com" },
  { key: "accessAppId" },
  { key: "emailPolicyId" },
  { key: "devicePolicyId" },
  { key: "tunnelId" },
];

function sourceText(src: "settings" | "env" | "default" | "") {
  return src === "settings" ? "저장값" : src === "env" ? ".env" : src === "default" ? "기본값" : "비어 있음";
}

function SettingsSection() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["cf", "settings"],
    queryFn: cloudflareApi.settings,
    retry: retryUnlessClientError,
  });
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
      setMsg({ text: body.apiToken === null ? "토큰을 지웠어요" : "저장했어요" });
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

  if (loadError(settings)) return <Sec title="연결 설정"><Problem>{errText(loadError(settings))}</Problem></Sec>;
  if (!s) return <Sec title="연결 설정"><Loading /></Sec>;

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
      setMsg({ text: "바뀐 게 없어요" });
      return;
    }
    save.mutate(body);
  };

  return (
    <Sec id="cf-settings" tour="cloudflare.settings" title="연결 설정">
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="font-mbc text-[12.5px] text-white/50">API 토큰</span>
          <div className="flex max-w-[640px] gap-2">
            <input
              type="password"
              name="apiToken"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={s.tokenSet ? "새 토큰" : undefined}
              className={field}
            />
            {s.tokenSource === "settings" && (
              <NeonButton
                tone={clearArmed ? "red" : "white"}
                disabled={save.isPending}
                onClick={() => (clearArmed ? save.mutate({ apiToken: null }) : setClearArmed(true))}
                className="h-11 shrink-0 md:h-10"
              >
                {clearArmed ? "정말 지우기" : "토큰 지우기"}
              </NeonButton>
            )}
          </div>
          <span className="font-pretendard text-[12.5px] text-white/50">
            {s.tokenSet
              ? `저장된 토큰 ${s.tokenHint ?? ""} · ${s.tokenSource === "settings" ? "저장값" : ".env"}`
              : "토큰 없음 · mock 모드"}
          </span>
        </label>

        <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
          {SETTING_ROWS.map((r) => (
            <label key={r.key} className="flex flex-col gap-1.5">
              <span className="flex items-baseline gap-2 font-mbc text-[12.5px] text-white/50">
                {s.labels[r.key] ?? r.key}
                <span className="font-normal text-white/40">{sourceText(s.sources[r.key])}</span>
              </span>
              <input
                name={r.key}
                value={form[r.key] ?? ""}
                onChange={(e) => setForm({ ...form, [r.key]: e.target.value })}
                placeholder={r.placeholder}
                autoComplete="off"
                spellCheck={false}
                className={cn(field, "font-mono md:text-[13.5px]")}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1.5">
            <span className="flex items-baseline gap-2 font-mbc text-[12.5px] text-white/50">
              메일 드라이버
              <span className="font-normal text-white/40">{sourceText(s.sources.mailDriver)}</span>
            </span>
            <Select
              value={form.mailDriver ?? s.mailDriver}
              onChange={(mailDriver) => setForm({ ...form, mailDriver })}
              options={[
                { value: "mock", label: "mock" },
                { value: "cloudflare", label: "cloudflare" },
              ]}
              className={field}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NeonButton
            data-tour="cloudflare.settings.save"
            onClick={submit}
            disabled={save.isPending}
            icon={save.isPending ? <Loader2 className="animate-spin" /> : undefined}
            className="min-w-[96px] md:h-[38px]"
          >
            저장
          </NeonButton>
          <Btn
            tour="cloudflare.settings.test"
            busy={runTest.isPending}
            onClick={() => {
              setTest(null);
              runTest.mutate();
            }}
          >
            연결 확인
          </Btn>
          {msg && (
            <span className={cn("ml-2 font-pretendard text-[13.5px]", msg.error ? "text-[#ff8a8a]" : "text-white/70")}>
              {msg.text}
            </span>
          )}
        </div>
        {test && (
          <p className="font-pretendard text-[14px] text-white/80">
            {test.driver === "mock"
              ? "mock 모드"
              : test.problems === 0
                ? "연결됐어요"
                : `고칠 곳 ${test.problems}개`}
          </p>
        )}
      </div>
    </Sec>
  );
}

/* ---------------- 탭 ---------------- */

/** 관리 › Cloudflare — 부장 이상 (연결 설정은 최고 관리자) */
export default function CloudflarePanel() {
  const { isSuperadmin } = useMe();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pb-4 md:overflow-auto">
      <StatusSection canSettings={isSuperadmin} />
      <MailSection />
      <AccessEmailSection />
      <DeviceSection />
      {isSuperadmin && <SettingsSection />}
    </div>
  );
}
