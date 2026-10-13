"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ToastHost, toast } from "@/components/common/Toast";
import { BgTile, PhotoLayer, WaveCanvas, photoProblem, tileBtn } from "@/components/devices/CardBackground";
import { useMe } from "@/hooks/useMe";
import { mailApi, memberApi } from "@/lib/memberApi";
import { cohortPrefix, mailIdProblem, personalEmailProblem, suggestMailId } from "@/lib/romanize";
import { cn } from "@/lib/utils";
import type { CardBg } from "@/types/member";

/** 튜너 눈금에 찍힌 네 단계 — 키 연결은 앱에서 끝내고 이 화면으로 온다 */
const STEPS = ["키 연결", "프로필", "승인", "ON AIR"] as const;
type Step = 0 | 1 | 2 | 3;
type Lamp = "off" | "standby" | "on";

/** 오른쪽 위 ON AIR 램프 — 꺼짐(OFF AIR) · 대기(STANDBY, 회색) · 송출(ON AIR, 빨강) */
function Tally({ lamp }: { lamp: Lamp }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 min-w-[120px] items-center justify-center rounded-[10px] border border-black px-4 font-orbitron text-[13px] font-bold tracking-[0.22em] transition-[background,color,box-shadow] duration-500",
        lamp === "on"
          ? "bg-[radial-gradient(ellipse_at_50%_35%,#ff6b5f,#e12322_72%)] text-white shadow-[0_0_24px_rgba(255,59,59,0.6),inset_0_1px_0_rgba(255,255,255,0.35)]"
          : lamp === "standby"
            ? "bg-[#1a1b1e] text-white/75 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]"
            : "bg-[#1d0b0c] text-[#7a3436] shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]",
      )}
    >
      {lamp === "on" ? "ON AIR" : lamp === "standby" ? "STANDBY" : "OFF AIR"}
    </span>
  );
}

/** 라디오 주파수 창 — 빨간 바늘이 지금 단계 위에 선다 */
function Tuner({ at, device, status }: { at: Step; device: string; status: string }) {
  const pos = [12.5, 37.5, 62.5, 87.5][at];
  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-[#0a0a0c] px-4 pt-4 pb-3 shadow-[inset_0_2px_12px_rgba(0,0,0,0.9)] md:px-[22px] md:pt-[18px] md:pb-3.5">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="truncate font-pretendard text-sm font-semibold text-white/45">{device}</span>
        <span className="text-right font-pretendard text-lg font-bold text-white md:text-xl" aria-live="polite">
          {status}
        </span>
      </div>
      <div className="relative mt-2 h-[30px] border-t border-white/15" aria-hidden>
        {Array.from({ length: 41 }, (_, i) => (
          <i
            key={i}
            className="absolute top-0 w-px bg-white/20"
            style={{ left: `${i * 2.5}%`, height: i % 5 ? 8 : 14 }}
          />
        ))}
        <b
          className="absolute -top-1.5 -ml-px h-[22px] w-0.5 bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B] transition-[left] duration-700 ease-out"
          style={{ left: `${pos}%` }}
        />
      </div>
      <ol className="mt-1.5 grid grid-cols-4">
        {STEPS.map((t, i) => (
          <li
            key={t}
            aria-current={i === at ? "step" : undefined}
            className={cn(
              "pt-2 text-center font-pretendard text-[13px] font-bold md:text-[15px]",
              i === at ? "text-white" : i < at ? "text-white/60" : "text-white/30",
            )}
          >
            {t}
          </li>
        ))}
      </ol>
    </div>
  );
}

const lblCls = "mb-2 block font-pretendard text-sm font-bold text-white/80";
const inpCls =
  "w-full rounded-[10px] border border-white/[0.12] bg-[#0c0d0f] px-3.5 font-pretendard text-base text-white shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)] outline-none placeholder:text-white/35 focus:border-red-400/70";
const goCls =
  "inline-flex h-[54px] items-center justify-center rounded-[10px] border border-black bg-[linear-gradient(180deg,#ff5a52,#d9201e)] px-[26px] font-pretendard text-[17px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_3px_0_#5c0b0b,0_0_22px_rgba(255,59,59,0.3)] active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40";
const ghostCls =
  "inline-flex h-11 items-center justify-center rounded-[10px] border border-white/15 bg-transparent px-[18px] font-pretendard text-[15px] font-bold text-white/80 hover:text-white disabled:opacity-40";
const noteCls = "font-pretendard text-sm leading-relaxed text-white/60";
const errCls = "mt-2 font-pretendard text-[13px] leading-snug text-[#ff9b9b]";

