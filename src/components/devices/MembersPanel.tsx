"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover as P } from "radix-ui";
import { ChevronRight, Crown, Download, KeyRound, Mail, MoreHorizontal, Search, Send, Smartphone, UserPlus, X } from "lucide-react";
import Portal from "@/components/common/Portal";
import InputModal from "@/components/common/InputModal";
import { toast } from "@/components/common/Toast";
import { photoSrc } from "@/components/devices/CardBackground";
import CrewView, { ProfileModal, type ProfileTarget } from "@/components/devices/CrewView";
import InviteModal from "@/components/devices/InviteModal";
import NeonButton from "@/components/common/NeonButton";
import { DeviceIcon } from "@/components/devices/MyDevicesModal";
import { ASSIGNABLE } from "@/components/devices/roleStyle";
import { Notice } from "@/components/hall/HallControls";
import { TimeConfirm, ghostBtn, redBtn } from "@/components/time/TimeToolbar";
import { useMe } from "@/hooks/useMe";
import { usePersistentState } from "@/hooks/usePersistentState";
import { downloadMembersCsv, mailApi, memberApi } from "@/lib/memberApi";
import { cn } from "@/lib/utils";
import type { AssignableRole, InviteCreated, Invite, Member, MemberDevice } from "@/types/member";

/* 관리 › 부원 (시안 A) — 위: 거르기 4개·이름 찾기·목록/카드·명단 내보내기·새 부원 초대
   왼쪽: 기수별 목록 (승인 대기·초대 대기 묶음은 맨 위) / 오른쪽: 고른 사람 자세히 (lg 미만은 아래 시트) */

type Filter = "member" | "teacher" | "alumni" | "revoked";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "member", label: "부원" },
  { key: "teacher", label: "교사" },
  { key: "alumni", label: "졸업" },
  { key: "revoked", label: "퇴출" },
];
const EMPTY: Record<Filter, string> = {
  member: "부원이 없어요",
  teacher: "교사가 없어요",
  alumni: "졸업생이 없어요",
  revoked: "퇴출된 사람이 없어요",
};

/** 부원 탭 보기 — 목록(관리) | 카드(방송부 엔딩 크레딧). 저장된 값과 맞게 key 는 예전 그대로 */
type View = "table" | "crew";
const VIEWS: { key: View; label: string }[] = [
  { key: "table", label: "목록" },
  { key: "crew", label: "카드" },
];

/** 역할 고르기 순서 (시안) */
const ROLE_ORDER: AssignableRole[] = ["member", "lead", "teacher", "alumni"];
/** 명단만 부원이 가질 수 있는 역할 (부장·교사는 초대해서 기기를 등록한 뒤에) */
const ROSTER_ROLES: AssignableRole[] = ["member", "alumni"];
const roleName = (r: string) => ASSIGNABLE.find((a) => a.value === r)?.label ?? r;

const panel = "rounded-[20px] border border-white/[0.08] bg-[rgba(14,14,17,0.74)] backdrop-blur-[10px]";
const two = (n: number) => String(n).padStart(2, "0");

function filterOf(m: Member): Filter | null {
  if (m.status === "revoked") return "revoked";
  if (m.status !== "approved") return null;
  if (m.role === "teacher") return "teacher";
  if (m.role === "alumni") return "alumni";
  return "member";
}

/** 기수 큰 순서로 묶기 (기수 없으면 맨 뒤) */
function byCohort(list: Member[]): [number | null, Member[]][] {
  const map = new Map<number | null, Member[]>();
  for (const m of list) map.set(m.cohort, [...(map.get(m.cohort) ?? []), m]);
  return [...map.entries()].sort((a, b) => (a[0] == null ? 1 : b[0] == null ? -1 : b[0] - a[0]));
}

const isLeadMark = (m: Member) => m.status !== "revoked" && (m.wasLead || m.role === "lead");
const roleText = (m: Member) =>
  m.status === "revoked" ? "퇴출" : m.superadmin ? "최고 관리자" : roleName(m.role) || m.roleLabel;

/** 2027. 3. 1. */
function dateDots(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

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

function seen(d: MemberDevice): string {
  const iso = d.lastSeenAt ?? d.addedAt;
  if (!iso) return "";
  const t = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const today = new Date().toDateString() === t.toDateString();
  const when = `${today ? "오늘" : `${t.getMonth() + 1}/${t.getDate()}`} ${p(t.getHours())}:${p(t.getMinutes())}`;
  return d.lastSeenAt ? `최근 접속 ${when}` : `${when} ${d.primary ? "등록" : "추가"}`;
}

/** lg(1024px) 이상 — 오른쪽 자세히 패널이 보이는 너비 */
const WIDE = "(min-width: 1024px)";
function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(WIDE);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

/* ---------------------------------------------------------------- 작은 조각 */

function DiscordIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 12h.01M16 12h.01" />
      <path d="M7.5 17.5 6 21c-2-1-3.5-2-4-3 0-5 1.5-9 3-12 1.5-1 3-1.5 5-1.5l1 2h2l1-2c2 0 3.5.5 5 1.5 1.5 3 3 7 3 12-.5 1-2 2-4 3l-1.5-3.5" />
    </svg>
  );
}

