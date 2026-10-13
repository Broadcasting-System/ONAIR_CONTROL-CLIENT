"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "@/components/common/Toast";
import {
  BgTile,
  CardBackground,
  PhotoLayer,
  WaveCanvas,
  photoProblem,
  tileBtn,
} from "@/components/devices/CardBackground";
import { Notice } from "@/components/hall/HallControls";
import { ActionButton } from "@/components/hall/setup/ui";
import { memberApi } from "@/lib/memberApi";
import { cn } from "@/lib/utils";
import type { CardBg, CrewMember } from "@/types/member";

const TITLE_MAX = 40;
const BIO_MAX = 1000;
const RED = "#FF3B3B";

const two = (n: number) => String(n).padStart(2, "0");
const rank = (lead: boolean) => (lead ? "부장" : "부원");

/** 소개글이 비었을 때 — "방송부 4기 부원 서정현입니다." */
export function defaultBio(p: { cohort: number | null; name: string; lead: boolean }): string {
  return `방송부 ${p.cohort ?? "?"}기 ${rank(p.lead)} ${p.name}입니다.`;
}

/** 이름 아래 작은 줄 — 직함, 없으면 "4기 부원" */
const nameLine = (p: CrewMember) => p.title || `${p.cohort}기 ${rank(p.lead)}`;

/** 기수 숫자 — 졸업 기수는 외곽선만, 지금 기수는 하얗게 */
function CohortNumber({ n, on, size, stroke }: { n: number; on: boolean; size: number; stroke: string }) {
  return (
    <span
      className="block font-orbitron font-black leading-[0.9]"
      style={{
        fontSize: size,
        color: on ? "#fff" : "transparent",
        WebkitTextStroke: on ? "0" : stroke,
        textShadow: on ? "0 0 24px rgba(255,255,255,0.2)" : undefined,
      }}
    >
      {two(n)}
    </span>
  );
}

/* ---------------- 오른쪽: 송출 모니터 같은 프로필 ---------------- */

function Monitor({ p }: { p: CrewMember }) {
  const live = p.role !== "alumni";
  return (
    <div data-tour="crew.card" className="relative aspect-[16/10] overflow-hidden rounded-[18px] border border-black bg-[#050506] shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      {/* 배경 — 부원마다 ① 소리 파형(이름으로 만든 그림) 또는 ③ 본인 사진 */}
      <CardBackground key={p.id} name={p.name} cohort={p.cohort} cardBg={p.cardBg} photoUrl={p.photoUrl} />
      {/* 큰 기수 숫자 워터마크 */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-1.5 -top-5 select-none font-orbitron text-[130px] font-black leading-none tracking-[-0.04em] md:-right-2.5 md:-top-10 md:text-[250px]"
        style={{ color: "transparent", WebkitTextStroke: "1.5px rgba(255,255,255,0.14)" }}
      >
        {two(p.cohort)}
      </span>
      <div className="absolute left-3 top-3 md:left-[18px] md:top-4">
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-md px-2.5 font-orbitron text-[10px] font-bold tracking-[0.2em]",
            live ? "bg-[#FF3B3B] text-white shadow-[0_0_14px_rgba(255,59,59,0.6)]" : "bg-white/[0.08] text-white/60",
          )}
        >
          {live ? "ON AIR" : "ALUMNI"}
        </span>
      </div>
      <div className="absolute right-3 top-3.5 font-mono text-[11px] font-bold md:right-[18px] md:top-[18px] md:text-sm text-white/75 [text-shadow:0_1px_4px_#000]">
        BSSM BROADCASTING · {two(p.cohort)}기
      </div>
      {/* 방송 자막 (로워서드) */}
      <div className="absolute bottom-3 left-3 right-3 flex items-stretch md:bottom-6 md:left-[22px] md:right-[22px]">
        <div className="min-w-0 bg-[rgba(8,8,10,0.82)] px-3.5 pb-2.5 pt-2 backdrop-blur-[6px] md:px-5 md:pb-3.5 md:pt-3">
          <div className="truncate font-mbc text-[28px] leading-[1.05] text-white md:text-[44px]">{p.name}</div>
          <div className="mt-1 truncate font-mbc text-[13px] text-white/75 md:mt-1.5 md:text-[17px]">
            방송부 {p.cohort}기 {rank(p.lead)}
            {p.title ? ` · ${p.title}` : ""}
          </div>
        </div>
        {p.lead && (
          <span
            className="ml-2 flex h-[22px] shrink-0 items-center self-start px-2 font-orbitron text-[10px] md:h-[26px] md:px-2.5 md:text-[11px] font-bold tracking-[0.18em] text-white"
            style={{ background: RED }}
          >
            CHIEF
          </span>
        )}
      </div>
    </div>
  );
}

