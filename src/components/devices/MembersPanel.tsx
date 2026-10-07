"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MoreHorizontal, UserPlus } from "lucide-react";
import ConfirmModal from "@/components/common/ConfirmModal";
import InputModal from "@/components/common/InputModal";
import PageTabs from "@/components/common/PageTabs";
import { toast } from "@/components/common/Toast";
import CrewView, { ProfileModal, type ProfileTarget } from "@/components/devices/CrewView";
import InviteModal from "@/components/devices/InviteModal";
import { ASSIGNABLE } from "@/components/devices/roleStyle";
import { Notice, Panel } from "@/components/hall/HallControls";
import { ActionButton } from "@/components/hall/setup/ui";
import { useMe } from "@/hooks/useMe";
import { usePersistentState } from "@/hooks/usePersistentState";
import { downloadMembersCsv, mailApi, memberApi } from "@/lib/memberApi";
import { cn } from "@/lib/utils";
import type { AssignableRole, InviteCreated, MailStatus, Member, Role, RoleAddress } from "@/types/member";

type Filter = "all" | "lead" | "member" | "teacher" | "alumni" | "roster" | "revoked";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "lead", label: "부장" },
  { key: "member", label: "부원" },
  { key: "teacher", label: "교사" },
  { key: "alumni", label: "졸업" },
  { key: "roster", label: "명단만" },
  { key: "revoked", label: "내보냄" },
];

/** 부원 탭 보기 — 표(관리) | 방송부(엔딩 크레딧) */
type View = "table" | "crew";
const VIEWS: { key: View; label: string }[] = [
  { key: "table", label: "표" },
  { key: "crew", label: "방송부" },
];
/** 명단만 부원이 가질 수 있는 역할 (부장·교사는 초대해서 기기를 등록한 뒤에) */
const ROSTER_ROLES: AssignableRole[] = ["member", "alumni"];

/** 명단만 — 기기 없이 이름만 올라 있는 사람 */
function RosterTag() {
  return (
    <span
      title="기기·토큰 없이 이름만 올라 있어요. [초대 이어 주기]로 기기를 붙일 수 있어요."
      className="inline-flex h-[22px] shrink-0 items-center rounded-md border border-white/15 px-1.5 font-pretendard text-[11.5px] font-semibold text-white/55"
    >
      명단만
    </span>
  );
}

const profileOf = (m: Member, meId: string | null | undefined): ProfileTarget => ({
  id: m.id,
  name: m.name,
  cohort: m.cohort,
  lead: m.wasLead || m.role === "lead",
  title: m.title ?? "",
  bio: m.bio ?? "",
  me: !!meId && meId === m.id,
});

function ago(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return iso.slice(5, 16).replace("T", " ");
}

function hoursLeft(iso: string): string {
  const h = (new Date(iso).getTime() - Date.now()) / 3600_000;
  return h >= 1 ? `${Math.floor(h)}시간 남음` : `${Math.max(0, Math.round(h * 60))}분 남음`;
}

/** 기수 배지 — 회색 바탕 고정폭 숫자 */
function Cohort({ n, suffix }: { n: number | null; suffix?: boolean }) {
  if (!n) return <span className="font-mono text-[13px] text-white/30">—</span>;
  return (
    <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[13px] font-bold tabular-nums text-white/70">
      {suffix ? `${n}기` : String(n).padStart(2, "0")}
    </span>
  );
}

