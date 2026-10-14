"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorUp } from "lucide-react";
import { toast } from "@/components/common/Toast";
import { avApi } from "@/lib/avApi";
import { shareApi, type ShareRequest } from "@/lib/shareApi";
import { cn } from "@/lib/utils";

/** 외부 화면 받기 — 기다리는 요청 수 (송출 화면 탭의 빨간 숫자). 열어 둔 동안은 자주, 아니면 가끔 */
export function useExternalShare(open: boolean, enabled: boolean) {
  return useQuery({
    queryKey: ["share"],
    queryFn: shareApi.overview,
    enabled,
    refetchInterval: open ? 2000 : 8000,
    retry: false,
  });
}

function left(until: string, now: number): string {
  const s = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

function minutes(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

/** 송출 › 송출 화면 › 외부 화면 — 발표자가 share.bssmcast.com 에서 코드로 보낸 화면을 허용·끊기 */
export default function ExternalSharePanel({
  channel,
  disabled,
}: {
  channel: number;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const q = useExternalShare(true, !disabled);
  const av = useQuery({ queryKey: ["av-state"], queryFn: () => avApi.state(), staleTime: 60_000 });
  const [now, setNow] = useState(() => Date.now());
  const [pick, setPick] = useState<Record<string, number>>({});
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const room = q.data?.room ?? null;
  const requests = q.data?.requests ?? [];
  const label = (n: number) => {
    const c = av.data?.channels?.find((x) => x.channel === n);
    return c?.hallName ? `CH${n} ${c.hallName}` : (c?.label ?? `CH${n}`);
  };

  const run = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["share"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!room && requests.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-white/5 bg-[#0a0a0a] p-6 text-center">
        <MonitorUp size={32} className="text-white/30" />
        <button
          type="button"
          data-tour="media.share-open"
          disabled={disabled || run.isPending}
          onClick={() => run.mutate(() => shareApi.openRoom(channel))}
          className="h-11 rounded-xl border border-[#FF3B3B]/60 bg-[#FF3B3B]/20 px-5 font-mbc text-sm text-white hover:bg-[#FF3B3B]/30 disabled:opacity-40"
        >
          코드 만들기
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col gap-3 overflow-auto rounded-2xl border border-white/5 bg-[#0a0a0a] p-3"
      data-tour="media.share"
    >
      {room ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl bg-[#151519] px-4 py-3.5">
          <div>
            <p className="font-pretendard text-[12.5px] text-white/50">share.bssmcast.com 코드</p>
            <p className="font-mono text-[30px] font-bold leading-tight tracking-[0.18em] tabular-nums text-white">
              {room.code.slice(0, 3)} {room.code.slice(3)}
            </p>
            <p className="font-pretendard text-[12.5px] tabular-nums text-white/45">
              {left(room.expiresAt, now)} 남음
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={disabled || run.isPending}
              onClick={() => run.mutate(() => shareApi.openRoom(channel))}
              className="h-10 rounded-lg border border-white/10 px-3.5 font-mbc text-sm text-white/75 hover:bg-white/10 disabled:opacity-40"
            >
              새 코드
            </button>
            <button
              type="button"
              disabled={disabled || run.isPending}
              onClick={() => run.mutate(() => shareApi.closeRoom())}
              className="h-10 rounded-lg border border-white/10 px-3.5 font-mbc text-sm text-white/75 hover:bg-white/10 disabled:opacity-40"
            >
              받기 끝내기
            </button>
          </div>
        </div>
      ) : null}

      {requests.length === 0 ? (
        <p className="px-2 py-6 text-center font-pretendard text-[14px] text-white/40">
          요청을 기다리는 중
        </p>
      ) : (
        requests.map((r: ShareRequest) => {
          const live = r.status === "approved";
          const ch = pick[r.id] ?? channel;
          return (
            <div
              key={r.id}
              className={cn(
                "grid grid-cols-[120px_minmax(0,1fr)] gap-3 rounded-xl bg-[#151519] p-2.5 md:grid-cols-[150px_minmax(0,1fr)]",
                live && "ring-1 ring-[#FF3B3B]/50",
              )}
            >
              <div className="relative aspect-video overflow-hidden rounded-lg bg-[#1d1d22]">
                {r.hasSnapshot ? (
                  // 발표자가 몇 초마다 올리는 미리보기 사진 (서버가 그대로 준다)
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shareApi.snapshotUrl(r)}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center font-pretendard text-[12px] text-white/30">
                    화면 고르는 중
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <div className="min-w-0">
                  <p className="truncate font-pretendard text-[15px] font-semibold text-white">
                    {r.name}
                  </p>
                  <p className="font-pretendard text-[12.5px] text-white/50">
                    {live ? (
                      <span className="text-[#FF6B6B]">
                        ● ON AIR {label(r.channel ?? 1)} ·{" "}
                        {minutes(r.approvedAt ?? r.createdAt, now) < 1
                          ? "방금 시작"
                          : `${minutes(r.approvedAt ?? r.createdAt, now)}분째`}
                      </span>
                    ) : minutes(r.createdAt, now) < 1 ? (
                      "방금 요청"
                    ) : (
                      `${minutes(r.createdAt, now)}분 전 요청`
                    )}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  {live ? (
                    <button
                      type="button"
                      disabled={disabled || run.isPending}
                      onClick={() => run.mutate(() => shareApi.end(r.id))}
                      className="h-9 rounded-lg border border-white/15 px-3.5 font-mbc text-sm text-white/80 hover:bg-white/10 disabled:opacity-40"
                    >
                      끊기
                    </button>
                  ) : (
                    <>
                      <select
                        value={ch}
                        onChange={(e) => setPick((p) => ({ ...p, [r.id]: Number(e.target.value) }))}
                        className="h-9 rounded-lg border border-white/10 bg-[#0c0d0f] px-2 font-pretendard text-[13px] text-white"
                        aria-label="보낼 채널"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {label(n)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={disabled || run.isPending}
                        onClick={() => run.mutate(() => shareApi.reject(r.id))}
                        className="h-9 rounded-lg border border-white/15 px-3.5 font-mbc text-sm text-white/75 hover:bg-white/10 disabled:opacity-40"
                      >
                        거절
                      </button>
                      <button
                        type="button"
                        disabled={disabled || run.isPending || !r.hasSnapshot}
                        onClick={() => run.mutate(() => shareApi.approve(r.id, ch))}
                        className="h-9 rounded-lg border border-[#FF3B3B]/60 bg-[#FF3B3B]/25 px-4 font-mbc text-sm text-white hover:bg-[#FF3B3B]/35 disabled:opacity-40"
                      >
                        허용
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
