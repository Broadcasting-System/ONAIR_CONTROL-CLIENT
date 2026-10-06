"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ToastHost, toast } from "@/components/common/Toast";
import { ActionButton, Field, inputCls, okBorder } from "@/components/hall/setup/ui";
import { useMe } from "@/hooks/useMe";
import { memberApi } from "@/lib/memberApi";
import { cn } from "@/lib/utils";

function Steps({ at }: { at: 1 | 2 | 3 }) {
  const items = ["초대 확인", "내 정보", "부장 승인"];
  return (
    <div className="mb-6 flex gap-1.5">
      {items.map((t, i) => {
        const n = i + 1;
        const done = n < at;
        const on = n === at;
        return (
          <div key={t} className="flex flex-1 flex-col gap-1.5">
            <i
              className={cn(
                "h-1 rounded-sm",
                done ? "bg-[#00FF57] shadow-[0_0_8px_rgba(0,255,87,0.5)]" : on ? "bg-[#FF3B3B] shadow-[0_0_8px_rgba(255,59,59,0.6)]" : "bg-white/10",
              )}
            />
            <span className={cn("font-mbc text-[13px]", done || on ? "text-white/85" : "text-white/45")}>{t}</span>
          </div>
        );
      })}
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

  let title = "연결 중…";
  let lead = "";
  if (!loading && !me) {
    title = "서버에 연결하지 못했어요";
    lead = "인터넷 연결이나 ONAIR 앱의 서버 주소를 확인하세요.";
  } else if (status === "approved") {
    title = "승인됐어요!";
    lead = `${me?.roleLabel} 권한으로 ONAIR 를 시작합니다…`;
  } else if (status === "revoked") {
    title = "내보낸 기기예요";
    lead = "이 기기는 더 이상 ONAIR 를 쓸 수 없어요. 다시 쓰려면 부장에게 새 초대를 받으세요.";
  } else if (pending && !editing) {
    title = "부장 승인을 기다리고 있어요";
    lead = "부장이 ‘기기·부원 관리’에서 승인하면 이 화면이 저절로 바뀌어요. 창을 닫아도 괜찮아요.";
  } else if (showForm) {
    title = "방송부 기기 등록";
    lead = "초대를 확인했어요. 이름과 기수를 적으면 부장에게 승인 요청이 가요.";
  } else if (me) {
    title = "초대받지 않은 기기예요";
    lead = "부장에게 초대 QR 이나 코드를 받아 ONAIR 앱에서 입력하세요.";
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0505] to-black opacity-80" />
        <div className="absolute inset-0 bg-[url('/onair_background.png')] bg-cover bg-center opacity-40 mix-blend-screen" />
      </div>

      <div className="relative z-10 w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#181818]/75 p-8 shadow-2xl backdrop-blur-md">
        <p className="font-orbitron text-[13px] font-bold tracking-[0.4em] text-[#FF3B3B] [text-shadow:0_0_14px_rgba(255,59,59,0.6)]">
          ON AIR
        </p>
        <h1 className="mt-2.5 mb-1.5 font-mbc text-[28px] text-white">{title}</h1>
        {lead && <p className="mb-6 font-pretendard text-sm leading-relaxed text-white/50">{lead}</p>}

        {(showForm || pending || status === "approved") && <Steps at={status === "approved" ? 3 : pending && !editing ? 3 : 2} />}

        {showForm && (
          <form
            className="flex flex-col gap-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) submit.mutate();
            }}
          >
            <div className="grid grid-cols-[1fr_120px] gap-2.5">
              <Field label="이름">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={30}
                  placeholder="홍길동"
                  autoFocus
                  className={cn(inputCls, okBorder, "h-[42px]")}
                />
              </Field>
              <Field label="기수">
                <input
                  value={cohort}
                  onChange={(e) => setCohort(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  inputMode="numeric"
                  placeholder="7"
                  className={cn(inputCls, okBorder, "h-[42px] font-orbitron")}
                />
              </Field>
            </div>
            <Field label="소개" hint="선택 — 방송부 화면에 보일 수 있어요">
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="한두 줄로 소개해 주세요"
                className={cn(inputCls, okBorder, "h-auto resize-none py-2.5 leading-relaxed")}
              />
            </Field>
            <div className="flex gap-2">
              {editing && (
                <ActionButton tone="ghost" onClick={() => setEditing(false)}>
                  취소
                </ActionButton>
              )}
              <button
                type="submit"
                disabled={!valid || submit.isPending}
                className="h-[46px] flex-1 rounded-lg border border-[#FF3B3B]/60 bg-[#FF3B3B]/20 font-mbc text-[15px] text-white transition-colors enabled:hover:bg-[#FF3B3B]/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submit.isPending ? "보내는 중…" : editing ? "다시 보내기" : "등록 신청"}
              </button>
            </div>
          </form>
        )}

        {pending && !editing && me && (
          <div className="flex flex-col items-center gap-3 pt-1 text-center">
            <div className="grid h-[72px] w-[72px] place-items-center rounded-full border border-amber-400/35 bg-amber-400/10">
              <span className="h-4 w-4 animate-pulse rounded-full bg-[#FFB23F] shadow-[0_0_16px_#FFB23F]" />
            </div>
            <div className="grid w-full grid-cols-[60px_1fr] gap-x-2.5 gap-y-1.5 rounded-2xl bg-black/35 px-4 py-3 text-left font-pretendard text-[13px] text-white/60">
              <span className="text-white/35">이름</span>
              <span>{me.name}</span>
              <span className="text-white/35">기수</span>
              <span>{me.cohort}기</span>
              {me.intro && (
                <>
                  <span className="text-white/35">소개</span>
                  <span className="whitespace-pre-wrap">{me.intro}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <ActionButton className="h-8 px-3 text-[13px]" onClick={startEdit}>
                정보 고치기
              </ActionButton>
              <span className="flex items-center gap-2 font-pretendard text-[13px] text-white/45">
                <span className="h-2 w-2 rounded-full bg-[#FFB23F] shadow-[0_0_8px_#FFB23F]" />
                5초마다 확인 중
              </span>
            </div>
          </div>
        )}

        {me && !showForm && !pending && status !== "approved" && (
          <Link href="/main" className="font-pretendard text-[13px] text-white/40 underline-offset-4 hover:text-white/70 hover:underline">
            보기만 하기 →
          </Link>
        )}
      </div>
      <ToastHost />
    </div>
  );
}