/** 프리셋 스위치 묶음 (승인 대기 역할·목록 필터) — 고른 것만 빨간 테두리·LED */
function Seg<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-2">
      {items.map((it) => {
        const on = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(it.key)}
            className={cn(
              "flex h-9 items-center gap-2 rounded-[10px] border border-black bg-[linear-gradient(180deg,#2a2c31,#1c1e22)] px-3.5 font-pretendard text-sm font-semibold transition-colors",
              on
                ? "text-white shadow-[inset_0_0_0_1.5px_rgba(248,113,113,0.8),0_2px_0_#08090a]"
                : "text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_0_#08090a] hover:text-white",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                on ? "bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" : "bg-[#3a3d44]",
              )}
            />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/** ONAIR 메일 주소 — 04junghyun@ (@ 뒤는 흐리게) */
function MailAddress({ address, domain, dim }: { address: string; domain?: string; dim?: boolean }) {
  if (!address) return <span className="text-white/30">—</span>;
  return (
    <span className={cn("font-mono text-[15px] font-semibold", dim ? "text-white/35" : "text-white")}>
      {address}
      <span className="font-medium text-white/40">@{domain ?? ""}</span>
    </span>
  );
}

/** 받는 역할 주소 — 작은 회색 태그 */
function RoleTags({ roles, dim }: { roles: RoleAddress[]; dim?: boolean }) {
  if (roles.length === 0) return <span className="text-white/30">—</span>;
  return (
    <span className={cn("flex gap-1", dim && "opacity-50")}>
      {roles.map((r) => (
        <span
          key={r}
          className="inline-flex h-6 items-center rounded-md bg-white/[0.07] px-2 font-mono text-[12.5px] text-white/80"
        >
          {r}@
        </span>
      ))}
    </span>
  );
}

/** 메일 상태 — 사용 중(흰 점) · 메일 확인 대기(빨간 점) · 꺼짐·없음(회색) */
function MailState({ status, label, error }: { status: MailStatus; label: string; error?: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span
        className={cn(
          "inline-flex items-center gap-2 text-sm font-bold",
          status === "off" || status === "none" ? "text-white/40" : "text-white",
        )}
      >
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            status === "active" && "bg-white/85",
            status === "pending" && "bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]",
            (status === "off" || status === "none") && "bg-white/25",
          )}
        />
        {label}
      </span>
      {error && (
        <span className="max-w-[220px] truncate text-xs font-normal text-red-300/90" title={error}>
          Cloudflare 실패 — 다시 맞춰야 해요
        </span>
      )}
    </span>
  );
}

