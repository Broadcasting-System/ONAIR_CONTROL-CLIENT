"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MoreHorizontal, UserPlus } from "lucide-react";
import ConfirmModal from "@/components/common/ConfirmModal";
import InputModal from "@/components/common/InputModal";
import { toast } from "@/components/common/Toast";
import InviteModal from "@/components/devices/InviteModal";
import { ASSIGNABLE } from "@/components/devices/roleStyle";
import { Notice, Panel } from "@/components/hall/HallControls";
import { ActionButton } from "@/components/hall/setup/ui";
import { downloadMembersCsv, memberApi } from "@/lib/memberApi";
import { cn } from "@/lib/utils";
import type { AssignableRole, InviteCreated, Member, Role } from "@/types/member";

type Filter = "all" | "lead" | "member" | "teacher" | "alumni" | "revoked";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "lead", label: "부장" },
  { key: "member", label: "부원" },
  { key: "teacher", label: "교사" },
  { key: "alumni", label: "졸업" },
  { key: "revoked", label: "내보냄" },
];

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

function PendingCard({
  m,
  busy,
  onApprove,
  onReject,
}: {
  m: Member;
  busy: boolean;
  onApprove: (role: AssignableRole) => void;
  onReject: () => void;
}) {
  const [role, setRole] = useState<AssignableRole>("member");
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 px-5 py-[18px]">
      <div className="flex items-center gap-2.5">
        <Cohort n={m.cohort} suffix />
        <span className="font-mbc text-[19px] text-white">{m.name}</span>
        <span className="ml-auto font-pretendard text-[13px] text-white/50">{ago(m.registeredAt)} 신청</span>
      </div>
      {m.intro && <p className="whitespace-pre-wrap font-pretendard text-sm leading-relaxed text-white/80">{m.intro}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Seg
          items={(["member", "lead", "teacher"] as AssignableRole[]).map((r) => ({
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

/** 기기·부원 관리 › 부원 — 초대(QR·코드), 승인 대기, 부원 목록 (부장 이상) */
export default function MembersPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [created, setCreated] = useState<InviteCreated | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [mailFor, setMailFor] = useState<Member | null>(null);
  const [allInvites, setAllInvites] = useState(false);

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

  const invite = useMutation({
    mutationFn: () => memberApi.createInvite(),
    onSuccess: (res) => {
      setCreated(res);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
        : m.status === "approved" && m.role === filter,
  );
  const waiting = invites.data?.invites ?? [];

  const setRole = (m: Member, role: AssignableRole) => {
    if (role === m.role) return;
    const label = ASSIGNABLE.find((r) => r.value === role)?.label ?? role;
    run(() => memberApi.update(m.id, { role }), `${m.name} — ${label}(으)로 바꿨어요.`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto pb-4">
      {/* 요약 · 초대 */}
      <div className="flex flex-wrap items-center gap-2">
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
          <ActionButton tone="primary" icon={<UserPlus size={15} />} busy={invite.isPending} onClick={() => invite.mutate()}>
            새 부원 초대
          </ActionButton>
        </div>
      </div>

      {waiting.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {(allInvites ? waiting : waiting.slice(0, 2)).map((i) => (
            <div key={i.id} className="flex items-center gap-2.5 font-pretendard text-[13px] text-white/60">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF3B3B]" />
              기다리는 초대 · {i.createdAt.slice(11, 16)} {i.createdBy && `${i.createdBy} `}만듦 · {hoursLeft(i.expiresAt)}
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-3">
            {pending.map((m) => (
              <PendingCard
                key={m.id}
                m={m}
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
      <Panel title="부원" hint="역할을 바꾸면 그 기기에 바로 반영돼요 · 마지막 부장은 내려놓을 수 없어요">
        <Seg items={FILTERS} value={filter} onChange={setFilter} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left font-pretendard text-sm">
            <thead className="text-white/50">
              <tr className="border-b border-white/[0.07]">
                <th className="w-[70px] px-3 py-2 text-[13px] font-bold">기수</th>
                <th className="px-3 py-2 text-[13px] font-bold">이름</th>
                <th className="px-3 py-2 text-[13px] font-bold">역할</th>
                <th className="px-3 py-2 text-[13px] font-bold">디스코드</th>
                <th className="px-3 py-2 text-[13px] font-bold">기기 키 만료</th>
                <th className="w-[52px] px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-white/45">
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
                  return (
                    <tr key={m.id} className={cn("border-b border-white/[0.07]", gone && "text-white/30")}>
                      <td className={cn("px-3 py-3", gone && "opacity-50")}>
                        <Cohort n={m.cohort} />
                      </td>
                      <td className="px-3 py-3">
                        <div className={cn("flex items-center gap-2.5 font-mbc text-base", gone ? "text-white/35" : "text-white")}>
                          {m.name}
                          {m.mailLocalPart && (
                            <span className="font-pretendard text-xs text-white/45">{m.mailLocalPart}@bssmcast.com</span>
                          )}
                        </div>
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
                            {ASSIGNABLE.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        )}
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
                        {!fixed && !gone && (
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
                                    m.role === "lead"
                                      ? { t: "부장 해제", f: () => setRole(m, "member") }
                                      : { t: "부장 임명", f: () => setRole(m, "lead") },
                                    m.role !== "alumni" && {
                                      t: "졸업 처리",
                                      f: () =>
                                        setConfirm({
                                          title: "졸업 처리",
                                          message: `${m.name} 님을 졸업 처리할까요?\n기기는 그대로 두고 보기만 할 수 있게 됩니다.`,
                                          confirmText: "졸업 처리",
                                          run: () => memberApi.graduate(m.id),
                                        }),
                                    },
                                    { t: "메일 주소 정하기", f: () => setMailFor(m) },
                                    {
                                      t: "내보내기",
                                      danger: true,
                                      f: () =>
                                        setConfirm({
                                          title: "부원 내보내기",
                                          message: `${m.name} 님을 내보낼까요?\n이 기기의 Cloudflare 토큰을 지워 더는 ONAIR 에 들어올 수 없습니다.`,
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

      <InputModal
        isOpen={!!mailFor}
        onClose={() => setMailFor(null)}
        title={`${mailFor?.name ?? ""} — 메일 주소 앞부분 (@bssmcast.com)`}
        placeholder="예: 07honggildong (비우면 지움)"
        initialValue={mailFor?.mailLocalPart ?? ""}
        onConfirm={async (v) => {
          if (mailFor) run(() => memberApi.update(mailFor.id, { mailLocalPart: v.trim() }), "메일 주소를 저장했어요.");
        }}
      />
    </div>
  );
}