/** 입력이 멈춘 뒤에만 서버에 묻는다 */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** 고른 사진 파일 미리보기 주소 — 파일이 바뀌거나 화면을 떠나면 놓아 준다 */
function useObjectUrl(file: File | null): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

/** 프로필 카드 배경 — 소리 파형(이름으로 그림) · 내 사진. 사진은 등록 신청 뒤에 올린다 */
function CardBgChoice({
  name,
  cohort,
  choice,
  onChoice,
  photoUrl,
  onFile,
}: {
  name: string;
  cohort: number | null;
  choice: CardBg;
  onChoice: (c: CardBg) => void;
  photoUrl: string;
  onFile: (f: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const openFile = () => fileRef.current?.click();
  return (
    <div>
      <span className={lblCls}>카드 배경</span>
      <div className="grid max-w-[560px] grid-cols-2 gap-3">
        <BgTile label="소리 파형" on={choice === "wave"} onPick={() => onChoice("wave")}>
          <WaveCanvas name={name.trim() || "ONAIR"} />
        </BgTile>
        <BgTile
          label="내 사진"
          on={choice === "photo" && !!photoUrl}
          onPick={() => (photoUrl ? onChoice("photo") : openFile())}
          actions={
            <button type="button" className={tileBtn} onClick={openFile}>
              {photoUrl ? "바꾸기" : "사진 올리기"}
            </button>
          }
        >
          {photoUrl ? (
            <PhotoLayer url={photoUrl} cohort={cohort} />
          ) : (
            <span className="absolute inset-0 grid place-items-center pb-5 font-pretendard text-[13px] text-white/45">
              사진 없음
            </span>
          )}
        </BgTile>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // 같은 파일을 다시 골라도 바뀌게
          if (!f) return;
          const problem = photoProblem(f);
          if (problem) {
            toast.error(problem);
            return;
          }
          onFile(f);
          onChoice("photo");
        }}
      />
    </div>
  );
}