function Meta({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 md:px-3.5 md:py-3">
      <span className="mb-1 block font-pretendard text-xs text-white/45">{label}</span>
      <b className={cn("block truncate text-white", mono ? "font-mono text-[13px] font-semibold" : "font-pretendard text-sm font-bold")}>
        {children}
      </b>
    </div>
  );
}

function Profile({ p, domain, onEdit }: { p: CrewMember; domain: string; onEdit: () => void }) {
  return (
    <div className="grid gap-3.5">
      <Monitor p={p} />
      <div className="rounded-2xl border border-white/[0.07] bg-black/35 px-4 py-4 md:px-[22px] md:py-5">
        <span aria-hidden className="mb-1.5 block font-serif text-[48px] font-bold leading-[0.5]" style={{ color: RED }}>
          &ldquo;
        </span>
        <p
          className={cn(
            "max-h-[340px] overflow-y-auto whitespace-pre-line font-pretendard text-base leading-[1.75]",
            p.bio ? "text-white/80" : "text-white/55",
          )}
        >
          {p.bio || defaultBio(p)}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 md:gap-2.5">
        <Meta label="지금">{p.roleLabel}</Meta>
        <Meta label="ONAIR 메일" mono>
          <span title={p.mailAddress ? `${p.mailAddress}@${domain}` : undefined}>
            {p.mailAddress ? `${p.mailAddress}@` : "없음"}
          </span>
        </Meta>
        <Meta label="기기">{p.hasDevice ? "등록됨" : "명단만"}</Meta>
      </div>
      {p.canEdit && (
        <div data-tour="crew.edit" className="flex justify-end">
          <ActionButton className="h-11 px-4 md:h-9 md:px-3.5" onClick={onEdit}>
            소개 고치기
          </ActionButton>
        </div>
      )}
    </div>
  );
}

/* ---------------- 모달 ---------------- */

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm max-md:pb-[calc(78px+env(safe-area-inset-bottom))] max-md:pt-[calc(16px+env(safe-area-inset-top))]">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 grid max-h-[calc(100dvh-2rem)] w-full max-w-[560px] gap-5 overflow-y-auto rounded-[20px] border border-white/10 bg-[#151515] p-5 shadow-2xl max-md:max-h-full md:rounded-[24px] md:p-7">
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 truncate font-mbc text-2xl text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 ml-auto rounded-full p-2.5 text-white/50 hover:bg-white/10 hover:text-white md:mr-0 md:p-1"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const lblCls = "flex items-baseline justify-between font-mbc text-[13px] text-white/60";
const inpCls =
  "w-full rounded-[10px] border border-white/[0.12] bg-[#0c0d0f] px-3.5 font-pretendard text-[15px] text-white placeholder:text-white/30 focus:border-red-400/70 focus:outline-none max-md:text-base";

function Count({ n, max }: { n: number; max: number }) {
  return <span className={cn("font-mono text-xs tabular-nums", n > max ? "text-[#ff9b9b]" : "text-white/35")}>{n}/{max}</span>;
}

export interface ProfileTarget {
  id: string;
  name: string;
  cohort: number | null;
  lead: boolean;
  title: string;
  bio: string;
  /** 보고 있는 기기의 본인이면 /members/me/profile 로 */
  me: boolean;
  /** 프로필 카드 배경 (지금 보이는 것)·사진 주소 */
  cardBg: CardBg;
  photoUrl: string;
}

