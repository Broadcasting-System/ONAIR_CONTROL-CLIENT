"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X } from "lucide-react";
import { ActionButton } from "@/components/hall/setup/ui";
import type { InviteCreated } from "@/types/member";

function left(until: string, now: number): string {
  const ms = new Date(until).getTime() - now;
  if (!(ms > 0)) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** QR 남은 시간 — 23:59:41 */
function clock(until: string, now: number): string {
  const ms = new Date(until).getTime() - now;
  if (!(ms > 0)) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** 새 부원 초대 — QR(onair://register…)과 30분짜리 코드. 이 창을 닫으면 다시 볼 수 없다 */
export default function InviteModal({
  invite,
  onClose,
  onCancelInvite,
}: {
  invite: InviteCreated;
  onClose: () => void;
  onCancelInvite: () => void;
}) {
  const [svg, setSvg] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    // 비밀값이 길어 QR 이 촘촘하다 — 노트북 카메라로 찍기 쉽게 오류 정정은 낮게(L)
    QRCode.toString(invite.qr, { type: "svg", errorCorrectionLevel: "L", margin: 0, color: { dark: "#111111", light: "#ffffff" } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [invite.qr]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const codeLeft = left(invite.invite.codeExpiresAt, now);
  const codeAlive = codeLeft !== "0:00";
  const code = `${invite.code.slice(0, 4)}-${invite.code.slice(4)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm max-md:pb-[calc(78px+env(safe-area-inset-bottom))] max-md:pt-[calc(16px+env(safe-area-inset-top))]">
      <div className="absolute inset-0" onClick={onClose} />
      <div data-tour="members.invite-modal" className="relative z-10 grid max-h-full w-full max-w-[720px] items-center gap-4 overflow-y-auto rounded-[20px] border border-white/10 bg-[#151515] p-5 shadow-2xl md:max-h-none md:grid-cols-[230px_minmax(0,1fr)] md:gap-6 md:overflow-visible md:rounded-[24px] md:p-7">
        <div data-tour="members.invite-qr" className="order-2 aspect-square w-full max-w-[230px] justify-self-center rounded-xl bg-white p-3 md:order-none">
          {svg ? (
            // qrcode 가 만든 SVG 문자열 (서버가 준 링크만 담는다)
            <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="flex h-full items-center justify-center font-pretendard text-xs text-black/40">QR 만드는 중…</div>
          )}
        </div>

        <div className="contents md:flex md:min-w-0 md:flex-col md:gap-4">
          <div className="order-1 flex items-center gap-3 md:order-none">
            <h2 className="min-w-0 truncate font-mbc text-2xl text-white">
              {invite.invite.memberId && invite.invite.note ? `${invite.invite.note} 초대` : "새 부원 초대"}
            </h2>
            <span
              className="ml-auto inline-flex h-[34px] items-center rounded-[10px] border border-red-400/50 bg-red-400/[0.12] px-3.5 font-mono text-[15px] font-bold tabular-nums text-white"
              title="QR 남은 시간"
            >
              {clock(invite.invite.expiresAt, now)}
            </span>
            <button onClick={onClose} className="-mr-2 rounded-full p-2.5 text-white/50 hover:bg-white/10 hover:text-white md:mr-0 md:p-1" aria-label="닫기">
              <X size={20} />
            </button>
          </div>

          <div data-tour="members.invite-code" className="order-3 flex flex-col gap-1.5 md:order-none rounded-[14px] border border-white/[0.08] bg-[#0a0a0c] px-[18px] py-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
            <span className="font-pretendard text-[13px] font-semibold text-white/50">
              {codeAlive ? `코드 · ${codeLeft} 남음` : "코드 만료"}
            </span>
            <b
              className={`font-mono text-[40px] font-bold leading-[1.1] tracking-[0.06em] ${codeAlive ? "text-white" : "text-white/25 line-through"}`}
            >
              {code}
            </b>
          </div>

          <p className="order-4 truncate font-mono text-[11px] text-white/30 md:order-none" title={invite.server}>
            서버 {invite.server}
            {!invite.cloudflare && " · 개발용 토큰"}
          </p>

          <div className="order-5 grid grid-cols-2 gap-2 md:order-none md:flex md:justify-end">
            <ActionButton tone="ghost" className="border-white/15 max-md:h-11" onClick={onCancelInvite}>
              초대 취소
            </ActionButton>
            <ActionButton className="max-md:h-11" onClick={onClose}>닫기</ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