/** 세그먼트 — 고른 것만 흰 바탕 (시안 .seg) */
function Seg<T extends string>({
  items,
  value,
  onChange,
  tour,
  itemTour,
  disabled,
  className,
  itemClass,
}: {
  items: { key: T; label: string; count?: number }[];
  value: T | null;
  onChange: (v: T) => void;
  tour?: string;
  /** 있으면 칸마다 data-tour="{itemTour}.{key}" */
  itemTour?: string;
  disabled?: boolean;
  className?: string;
  itemClass?: string;
}) {
  return (
    <div data-tour={tour} role="group" className={cn("flex gap-1 rounded-xl bg-white/[0.05] p-1", className)}>
      {items.map((it) => {
        const on = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            data-tour={itemTour ? `${itemTour}.${it.key}` : undefined}
            onClick={() => onChange(it.key)}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 font-mbc text-[14px] transition-colors disabled:opacity-50 md:h-8 md:text-[13.5px]",
              on ? "bg-white text-[#0b0b0d]" : "text-white/55 hover:text-white",
              itemClass,
            )}
          >
            {it.label}
            {it.count != null && (
              <small className={cn("font-orbitron text-[10.5px] font-semibold tabular-nums", on ? "text-black/45" : "text-white/35")}>
                {it.count}
              </small>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 아바타 — 카드 사진이 있으면 사진, 없으면 이름 두 글자. 명단만은 점선 */
function Avatar({ m, size = 36 }: { m: Member; size?: number }) {
  const [broken, setBroken] = useState("");
  const photo = m.hasPhoto && m.photoUrl && broken !== m.photoUrl ? m.photoUrl : "";
  const roster = m.rosterOnly && m.status !== "revoked";
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-pretendard font-bold",
        roster
          ? "border-[1.5px] border-dashed border-white/25 text-white/40"
          : "bg-[linear-gradient(135deg,#3a3a42,#1c1c20)] text-white",
        m.status === "revoked" && "opacity-50",
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {photo ? (
        <>
          {/* 학교마다 주소가 다른 ONAIR 서버의 이미지 — next/image 원격 도메인 설정을 둘 수 없어 <img> 사용 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoSrc(photo)}
            alt=""
            draggable={false}
            onError={() => setBroken(photo)}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: "grayscale(1)" }}
          />
        </>
      ) : (
        m.name.slice(-2)
      )}
    </span>
  );
}

/** 부장 꼬리표 — 지금 부장은 "부장", 예전 부장은 "n기 부장" */
function LeadTag({ m }: { m: Member }) {
  if (!isLeadMark(m)) return null;
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-[3px] rounded-md border border-[#FF3B3B]/50 bg-[#FF3B3B]/10 px-[7px] font-pretendard text-[11px] font-semibold text-[#ff8a8a]">
      <Crown size={11} strokeWidth={2.2} />
      {m.role === "lead" ? "부장" : `${m.cohort}기 부장`}
    </span>
  );
}

/** 연결 아이콘 하나 — on 흰색 · wait 빨간 테두리 · 그 외 흐림 */
function Conn({ state, label, children, count }: { state: "on" | "wait" | "off"; label: string; children: ReactNode; count?: number }) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "relative flex h-7 w-7 items-center justify-center rounded-lg border",
        state === "on" && "border-white/30 bg-white/[0.06] text-white",
        state === "wait" && "border-[#FF3B3B]/40 text-[#ff8a8a]",
        state === "off" && "border-white/[0.08] text-white/20",
      )}
    >
      {children}
      {count != null && count > 1 && (
        <i className="absolute -right-1 -top-[5px] rounded-md bg-white px-[3px] font-orbitron text-[9px] font-bold not-italic leading-[13px] text-black">
          {count}
        </i>
      )}
    </span>
  );
}

function ConnIcons({ m }: { m: Member }) {
  const n = m.devices?.length ?? (m.hasDevice ? 1 : 0);
  const mail = m.mailStatus === "active" ? "on" : m.mailStatus === "pending" ? "wait" : "off";
  return (
    <span className="flex gap-1.5">
      <Conn state={mail} label={`ONAIR 메일 ${mail === "on" ? "확인됨" : mail === "wait" ? "확인 대기" : "없음"}`}>
        <Mail size={14} strokeWidth={2} />
      </Conn>
      <Conn state={m.discordLinked ? "on" : "off"} label={`디스코드 ${m.discordLinked ? "연결됨" : "없음"}`}>
        <DiscordIcon size={14} />
      </Conn>
      <Conn state={n > 0 ? "on" : "off"} label={`기기 ${n}대`} count={n}>
        <Smartphone size={14} strokeWidth={2} />
      </Conn>
    </span>
  );
}

function InviteBtn({ onClick, busy, tour }: { onClick: () => void; busy?: boolean; tour?: string }) {
  return (
    <button
      type="button"
      data-tour={tour}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-9 shrink-0 items-center gap-[5px] whitespace-nowrap rounded-lg border border-white/[0.18] px-2.5 font-mbc text-[13px] text-white transition-colors hover:bg-white/[0.06] disabled:opacity-50 md:h-7 md:text-[12.5px]"
    >
      <Send size={13} />
      초대
    </button>
  );
}

/** 상태 글자 — 앞에 점 (흰 점 · 빨간 점 · 흐림) */
function Status({ tone, children }: { tone: "on" | "wait" | "off"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "ml-auto flex shrink-0 items-center gap-[5px] font-pretendard text-[12px] font-semibold",
        tone === "on" ? "text-white/75" : tone === "wait" ? "text-[#ff8a8a]" : "text-white/35",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "on" ? "bg-white" : tone === "wait" ? "bg-[#FF3B3B] shadow-[0_0_6px_#FF3B3B]" : "bg-white/25",
        )}
      />
      {children}
    </span>
  );
}

function Kv({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[26px] items-center gap-2 font-pretendard text-[13.5px] font-medium text-white">
      <span className="w-16 shrink-0 text-white/45">{k}</span>
      {children}
    </div>
  );
}

function Sec({ icon, title, extra, tour, children }: { icon: ReactNode; title: string; extra?: ReactNode; tour?: string; children: ReactNode }) {
  return (
    <section data-tour={tour} className="border-t border-white/[0.06] pt-3.5">
      <h5 className="mb-2.5 flex items-center gap-[7px] font-mbc text-[13px] text-white/45">
        {icon}
        {title}
        {extra}
      </h5>
      {children}
    </section>
  );
}

const smallBtn =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-white/[0.14] px-2.5 font-mbc text-[13px] text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40 md:h-7 md:text-[12.5px]";

/* ---------------------------------------------------------------- 줄 */

function MemberRow({
  m,
  selected,
  onPick,
  onInvite,
  inviting,
  first,
}: {
  m: Member;
  selected: boolean;
  onPick: () => void;
  onInvite: () => void;
  inviting: boolean;
  first?: boolean;
}) {
  const gone = m.status === "revoked";
  const roster = m.rosterOnly && !gone;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      data-tour={first ? "members.row" : undefined}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      className={cn(
        "grid min-h-[56px] cursor-pointer grid-cols-[36px_minmax(0,1fr)_auto_16px] items-center gap-3 rounded-xl px-3 py-2 outline-none transition-colors sm:grid-cols-[36px_minmax(0,1fr)_64px_auto_18px] lg:grid-cols-[40px_minmax(0,1fr)_80px_120px_18px]",
        selected
          ? "bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]"
          : "hover:bg-white/[0.035] focus-visible:bg-white/[0.05]",
      )}
    >
      <Avatar m={m} />
      <span className="flex min-w-0 flex-wrap items-center gap-x-[7px] gap-y-0.5">
        <b className={cn("truncate font-pretendard text-[15px] font-bold", gone || roster ? "text-white/60" : "text-white")}>{m.name}</b>
        <LeadTag m={m} />
        {m.title && <small className="min-w-0 truncate font-pretendard text-[12.5px] font-medium text-white/45">{m.title}</small>}
      </span>
      <span className="hidden font-mbc text-[13px] text-white/70 sm:block">{roster ? "" : roleText(m)}</span>
      {roster ? (
        <span className="flex justify-end">
          <InviteBtn onClick={onInvite} busy={inviting} />
        </span>
      ) : (
        <span className={cn(gone && "opacity-50")}>
          <ConnIcons m={m} />
        </span>
      )}
      <ChevronRight size={16} className="text-white/35" />
    </div>
  );
}

function PendingRow({
  m,
  domain,
  busy,
  onApprove,
  onReject,
  first,
}: {
  m: Member;
  domain: string;
  busy: boolean;
  onApprove: (role: AssignableRole) => void;
  onReject: () => void;
  first: boolean;
}) {
  const [role, setRole] = useState<AssignableRole>(m.rosterRole || "member");
  const choices: AssignableRole[] = m.rosterRole ? ["member", "alumni", "lead", "teacher"] : ["member", "lead", "teacher"];
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3">
      <div className="flex items-center gap-3">
        <Avatar m={{ ...m, rosterOnly: true }} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 font-pretendard">
            <b className="text-[15px] font-bold text-white">{m.name}</b>
            {m.cohort != null && <span className="font-orbitron text-[11.5px] font-semibold text-white/50">{two(m.cohort)}기</span>}
            <span className="text-[12.5px] text-white/40">{ago(m.registeredAt)} 신청</span>
          </p>
          {m.rosterRole && (
            <p className="truncate font-pretendard text-[12.5px] text-white/50">
              명단 연결 · {m.cohort}기 {m.name}
              {m.title ? ` · ${m.title}` : ""}
            </p>
          )}
        </div>
      </div>
      {m.intro && <p className="whitespace-pre-wrap pl-12 font-pretendard text-[13.5px] leading-relaxed text-white/75">{m.intro}</p>}
      {m.mailAddress && (
        <p className="flex flex-wrap items-baseline gap-x-2 pl-12 font-pretendard text-[12.5px] text-white/45">
          ONAIR 메일
          <span className="font-orbitron text-[12px] text-white">
            {m.mailAddress}
            <span className="text-white/40">@{domain}</span>
          </span>
          {m.personalEmailHint && <span>→ {m.personalEmailHint}</span>}
        </p>
      )}
      <div data-tour={first ? "members.pending.actions" : undefined} className="flex flex-wrap items-center gap-2 md:pl-12">
        <Seg
          items={choices.map((r) => ({ key: r, label: roleName(r) }))}
          value={role}
          onChange={setRole}
          className="max-md:w-full max-md:[&>button]:flex-1"
        />
        <span className="ml-auto flex gap-2 max-md:w-full">
          <button type="button" disabled={busy} onClick={onReject} className={cn(ghostBtn, "max-md:flex-1 md:h-9")}>
            거절
          </button>
          <button
            type="button"
            data-tour={first ? "members.pending.approve" : undefined}
            disabled={busy}
            onClick={() => onApprove(role)}
            className={cn(redBtn, "max-md:flex-[2] md:h-9")}
          >
            승인
          </button>
        </span>
      </div>
    </div>
  );
}

function InviteWaitRow({ i, onCancel }: { i: Invite; onCancel: () => void }) {
  return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl px-3 py-1.5 font-pretendard text-[13px] text-white/60">
      <Send size={14} className="shrink-0 text-white/40" />
      <span className="min-w-0 flex-1">
        <b className="font-semibold text-white">{i.memberId && i.note ? i.note : "새 부원"}</b>
        <span className="text-white/45">
          {" "}
          · {i.createdAt.slice(11, 16)}
          {i.createdBy && ` ${i.createdBy}`} · {hoursLeft(i.expiresAt)}
        </span>
      </span>
      {i.codeActive && (
        <span className="inline-flex h-[22px] items-center rounded-md bg-white/[0.08] px-[7px] text-[11.5px] font-semibold text-white/70">코드 유효</span>
      )}
      <button type="button" onClick={onCancel} className={smallBtn}>
        취소
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- 자세히 */

type MenuItem = { t: string; f: () => void; danger?: boolean };

function MoreMenu({ items, name }: { items: MenuItem[]; name: string }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger
        data-tour="members.row-menu"
        aria-label={`${name} 더 보기`}
        className="-mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white md:h-9 md:w-9"
      >
        <MoreHorizontal size={18} />
      </P.Trigger>
      <P.Portal>
        <P.Content
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-[900] flex min-w-[200px] flex-col rounded-[16px] border border-white/[0.12] bg-[#141416] p-1.5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.65)] outline-none"
        >
          {items.map((x) => (
            <button
              key={x.t}
              type="button"
              onClick={() => {
                setOpen(false);
                x.f();
              }}
              className={cn(
                "h-11 rounded-[10px] px-3 text-left font-mbc text-[14px] transition-colors hover:bg-white/[0.07] md:h-9 md:text-[13.5px]",
                x.danger ? "text-[#ff8a8a]" : "text-white/80 hover:text-white",
              )}
            >
              {x.t}
            </button>
          ))}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

function Detail({
  m,
  domain,
  busy,
  myId,
  myDeviceId,
  menu,
  onRole,
  onMail,
  onResend,
  onInvite,
  inviting,
  onRemoveDevice,
  onGraduate,
  onRevoke,
  onDeleteRoster,
  onClose,
}: {
  m: Member;
  domain: string;
  busy: boolean;
  myId?: string | null;
  myDeviceId?: string;
  menu: MenuItem[];
  onRole: (role: AssignableRole) => void;
  onMail: () => void;
  onResend: () => void;
  onInvite: () => void;
  inviting: boolean;
  onRemoveDevice: (d: MemberDevice) => void;
  onGraduate: () => void;
  onRevoke: () => void;
  onDeleteRoster: () => void;
  /** 시트일 때만 — 닫기 */
  onClose?: () => void;
}) {
  const gone = m.status === "revoked";
  const fixed = m.superadmin;
  const roster = m.rosterOnly && !gone;
  const devices = m.devices ?? [];
  const roles = ROLE_ORDER.filter((r) => !roster || ROSTER_ROLES.includes(r));
  const mailTone = m.mailStatus === "active" ? "on" : m.mailStatus === "pending" ? "wait" : "off";
  const sub = [m.cohort != null ? `${two(m.cohort)}기` : "", m.title].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <Avatar m={m} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("min-w-0 truncate font-mbc text-[22px]", gone ? "text-white/50" : "text-white")}>{m.name}</span>
            <LeadTag m={m} />
          </div>
          {sub && <p className="mt-1 truncate font-pretendard text-[13px] font-medium text-white/45">{sub}</p>}
        </div>
        <MoreMenu items={menu} name={m.name} />
        {onClose && (
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/55 active:bg-white/10"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div data-tour="members.role">
        <p className="mb-[7px] font-mbc text-[14px] text-white/55">역할</p>
        {gone ? (
          <p className="flex items-center gap-2 font-pretendard text-[14px] font-semibold text-white/60">
            퇴출
            {m.hasToken && <span className="text-[12.5px] font-medium text-[#ff8a8a]">토큰 삭제 실패</span>}
          </p>
        ) : fixed ? (
          <p className="font-pretendard text-[14px] font-bold text-white">최고 관리자</p>
        ) : (
          <Seg
            items={roles.map((r) => ({ key: r, label: roleName(r) }))}
            value={(m.role as AssignableRole) ?? null}
            onChange={onRole}
            disabled={busy}
            className="w-full"
            itemClass="flex-1 md:flex-none md:px-3.5"
          />
        )}
      </div>

      <Sec tour="members.mail" icon={<Mail size={15} />} title="ONAIR 메일">
        <Kv k="주소">
          {m.mailAddress ? (
            <span className={cn("min-w-0 truncate font-orbitron text-[12.5px]", gone ? "text-white/40" : "text-white")} title={`${m.mailAddress}@${domain}`}>
              {m.mailAddress}
              <span className="text-white/40">@{domain}</span>
            </span>
          ) : (
            <span className="text-white/35">없음</span>
          )}
          {m.mailAddress && <Status tone={mailTone}>{m.mailStatusLabel}</Status>}
        </Kv>
        {!gone && m.mailError && (
          <Kv k="">
            <span className="truncate text-[12.5px] text-[#ff8a8a]" title={m.mailError}>
              Cloudflare 실패
            </span>
          </Kv>
        )}
        {m.personalEmailHint && (
          <Kv k="개인 메일">
            <span className="min-w-0 truncate text-white/75">{m.personalEmailHint}</span>
          </Kv>
        )}
        {m.mailRoles.length > 0 && (
          <Kv k="받는 주소">
            <span className={cn("flex flex-wrap gap-1.5", gone && "opacity-50")}>
              {m.mailRoles.map((r) => (
                <span key={r} className="inline-flex h-[22px] items-center rounded-md bg-white/[0.08] px-[7px] text-[11.5px] font-semibold">
                  {r}@
                </span>
              ))}
            </span>
          </Kv>
        )}
        {!gone &&
          m.mailAliases.map((a) => (
            <Kv key={a.address} k="예전 주소">
              <span className="min-w-0 truncate font-orbitron text-[12px] text-white/55" title={`${a.address}@${domain}`}>
                {a.address}@
              </span>
              <span className="ml-auto shrink-0 text-[12px] text-white/40">{dateDots(a.expiresAt)}까지</span>
            </Kv>
          ))}
        {!gone && !fixed && (
          <div className="mt-2 flex gap-1.5">
            <button type="button" data-tour="members.mail.change" onClick={onMail} className={smallBtn}>
              {m.mailAddress ? "메일 바꾸기" : "메일 정하기"}
            </button>
            {m.mailStatus === "pending" && (
              <button type="button" data-tour="members.mail.resend" disabled={busy} onClick={onResend} className={smallBtn}>
                다시 보내기
              </button>
            )}
          </div>
        )}
      </Sec>

      <Sec tour="members.discord" icon={<DiscordIcon />} title="디스코드">
        <Kv k="계정">
          <span className={cn("min-w-0 truncate", m.discordLinked ? "font-orbitron text-[12px] text-white/75" : "text-white/35")}>
            {m.discordLinked ? m.discordId || "연결됨" : "없음"}
          </span>
          {m.discordLinked && <Status tone="on">연결됨</Status>}
        </Kv>
      </Sec>

      <Sec
        tour="members.devices"
        icon={<Smartphone size={15} />}
        title="기기"
        extra={
          <>
            {devices.length > 0 && <span className="font-orbitron text-[11px] text-white/40">{devices.length}</span>}
            {!gone && m.tokenExpiresAt && (
              <span className="ml-auto flex items-center gap-1 font-pretendard text-[12px] text-white/45" title="접속 키 만료">
                <KeyRound size={12} />
                {dateDots(m.tokenExpiresAt)}까지
              </span>
            )}
          </>
        }
      >
        {devices.length === 0 ? (
          <div className="flex items-center gap-2">
            <span className="font-pretendard text-[13.5px] text-white/35">{roster ? "가입 전" : "없음"}</span>
            {roster && (
              <span className="ml-auto">
                <InviteBtn onClick={onInvite} busy={inviting} tour="members.detail.invite" />
              </span>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {devices.map((d) => {
              const current = !!myId && myId === m.id && d.id === myDeviceId;
              const canRemove = !gone && !current && devices.length > 1;
              return (
                <li
                  key={d.id}
                  className={cn(
                    "flex min-h-[44px] items-center gap-2.5 rounded-[11px] border border-white/[0.06] bg-black/30 px-3 py-1.5",
                    gone && "opacity-50",
                  )}
                >
                  <span className="text-white/70">
                    <DeviceIcon name={d.name} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-pretendard text-[13.5px] font-medium text-white">{d.name}</span>
                    <span className="block truncate font-pretendard text-[11.5px] text-white/40">{current ? "이 기기" : seen(d)}</span>
                  </span>
                  {canRemove && (
                    <button type="button" onClick={() => onRemoveDevice(d)} className={smallBtn}>
                      끊기
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Sec>

      {!gone && !fixed && (
        <div data-tour="members.actions" className="mt-auto flex gap-2 pt-2">
          {m.role !== "alumni" && (
            <button type="button" disabled={busy} onClick={onGraduate} className={cn(ghostBtn, "flex-1 md:h-[38px]")}>
              졸업 처리
            </button>
          )}
          {roster ? (
            <button
              type="button"
              disabled={busy}
              onClick={onDeleteRoster}
              className="flex h-11 flex-1 items-center justify-center rounded-[11px] border border-[#FF3B3B]/45 font-mbc text-[13.5px] text-[#ff7b7b] transition-colors hover:bg-[#FF3B3B]/10 disabled:opacity-40 md:h-[38px]"
            >
              명단에서 지우기
            </button>
          ) : (
            <button
              type="button"
              data-tour="members.revoke"
              disabled={busy}
              onClick={onRevoke}
              className="flex h-11 flex-1 items-center justify-center rounded-[11px] border border-[#FF3B3B]/45 font-mbc text-[13.5px] text-[#ff7b7b] transition-colors hover:bg-[#FF3B3B]/10 disabled:opacity-40 md:h-[38px]"
            >
              퇴출
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- 본체 */

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

type Confirm = { title: string; message: string; confirmText: string; done: string; danger?: boolean; run: () => Promise<unknown> } | null;

/** 관리 › 부원 — 초대(QR·코드), 승인 대기, 부원 목록·자세히 (부장 이상) */
export default function MembersPanel() {
  const qc = useQueryClient();
  const wide = useWide();
  const [filter, setFilter] = useState<Filter>("member");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [created, setCreated] = useState<InviteCreated | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [mailFor, setMailFor] = useState<Member | null>(null);
  const [allInvites, setAllInvites] = useState(false);
  const [profileFor, setProfileFor] = useState<ProfileTarget | null>(null);
  const [view, setView] = usePersistentState<View>("onair.members.view", "table");
  const { me, isSuperadmin } = useMe();

  const list = useQuery({ queryKey: ["members"], queryFn: memberApi.list, refetchInterval: 5000 });
  const invites = useQuery({ queryKey: ["member-invites"], queryFn: memberApi.invites, refetchInterval: 15000 });

  // 시트는 Esc 로도 닫는다
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["member-invites"] });
    qc.invalidateQueries({ queryKey: ["crew"] });
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
      setSheetOpen(false);
      setCreated(res);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const members = useMemo(() => list.data?.members ?? [], [list.data]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { member: 0, teacher: 0, alumni: 0, revoked: 0 };
    for (const m of members) {
      const f = filterOf(m);
      if (f) c[f] += 1;
    }
    return c;
  }, [members]);

  const toggle = (
    <Seg
      itemTour="members.view"
      items={VIEWS}
      value={view}
      onChange={setView}
      itemClass="md:px-3.5"
    />
  );
  if (view === "crew") return <CrewView toggle={toggle} />;

  if (list.error) {
    return <Notice>{(list.error as Error).message || "부원 목록을 불러오지 못했어요"}</Notice>;
  }

  const needle = q.trim().toLowerCase();
  const match = (m: Member) =>
    !needle || m.name.toLowerCase().includes(needle) || (m.title ?? "").toLowerCase().includes(needle) || m.mailAddress.includes(needle);
  const pending = filter === "revoked" ? [] : members.filter((m) => m.status === "pending" && match(m));
  const shown = members.filter((m) => filterOf(m) === filter && match(m));
  const groups = byCohort(shown);
  const waiting = filter === "revoked" ? [] : invites.data?.invites ?? [];
  const domain = list.data?.mail?.domain ?? "bssmcast.com";
  const mockMail = list.data?.mail?.driver === "mock";

  // PC 는 고른 사람이 지금 목록에 없으면 첫 사람
  const picked = selId ? members.find((m) => m.id === selId) ?? null : null;
  const selected = wide ? (picked && shown.some((m) => m.id === picked.id) ? picked : shown[0] ?? null) : picked;

  const pick = (m: Member) => {
    setSelId(m.id);
    if (!wide) setSheetOpen(true);
  };

  const setRole = (m: Member, role: AssignableRole) => {
    if (role === m.role) return;
    run(() => memberApi.update(m.id, { role }), `${m.name} 역할을 ${roleName(role)}로 바꿨어요`);
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
      done: `${m.name} 님을 부장으로 임명했어요`,
      run: () => memberApi.update(m.id, { role: "lead" }),
    });
  };

  const onRole = (m: Member, role: AssignableRole) => (role === "lead" ? appointLead(m) : setRole(m, role));

  /** ⋯ 메뉴 — 역할·메일·졸업·퇴출은 자세히 패널에 있다 */
  const menuItems = (m: Member): MenuItem[] => {
    const gone = m.status === "revoked";
    if (gone) return [];
    const fixed = m.superadmin;
    const roster = m.rosterOnly;
    const canProfile = !fixed || isSuperadmin;
    return [
      roster && { t: "초대 이어 주기", f: () => invite.mutate(m.id) },
      canProfile && {
        t: "소개 고치기",
        f: () => {
          setSheetOpen(false);
          setProfileFor(profileOf(m, me?.memberId));
        },
      },
      m.role !== "lead" && {
        t: m.wasLead ? `${m.cohort}기 부장 표시 빼기` : `${m.cohort}기 부장으로 표시`,
        f: () =>
          run(
            () => memberApi.update(m.id, { wasLead: !m.wasLead }),
            m.wasLead ? `${m.name} 님 부장 표시를 뺐어요` : `${m.name} 님을 ${m.cohort}기 부장으로 표시했어요`,
          ),
      },
      mockMail && m.mailStatus === "pending" && { t: "메일 확인 처리", f: () => run(() => mailApi.devVerify(m.id), `${m.name} 메일 확인됨`) },
    ].filter((x): x is MenuItem => !!x);
  };

  const detail = (m: Member, onClose?: () => void) => (
    <Detail
      m={m}
      domain={domain}
      busy={act.isPending}
      myId={me?.memberId}
      myDeviceId={me?.deviceId}
      menu={menuItems(m)}
      onClose={onClose}
      onRole={(role) => onRole(m, role)}
      onMail={() => setMailFor(m)}
      onResend={() => run(() => mailApi.resend(m.id), `${m.personalEmailHint || m.name} 로 확인 메일을 보냈어요`)}
      onInvite={() => invite.mutate(m.id)}
      inviting={invite.isPending}
      onRemoveDevice={(d) =>
        setConfirm({
          title: "기기 끊기",
          message: `${m.name} 님의 ${d.name}에서는 더 이상 ONAIR에 들어올 수 없어요.`,
          confirmText: "끊기",
          done: "기기를 끊었어요",
          danger: true,
          run: () => memberApi.removeDevice(m.id, d.id),
        })
      }
      onGraduate={() =>
        setConfirm({
          title: "졸업 처리",
          message: `${m.name} 님을 졸업 처리할까요?\n보기만 할 수 있게 돼요.`,
          confirmText: "졸업 처리",
          done: `${m.name} 님을 졸업 처리했어요`,
          run: () => memberApi.graduate(m.id),
        })
      }
      onRevoke={() =>
        setConfirm({
          title: "부원 퇴출",
          message: `${m.name} 님을 퇴출할까요?\n되돌릴 수 없어요.`,
          confirmText: "퇴출",
          done: `${m.name} 님을 퇴출했어요`,
          danger: true,
          run: () => memberApi.revoke(m.id),
        })
      }
      onDeleteRoster={() =>
        setConfirm({
          title: "명단에서 지우기",
          message: `${m.cohort}기 ${m.name} 님을 명단에서 지울까요?\n직함·소개도 함께 지워져요.`,
          confirmText: "지우기",
          done: `${m.name} 님을 명단에서 지웠어요`,
          danger: true,
          run: () => memberApi.deleteRoster(m.id),
        })
      }
    />
  );

  const firstId = groups[0]?.[1][0]?.id;

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-152px)] lg:min-h-[560px]">
      {/* 거르기 · 찾기 · 보기 · 내보내기 · 초대 */}
      <div data-tour="members.summary" className="flex flex-wrap items-center gap-2">
        <Seg
          tour="members.filter"
          items={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))}
          value={filter}
          onChange={setFilter}
          className="max-md:w-full"
          itemClass="max-md:flex-1"
        />
        <label
          data-tour="members.search"
          className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[11px] border border-white/10 bg-[#0c0d0f] px-3.5 md:h-10 md:w-[200px] md:flex-none"
        >
          <Search size={15} className="shrink-0 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름 찾기"
            aria-label="이름 찾기"
            className="min-w-0 flex-1 bg-transparent font-pretendard text-[15px] text-white outline-none placeholder:text-white/35 md:text-[13.5px]"
          />
          {q && (
            <button type="button" aria-label="지우기" onClick={() => setQ("")} className="shrink-0 text-white/40 hover:text-white">
              <X size={14} />
            </button>
          )}
        </label>
        <span className="md:ml-auto">{toggle}</span>
        <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2 md:flex md:w-auto">
          <button
            type="button"
            data-tour="members.export"
            onClick={() => downloadMembersCsv().catch((e: Error) => toast.error(e.message))}
            className={cn(ghostBtn, "md:h-10")}
          >
            <Download size={15} />
            명단 내보내기
          </button>
          <NeonButton data-tour="members.invite" disabled={invite.isPending} onClick={() => invite.mutate("")} icon={<UserPlus />}>
            새 부원 초대
          </NeonButton>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* 목록 */}
        <section
          data-tour="members.table"
          className={cn(panel, "min-h-0 px-1.5 py-1.5 max-md:-mx-1 max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:backdrop-blur-none md:px-2 lg:overflow-y-auto [scrollbar-width:thin]")}
        >
          {pending.length > 0 && (
            <div data-tour="members.pending" className="pb-2">
              <div className="flex items-baseline gap-2 px-3 pb-1.5 pt-3.5 font-mbc text-[14px] text-white">
                <span className="h-2 w-2 self-center rounded-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" />
                승인 대기
                <span className="font-orbitron text-[12px] font-semibold text-white/50">{pending.length}</span>
              </div>
              <div className="flex flex-col gap-2 px-1">
                {pending.map((m, k) => (
                  <PendingRow
                    key={m.id}
                    m={m}
                    domain={domain}
                    first={k === 0}
                    busy={act.isPending}
                    onApprove={(role) => run(() => memberApi.approve(m.id, role), `${m.name} 님을 승인했어요`)}
                    onReject={() =>
                      setConfirm({
                        title: "등록 거절",
                        message: `${m.cohort}기 ${m.name} 님의 등록을 거절할까요?\n되돌릴 수 없어요.`,
                        confirmText: "거절",
                        done: `${m.name} 님의 등록을 거절했어요`,
                        danger: true,
                        run: () => memberApi.revoke(m.id),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {waiting.length > 0 && (
            <div data-tour="members.invites" className="pb-1">
              <div className="flex items-baseline gap-2 px-3 pb-1 pt-3.5 font-mbc text-[14px] text-white/50">
                초대 대기
                <span className="font-orbitron text-[12px] font-semibold text-white/35">{waiting.length}</span>
                {waiting.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setAllInvites((v) => !v)}
                    className="ml-auto min-h-[36px] font-pretendard text-[12.5px] text-white/45 hover:text-white/80"
                  >
                    {allInvites ? "접기" : `${waiting.length - 2}개 더 보기`}
                  </button>
                )}
              </div>
              {(allInvites ? waiting : waiting.slice(0, 2)).map((i) => (
                <InviteWaitRow key={i.id} i={i} onCancel={() => run(() => memberApi.cancelInvite(i.id), "초대를 취소했어요")} />
              ))}
            </div>
          )}

          {shown.length === 0 ? (
            <p className="px-3 py-16 text-center font-pretendard text-[15px] text-white/35">
              {list.isLoading ? "불러오는 중…" : needle ? "찾는 사람이 없어요" : EMPTY[filter]}
            </p>
          ) : (
            groups.map(([cohort, people]) => (
              <div key={cohort ?? "none"}>
                <div className="flex items-baseline gap-2 px-3 pb-1.5 pt-3.5 font-mbc text-[14px] text-white/50">
                  {cohort != null ? (
                    <>
                      <b className="font-orbitron text-[15px] font-bold text-white">{two(cohort)}</b>기
                    </>
                  ) : (
                    "기수 없음"
                  )}
                  <span className="font-pretendard text-[12px] font-medium text-white/30">{people.length}명</span>
                </div>
                {people.map((m) => (
                  <MemberRow
                    key={m.id}
                    m={m}
                    first={m.id === firstId}
                    selected={wide && selected?.id === m.id}
                    onPick={() => pick(m)}
                    onInvite={() => invite.mutate(m.id)}
                    inviting={invite.isPending}
                  />
                ))}
              </div>
            ))
          )}
        </section>

        {/* 자세히 (PC) */}
        <aside data-tour="members.detail" className={cn(panel, "hidden min-h-0 overflow-y-auto p-[22px] [scrollbar-width:thin] lg:block")}>
          {selected ? (
            detail(selected)
          ) : (
            <p className="py-16 text-center font-pretendard text-[15px] text-white/35">{list.isLoading ? "불러오는 중…" : EMPTY[filter]}</p>
          )}
        </aside>
      </div>

      {/* 자세히 (폰·태블릿) — 아래에서 올라오는 시트 */}
      {!wide && sheetOpen && picked && (
        <Portal>
          <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label={picked.name}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSheetOpen(false)} />
            <div
              data-tour="members.sheet"
              className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[24px] border-t border-white/[0.12] bg-[#121214] px-[18px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-20px_50px_rgba(0,0,0,.6)] md:mx-auto md:max-w-[560px] md:rounded-t-[26px] md:border-x"
            >
              <span className="mx-auto mb-2 block h-[5px] w-10 rounded-full bg-white/20" />
              {detail(picked, () => setSheetOpen(false))}
            </div>
          </div>
        </Portal>
      )}

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

      <TimeConfirm
        open={!!confirm}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmText={confirm?.confirmText ?? "확인"}
        danger={confirm?.danger}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) run(confirm.run, confirm.done);
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
