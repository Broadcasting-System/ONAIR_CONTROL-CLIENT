"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import NeonButton from "@/components/common/NeonButton";
import Portal from "@/components/common/Portal";
import { toast } from "@/components/common/Toast";
import { EYEBROW, Horizon, PublicTop, Warp } from "@/components/recruit/public/Stage";
import { GhostButton, useNow } from "@/components/recruit/ui";
import { recruitKeys } from "@/hooks/useRecruit";
import { recruitApi } from "@/lib/recruitApi";
import { countdown, dotMd, hm, mdDow, mdhm } from "@/lib/recruitFormat";
import { cn } from "@/lib/utils";
import type { MyApplication } from "@/types/recruit";

/**
 * 내 지원 — 시안 MyStatus.dc.html.
 * 면접 시간 전 → 내 면접(큰 시각) → 발표 대기(카운트다운) → 합격(빨간 고리 퍼짐 + 입부 확정/거절) · 불합격 · 예비 · 추가 합격.
 */

type View =
  | "none"
  | "submitted"
  | "wait-slot"
  | "interview"
  | "result-wait"
  | "pass"
  | "joined"
  | "declined"
  | "expired"
  | "fail"
  | "reserve";

function viewOf(m: MyApplication, now: number): View {
  if (!m.application || m.application.status !== "active") return "none";
  const res = m.result;
  if (res === "pass") {
    const st = m.confirm?.status;
    if (st === "accepted") return "joined";
    if (st === "declined") return "declined";
    if (st === "expired") return "expired";
    return "pass";
  }
  if (res === "fail") return "fail";
  if (res === "reserve") return "reserve";
  if (m.canEdit) return "submitted";
  if (!m.interview?.at) return "wait-slot";
  const end = Date.parse(m.interview.at) + (m.interview.minutes || 10) * 60000;
  if (now && now < end) return "interview";
  return "result-wait";
}

const H = "m-0 text-center font-mbc font-normal leading-[1.2]";