function PendingCard({
  m,
  domain,
  busy,
  onApprove,
  onReject,
}: {
  m: Member;
  domain: string;
  busy: boolean;
  onApprove: (role: AssignableRole) => void;
  onReject: () => void;
}) {
  const [role, setRole] = useState<AssignableRole>(m.rosterRole || "member");
  const choices: AssignableRole[] = m.rosterRole ? ["member", "alumni", "lead", "teacher"] : ["member", "lead", "teacher"];
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 px-5 py-[18px]">
      <div className="flex items-center gap-2.5">
        <Cohort n={m.cohort} suffix />
        <span className="font-mbc text-[19px] text-white">{m.name}</span>
        <span className="ml-auto font-pretendard text-[13px] text-white/50">{ago(m.registeredAt)} 신청</span>
      </div>
      {m.rosterRole && (
        <p className="font-pretendard text-[13px] text-white/55">
          방송부 명단의 {m.cohort}기 {m.name}{m.title ? ` (${m.title})` : ""} 기록에 이어져요 — 거절하면 명단만으로 돌아가요.
        </p>
      )}
      {m.intro && <p className="whitespace-pre-wrap font-pretendard text-sm leading-relaxed text-white/80">{m.intro}</p>}
      {m.mailAddress && (
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-pretendard text-[13px] text-white/50">
          ONAIR 메일
          <MailAddress address={m.mailAddress} domain={domain} />
          {m.personalEmailHint && <span>→ {m.personalEmailHint}</span>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Seg
          items={choices.map((r) => ({
            key: r,
            label: ASSIGNABLE.find((a) => a.value === r)?.label ?? r,
          }))}
          value={role}
          onChange={setRole}
        />
        <ActionButton className="ml-auto h-9 px-3.5" onClick={onReject} disabled={busy}>
          거절
        </ActionButton>
        <ActionButton tone="primary" className="h-9 px-4" onClick={() => onApprove(role)} busy={busy}>
          승인
        </ActionButton>
      </div>
    </div>
  );
}

type Confirm = { title: string; message: string; confirmText: string; run: () => Promise<unknown> } | null;

/** 메일 (Cloudflare) — 최고 관리자만. 값은 서버 .env 로만 바꾸고 여기서는 보기·규칙 다시 맞추기 */
function MailSettingsPanel() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["mail-settings"], queryFn: mailApi.settings, refetchInterval: 30000 });
  const sync = useMutation({
    mutationFn: mailApi.sync,
    onSuccess: (res) => {
      qc.setQueryData(["mail-settings"], res.settings);
      qc.invalidateQueries({ queryKey: ["members"] });
      if (res.failed.length) toast.error(`규칙을 못 맞춘 부원: ${res.failed.join(", ")}`);
      else toast.success("메일 규칙을 다시 맞췄어요.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const s = settings.data;

  return (
    <Panel title="메일 (Cloudflare)" hint="최고 관리자만 보여요 · 값은 서버 .env 로 바꿔요 (docs/mail.md)">
      {settings.error ? (
        <p className="font-pretendard text-sm text-white/50">{(settings.error as Error).message}</p>
      ) : !s ? (
        <p className="font-pretendard text-sm text-white/45">불러오는 중…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2.5 font-pretendard text-sm">
            <span className="text-white/45">연결</span>
            <span className="flex items-center gap-2 text-white">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  s.connection.ok ? "bg-white/85" : "bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]",
                )}
              />
              {s.driver === "mock"
                ? "가짜(mock) — 서버 안에서만 시험"
                : s.connection.ok
                  ? `Cloudflare 연결됨${s.connection.enabled === false ? " · Email Routing 꺼짐" : ""}`
                  : "Cloudflare 에 연결하지 못했어요"}
            </span>
            <span className="text-white/45">도메인</span>
            <span className="font-mono text-white">{s.domain}</span>
            <span className="text-white/45">역할 주소</span>
            <span className="flex flex-wrap items-center gap-1.5">
              {s.roleRules.map((r) => (
                <span
                  key={r.address}
                  className={cn(
                    "inline-flex h-6 items-center rounded-md px-2 font-mono text-[12.5px]",
                    r.routed ? "bg-white/[0.07] text-white/80" : "bg-white/[0.03] text-white/35",
                  )}
                >
                  {r.address}@
                </span>
              ))}
              <span className="ml-1 text-xs text-white/45">
                {s.roleRules.every((r) => r.routed) ? `워커 ${s.workerName} 로 가요` : "워커 규칙이 아직 없어요"}
              </span>
            </span>
            <span className="text-white/45">워커 비밀값</span>
            <span className={s.workerSecretSet ? "text-white" : "text-white/45"}>
              {s.workerSecretSet ? "설정됨" : "없음 — MAIL_WORKER_SECRET 을 넣어야 역할 주소가 동작해요"}
            </span>
          </div>
          {(s.problem || s.connection.message) && (
            <p className="font-pretendard text-[13px] text-red-300/90">{s.problem || s.connection.message}</p>
          )}
          <div className="flex items-center gap-3">
            <span className="mr-auto font-pretendard text-[13px] text-white/45">
              {s.failed > 0 ? `규칙을 못 맞춘 부원 ${s.failed}명` : "역할 주소 워커 규칙을 만들고 부원 규칙을 다시 맞춰요"}
            </span>
            <ActionButton busy={sync.isPending} onClick={() => sync.mutate()}>
              규칙 다시 맞추기
            </ActionButton>
          </div>
        </div>
      )}
    </Panel>
  );
}

/** 기기·부원 관리 › 부원 — 초대(QR·코드), 승인 대기, 부원 목록 (부장 이상) */
export default function MembersPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [created, setCreated] = useState<InviteCreated | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [mailFor, setMailFor] = useState<Member | null>(null);
  const [allInvites, setAllInvites] = useState(false);
  const [profileFor, setProfileFor] = useState<ProfileTarget | null>(null);
  const [view, setView] = usePersistentState<View>("onair.members.view", "table");
  const { me, isSuperadmin } = useMe();

  // 메뉴는 Esc 로도 닫는다
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  const list = useQuery({ queryKey: ["members"], queryFn: memberApi.list, refetchInterval: 5000 });
  const invites = useQuery({ queryKey: ["member-invites"], queryFn: memberApi.invites, refetchInterval: 15000 });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["member-invites"] });
  };
  const act = useMutation({
    mutationFn: async (job: { run: () => Promise<unknown>; done: string }) => {
      await job.run();
      return job.done;
    },
    onSuccess: (done) => {
      toast.success(done);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const run = (fn: () => Promise<unknown>, done: string) => act.mutate({ run: fn, done });

  // memberId — 명단만 부원에게 이어 둘 초대 ("" 이면 새 부원)
  const invite = useMutation({
    mutationFn: (memberId: string) => memberApi.createInvite("", memberId || undefined),
    onSuccess: (res) => {
      setCreated(res);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = <PageTabs tabs={VIEWS} value={view} onChange={setView} />;
  if (view === "crew") return <CrewView toggle={toggle} />;

  if (list.error) {
    return <Notice>{(list.error as Error).message || "부원 목록을 불러오지 못했습니다."}</Notice>;
  }

  const members = list.data?.members ?? [];
  const pending = members.filter((m) => m.status === "pending");
  const live = members.filter((m) => m.status === "approved");
  const count = (r: Role) => live.filter((m) => m.role === r).length;
  const shown = members.filter((m) =>
    filter === "all"
      ? m.status === "approved"
      : filter === "revoked"
        ? m.status === "revoked"
        : filter === "roster"
          ? m.status === "approved" && m.rosterOnly
          : m.status === "approved" && m.role === filter,
  );
  const waiting = invites.data?.invites ?? [];
  const domain = list.data?.mail?.domain ?? "bssmcast.com";
  const mockMail = list.data?.mail?.driver === "mock";

  const setRole = (m: Member, role: AssignableRole) => {
    if (role === m.role) return;
    const label = ASSIGNABLE.find((r) => r.value === role)?.label ?? role;
    run(() => memberApi.update(m.id, { role }), `${m.name} — ${label}(으)로 바꿨어요.`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto pb-4">
      {/* 요약 · 초대 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2">{toggle}</span>
        {(
          [
            ["lead", "부장"],
            ["member", "부원"],
            ["teacher", "교사"],
            ["alumni", "졸업"],
          ] as [Role, string][]
        ).map(([r, label]) => (
          <span
            key={r}
            className="flex h-10 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 font-mbc text-sm text-white/70"
          >
            {label}
            <span className="font-mono text-base font-bold tabular-nums text-white">{count(r)}</span>
          </span>
        ))}
        {pending.length > 0 && (
          <span className="flex h-10 items-center gap-2.5 rounded-xl border border-red-400/50 bg-red-400/[0.12] px-4 font-mbc text-sm text-white">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" />
            승인 대기 <span className="font-mono text-base font-bold tabular-nums">{pending.length}</span>
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <ActionButton
            icon={<Download size={15} />}
            onClick={() => downloadMembersCsv().catch((e: Error) => toast.error(e.message))}
          >
            명단 내보내기
          </ActionButton>
          <ActionButton tone="primary" icon={<UserPlus size={15} />} busy={invite.isPending} onClick={() => invite.mutate("")}>
            새 부원 초대
          </ActionButton>
        </div>
      </div>

      {waiting.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {(allInvites ? waiting : waiting.slice(0, 2)).map((i) => (
            <div key={i.id} className="flex items-center gap-2.5 font-pretendard text-[13px] text-white/60">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF3B3B]" />
              기다리는 초대{i.memberId && i.note ? ` (${i.note} 명단에 이어짐)` : ""} · {i.createdAt.slice(11, 16)}{" "}
              {i.createdBy && `${i.createdBy} `}만듦 · {hoursLeft(i.expiresAt)}
              {i.codeActive && <span className="text-white/45">· 코드 사용 가능</span>}
              <button
                type="button"
                className="rounded-md px-2 py-0.5 font-mbc text-xs text-white/55 hover:bg-white/[0.06] hover:text-white"
                onClick={() => run(() => memberApi.cancelInvite(i.id), "초대를 취소했어요.")}
              >
                취소
              </button>
            </div>
          ))}
          {waiting.length > 2 && (
            <button
              type="button"
              onClick={() => setAllInvites((v) => !v)}
              className="w-fit pl-4 font-pretendard text-xs text-white/45 hover:text-white/75"
            >
              {allInvites ? "접기" : `기다리는 초대 ${waiting.length - 2}개 더 보기`}
            </button>
          )}
        </div>
      )}

      {/* 승인 대기 */}
      {pending.length > 0 && (
        <Panel title="승인 대기" hint="역할을 고르고 승인하면 그 기기에서 바로 조작할 수 있어요">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,460px),1fr))] gap-3">
            {pending.map((m) => (
              <PendingCard
                key={m.id}
                m={m}
                domain={domain}
                busy={act.isPending}
                onApprove={(role) => run(() => memberApi.approve(m.id, role), `${m.name} 님을 승인했어요.`)}
                onReject={() =>
                  setConfirm({
                    title: "등록 거절",
                    message: `${m.cohort}기 ${m.name} 님의 등록을 거절할까요?\n이 기기의 토큰을 지워 다시 들어올 수 없게 됩니다.`,
                    confirmText: "거절",
                    run: () => memberApi.revoke(m.id),
                  })
                }
              />
            ))}
          </div>
        </Panel>
      )}

      {/* 부원 목록 */}
      <Panel title="부원" hint="역할을 바꾸면 그 기기·받는 역할 주소에 바로 반영돼요 · 마지막 부장은 내려놓을 수 없어요">
        <Seg items={FILTERS} value={filter} onChange={setFilter} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left font-pretendard text-sm">
            <thead className="text-white/50">
              <tr className="border-b border-white/[0.07]">
                <th className="w-[70px] px-3 py-2 text-[13px] font-bold">기수</th>
                <th className="px-3 py-2 text-[13px] font-bold">이름</th>
                <th className="px-3 py-2 text-[13px] font-bold">직함</th>
                <th className="px-3 py-2 text-[13px] font-bold">역할</th>
                <th className="px-3 py-2 text-[13px] font-bold">ONAIR 메일</th>
                <th className="px-3 py-2 text-[13px] font-bold">받는 역할 주소</th>
                <th className="px-3 py-2 text-[13px] font-bold">메일 상태</th>
                <th className="px-3 py-2 text-[13px] font-bold">디스코드</th>
                <th className="px-3 py-2 text-[13px] font-bold">기기 키 만료</th>
                <th className="w-[52px] px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-white/45">
                    {list.isLoading
                      ? "불러오는 중…"
                      : filter === "all"
                        ? "아직 등록한 부원이 없어요. [새 부원 초대]로 시작하세요."
                        : "해당하는 사람이 없어요."}
                  </td>
                </tr>
              ) : (
                shown.map((m) => {
                  const gone = m.status === "revoked";
                  const fixed = m.superadmin;
                  const roster = m.rosterOnly && !gone;
                  const canProfile = !fixed || isSuperadmin;
                  return (
                    <tr key={m.id} className={cn("border-b border-white/[0.07]", gone && "text-white/30")}>
                      <td className={cn("px-3 py-3", gone && "opacity-50")}>
                        <Cohort n={m.cohort} />
                      </td>
                      <td className="px-3 py-3">
                        <div className={cn("flex items-center gap-2.5 font-mbc text-base", gone ? "text-white/35" : "text-white")}>
                          {m.name}
                          {(m.wasLead || m.role === "lead") && !gone && (
                            <span
                              title={m.role === "lead" ? "부장" : `${m.cohort}기 부장이었어요`}
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF3B3B]"
                            />
                          )}
                          {roster && <RosterTag />}
                        </div>
                      </td>
                      <td className="max-w-[200px] px-3 py-3">
                        <span className={cn("block truncate", gone || !m.title ? "text-white/35" : "text-white/80")} title={m.title}>
                          {m.title || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {fixed ? (
                          <span className="flex items-baseline gap-2">
                            <b className="font-bold text-white">최고 관리자</b>
                            <span className="text-xs text-white/45">서버 설정</span>
                          </span>
                        ) : gone ? (
                          <span className="text-xs">내보냄{m.hasToken ? " · 토큰 삭제 실패 — Cloudflare 에서 지우세요" : ""}</span>
                        ) : (
                          <select
                            value={m.role}
                            disabled={act.isPending}
                            onChange={(e) => setRole(m, e.target.value as AssignableRole)}
                            className="h-9 rounded-[10px] border border-white/[0.12] bg-[#0c0d0f] px-3 font-pretendard text-sm font-bold text-white focus:border-red-400/70 focus:outline-none"
                          >
                            {ASSIGNABLE.filter((r) => !roster || ROSTER_ROLES.includes(r.value)).map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <MailAddress address={m.mailAddress} dim={gone} />
                        {m.mailAliases.length > 0 && !gone && (
                          <div
                            className="mt-0.5 font-mono text-xs text-white/40"
                            title={m.mailAliases.map((a) => `${a.address}@${domain} — ${a.expiresAt.slice(0, 10)}까지`).join("\n")}
                          >
                            예전 {m.mailAliases[0].address}@ · {m.mailAliases[0].expiresAt.slice(5, 10).replace("-", "/")}까지
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <RoleTags roles={m.mailRoles} dim={gone} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <MailState status={m.mailStatus} label={m.mailStatusLabel} error={gone ? "" : m.mailError} />
                      </td>
                      <td className="px-3 py-3">
                        {m.discordLinked ? (
                          <span className={gone ? "text-white/35" : "text-white"}>연결</span>
                        ) : (
                          <span className="text-white/45">없음</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-[15px] tabular-nums text-white">
                        {!gone && m.tokenExpiresAt ? m.tokenExpiresAt.slice(0, 10) : ""}
                      </td>
                      <td className="relative px-3 py-3 text-right">
                        {!gone && (canProfile || m.mailStatus === "pending") && (
                          <>
                            <button
                              type="button"
                              aria-label={`${m.name} 더 보기`}
                              onClick={() => setMenu(menu === m.id ? null : m.id)}
                              className="rounded-lg border border-white/15 p-1.5 text-white/75 hover:bg-white/[0.06] hover:text-white"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {menu === m.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                                <div className="absolute right-3 top-11 z-20 flex min-w-[170px] flex-col rounded-xl border border-white/10 bg-[#161616] p-1.5 text-left shadow-2xl">
                                  {[
                                    roster && {
                                      t: "초대 이어 주기",
                                      f: () => invite.mutate(m.id),
                                    },
                                    canProfile && { t: "소개 고치기", f: () => setProfileFor(profileOf(m, me?.memberId)) },
                                    !fixed &&
                                      !roster &&
                                      (m.role === "lead"
                                        ? { t: "부장 해제", f: () => setRole(m, "member") }
                                        : { t: "부장 임명", f: () => setRole(m, "lead") }),
                                    !fixed &&
                                      m.role !== "alumni" && {
                                      t: "졸업 처리",
                                      f: () =>
                                        setConfirm({
                                          title: "졸업 처리",
                                          message: `${m.name} 님을 졸업 처리할까요?\n기기는 그대로 두고 보기만 할 수 있게 됩니다. ONAIR 메일 전달도 꺼져요.`,
                                          confirmText: "졸업 처리",
                                          run: () => memberApi.graduate(m.id),
                                        }),
                                    },
                                    !fixed && { t: "메일 주소 바꾸기", f: () => setMailFor(m) },
                                    m.mailStatus === "pending" && {
                                      t: "확인 메일 다시 보내기",
                                      f: () =>
                                        run(
                                          () => mailApi.resend(m.id),
                                          `${m.name} 님 받을 메일(${m.personalEmailHint})로 확인 메일을 다시 보냈어요.`,
                                        ),
                                    },
                                    mockMail &&
                                      m.mailStatus === "pending" && {
                                        t: "메일 확인 처리 (시험용)",
                                        f: () => run(() => mailApi.devVerify(m.id), `${m.name} — 메일 확인됨(시험용)`),
                                      },
                                    roster && {
                                      t: "명단에서 지우기",
                                      danger: true,
                                      f: () =>
                                        setConfirm({
                                          title: "명단에서 지우기",
                                          message: `${m.cohort}기 ${m.name} 님을 방송부 명단에서 지울까요?\n직함·소개도 함께 지워져요. (기기는 원래 없어요)`,
                                          confirmText: "지우기",
                                          run: () => memberApi.deleteRoster(m.id),
                                        }),
                                    },
                                    !fixed &&
                                      !roster && {
                                      t: "내보내기",
                                      danger: true,
                                      f: () =>
                                        setConfirm({
                                          title: "부원 내보내기",
                                          message: `${m.name} 님을 내보낼까요?\n이 기기의 Cloudflare 토큰을 지워 더는 ONAIR 에 들어올 수 없고, ONAIR 메일 전달도 꺼져요.`,
                                          confirmText: "내보내기",
                                          run: () => memberApi.revoke(m.id),
                                        }),
                                    },
                                  ]
                                    .filter((x): x is { t: string; f: () => void; danger?: boolean } => !!x)
                                    .map((x) => (
                                      <button
                                        key={x.t}
                                        type="button"
                                        onClick={() => {
                                          setMenu(null);
                                          x.f();
                                        }}
                                        className={cn(
                                          "h-[34px] rounded-lg px-2.5 text-left font-mbc text-sm hover:bg-white/[0.07]",
                                          x.danger ? "text-[#ff9b9b]" : "text-white/75 hover:text-white",
                                        )}
                                      >
                                        {x.t}
                                      </button>
                                    ))}
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {created && (
        <InviteModal
          invite={created}
          onClose={() => setCreated(null)}
          onCancelInvite={() => {
            const id = created.invite.id;
            setCreated(null);
            run(() => memberApi.cancelInvite(id), "초대를 취소했어요.");
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmText={confirm?.confirmText}
        onConfirm={() => {
          if (confirm) run(confirm.run, `${confirm.title} 완료`);
        }}
      />

      {isSuperadmin && <MailSettingsPanel />}

      {profileFor && <ProfileModal key={profileFor.id} target={profileFor} onClose={() => setProfileFor(null)} />}

      <InputModal
        isOpen={!!mailFor}
        onClose={() => setMailFor(null)}
        title={`${mailFor?.name ?? ""} — ONAIR 메일 ${String(mailFor?.cohort ?? "").padStart(2, "0")}□@${domain}`}
        placeholder="기수 뒤에 붙는 부분 — 영문 소문자·숫자·점 3~20자"
        initialValue={mailFor?.mailId ?? ""}
        confirmText="바꾸기"
        onConfirm={async (v) => {
          if (mailFor)
            run(
              () => memberApi.update(mailFor.id, { mailId: v.trim().toLowerCase() }),
              mailFor.mailAddress ? "메일 주소를 바꿨어요. 예전 주소로도 30일 더 받아요." : "메일 주소를 정했어요.",
            );
        }}
      />
    </div>
  );
}
