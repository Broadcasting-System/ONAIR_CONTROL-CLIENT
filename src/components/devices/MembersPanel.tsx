"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Download, Mail, MessageCircle, MoreHorizontal, UserPlus } from "lucide-react";
import Portal from "@/components/common/Portal";
import ConfirmModal from "@/components/common/ConfirmModal";
import InputModal from "@/components/common/InputModal";
import PageTabs from "@/components/common/PageTabs";
import Select from "@/components/common/Select";
import { toast } from "@/components/common/Toast";
import CrewView, { ProfileModal, type ProfileTarget } from "@/components/devices/CrewView";
import InviteModal from "@/components/devices/InviteModal";
import { MemberDevicesModal } from "@/components/devices/MyDevicesModal";
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
/** 폰 목록 — 기수 큰 순서로 묶기 (기수 없으면 맨 뒤) */
function byCohort(list: Member[]): [number | string, Member[]][] {
  const map = new Map<number | string, Member[]>();
  for (const m of list) {
    const k = m.cohort ?? "기타";
    map.set(k, [...(map.get(k) ?? []), m]);
  }
  return [...map.entries()].sort((a, b) =>
    typeof a[0] === "number" && typeof b[0] === "number" ? b[0] - a[0] : typeof a[0] === "number" ? -1 : 1,
  );
}

const CHIP: Record<string, string> = {
  lead: "bg-[#FF3B3B]/[0.18] text-[#ff8a8a]",
  member: "bg-white/10 text-white/80",
  teacher: "bg-sky-400/[0.16] text-sky-200",
  alumni: "bg-violet-400/[0.18] text-violet-200",
};

function RoleChip({ m }: { m: Member }) {
  const cls = "shrink-0 rounded-md px-1.5 py-0.5 font-pretendard text-[11.5px] font-bold";
  if (m.status === "revoked") return <span className={cn(cls, "bg-white/5 text-white/40")}>내보냄</span>;
  if (m.superadmin) return <span className={cn(cls, "bg-white text-black")}>최고 관리자</span>;
  if (m.rosterOnly) return <span className={cn(cls, "border border-white/20 text-white/55")}>명단만</span>;
  const label = ASSIGNABLE.find((r) => r.value === m.role)?.label ?? m.roleLabel ?? m.role;
  return <span className={cn(cls, CHIP[m.role] ?? CHIP.member)}>{label}</span>;
}

function StatusIcon({ on, warn, label, children }: { on: boolean; warn?: boolean; label: string; children: React.ReactNode }) {
  return (
    <span
      aria-label={`${label} ${on ? "연결" : warn ? "확인 대기" : "없음"}`}
      className={cn(
        "grid h-[22px] w-[22px] place-items-center rounded-[7px]",
        on ? "bg-[#3ddc84]/15 text-[#3ddc84]" : warn ? "bg-[#FF3B3B]/15 text-[#ff8a8a]" : "bg-white/[0.06] text-white/30",
      )}
    >
      {children}
    </span>
  );
}