export default function MyStatus({ data }: { data: MyApplication }) {
  const router = useRouter();
  const qc = useQueryClient();
  const now = useNow(1000);
  const [asking, setAsking] = useState(false);
  const [cancelAsk, setCancelAsk] = useState(false);
  const [mailId, setMailId] = useState("");
  const [busy, setBusy] = useState(false);
  const r = data.recruit;
  const cohort = r?.cohort ?? "";
  const v = viewOf(data, now);

  const lit = v === "pass" || v === "joined";
  const dim = v === "declined" || v === "fail";

  const confirm = async (accept: boolean) => {
    setBusy(true);
    try {
      const res = await recruitApi.confirm(accept);
      qc.setQueryData(recruitKeys.me, res);
      qc.invalidateQueries({ queryKey: ["me"] });
      setAsking(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  // 확정한 뒤 메일 아이디를 정하고 ONAIR 로 (아이디는 처음 한 번만, 비우면 나중에 부원 화면에서)
  const enter = async () => {
    if (mailId.trim()) {
      setBusy(true);
      try {
        await recruitApi.confirm(true, mailId.trim());
      } catch (e) {
        setBusy(false);
        return toast.error(e instanceof Error ? e.message : "메일 아이디를 정하지 못했어요");
      }
    }
    window.location.href = "/main";
  };

  const cancelMine = async () => {
    setBusy(true);
    try {
      const res = await recruitApi.cancelMine();
      qc.setQueryData(recruitKeys.me, res);
      qc.invalidateQueries({ queryKey: recruitKeys.current });
      setCancelAsk(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "취소하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const iv = data.interview;
  const ivLeft = iv?.at && now ? Date.parse(iv.at) - now : 0;
  const ivCd = countdown(ivLeft);
  const annLeft = r?.announceAt && now ? Date.parse(r.announceAt) - now : 0;
  const annCd = countdown(annLeft);
  const due = data.confirm?.by;
  const ratio = r?.quota ? `${((r.applied ?? 0) / r.quota).toFixed(1)} : 1` : "";
  const ivDate = r?.interview?.date ? `${r.interview.date}T00:00:00` : null;

  return (
    <div className="relative h-[100dvh] w-full overflow-clip break-keep bg-black font-pretendard text-white">
      {/* 워프는 적고 흐리게, 가운데는 어둡게 — 큰 제목이 깨끗하게 읽히도록 */}
      <Warp
        soft
        count={36}
        className="transition-opacity duration-500"
        style={{ opacity: dim ? 0.05 : lit ? 0.32 : 0.2 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 42% at 50% 42%, rgba(0,0,0,.92) 0%, rgba(0,0,0,.7) 45%, transparent 75%)",
        }}
      />
      {/* 지평선은 늘 내용 아래 — 내용 칸 바닥(160px)보다 50px 아래 */}
      <Horizon
        top={lit ? "calc(100dvh - 110px)" : dim ? "calc(100dvh + 40px)" : "calc(100dvh - 70px)"}
        dim={dim}
        animate
      />
      <PublicTop center={`방송부 ${cohort}기 · 내 지원`} right={data.email ?? ""} />

      <div className="no-scrollbar absolute inset-x-0 bottom-[160px] top-[72px] overflow-y-auto">
        <div className="flex min-h-full flex-col items-center justify-center py-10">
          {v === "none" && (
            <div className="rc-rise flex flex-col items-center gap-[22px] px-5 text-center">
              <h1 className={cn(H, "text-[40px] md:text-[56px]")}>아직 지원하지 않았어요</h1>
              {r && (
                <NeonButton
                  size="lg"
                  className="h-[60px] w-[240px]"
                  onClick={() => router.push("/recruit/apply")}
                >
                  지원하기
                </NeonButton>
              )}
            </div>
          )}

          {v === "submitted" && (
            <div className="rc-rise flex flex-col items-center gap-[22px] px-5 text-center">
              <span className={EYEBROW}>SUBMITTED</span>
              <h1 className={cn(H, "text-[48px] md:text-[84px]")}>합격을 기원해요</h1>
              <div className="flex flex-wrap justify-center pb-2 pt-[18px]">
                {[
                  {
                    k: "지금 경쟁률",
                    v: <span className="text-[#FF3B3B]">{ratio}</span>,
                    show: !!ratio,
                  },
                  { k: "면접", v: dotMd(ivDate), show: !!ivDate },
                  {
                    k: "발표",
                    v: `${dotMd(r?.announceAt)} ${hm(r?.announceAt)}`,
                    show: !!r?.announceAt,
                  },
                ]
                  .filter((c) => c.show)
                  .map((c, i) => (
                    <div
                      key={c.k}
                      className={cn(
                        "flex flex-col items-center gap-2 px-6 md:px-10",
                        i > 0 && "border-l border-white/[0.14]",
                      )}
                    >
                      <span className="text-[15px] text-white/50">{c.k}</span>
                      <span className="text-[24px] font-bold tabular-nums md:text-[30px]">
                        {c.v}
                      </span>
                    </div>
                  ))}
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <GhostButton size="lg" onClick={() => router.push("/recruit/apply?edit=1")}>
                  지원서 고치기
                </GhostButton>
                <GhostButton size="lg" onClick={() => setCancelAsk(true)}>
                  지원 취소
                </GhostButton>
              </div>
            </div>
          )}

          {v === "wait-slot" && (
            <div className="rc-rise flex flex-col items-center gap-[22px] px-5 text-center">
              <span className={EYEBROW}>MY INTERVIEW</span>
              <h1 className={cn(H, "text-[40px] md:text-[64px]")}>면접 시간은 곧 알려 드려요</h1>
              {ivDate && (
                <span className="text-[20px] text-white/75 md:text-[24px]">
                  면접 {mdDow(ivDate)} · {r?.interview.place}
                </span>
              )}
            </div>
          )}

          {v === "interview" && iv?.at && (
            <div className="rc-rise flex flex-col items-center gap-3.5 px-5">
              <span className={EYEBROW}>MY INTERVIEW</span>
              <span className="text-[22px] text-white/75 md:text-[26px]">{mdDow(iv.at)}</span>
              <span className="text-[96px] font-extrabold leading-none tracking-[-0.02em] tabular-nums md:text-[150px]">
                {hm(iv.at)}
              </span>
              {ivLeft > 0 && (
                <span className="text-[18px] text-[#FF3B3B] tabular-nums md:text-[20px]">
                  면접까지 {ivCd.dd} {ivCd.hms}
                </span>
              )}
              <div className="mt-[22px] w-full max-w-[720px] border-b border-white/[0.12]">
                {[
                  ["장소", iv.place],
                  ["순서", `${iv.no}번째${iv.minutes ? ` · ${iv.minutes}분` : ""}`],
                  ["준비할 것", iv.prep],
                ]
                  .filter(([, val]) => val)
                  .map(([k, val]) => (
                    <div
                      key={k}
                      className="grid grid-cols-[110px_minmax(0,1fr)] border-t border-white/[0.12] py-[18px] text-[18px] md:grid-cols-[150px_minmax(0,1fr)] md:text-[20px]"
                    >
                      <span className="text-[17px] text-white/50">{k}</span>
                      <span className="tabular-nums">{val}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {v === "result-wait" && (
            <div className="rc-rise flex flex-col items-center gap-[22px] px-5 text-center">
              <span className={EYEBROW}>RESULT</span>
              <h1 className={cn(H, "text-[36px] md:text-[64px]")}>
                {r?.announceAt ? `결과는 ${mdhm(r.announceAt)}에 나와요` : "결과는 곧 나와요"}
              </h1>
              {annLeft > 0 && (
                <span className="text-[72px] font-extrabold leading-none tabular-nums md:text-[120px]">
                  {annCd.days > 0 && <span className="mr-6">{annCd.dd}</span>}
                  {annCd.hms}
                </span>
              )}
              <span className="text-[20px] text-white/50">면접 봐 줘서 고마워요</span>
            </div>
          )}

          {v === "pass" && (
            <div className="relative flex flex-col items-center px-5 text-center">
              <div className="rc-burst absolute left-1/2 top-[86px] h-0 w-0" aria-hidden>
                <i />
                <i style={{ animationDelay: ".55s" }} />
                <i style={{ animationDelay: ".9s" }} />
              </div>
              <span className={cn(EYEBROW, "rc-rise d1 relative")}>
                {data.extra ? "추가 합격" : "PASS"}
              </span>
              <h1 className={cn(H, "rc-rise d1 relative mt-5 text-[56px] md:text-[96px]")}>
                합격을 축하해요
              </h1>
              {due && (
                <span className="rc-rise d2 relative mt-7 flex items-baseline gap-3 text-[17px] md:text-[18px]">
                  <span className="text-white/50">확정 기한</span>
                  <span className="font-semibold tabular-nums">{mdhm(due)}</span>
                </span>
              )}
              <div className="rc-rise d3 relative mt-10 flex flex-wrap justify-center gap-3">
                <GhostButton size="lg" className="w-[140px]" onClick={() => setAsking(true)}>
                  거절
                </GhostButton>
                <NeonButton
                  size="lg"
                  disabled={busy}
                  className="h-[60px] w-[260px]"
                  onClick={() => confirm(true)}
                >
                  입부 확정
                </NeonButton>
              </div>
            </div>
          )}

          {v === "joined" && (
            <div className="rc-rise flex flex-col items-center gap-[22px] px-5 text-center">
              <span className={EYEBROW}>WELCOME ON AIR</span>
              <h1 className={cn(H, "text-[44px] md:text-[80px]")}>{cohort}기 방송부원이 됐어요</h1>
              <div className="mt-2.5 flex w-full max-w-[640px] flex-col gap-2.5 text-left">
                <label htmlFor="ms-mail" className="text-[16px] text-white/55">
                  방송부 메일 아이디
                </label>
                <div className="flex items-baseline gap-2">
                  <span className="text-[22px] text-white/50 tabular-nums md:text-[26px]">
                    {String(cohort).padStart(2, "0")}
                  </span>
                  <input
                    id="ms-mail"
                    value={mailId}
                    maxLength={30}
                    autoComplete="off"
                    onChange={(e) =>
                      setMailId(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))
                    }
                    className="h-[60px] min-w-0 flex-1 border-0 border-b-2 border-white/20 bg-transparent px-1 font-pretendard text-[22px] font-semibold text-white outline-none focus:border-[#FF3B3B] md:text-[26px]"
                  />
                  <span className="whitespace-nowrap text-[18px] text-white/50 md:text-[22px]">
                    @bssmcast.com
                  </span>
                </div>
              </div>
              <div className="pt-2">
                <NeonButton
                  size="lg"
                  disabled={busy}
                  className="h-[60px] w-[260px]"
                  onClick={enter}
                >
                  ONAIR 들어가기
                </NeonButton>
              </div>
            </div>
          )}

          {v === "declined" && (
            <div className="rc-rise flex flex-col items-center gap-[22px] px-5 text-center">
              <h1 className={cn(H, "text-[40px] md:text-[56px]")}>입부를 거절했어요</h1>
              <span className="text-[20px] text-white/50">지원해 줘서 고마워요</span>
            </div>
          )}

          {v === "fail" && (
            <div className="rc-rise flex flex-col items-center gap-[22px] px-5 text-center">
              <h1 className={cn(H, "text-[36px] md:text-[56px]")}>
                이번에는 함께하지 못하게 됐어요
              </h1>
              <span className="text-[18px] text-white/70 md:text-[20px]">
                지원하고 면접까지 와 줘서 고마워요. 다음 모집 때 다시 만나요.
              </span>
            </div>
          )}

          {v === "expired" && (
            <div className="rc-rise flex flex-col items-center gap-[22px] px-5 text-center">
              <h1 className={cn(H, "text-[40px] md:text-[56px]")}>입부 확정 기한이 지났어요</h1>
            </div>
          )}

          {v === "reserve" && (
            <div className="rc-rise flex flex-col items-center gap-[22px] px-5 text-center">
              <span className={EYEBROW}>RESERVE</span>
              <h1 className={cn(H, "text-[44px] md:text-[64px]")}>
                예비 <span className="tabular-nums">{data.reserveRank ?? ""}</span>번이에요
              </h1>
            </div>
          )}
        </div>
      </div>

      {cancelAsk && (
        <Portal>
          <div className="fixed inset-x-0 bottom-0 top-[72px] z-[60] flex items-center justify-center bg-black/[0.78] p-5">
            <div className="rc-rise flex w-full max-w-[560px] flex-col gap-[18px] rounded-3xl border border-white/[0.14] bg-[#0b0b0b] px-8 py-10 md:px-12 md:py-11">
              <h2 className="m-0 font-mbc text-[32px] font-normal md:text-[40px]">
                지원을 취소할까요?
              </h2>
              <span className="text-[18px] leading-[1.7] text-white/75 md:text-[19px]">
                마감 전에는 다시 지원할 수 있어요.
              </span>
              <div className="flex flex-wrap justify-end gap-3 pt-2.5">
                <GhostButton size="lg" onClick={() => setCancelAsk(false)}>
                  돌아가기
                </GhostButton>
                <GhostButton
                  size="lg"
                  disabled={busy}
                  className="border-[#FF3B3B] text-[#FF3B3B] enabled:hover:border-[#FF3B3B] enabled:hover:text-[#FF3B3B]"
                  onClick={cancelMine}
                >
                  지원 취소
                </GhostButton>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {asking && (
        <Portal>
          <div className="fixed inset-x-0 bottom-0 top-[72px] z-[60] flex items-center justify-center bg-black/[0.78] p-5">
            <div className="rc-rise flex w-full max-w-[560px] flex-col gap-[18px] rounded-3xl border border-white/[0.14] bg-[#0b0b0b] px-8 py-10 md:px-12 md:py-11">
              <h2 className="m-0 font-mbc text-[32px] font-normal md:text-[40px]">
                입부를 거절할까요?
              </h2>
              <span className="text-[18px] leading-[1.7] text-white/75 md:text-[19px]">
                자리는 다음 지원자에게 넘어가요. 되돌릴 수 없어요.
              </span>
              <div className="flex flex-wrap justify-end gap-3 pt-2.5">
                <GhostButton size="lg" onClick={() => setAsking(false)}>
                  돌아가기
                </GhostButton>
                <GhostButton
                  size="lg"
                  disabled={busy}
                  className="border-[#FF3B3B] text-[#FF3B3B] enabled:hover:border-[#FF3B3B] enabled:hover:text-[#FF3B3B]"
                  onClick={() => confirm(false)}
                >
                  거절
                </GhostButton>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
