"use client";

/* eslint-disable @next/next/no-img-element -- 발표자가 몇 초마다 올리는 미리보기 사진 (서버가 그대로 준다) */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/common/Toast";
import { SourceCard } from "@/components/media/parts";
import { shareApi, type ShareRequest } from "@/lib/shareApi";
import type { SwitchSource } from "@/lib/switchApi";
import { cn } from "@/lib/utils";
import { channelName } from "@/constants/channels";

/** 외부 화면 받기 — 요청 목록 (송출 › 외부 화면의 빨간 숫자도 이걸로). 열어 둔 동안은 자주, 아니면 가끔 */
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
  return s >= 3600 ? `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}` : `${Math.floor(s / 60)}:${p(s % 60)}`;
}

export const shareSource = (r: ShareRequest): SwitchSource => ({ kind: "share", id: r.id, name: r.name });

function Mini({ white, className, ...rest }: { white?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg border px-2.5 font-mbc text-[12.5px] transition-colors disabled:opacity-40 md:h-[30px]",
        white ? "border-white bg-white text-[#0b0b0d]" : "border-white/12 text-white/70 hover:text-white",
        className,
      )}
    />
  );
}

/** 송출 › 외부 화면 — 발표자가 share.bssmcast.com 에서 코드로 보낸 화면.
 *  허용하면 이 채널의 소스가 되고, 카드를 눌러 고른 뒤 아래 송출 버튼으로 내보낸다 (분할이면 고른 칸에 들어간다). */
export default function ExternalSharePanel({
  channel,
  disabled,
  isOn,
  slotOf,
  onPick,
}: {
  channel: number;
  disabled?: boolean;
  /** 고른 것 (한 화면: 보낼 것 · 분할: 고른 칸에 든 것) */
  isOn: (s: SwitchSource) => boolean;
  /** 분할에서 그 외부 화면이 들어간 칸 (-1 = 없음) */
  slotOf: (s: SwitchSource) => number;
  /** 이 채널로 허용된 외부 화면을 눌렀을 때 */
  onPick: (s: SwitchSource) => void;
}) {
  const qc = useQueryClient();
  const q = useExternalShare(true, !disabled);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const room = q.data?.room ?? null;
  const requests = q.data?.requests ?? [];
  const approved = requests.filter((r) => r.status === "approved");
  const waiting = requests.filter((r) => r.status === "waiting");

  const run = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["share"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const busy = disabled || run.isPending;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-tour="media.share">
      <p className="mb-3 hidden font-mbc text-[17px] text-white md:block">외부 화면</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[#151519] px-3.5 py-2.5">
        <span className="font-pretendard text-[12.5px] text-white/45">share 코드</span>
        {room ? (
          <>
            <b className="font-mono text-[20px] font-bold tracking-[0.16em] tabular-nums text-white">
              {room.code.slice(0, 3)} {room.code.slice(3)}
            </b>
            <span className="font-pretendard text-[12px] tabular-nums text-white/40">{left(room.expiresAt, now)}</span>
            <span className="ml-auto flex gap-1.5">
              <Mini disabled={busy} onClick={() => run.mutate(() => shareApi.openRoom(channel))}>
                새 코드
              </Mini>
              <Mini disabled={busy} onClick={() => run.mutate(() => shareApi.closeRoom())}>
                받기 끝내기
              </Mini>
            </span>
          </>
        ) : (
          <Mini white className="ml-auto" data-tour="media.share-open" disabled={busy} onClick={() => run.mutate(() => shareApi.openRoom(channel))}>
            코드 만들기
          </Mini>
        )}
      </div>

      <div className="mt-3 grid min-h-0 grid-cols-2 content-start gap-2.5 overflow-auto">
        {approved.map((r) => {
          const here = r.channel === channel;
          const src = shareSource(r);
          return (
            <SourceCard
              key={r.id}
              thumb={r.hasSnapshot ? <img src={shareApi.snapshotUrl(r)} alt="" className="absolute inset-0 h-full w-full object-contain" /> : null}
              name={r.name}
              on={here && isOn(src)}
              slot={here ? slotOf(src) : -1}
              disabled={disabled || !here}
              onClick={here ? () => onPick(src) : undefined}
              sub={here ? "연결됨" : `${channelName(r.channel)}에 연결됨`}
            >
              <span className="mx-[3px] mb-0.5 mt-1.5 flex">
                <Mini
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    run.mutate(() => shareApi.end(r.id));
                  }}
                >
                  끊기
                </Mini>
              </span>
            </SourceCard>
          );
        })}
        {waiting.map((r) => (
          <SourceCard
            key={r.id}
            dashed
            thumb={
              r.hasSnapshot ? (
                <img src={shareApi.snapshotUrl(r)} alt="" className="absolute inset-0 h-full w-full object-contain" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center font-pretendard text-[12px] text-white/30">화면 고르는 중</span>
              )
            }
            name={r.name}
          >
            <span className="mx-[3px] mb-0.5 mt-1.5 flex gap-1.5">
              <Mini white disabled={busy || !r.hasSnapshot} onClick={() => run.mutate(() => shareApi.approve(r.id, channel, "source"))}>
                허용
              </Mini>
              <Mini disabled={busy} onClick={() => run.mutate(() => shareApi.reject(r.id))}>
                거절
              </Mini>
            </span>
          </SourceCard>
        ))}
      </div>
      {requests.length === 0 && (
        <p className="py-10 text-center font-pretendard text-[13.5px] text-white/35">{room ? "요청을 기다리는 중" : "받은 화면이 없어요"}</p>
      )}
    </div>
  );
}
