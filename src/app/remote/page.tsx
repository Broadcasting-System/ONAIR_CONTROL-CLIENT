"use client";

import { useCallback, useState } from "react";
import { getApiBase } from "@/lib/apiBase";
import { cn } from "@/lib/utils";
import { toast } from "@/components/common/Toast";
import { ToastHost } from "@/components/common/Toast";
import { useMe } from "@/hooks/useMe";
import { useHealth } from "@/hooks/useHealth";
import { useSpeakers } from "@/hooks/useSpeakers";
import { useTts } from "@/hooks/useTts";
import { MAX_CHANNELS } from "@/stores/channelStore";
import { clearBanner } from "@/lib/bannerApi";

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자",
  operator: "운영",
  viewer: "보기 전용",
};

export default function RemotePage() {
  const { me, role, canOperate } = useMe();
  const { health } = useHealth(2000);
  const { toggleSpeaker, allOff } = useSpeakers();
  const { text, setText, handleSend, isSending } = useTts();
  const [stopping, setStopping] = useState(false);

  const clearChannel = useCallback(async (ch: number) => {
    const qs = ch > 1 ? `?channel=${ch}` : "";
    try {
      await fetch(`${getApiBase()}/display/clear${qs}`, { method: "POST" });
    } catch {
      /* ignore */
    }
  }, []);

  const emergencyStop = useCallback(async () => {
    setStopping(true);
    try {
      await Promise.all(
        Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1).map((ch) => clearChannel(ch)),
      );
      await clearBanner().catch(() => {});
      await allOff();
      toast.success("전체 송출·스피커를 정지했습니다.");
    } finally {
      setStopping(false);
    }
  }, [clearChannel, allOff]);

  return (
    <main className="min-h-[100dvh] w-full bg-black px-4 py-5 text-white">
      <ToastHost />

      {/* 상태바 */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div>
          <p className="font-mbc text-sm text-white/80">{me?.name ?? "연결 중…"}</p>
          <p className="font-orbitron text-[10px] uppercase tracking-widest text-white/30">
            {ROLE_LABEL[role] ?? role} · 리모컨
          </p>
        </div>
        {health && (
          <div className="flex items-center gap-1.5">
            {health.matrix.connected ? null : (
              <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[10px] text-amber-200">
                ⚠️ 매트릭스
              </span>
            )}
          </div>
        )}
      </div>

      {!canOperate && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center font-pretendard text-xs text-amber-200/80">
          보기 전용 권한입니다. 조작하려면 관리자에게 운영 권한을 요청하세요.
        </p>
      )}

      {/* 긴급 정지 */}
      <button
        onClick={emergencyStop}
        disabled={!canOperate || stopping}
        className="mb-5 h-24 w-full rounded-2xl border-2 border-red-500/60 bg-red-600/20 font-mbc text-2xl font-bold text-red-100 active:bg-red-600/40 disabled:opacity-40"
      >
        {stopping ? "정지 중…" : "🔴 전체 긴급 정지"}
      </button>

      {/* 채널 끄기 */}
      <p className="mb-2 font-mbc text-sm text-white/40">채널별 끄기</p>
      <div className="mb-5 grid grid-cols-5 gap-2">
        {Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1).map((ch) => {
          const live = health?.channels[String(ch)]?.live ?? false;
          return (
            <button
              key={ch}
              onClick={() => clearChannel(ch)}
              disabled={!canOperate}
              className="relative flex h-16 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] font-orbitron text-lg active:bg-white/10 disabled:opacity-40"
            >
              {ch}
              <span
                className={cn(
                  "absolute right-1.5 top-1.5 h-2 w-2 rounded-full",
                  live ? "bg-emerald-400" : "bg-white/20",
                )}
              />
            </button>
          );
        })}
      </div>

      {/* 스피커 빠른 토글 */}
      <p className="mb-2 font-mbc text-sm text-white/40">스피커</p>
      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          onClick={() => toggleSpeaker("grade")}
          disabled={!canOperate}
          className="h-16 rounded-xl border border-white/10 bg-white/[0.03] font-mbc text-base active:bg-white/10 disabled:opacity-40"
        >
          학년 전체
        </button>
        <button
          onClick={() => toggleSpeaker("all")}
          disabled={!canOperate}
          className="h-16 rounded-xl border border-white/10 bg-white/[0.03] font-mbc text-base active:bg-white/10 disabled:opacity-40"
        >
          학교 전체
        </button>
      </div>

      {/* 빠른 TTS */}
      <p className="mb-2 font-mbc text-sm text-white/40">빠른 TTS (켜진 스피커로 송출)</p>
      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="방송할 텍스트"
          className="resize-none rounded-xl border border-white/10 bg-[#141414] px-4 py-3 font-pretendard text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!canOperate || !text.trim() || isSending}
          className="h-14 rounded-xl border border-white/15 bg-white/10 font-mbc text-lg active:bg-white/15 disabled:opacity-40"
        >
          {isSending ? "송출 중…" : "TTS 송출"}
        </button>
      </div>
    </main>
  );
}
