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
      <div className="relative z-10 w-full max-w-[760px] rounded-[24px] border border-white/10 bg-[#151515] p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-mbc text-2xl text-white">새 부원 초대</h2>
            <p className="mt-1 font-pretendard text-[13px] text-white/45">
              새 부원의 노트북에서 ONAIR 앱을 열고 이 QR 을 찍으면 됩니다. QR 은 24시간, 코드는 30분 동안 쓸 수 있어요.
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white" aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 grid gap-7 sm:grid-cols-[250px_1fr]">
          <div className="h-[250px] w-[250px] rounded-[18px] bg-white p-4">
            {svg ? (
              // qrcode 가 만든 SVG 문자열 (서버가 준 링크만 담는다)
              <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            ) : (
              <div className="flex h-full items-center justify-center font-pretendard text-xs text-black/40">QR 만드는 중…</div>
            )}
          </div>

          <div className="min-w-0">
            <span className="font-mbc text-[13px] text-white/55">QR 을 못 찍으면 이 코드를 입력하세요</span>
            <p className={`mt-1.5 font-orbitron text-[34px] tracking-[0.18em] ${codeAlive ? "text-white" : "text-white/25 line-through"}`}>
              {code}
            </p>
            <span className="flex items-center gap-2 font-pretendard text-[13px] text-white/55">
              <span
                className={`h-2 w-2 rounded-full ${codeAlive ? "bg-[#00FF57] shadow-[0_0_8px_#00FF57]" : "bg-white/25"}`}
              />
              {codeAlive ? `${codeLeft} 남음 · 한 번만 쓸 수 있어요` : "코드 시간이 지났어요 — QR 은 아직 쓸 수 있어요"}
            </span>

            <ol className="mt-5 flex flex-col gap-2.5">
              {[
                "ONAIR 앱 설치 후 실행",
                "[초대 QR 찍기] 또는 [코드 입력]",
                "이름 · 기수 · 소개 적고 등록 신청",
                "여기 ‘승인 대기’에 뜨면 역할 골라 승인",
              ].map((t, i) => (
                <li key={t} className="flex gap-2.5 font-pretendard text-sm text-white/70">
                  <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-white/10 font-orbitron text-[11px]">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>

            <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 font-pretendard text-[13px] text-amber-100/90">
              이 창을 닫으면 QR 과 코드는 다시 볼 수 없어요. 필요하면 새로 초대하세요.
              {!invite.cloudflare && (
                <span className="mt-1 block text-xs text-white/45">
                  Cloudflare 가 아직 꺼져 있어 학교 안(Tailscale)에서만 쓸 수 있는 개발용 토큰입니다.
                </span>
              )}
            </p>
            <p className="mt-2 truncate font-mono text-[11px] text-white/25" title={invite.server}>
              서버 {invite.server}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <ActionButton tone="ghost" onClick={onCancelInvite}>
            초대 취소
          </ActionButton>
          <ActionButton onClick={onClose}>닫기</ActionButton>
        </div>
      </div>
    </div>
  );
}