/** 폰 — 부원 한 명 자세히 (아래에서 올라오는 시트): 역할 바꾸기·메일·디스코드·기기 키 + 할 일 */
function MemberSheet({
  m,
  domain,
  busy,
  isSuperadmin,
  items,
  onRole,
  onDevices,
  onClose,
}: {
  m: Member;
  domain?: string;
  busy: boolean;
  isSuperadmin: boolean;
  items: { t: string; f: () => void; danger?: boolean }[];
  onRole: (role: AssignableRole) => void;
  onDevices: () => void;
  onClose: () => void;
}) {
  const gone = m.status === "revoked";
  const roster = m.rosterOnly && !gone;
  const roles = ASSIGNABLE.filter((r) => !roster || ROSTER_ROLES.includes(r.value));
  const canRole = !gone && !m.superadmin;
  const rows: [string, React.ReactNode][] = [
    ["ONAIR 메일", m.mailAddress ? `${m.mailAddress}@${domain ?? ""}`.replace(/@$/, "") : "없음"],
    ["메일 상태", <MailState key="s" status={m.mailStatus} label={m.mailStatusLabel} error={gone ? "" : m.mailError} />],
    ["디스코드", m.discordLinked ? "연결" : "없음"],
  ];
  if (!gone && m.devices?.length)
    rows.push([
      "기기",
      <button key="d" type="button" onClick={onDevices} className="font-pretendard text-white underline underline-offset-4">
        {m.devices.map((d) => d.name).join(" · ")}
      </button>,
    ]);
  if (!gone && m.tokenExpiresAt) rows.push(["기기 키", `${m.tokenExpiresAt.slice(0, 10)}까지`]);
  return (
    <Portal>
      <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label={m.name}>
        <div className="absolute inset-0 bg-black/55" onClick={onClose} />
        <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[26px] border-t border-white/[0.12] bg-[#141418] px-[18px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-20px_50px_rgba(0,0,0,.6)]">
          <button type="button" aria-label="닫기" onClick={onClose} className="mx-auto mb-3 block h-5 w-16">
            <span className="mx-auto block h-[5px] w-10 rounded-full bg-white/25" />
          </button>
          <div className="flex items-center gap-3">
            <Cohort n={m.cohort} />
            <div className="min-w-0">
              <p className="truncate font-pretendard text-[20px] font-bold text-white">{m.name}</p>
              <p className="truncate font-pretendard text-[12.5px] text-white/45">
                {m.title || (m.cohort ? `${m.cohort}기` : "")}
              </p>
            </div>
            <span className="ml-auto">
              <RoleChip m={m} />
            </span>
          </div>

          {canRole && (
            <>
              <p className="mb-2 mt-4 font-pretendard text-[13px] font-semibold text-white/50">역할</p>
              <div className={cn("grid gap-1 rounded-xl bg-white/[0.06] p-1", roles.length === 2 ? "grid-cols-2" : "grid-cols-4")}>
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    disabled={busy}
                    onClick={() => onRole(r.value)}
                    className={cn(
                      "h-10 rounded-[9px] font-pretendard text-[14px] font-semibold transition-colors disabled:opacity-50",
                      m.role === r.value ? "bg-white text-black" : "text-white/60 active:bg-white/10",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="mt-3">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-t border-white/[0.07] py-3 font-pretendard text-[14.5px]">
                <span className="shrink-0 text-white/50">{k}</span>
                <span className="min-w-0 truncate text-right text-white">{v}</span>
              </div>
            ))}
            {m.mailRoles.length > 0 && (
              <div className="border-t border-white/[0.07] py-3">
                <RoleTags roles={m.mailRoles} dim={gone} />
              </div>
            )}
          </div>

          {(items.length > 0 || isSuperadmin) && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {items.map((x) => (
                <button
                  key={x.t}
                  type="button"
                  onClick={() => {
                    onClose();
                    x.f();
                  }}
                  className={cn(
                    "min-h-[48px] rounded-[14px] bg-white/[0.07] px-3 font-pretendard text-[14.5px] font-bold active:bg-white/[0.12]",
                    x.danger ? "text-[#ff6b6b]" : "text-white",
                  )}
                >
                  {x.t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

function RosterTag() {
  return (
    <span
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
  cardBg: m.cardBg ?? "wave",
  photoUrl: m.photoUrl ?? "",
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
  if (!n) return null;
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
  tour,
  className,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** CUE 튜토리얼 이름표 (data-tour) */
  tour?: string;
  className?: string;
}) {
  return (
    <div data-tour={tour} className={cn("inline-flex flex-wrap gap-2", className)}>
      {items.map((it) => {
        const on = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(it.key)}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-[10px] border border-black md:h-9 bg-[linear-gradient(180deg,#2a2c31,#1c1e22)] px-3.5 font-pretendard text-sm font-semibold transition-colors",
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
  if (!address) return null;
  return (
    <span className={cn("font-mono text-[15px] font-semibold", dim ? "text-white/35" : "text-white")}>
      {address}
      <span className="font-medium text-white/40">@{domain ?? ""}</span>
    </span>
  );
}

/** 받는 역할 주소 — 작은 회색 태그 */
function RoleTags({ roles, dim }: { roles: RoleAddress[]; dim?: boolean }) {
  if (roles.length === 0) return null;
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
          Cloudflare 실패
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
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 md:px-5 md:py-[18px]">
      <div className="flex items-center gap-2.5">
        <Cohort n={m.cohort} suffix />
        <span className="font-mbc text-[19px] text-white">{m.name}</span>
        <span className="ml-auto font-pretendard text-[13px] text-white/50">{ago(m.registeredAt)} 신청</span>
      </div>
      {m.rosterRole && (
        <p className="font-pretendard text-[13px] text-white/55">
          명단 연결 · {m.cohort}기 {m.name}{m.title ? ` · ${m.title}` : ""}
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
      <div data-tour="members.pending.actions" className="flex flex-wrap items-center gap-2">
        <Seg
          items={choices.map((r) => ({
            key: r,
            label: ASSIGNABLE.find((a) => a.value === r)?.label ?? r,
          }))}
          value={role}
          onChange={setRole}
        />
        <ActionButton className="ml-auto h-11 px-3.5 md:h-9" onClick={onReject} disabled={busy}>
          거절
        </ActionButton>
        <ActionButton tour="members.pending.approve" tone="primary" className="h-11 px-4 md:h-9" onClick={() => onApprove(role)} busy={busy}>
          승인
        </ActionButton>
      </div>
    </div>
  );
}

type Confirm = { title: string; message: string; confirmText: string; run: () => Promise<unknown> } | null;

/** 관리 › 부원 — 초대(QR·코드), 승인 대기, 부원 목록 (부장 이상) */
export default function MembersPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [created, setCreated] = useState<InviteCreated | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  // 기기 목록 창 — 끊으면 목록이 새로 와서 같은 사람의 새 기기 목록을 보인다
  const [devicesId, setDevicesId] = useState<string | null>(null);
  const setDevicesFor = (m: Member) => {
    setSheetId(null);
    setDevicesId(m.id);
  };
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

  const toggle = (
    <PageTabs
      tour="members.view"
      tabs={VIEWS}
      value={view}
      onChange={setView}
      className="max-md:[&>button]:min-h-[44px] max-md:[&>button]:min-w-[52px] max-md:[&>button]:text-[14px]"
    />
  );
  if (view === "crew") return <CrewView toggle={toggle} />;

  if (list.error) {
    return <Notice>{(list.error as Error).message || "부원 목록을 불러오지 못했어요"}</Notice>;
  }

  const members = list.data?.members ?? [];
  const pending = members.filter((m) => m.status === "pending");
  const live = members.filter((m) => m.status === "approved");
  const count = (r: Role) => live.filter((m) => m.role === r).length;
  const sheet = sheetId ? members.find((m) => m.id === sheetId) ?? null : null;
  const devicesOf = devicesId ? members.find((m) => m.id === devicesId) ?? null : null;
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
    run(() => memberApi.update(m.id, { role }), `${m.name} 역할을 ${label}로 바꿨어요`);
  };

  /** 부장 임명 — 앞 기수 부장이 있으면 넘겨받는다 (서버 _hand_over 와 같은 규칙) */
  const appointLead = (m: Member) => {
    const before = members.filter(
      (o) => o.id !== m.id && o.status === "approved" && o.role === "lead" && !o.superadmin && o.cohort != null && m.cohort != null && o.cohort < m.cohort,
    );
    if (!before.length) return setRole(m, "lead");
    setConfirm({
      title: "부장 임명",
      message: `${m.cohort}기 ${m.name} 님을 부장으로 임명할까요?\n${before.map((o) => `${o.cohort}기 ${o.name}`).join(", ")} 님은 부원이 되고 부장 표시는 남아요.`,
      confirmText: "임명",
      run: () => memberApi.update(m.id, { role: "lead" }),
    });
  };

  type MenuItem = { t: string; f: () => void; danger?: boolean };
  /** 부원 한 명의 더 보기 메뉴 (표·폰 카드 같이 쓴다) */
  const menuItems = (m: Member): MenuItem[] => {
    const gone = m.status === "revoked";
    const fixed = m.superadmin;
    const roster = m.rosterOnly && !gone;
    const canProfile = !fixed || isSuperadmin;
    return [
      roster && {
        t: "초대 이어 주기",
        f: () => invite.mutate(m.id),
      },
      canProfile && { t: "소개 고치기", f: () => setProfileFor(profileOf(m, me?.memberId)) },
      !gone &&
        m.role !== "lead" && {
        t: m.wasLead ? `${m.cohort}기 부장 표시 빼기` : `${m.cohort}기 부장으로 표시`,
        f: () =>
          run(
            () => memberApi.update(m.id, { wasLead: !m.wasLead }),
            m.wasLead ? `${m.name} 님 부장 표시를 뺐어요` : `${m.name} 님을 ${m.cohort}기 부장으로 표시했어요`,
          ),
      },
      !fixed &&
        !roster &&
        (m.role === "lead"
          ? { t: "부장 해제", f: () => setRole(m, "member") }
          : { t: "부장 임명", f: () => appointLead(m) }),
      !fixed &&
        m.role !== "alumni" && {
        t: "졸업 처리",
        f: () =>
          setConfirm({
            title: "졸업 처리",
            message: `${m.name} 님을 졸업 처리할까요?\n보기만 할 수 있게 돼요.`,
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
            `${m.personalEmailHint} 로 확인 메일을 보냈어요`,
          ),
      },
      mockMail &&
        m.mailStatus === "pending" && {
          t: "메일 확인 처리",
          f: () => run(() => mailApi.devVerify(m.id), `${m.name} 메일 확인됨`),
        },
      roster && {
        t: "명단에서 지우기",
        danger: true,
        f: () =>
          setConfirm({
            title: "명단에서 지우기",
            message: `${m.cohort}기 ${m.name} 님을 명단에서 지울까요?\n직함·소개도 함께 지워져요.`,
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
            message: `${m.name} 님을 내보낼까요?\n되돌릴 수 없어요.`,
            confirmText: "내보내기",
            run: () => memberApi.revoke(m.id),
          }),
      },
    ].filter((x): x is MenuItem => !!x);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-4 md:overflow-auto">
      {/* 요약 · 초대 */}
      <div data-tour="members.summary" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 md:mr-2">{toggle}</span>
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
            className="flex h-11 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 font-mbc text-sm text-white/70 md:h-10"
          >
            {label}
            <span className="font-mono text-base font-bold tabular-nums text-white">{count(r)}</span>
          </span>
        ))}
        {pending.length > 0 && (
          <span className="flex h-11 items-center gap-2.5 rounded-xl border border-red-400/50 md:h-10 bg-red-400/[0.12] px-4 font-mbc text-sm text-white">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" />
            승인 대기 <span className="font-mono text-base font-bold tabular-nums">{pending.length}</span>
          </span>
        )}
        <div className="grid w-full grid-cols-2 gap-2 md:ml-auto md:flex md:w-auto">
          <ActionButton
            tour="members.export"
            className="h-11 md:h-10"
            icon={<Download size={15} />}
            onClick={() => downloadMembersCsv().catch((e: Error) => toast.error(e.message))}
          >
            명단 내보내기
          </ActionButton>
          <ActionButton tour="members.invite" tone="primary" className="h-11 md:h-10" icon={<UserPlus size={15} />} busy={invite.isPending} onClick={() => invite.mutate("")}>
            새 부원 초대
          </ActionButton>
        </div>
      </div>

      {waiting.length > 0 && (
        <div data-tour="members.invites" className="flex flex-col gap-1.5">
          {(allInvites ? waiting : waiting.slice(0, 2)).map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-pretendard text-[13px] text-white/60 md:flex-nowrap">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF3B3B]" />
              초대 대기{i.memberId && i.note ? ` · ${i.note}` : ""} · {i.createdAt.slice(11, 16)}
              {i.createdBy && ` ${i.createdBy}`} · {hoursLeft(i.expiresAt)}
              {i.codeActive && <span className="text-white/45">· 코드 유효</span>}
              <button
                type="button"
                className="min-h-[44px] rounded-md px-3 font-mbc text-xs text-white/55 hover:bg-white/[0.06] hover:text-white md:min-h-0 md:px-2 md:py-0.5"
                onClick={() => run(() => memberApi.cancelInvite(i.id), "초대를 취소했어요")}
              >
                취소
              </button>
            </div>
          ))}
          {waiting.length > 2 && (
            <button
              type="button"
              onClick={() => setAllInvites((v) => !v)}
              className="min-h-[44px] w-fit pl-4 font-pretendard text-xs text-white/45 hover:text-white/75 md:min-h-0"
            >
              {allInvites ? "접기" : `${waiting.length - 2}개 더 보기`}
            </button>
          )}
        </div>
      )}

      {/* 승인 대기 */}
      {pending.length > 0 && (
        <Panel tour="members.pending" title="승인 대기" className="max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none max-md:backdrop-blur-none">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,460px),1fr))] gap-3">
            {pending.map((m) => (
              <PendingCard
                key={m.id}
                m={m}
                domain={domain}
                busy={act.isPending}
                onApprove={(role) => run(() => memberApi.approve(m.id, role), `${m.name} 님을 승인했어요`)}
                onReject={() =>
                  setConfirm({
                    title: "등록 거절",
                    message: `${m.cohort}기 ${m.name} 님의 등록을 거절할까요?\n되돌릴 수 없어요.`,
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
      <Panel tour="members.table" title="부원" className="max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none max-md:backdrop-blur-none">
        <Seg
          tour="members.filter"
          items={FILTERS}
          value={filter}
          onChange={setFilter}
          className="no-scrollbar -mx-4 flex flex-nowrap overflow-x-auto px-4 pb-1 pt-0.5 md:mx-0 md:pt-0 md:inline-flex md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
        />

        {/* 폰 — 기수별 묶음, 누르면 아래에서 올라오는 시트 */}
        <div className="mt-3 flex flex-col md:hidden">
          {shown.length === 0 ? (
            <p className="px-3 py-8 text-center font-pretendard text-sm text-white/45">
              {list.isLoading ? "불러오는 중…" : filter === "all" ? "부원이 없어요" : "해당하는 사람이 없어요"}
            </p>
          ) : (
            byCohort(shown).map(([cohort, people]) => (
              <section key={cohort}>
                <div className="mb-2 mt-3 flex justify-between px-1 font-orbitron text-[11px] tracking-[0.2em] text-white/40 first:mt-0">
                  <span>{String(cohort).padStart(2, "0")}기</span>
                  <span>{people.length}명</span>
                </div>
                <div className="overflow-hidden rounded-[20px] border border-white/[0.09] bg-white/[0.045] backdrop-blur-md">
                  {people.map((m, k) => {
                    const gone = m.status === "revoked";
                    return (
                      <button
                        key={m.id}
                        type="button"
                        data-tour={k === 0 ? "members.row-menu" : undefined}
                        onClick={() => setSheetId(m.id)}
                        className={cn(
                          "flex min-h-[52px] w-full items-center gap-2 border-t border-white/[0.06] px-4 py-2.5 text-left first:border-t-0 active:bg-white/[0.06]",
                          gone && "opacity-50",
                        )}
                      >
                        <span className="min-w-0 truncate font-pretendard text-[15.5px] font-bold text-white">{m.name}</span>
                        <RoleChip m={m} />
                        <span className="ml-auto flex items-center gap-1.5">
                          <StatusIcon on={m.mailStatus === "active"} warn={m.mailStatus === "pending"} label="메일">
                            <Mail size={12} strokeWidth={2.4} />
                          </StatusIcon>
                          <StatusIcon on={m.discordLinked} label="디스코드">
                            <MessageCircle size={12} strokeWidth={2.4} />
                          </StatusIcon>
                          <ChevronRight size={16} className="text-white/35" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
        {devicesOf && (
          <MemberDevicesModal
            name={devicesOf.name}
            memberId={devicesOf.id}
            devices={devicesOf.devices ?? []}
            onClose={() => setDevicesId(null)}
          />
        )}
        {sheet && (
          <MemberSheet
            m={sheet}
            domain={domain}
            busy={act.isPending}
            isSuperadmin={isSuperadmin}
            onClose={() => setSheetId(null)}
            onRole={(role) => setRole(sheet, role)}
            onDevices={() => setDevicesFor(sheet)}
            items={menuItems(sheet).filter((x) => x.t !== "부장 임명" && x.t !== "부장 해제")}
          />
        )}<div className="mt-3 flex flex-col gap-2.5 md:hidden">
          {shown.length === 0 ? (
            <p className="px-3 py-8 text-center font-pretendard text-sm text-white/45">
              {list.isLoading ? "불러오는 중…" : filter === "all" ? "부원이 없어요" : "해당하는 사람이 없어요"}
            </p>
          ) : (
            shown.map((m) => {
              const gone = m.status === "revoked";
              const fixed = m.superadmin;
              const roster = m.rosterOnly && !gone;
              const canProfile = !fixed || isSuperadmin;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "relative flex flex-col gap-2.5 rounded-[20px] border border-white/[0.09] bg-white/[0.045] px-4 py-3.5 backdrop-blur-md",
                    gone && "text-white/30",
                    menu === m.id && "z-30",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={cn(gone && "opacity-50")}>
                      <Cohort n={m.cohort} />
                    </span>
                    <span className={cn("min-w-0 truncate font-mbc text-[17px]", gone ? "text-white/35" : "text-white")}>{m.name}</span>
                    {(m.wasLead || m.role === "lead") && !gone && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF3B3B]" />
                    )}
                    {roster && <RosterTag />}
                    <span className="ml-auto" />
                    {!gone && (canProfile || m.mailStatus === "pending") && (
                      <button
                        type="button"
                        data-tour="members.row-menu"
                        aria-label={`${m.name} 더 보기`}
                        onClick={() => setMenu(menu === m.id ? null : m.id)}
                        className="-my-1.5 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/75 active:bg-white/[0.08]"
                      >
                        <MoreHorizontal size={20} />
                      </button>
                    )}
                  </div>
                  {m.title && (
                    <p className={cn("-mt-1.5 truncate font-pretendard text-[13px]", gone ? "text-white/35" : "text-white/60")}>{m.title}</p>
                  )}
                  <div className="flex items-center gap-3">
                    {fixed ? (
                      <b className="font-pretendard text-sm font-bold text-white">최고 관리자</b>
                    ) : gone ? (
                      <span className="font-pretendard text-xs">내보냄{m.hasToken ? " · 토큰 삭제 실패" : ""}</span>
                    ) : (
                      <Select
                        value={m.role}
                        disabled={act.isPending}
                        onChange={(role) => setRole(m, role as AssignableRole)}
                        aria-label={`${m.name} 역할`}
                        options={ASSIGNABLE.filter((r) => !roster || ROSTER_ROLES.includes(r.value))}
                        className="h-11 rounded-[10px] border-white/[0.12] bg-[#0c0d0f] text-sm font-bold focus:border-red-400/70"
                      />
                    )}
                    <span className="ml-auto font-pretendard">
                      <MailState status={m.mailStatus} label={m.mailStatusLabel} error={gone ? "" : m.mailError} />
                    </span>
                  </div>
                  {m.mailAddress && (
                    <div className="-mt-0.5 min-w-0 break-all">
                      <MailAddress address={m.mailAddress} domain={domain} dim={gone} />
                      {m.mailAliases.length > 0 && !gone && (
                        <p className="mt-0.5 font-mono text-xs text-white/40">
                          예전 {m.mailAliases[0].address}@ · {m.mailAliases[0].expiresAt.slice(5, 10).replace("-", ".")}까지
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-pretendard text-[13px]">
                    <RoleTags roles={m.mailRoles} dim={gone} />
                    <span className="text-white/45">
                      디스코드{" "}
                      <span className={m.discordLinked ? (gone ? "text-white/35" : "text-white") : "text-white/45"}>
                        {m.discordLinked ? "연결" : "없음"}
                      </span>
                    </span>
                    {!gone && m.tokenExpiresAt && (
                      <span className="text-white/45">
                        기기 키 만료 <span className="font-mono tabular-nums text-white">{m.tokenExpiresAt.slice(0, 10)}</span>
                      </span>
                    )}
                  </div>
                  {menu === m.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                      <div className="absolute right-3 top-12 z-20 flex min-w-[200px] flex-col rounded-xl border border-white/10 bg-[#161616] p-1.5 text-left shadow-2xl">
                        {menuItems(m).map((x) => (
                          <button
                            key={x.t}
                            type="button"
                            onClick={() => {
                              setMenu(null);
                              x.f();
                            }}
                            className={cn(
                              "h-11 rounded-lg px-3 text-left font-mbc text-[15px] active:bg-white/[0.07]",
                              x.danger ? "text-[#ff9b9b]" : "text-white/80",
                            )}
                          >
                            {x.t}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
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
                <th className="px-3 py-2 text-[13px] font-bold">기기</th>
                <th className="px-3 py-2 text-[13px] font-bold">기기 키 만료</th>
                <th className="w-[52px] px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-white/45">
                    {list.isLoading
                      ? "불러오는 중…"
                      : filter === "all"
                        ? "부원이 없어요"
                        : "해당하는 사람이 없어요"}
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
                              title={m.role === "lead" ? "부장" : `${m.cohort}기 부장`}
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF3B3B]"
                            />
                          )}
                          {roster && <RosterTag />}
                        </div>
                      </td>
                      <td className="max-w-[200px] px-3 py-3">
                        <span className={cn("block truncate", gone || !m.title ? "text-white/35" : "text-white/80")} title={m.title}>
                          {m.title}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {fixed ? (
                          <b className="font-bold text-white">최고 관리자</b>
                        ) : gone ? (
                          <span className="text-xs">내보냄{m.hasToken ? " · 토큰 삭제 실패" : ""}</span>
                        ) : (
                          <Select
                            value={m.role}
                            disabled={act.isPending}
                            onChange={(role) => setRole(m, role as AssignableRole)}
                            aria-label={`${m.name} 역할`}
                            options={ASSIGNABLE.filter((r) => !roster || ROSTER_ROLES.includes(r.value))}
                            className="h-9 rounded-[10px] border-white/[0.12] bg-[#0c0d0f] text-sm font-bold focus:border-red-400/70"
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <MailAddress address={m.mailAddress} dim={gone} />
                        {m.mailAliases.length > 0 && !gone && (
                          <div
                            className="mt-0.5 font-mono text-xs text-white/40"
                            title={m.mailAliases.map((a) => `${a.address}@${domain} ${a.expiresAt.slice(0, 10)}까지`).join("\n")}
                          >
                            예전 {m.mailAliases[0].address}@ · {m.mailAliases[0].expiresAt.slice(5, 10).replace("-", ".")}까지
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
                      <td className="px-3 py-3">
                        {!gone && (m.devices?.length ?? 0) > 0 ? (
                          <button
                            type="button"
                            data-tour="members.devices"
                            onClick={() => setDevicesFor(m)}
                            className="rounded-md px-1.5 py-0.5 font-pretendard text-white underline-offset-4 hover:bg-white/[0.06] hover:underline"
                          >
                            {m.devices!.length}대
                          </button>
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
                              data-tour="members.row-menu"
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
                                  {menuItems(m)
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
            run(() => memberApi.cancelInvite(id), "초대를 취소했어요");
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

      {profileFor && <ProfileModal key={profileFor.id} target={profileFor} onClose={() => setProfileFor(null)} />}

      <InputModal
        isOpen={!!mailFor}
        onClose={() => setMailFor(null)}
        title={`${mailFor?.name ?? ""} · ${String(mailFor?.cohort ?? "").padStart(2, "0")}□@${domain}`}
        placeholder="gildong"
        initialValue={mailFor?.mailId ?? ""}
        confirmText="바꾸기"
        onConfirm={async (v) => {
          if (mailFor)
            run(
              () => memberApi.update(mailFor.id, { mailId: v.trim().toLowerCase() }),
              mailFor.mailAddress ? "메일 주소를 바꿨어요" : "메일 주소를 정했어요",
            );
        }}
      />
    </div>
  );
}
