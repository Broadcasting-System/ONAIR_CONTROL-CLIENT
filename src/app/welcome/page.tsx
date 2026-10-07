"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ToastHost, toast } from "@/components/common/Toast";
import { useMe } from "@/hooks/useMe";
import { memberApi } from "@/lib/memberApi";
import { cn } from "@/lib/utils";

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
    <div className="rounded-[14px] border border-white/[0.06] bg-[#0a0a0c] px-[22px] pt-[18px] pb-3.5 shadow-[inset_0_2px_12px_rgba(0,0,0,0.9)]">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="truncate font-pretendard text-sm font-semibold text-white/45">{device}</span>
        <span className="text-right font-pretendard text-xl font-bold text-white" aria-live="polite">
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
              "pt-2 text-center font-pretendard text-[15px] font-bold",
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

/** 첫 화면 — 초대받은 기기의 등록 신청과 승인 기다리기 */
export default function WelcomePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { me, loading, refetch } = useMe();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [cohort, setCohort] = useState("");
  const [intro, setIntro] = useState("");

  const status = me?.status;
  const pending = status === "pending";

  // 승인 대기 중이면 5초마다 다시 확인
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => refetch(), 5000);
    return () => clearInterval(id);
  }, [pending, refetch]);

  // 승인되면 메인으로
  useEffect(() => {
    if (status !== "approved") return;
    const id = setTimeout(() => router.replace("/main"), 1500);
    return () => clearTimeout(id);
  }, [status, router]);

  const startEdit = () => {
    setName(me?.name ?? "");
    setCohort(me?.cohort ? String(me.cohort) : "");
    setIntro(me?.intro ?? "");
    setEditing(true);
  };

  const submit = useMutation({
    mutationFn: () => memberApi.register({ name: name.trim(), cohort: Number(cohort), intro: intro.trim() }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("등록 신청을 보냈어요. 부장이 승인하면 바로 쓸 수 있어요.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cohortNum = Number(cohort);
  const valid = name.trim().length > 0 && Number.isInteger(cohortNum) && cohortNum >= 1 && cohortNum <= 99;
  const showForm = (status === "unregistered" && me?.canRegister) || (pending && editing);

  // 튜너 단계 · 오른쪽 문장 · 아래 안내
  let at: Step = 1;
  let title = "연결 중…";
  let lead = "";
  if (!loading && !me) {
    at = 0;
    title = "서버에 연결하지 못했어요";
    lead = "인터넷 연결이나 ONAIR 앱의 서버 주소를 확인하세요.";
  } else if (status === "approved") {
    at = 3;
    title = "승인 완료 · ON AIR";
  } else if (status === "revoked") {
    at = 0;
    title = "내보낸 기기예요";
    lead = "이 기기는 더 이상 ONAIR 를 쓸 수 없어요. 다시 쓰려면 부장에게 새 초대를 받으세요.";
  } else if (pending && !editing) {
    at = 2;
    title = "부장 승인을 기다려요";
  } else if (showForm) {
    at = 1;
    title = pending ? "프로필을 고쳐 다시 보내요" : "키 확인됨 · 프로필을 적어 주세요";
  } else if (me) {
    at = 0;
    title = "초대받지 않은 기기예요";
    lead = "부장에게 초대 QR 이나 코드를 받아 ONAIR 앱에서 입력하세요.";
  }
  const lamp: Lamp = status === "approved" ? "on" : pending && !editing ? "standby" : "off";
  const device = me?.ip ? `이 기기 · ${me.ip}` : "이 기기";

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-5 py-12 text-foreground">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0505] to-black opacity-80" />
        <div className="absolute inset-0 bg-[url('/onair_background.png')] bg-cover bg-center opacity-45 mix-blend-screen" />
      </div>

      <div className="relative z-10 grid w-full max-w-[860px] gap-[22px]">
        <div className="flex items-center gap-3.5">
          <div>
            <h1 className="font-mbc text-[34px] leading-none text-white">ONAIR</h1>
            <p className="mt-1.5 font-orbitron text-[11px] tracking-[0.3em] text-white/40">DEVICE REGISTRATION</p>
          </div>
          <span className="ml-auto">
            <Tally lamp={lamp} />
          </span>
        </div>

        <section className="grid gap-[22px] rounded-[24px] border border-white/10 bg-[rgba(32,32,32,0.6)] p-7 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md">
          <Tuner at={at} device={device} status={title} />

          {lead && <p className={noteCls}>{lead}</p>}

          {showForm && (
            <form
              className="grid gap-[22px]"
              onSubmit={(e) => {
                e.preventDefault();
                if (valid) submit.mutate();
              }}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-4">
                <div>
                  <label htmlFor="reg-name" className={lblCls}>
                    이름
                  </label>
                  <input
                    id="reg-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
              <div>
                <label htmlFor="reg-intro" className={lblCls}>
                  소개 <span className="ml-1 font-normal text-white/45">선택 — 방송부 화면에 보일 수 있어요</span>
                </label>
                <textarea
                  id="reg-intro"
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="한두 줄로 소개해 주세요"
                  className={cn(inpCls, "h-[88px] resize-none py-3 leading-normal")}
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <span className={cn(noteCls, "mr-auto")}>부장이 이 정보를 보고 승인해요.</span>
                {editing && (
                  <button type="button" className={ghostCls} onClick={() => setEditing(false)}>
                    취소
                  </button>
                )}
                <button type="submit" disabled={!valid || submit.isPending} className={goCls}>
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
                <div className="min-w-0">
                  <p className="font-pretendard text-[22px] font-extrabold text-white">부장 승인을 기다리고 있어요</p>
                  <p className={noteCls}>
                    부장이 ‘기기·부원 관리’에서 승인하면 이 화면이 저절로 넘어가요. 창을 닫아도 괜찮아요.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-[56px_1fr] gap-x-3 gap-y-1.5 rounded-[14px] border border-white/[0.08] bg-[#0a0a0c] px-[18px] py-3.5 font-pretendard text-sm text-white">
                <span className="text-white/45">이름</span>
                <span>{me.name}</span>
                <span className="text-white/45">기수</span>
                <span className="font-mono tabular-nums">{me.cohort}기</span>
                {me.intro && (
                  <>
                    <span className="text-white/45">소개</span>
                    <span className="whitespace-pre-wrap text-white/80">{me.intro}</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <span className={cn(noteCls, "mr-auto text-white/45")}>5초마다 확인 중</span>
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
                  <p className="font-pretendard text-[22px] font-extrabold text-white">승인됐어요. 이제 ONAIR 를 쓸 수 있어요</p>
                  <p className={noteCls}>
                    {[me?.cohort ? `${me.cohort}기` : "", me?.name, "·", me?.roleLabel].filter(Boolean).join(" ")} 권한으로
                    ONAIR 를 시작합니다…
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