/** 첫 화면 — 초대받은 기기의 등록 신청과 승인 기다리기 */
export default function WelcomePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { me, loading, refetch } = useMe();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [cohort, setCohort] = useState("");
  const [intro, setIntro] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [mailId, setMailId] = useState("");
  // 사람이 메일 주소를 직접 고쳤으면 이름을 바꿔도 다시 채우지 않는다
  const [mailEdited, setMailEdited] = useState(false);
  // 카드 배경 — 고른 사진 파일은 등록 신청이 받아진 뒤에 올린다
  const [cardBg, setCardBg] = useState<CardBg>("wave");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const localPhoto = useObjectUrl(photoFile);
  const photoUrl = localPhoto || me?.photoUrl || "";

  const status = me?.status;
  const pending = status === "pending";

  // 승인 대기 중이면 5초마다 다시 확인
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => refetch(), 5000);
    return () => clearInterval(id);
  }, [pending, refetch]);

  // 승인되면 메인으로 (폰은 폰 홈으로 — 등록 중에 /main 을 거쳐 와서 '처음 열면 홈' 이 이미 쓰였을 수 있다)
  useEffect(() => {
    if (status !== "approved") return;
    const phone = window.matchMedia("(max-width: 767px)").matches;
    const id = setTimeout(() => router.replace(phone ? "/home" : "/main"), 1500);
    return () => clearTimeout(id);
  }, [status, router]);

  const startEdit = () => {
    setName(me?.name ?? "");
    setCohort(me?.cohort ? String(me.cohort) : "");
    setIntro(me?.intro ?? "");
    setPersonalEmail(me?.personalEmail ?? "");
    setMailId(me?.mailId || suggestMailId(me?.name ?? ""));
    setMailEdited(!!me?.mailId);
    setCardBg(me?.cardBg ?? "wave");
    setPhotoFile(null);
    setEditing(true);
  };

  const changeName = (v: string) => {
    setName(v);
    if (!mailEdited) setMailId(suggestMailId(v));
  };

  const pickedBg: CardBg = cardBg === "photo" && photoUrl ? "photo" : "wave";
  const submit = useMutation({
    mutationFn: async () => {
      const res = await memberApi.register({
        name: name.trim(),
        cohort: Number(cohort),
        intro: intro.trim(),
        cardBg: pickedBg,
        ...(mailOn ? { mailId, personalEmail: personalEmail.trim() } : {}),
      });
      // 신청이 받아진 뒤라 사진이 안 올라가도 신청은 그대로 — 알리기만 한다
      if (pickedBg === "photo" && photoFile) {
        try {
          await memberApi.uploadPhoto("me", photoFile);
          setPhotoFile(null);
        } catch (e) {
          toast.error((e as Error).message || "사진을 올리지 못했어요");
        }
      }
      return res;
    },
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("등록 신청을 보냈어요");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cohortNum = Number(cohort);
  const cohortOk = Number.isInteger(cohortNum) && cohortNum >= 1 && cohortNum <= 99;
  const showForm = (status === "unregistered" && me?.canRegister) || (pending && editing);

  // 메일 — 예전 서버(메일 기능 없음)면 칸을 숨긴다
  const mailOn = me?.mailDomain !== undefined;
  const domain = me?.mailDomain || "bssmcast.com";
  const prefix = cohortPrefix(cohort);
  const idProblem = mailIdProblem(mailId);
  const emailProblem = personalEmailProblem(personalEmail.trim(), domain);
  const checkId = useDebounced(mailId, 350);
  const check = useQuery({
    queryKey: ["mail-check", cohortNum, checkId],
    queryFn: () => mailApi.check(cohortNum, checkId),
    enabled: !!showForm && mailOn && cohortOk && !mailIdProblem(checkId),
    retry: false,
    staleTime: 10_000,
  });
  const checked = check.data && check.data.mailId === mailId && check.data.address === `${prefix}${mailId}`;
  const taken = checked && !check.data.ok ? check.data.problem : "";
  const mailProblem = mailId ? idProblem || taken : "";
  const mailValid = !mailOn || (!idProblem && !taken && !emailProblem);

  const valid = name.trim().length > 0 && cohortOk && mailValid;

  // 튜너 단계 · 오른쪽 문장 · 아래 안내
  let at: Step = 1;
  let title = "연결 중…";
  if (!loading && !me) {
    at = 0;
    title = "서버에 연결하지 못했어요";
  } else if (status === "approved") {
    at = 3;
    title = "승인 완료 · ON AIR";
  } else if (status === "revoked") {
    at = 0;
    title = "내보낸 기기예요";
  } else if (pending && !editing) {
    at = 2;
    title = "승인 대기";
  } else if (showForm) {
    at = 1;
    title = pending ? "프로필 수정" : "프로필 입력";
  } else if (me) {
    at = 0;
    title = "초대받지 않은 기기예요";
  }
  const lamp: Lamp = status === "approved" ? "on" : pending && !editing ? "standby" : "off";
  const device = me?.ip ? `이 기기 · ${me.ip}` : "이 기기";

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(32px+env(safe-area-inset-top))] text-foreground md:px-5 md:py-12">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0505] to-black opacity-80" />
        <div className="absolute inset-0 bg-[url('/onair_background.png')] bg-cover bg-center opacity-45 mix-blend-screen" />
      </div>

      <div className="relative z-10 grid w-full max-w-[860px] gap-4 md:gap-[22px]">
        <div className="flex items-center gap-3.5">
          <div>
            <h1 className="font-mbc text-[30px] leading-none text-white md:text-[34px]">ONAIR</h1>
            <p className="mt-1.5 font-orbitron text-[11px] tracking-[0.3em] text-white/40">DEVICE REGISTRATION</p>
          </div>
          <span className="ml-auto">
            <Tally lamp={lamp} />
          </span>
        </div>

        <section className="grid gap-5 rounded-[20px] border border-white/10 bg-[rgba(32,32,32,0.6)] p-4 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md md:gap-[22px] md:rounded-[24px] md:p-7">
          <Tuner at={at} device={device} status={title} />

          {showForm && (
            <form
              className="grid gap-[22px]"
              onSubmit={(e) => {
                e.preventDefault();
                if (valid) submit.mutate();
              }}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3 md:grid-cols-[minmax(0,1fr)_140px] md:gap-4">
                <div>
                  <label htmlFor="reg-name" className={lblCls}>
                    이름
                  </label>
                  <input
                    id="reg-name"
                    value={name}
                    onChange={(e) => changeName(e.target.value)}
                    maxLength={30}
                    placeholder="홍길동"
                    autoFocus
                    className={cn(inpCls, "h-12")}
                  />
                </div>
                <div>
                  <label htmlFor="reg-cohort" className={lblCls}>
                    기수
                  </label>
                  <input
                    id="reg-cohort"
                    value={cohort}
                    onChange={(e) => setCohort(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    inputMode="numeric"
                    placeholder="7"
                    className={cn(inpCls, "h-12 font-mono tabular-nums")}
                  />
                </div>
              </div>
              {mailOn && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reg-personal" className={lblCls}>
                      받을 메일
                    </label>
                    <input
                      id="reg-personal"
                      type="email"
                      value={personalEmail}
                      onChange={(e) => setPersonalEmail(e.target.value)}
                      maxLength={120}
                      autoComplete="email"
                      spellCheck={false}
                      placeholder="name@gmail.com"
                      className={cn(inpCls, "h-12", emailProblem && "border-red-400/50")}
                    />
                    {emailProblem && <p className={errCls}>{emailProblem}</p>}
                  </div>
                  <div>
                    <label htmlFor="reg-mail" className={lblCls}>
                      ONAIR 메일 주소
                    </label>
                    <div
                      className={cn(
                        "flex h-12 items-center overflow-hidden rounded-[10px] border bg-[#0c0d0f] shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)] focus-within:border-red-400/70",
                        mailProblem ? "border-red-400/50" : "border-white/[0.12]",
                      )}
                    >
                      {prefix && (
                        <span className="flex h-full shrink-0 items-center border-r border-white/[0.08] bg-white/[0.05] px-3 font-mono text-base font-bold tabular-nums text-white/55">
                          {prefix}
                        </span>
                      )}
                      <input
                        id="reg-mail"
                        value={mailId}
                        onChange={(e) => {
                          setMailId(e.target.value.toLowerCase().replace(/\s/g, ""));
                          setMailEdited(true);
                        }}
                        maxLength={20}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        placeholder="junghyun"
                        className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-base text-white outline-none placeholder:text-white/35"
                      />
                      <span className="shrink-0 pr-3.5 font-mono text-[15px] text-white/40">@{domain}</span>
                    </div>
                    {mailProblem && <p className={errCls}>{mailProblem}</p>}
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="reg-intro" className={lblCls}>
                  소개
                </label>
                <textarea
                  id="reg-intro"
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className={cn(inpCls, "h-[88px] resize-none py-3 leading-normal")}
                />
              </div>
              <CardBgChoice
                name={name}
                cohort={cohortOk ? cohortNum : null}
                choice={pickedBg}
                onChoice={setCardBg}
                photoUrl={photoUrl}
                onFile={setPhotoFile}
              />
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                {editing && (
                  <button type="button" className={cn(ghostCls, "max-md:h-[54px] max-md:flex-1")} onClick={() => setEditing(false)}>
                    취소
                  </button>
                )}
                <button type="submit" disabled={!valid || submit.isPending} className={cn(goCls, "max-md:flex-1")}>
                  {submit.isPending ? "보내는 중…" : editing ? "다시 보내기" : "승인 요청"}
                </button>
              </div>
            </form>
          )}

          {pending && !editing && me && (
            <>
              <div className="flex items-center gap-[18px]">
                <div className="onair-eq flex h-[42px] shrink-0 items-end gap-[5px]" aria-hidden>
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <p className="min-w-0 font-pretendard text-[22px] font-extrabold text-white">승인 대기</p>
              </div>
              <div className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5 rounded-[14px] border border-white/[0.08] bg-[#0a0a0c] px-[18px] py-3.5 font-pretendard text-sm text-white">
                <span className="text-white/45">이름</span>
                <span>{me.name}</span>
                <span className="text-white/45">기수</span>
                <span className="font-mono tabular-nums">{me.cohort}기</span>
                {me.mailAddress && (
                  <>
                    <span className="text-white/45">ONAIR 메일</span>
                    <span className="font-mono">
                      {me.mailAddress}
                      <span className="text-white/40">@{domain}</span>
                    </span>
                  </>
                )}
                {me.personalEmail && (
                  <>
                    <span className="text-white/45">받을 메일</span>
                    <span>{me.personalEmail}</span>
                  </>
                )}
                {me.intro && (
                  <>
                    <span className="text-white/45">소개</span>
                    <span className="whitespace-pre-wrap text-white/80">{me.intro}</span>
                  </>
                )}
                {me.cardBg && (
                  <>
                    <span className="text-white/45">카드 배경</span>
                    <span>{me.cardBg === "photo" ? "내 사진" : "소리 파형"}</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <button type="button" className={ghostCls} onClick={startEdit}>
                  정보 고치기
                </button>
              </div>
            </>
          )}

          {status === "approved" && (
            <>
              <div className="flex items-center gap-[18px]">
                <span className="h-4 w-4 shrink-0 rounded-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" />
                <div className="min-w-0">
                  <p className="font-pretendard text-[22px] font-extrabold text-white">승인 완료</p>
                  <p className={noteCls}>
                    {[me?.cohort ? `${me.cohort}기` : "", me?.name, "·", me?.roleLabel].filter(Boolean).join(" ")}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Link href="/main" replace className={goCls}>
                  ONAIR 열기
                </Link>
              </div>
            </>
          )}

          {me && !showForm && !pending && status !== "approved" && (
            <Link
              href="/main"
              className="w-fit font-pretendard text-sm text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
            >
              보기만 하기 →
            </Link>
          )}
        </section>
      </div>
      <ToastHost />
    </div>
  );
}
