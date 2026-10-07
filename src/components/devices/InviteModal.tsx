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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 grid w-full max-w-[720px] items-center gap-6 rounded-[24px] border border-white/10 bg-[#151515] p-7 shadow-2xl sm:grid-cols-[230px_minmax(0,1fr)]">
        <div className="aspect-square w-full max-w-[230px] justify-self-center rounded-xl bg-white p-3">
          {svg ? (
            // qrcode 가 만든 SVG 문자열 (서버가 준 링크만 담는다)
            <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="flex h-full items-center justify-center font-pretendard text-xs text-black/40">QR 만드는 중…</div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="min-w-0 truncate font-mbc text-2xl text-white">
              {invite.invite.memberId && invite.invite.note ? `${invite.invite.note} 초대` : "새 부원 초대"}
            </h2>
            <span
              className="ml-auto inline-flex h-[34px] items-center rounded-[10px] border border-red-400/50 bg-red-400/[0.12] px-3.5 font-mono text-[15px] font-bold tabular-nums text-white"
              title="QR 을 쓸 수 있는 남은 시간"
            >
              {clock(invite.invite.expiresAt, now)}
            </span>
            <button onClick={onClose} className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white" aria-label="닫기">
              <X size={20} />
            </button>
          </div>

          <p className="font-pretendard text-sm leading-relaxed text-white/60">
            새 부원의 노트북에서 ONAIR 앱을 열고 이 QR 을 찍게 하세요. 직접 만나서 찍는 게 가장 안전해요. QR 은 24시간 동안 쓸 수
            있어요.
            {invite.invite.memberId && (
              <span className="mt-1 block">이 QR 로 등록하면 방송부 명단의 그 기록(직함·소개)에 기기가 붙어요.</span>
            )}
          </p>

          <div className="flex flex-col gap-1.5 rounded-[14px] border border-white/[0.08] bg-[#0a0a0c] px-[18px] py-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
            <span className="font-pretendard text-[13px] font-semibold text-white/50">
              {codeAlive
                ? `못 만날 때 쓰는 코드 · ${codeLeft} 남음 · 1번만`
                : "코드 시간이 지났어요 — QR 은 아직 쓸 수 있어요"}
            </span>
            <b
              className={`font-mono text-[40px] font-bold leading-[1.1] tracking-[0.06em] ${codeAlive ? "text-white" : "text-white/25 line-through"}`}
            >
              {code}
            </b>
          </div>

          <p className="font-pretendard text-[13px] leading-relaxed text-white/50">
            이 창을 닫으면 QR 과 코드는 다시 볼 수 없어요. 필요하면 새로 초대하세요.
            {!invite.cloudflare && (
              <span className="mt-1 block text-xs text-white/45">
                Cloudflare 가 아직 꺼져 있어 학교 안(Tailscale)에서만 쓸 수 있는 개발용 토큰입니다.
              </span>
            )}
          </p>
          <p className="-mt-2 truncate font-mono text-[11px] text-white/30" title={invite.server}>
            서버 {invite.server}
          </p>

          <div className="flex justify-end gap-2">
            <ActionButton tone="ghost" className="border-white/15" onClick={onCancelInvite}>
              초대 취소
            </ActionButton>
            <ActionButton onClick={onClose}>닫기</ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