/** 카드 배경 — ① 소리 파형 · ③ 본인 사진 (사진 올리기·바꾸기·지우기는 바로 서버에) */
function CardBgPicker({
  target,
  choice,
  setChoice,
  photoUrl,
  setPhotoUrl,
}: {
  target: ProfileTarget;
  choice: CardBg;
  setChoice: (c: CardBg) => void;
  photoUrl: string;
  setPhotoUrl: (u: string) => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const who = target.me ? "me" : target.id;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["crew"] });
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };
  const up = useMutation({
    mutationFn: (file: File) => memberApi.uploadPhoto(who, file),
    onSuccess: (res) => {
      setPhotoUrl(res.member.photoUrl ?? "");
      setChoice("photo");
      toast.success("사진을 올렸어요");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rm = useMutation({
    mutationFn: () => memberApi.deletePhoto(who),
    onSuccess: () => {
      setPhotoUrl("");
      setChoice("wave");
      toast.success("사진을 지웠어요");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const busy = up.isPending || rm.isPending;

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    const problem = photoProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    up.mutate(file);
  };
  const openFile = () => fileRef.current?.click();

  return (
    <div className="grid gap-1.5">
      <span className={lblCls}>카드 배경</span>
      <div className="grid grid-cols-2 gap-3">
        <BgTile label="소리 파형" on={choice === "wave"} onPick={() => setChoice("wave")}>
          <WaveCanvas name={target.name} />
        </BgTile>
        <BgTile
          label="본인 사진"
          on={choice === "photo" && !!photoUrl}
          disabled={busy}
          onPick={() => (photoUrl ? setChoice("photo") : openFile())}
          actions={
            photoUrl ? (
              <>
                <button type="button" className={tileBtn} disabled={busy} onClick={openFile}>
                  {up.isPending ? "올리는 중…" : "바꾸기"}
                </button>
                <button type="button" className={tileBtn} disabled={busy} onClick={() => rm.mutate()}>
                  {rm.isPending ? "지우는 중…" : "지우기"}
                </button>
              </>
            ) : (
              <button type="button" className={tileBtn} disabled={busy} onClick={openFile}>
                {up.isPending ? "올리는 중…" : "사진 올리기"}
              </button>
            )
          }
        >
          {photoUrl ? (
            <PhotoLayer url={photoUrl} cohort={target.cohort} />
          ) : (
            <span className="absolute inset-0 grid place-items-center pb-5 font-pretendard text-[13px] text-white/45">
              {up.isPending ? "올리는 중…" : "사진 없음"}
            </span>
          )}
        </BgTile>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = ""; // 같은 파일을 다시 골라도 바뀌게
        }}
      />
    </div>
  );
}

/** 소개 고치기 — 직함(한 줄)·소개글. 본인 또는 부장 이상 */
export function ProfileModal({ target, onClose }: { target: ProfileTarget; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(target.title);
  const [bio, setBio] = useState(target.bio);
  const [cardBg, setCardBg] = useState<CardBg>(target.cardBg);
  const [photoUrl, setPhotoUrl] = useState(target.photoUrl);
  const save = useMutation({
    mutationFn: () =>
      memberApi.updateProfile(target.me ? "me" : target.id, {
        title,
        bio,
        cardBg: cardBg === "photo" && photoUrl ? "photo" : "wave",
      }),
    onSuccess: () => {
      toast.success("저장했어요");
      qc.invalidateQueries({ queryKey: ["crew"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const titleLen = title.trim().length;
  const bioLen = bio.trim().length;
  const ok = titleLen <= TITLE_MAX && bioLen <= BIO_MAX;

  return (
    <ModalShell title={`${target.name} 소개 고치기`} onClose={onClose}>
      <form
        data-tour="crew.editor"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) save.mutate();
        }}
      >
        <label className="grid gap-1.5">
          <span className={lblCls}>
            직함 <Count n={titleLen} max={TITLE_MAX} />
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX + 10}
            data-tour="crew.editor.title"
            placeholder="예: 강당 음향 담당"
            autoFocus
            className={cn(inpCls, "h-11")}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={lblCls}>
            소개글 <Count n={bioLen} max={BIO_MAX} />
          </span>
          <textarea
            data-tour="crew.editor.bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={6}
            placeholder={defaultBio(target)}
            className={cn(inpCls, "resize-y py-3 leading-relaxed")}
          />
        </label>
        <CardBgPicker
          target={target}
          choice={cardBg}
          setChoice={setCardBg}
          photoUrl={photoUrl}
          setPhotoUrl={setPhotoUrl}
        />
        <div className="flex justify-end gap-2">
          <ActionButton tone="ghost" className="max-md:h-11" onClick={onClose}>
            취소
          </ActionButton>
          <ActionButton tone="primary" className="max-md:h-11 max-md:px-6" busy={save.isPending} disabled={!ok} onClick={() => save.mutate()}>
            저장
          </ActionButton>
        </div>
      </form>
    </ModalShell>
  );
}

/** + 명단에 추가 — 기기 없이 이름만 (졸업생 등). 나중에 표에서 초대를 이어 줄 수 있다 */
function AddRosterModal({
  current,
  onClose,
  onAdded,
}: {
  current: number[];
  onClose: () => void;
  onAdded: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [cohort, setCohort] = useState("");
  const [role, setRole] = useState<"member" | "alumni" | null>(null);
  const [wasLead, setWasLead] = useState(false);
  const [title, setTitle] = useState("");
  const n = Number(cohort);
  const cohortOk = Number.isInteger(n) && n >= 1 && n <= 99;
  // 고르지 않으면 지금 기수는 부원, 아니면 졸업
  const shownRole = role ?? (cohortOk && current.includes(n) ? "member" : "alumni");
  const ok = name.trim().length > 0 && cohortOk && title.trim().length <= TITLE_MAX;

  const add = useMutation({
    mutationFn: () => memberApi.addRoster({ name: name.trim(), cohort: n, role: shownRole, wasLead, title }),
    onSuccess: (res) => {
      toast.success(`${res.member.cohort}기 ${res.member.name} 추가했어요`);
      qc.invalidateQueries({ queryKey: ["crew"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      onAdded(res.member.id);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ModalShell title="명단에 추가" onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) add.mutate();
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3 md:grid-cols-[minmax(0,1fr)_110px]">
          <label className="grid gap-1.5">
            <span className={lblCls}>이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus placeholder="홍길동" className={cn(inpCls, "h-11")} />
          </label>
          <label className="grid gap-1.5">
            <span className={lblCls}>기수</span>
            <input
              value={cohort}
              onChange={(e) => setCohort(e.target.value.replace(/\D/g, "").slice(0, 2))}
              inputMode="numeric"
              placeholder="4"
              className={cn(inpCls, "h-11 font-mono")}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["member", "alumni"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={shownRole === r}
              onClick={() => setRole(r)}
              className={cn(
                "flex h-11 items-center gap-2 rounded-[10px] border px-3.5 font-pretendard text-sm font-semibold md:h-9",
                shownRole === r ? "border-red-400/60 bg-[#FF3B3B]/10 text-white" : "border-white/10 text-white/65 hover:text-white",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", shownRole === r ? "bg-[#FF3B3B]" : "bg-white/20")} />
              {r === "member" ? "부원" : "졸업"}
            </button>
          ))}
          <label className="ml-2 flex min-h-[44px] cursor-pointer items-center gap-2 font-pretendard text-sm text-white/70 md:min-h-0">
            <input type="checkbox" checked={wasLead} onChange={(e) => setWasLead(e.target.checked)} className="h-4 w-4 accent-[#FF3B3B]" />
            부장
          </label>
        </div>
        <label className="grid gap-1.5">
          <span className={lblCls}>
            직함 <Count n={title.trim().length} max={TITLE_MAX} />
          </span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX + 10} placeholder="예: 화영" className={cn(inpCls, "h-11")} />
        </label>
        <div className="flex justify-end gap-2">
          <ActionButton tone="ghost" className="max-md:h-11" onClick={onClose}>
            취소
          </ActionButton>
          <ActionButton tone="primary" className="max-md:h-11 max-md:px-6" busy={add.isPending} disabled={!ok} onClick={() => add.mutate()}>
            올리기
          </ActionButton>
        </div>
      </form>
    </ModalShell>
  );
}

/* ---------------- 방송부 보기 (시안 A · 엔딩 크레딧) ---------------- */

/** 관리 › 부원 › 방송부 — 기수마다 큰 외곽선 숫자와 이름, 오른쪽은 송출 모니터 프로필 */
export default function CrewView({ toggle }: { toggle?: ReactNode }) {
  const crew = useQuery({ queryKey: ["crew"], queryFn: memberApi.crew, refetchInterval: 30_000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProfileTarget | null>(null);
  const [adding, setAdding] = useState(false);
  const profileRef = useRef<HTMLElement>(null);
  // 폰은 프로필이 목록 아래라 — 고르면 프로필로 내려 준다
  const pick = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 767px)").matches) {
      requestAnimationFrame(() => profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const list = useMemo(() => crew.data?.crew ?? [], [crew.data]);
  const groups = useMemo(() => {
    const map = new Map<number, CrewMember[]>();
    for (const p of list) map.set(p.cohort, [...(map.get(p.cohort) ?? []), p]);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [list]);

  // 처음엔 나(명단에 있으면), 아니면 지금 기수 부장
  const selected =
    list.find((p) => p.id === selectedId) ??
    list.find((p) => p.me) ??
    list.find((p) => p.current && p.lead) ??
    list.find((p) => p.current) ??
    list[0];

  const data = crew.data;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,480px)] 2xl:grid-cols-[minmax(0,1fr)_520px]">
      <section data-tour="crew.list" className="rounded-[20px] border border-sidebar-border bg-sidebar p-4 shadow-2xl backdrop-blur-md md:rounded-[24px] md:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="whitespace-nowrap font-mbc text-2xl text-white">방송부</h3>
          {toggle && <span className="ml-auto">{toggle}</span>}
        </div>

        {crew.error ? (
          <Notice tone="info">{(crew.error as Error).message || "명단을 불러오지 못했어요"}</Notice>
        ) : !data ? (
          <p className="py-8 font-pretendard text-sm text-white/45">불러오는 중…</p>
        ) : list.length === 0 ? (
          <p className="py-8 font-pretendard text-sm text-white/45">명단이 없어요</p>
        ) : (
          <div className="grid">
            {groups.map(([cohort, people]) => {
              const now = data.currentCohorts.includes(cohort);
              return (
                <div
                  key={cohort}
                  className="grid gap-x-6 gap-y-3 border-t border-white/[0.06] py-4 first:border-t-0 md:py-[22px] first:pt-1 sm:grid-cols-[150px_minmax(0,1fr)]"
                >
                  <div>
                    <CohortNumber n={cohort} on={now} size={64} stroke="1.2px rgba(255,255,255,0.35)" />
                    <span className="mt-2 block font-pretendard text-[13px] font-bold text-white/45">
                      {now ? "지금 기수" : "졸업"} · {people.length}명
                    </span>
                  </div>
                  <div className="flex flex-wrap content-start gap-x-2.5 gap-y-2">
                    {people.map((p) => {
                      const on = selected?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => pick(p.id)}
                          className={cn(
                            "grid min-w-[calc(50%-5px)] gap-0.5 rounded-xl border px-3 pb-2.5 pt-2 text-left transition-colors md:min-w-[150px] md:px-4 md:pb-[11px] md:pt-2.5",
                            on ? "border-red-400/55 bg-[#FF3B3B]/10" : "border-transparent hover:bg-white/[0.04]",
                          )}
                        >
                          <b className="flex items-center gap-2.5 font-mbc text-[22px] font-normal leading-tight text-white md:text-[26px]">
                            {p.name}
                            {p.lead && (
                              <i
                                aria-label="부장"
                                className="h-2 w-2 shrink-0 rounded-full shadow-[0_0_10px_#FF3B3B]"
                                style={{ background: RED }}
                              />
                            )}
                          </b>
                          <span className="max-w-[150px] truncate font-pretendard text-[13px] text-white/50 md:max-w-[220px]">{nameLine(p)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data?.canManage && (
          <button
            type="button"
            data-tour="crew.add"
            onClick={() => setAdding(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 py-3 font-mbc text-sm text-white/60 transition-colors hover:border-white/40 hover:text-white"
          >
            <Plus size={15} /> 명단에 추가
          </button>
        )}
      </section>

      <aside ref={profileRef} data-tour="crew.profile" className="scroll-mt-3 xl:sticky xl:top-6">
        {selected && data ? (
          <Profile
            p={selected}
            domain={data.domain}
            onEdit={() =>
              setEditing({
                id: selected.id,
                name: selected.name,
                cohort: selected.cohort,
                lead: selected.lead,
                title: selected.title,
                bio: selected.bio,
                me: selected.me,
                cardBg: selected.cardBg ?? "wave",
                photoUrl: selected.photoUrl ?? "",
              })
            }
          />
        ) : null}
      </aside>

      {editing && <ProfileModal key={editing.id} target={editing} onClose={() => setEditing(null)} />}
      {adding && data && (
        <AddRosterModal current={data.currentCohorts} onClose={() => setAdding(false)} onAdded={setSelectedId} />
      )}
    </div>
  );
}
