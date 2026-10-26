"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { qrSvg } from "@/lib/qrSvg";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Laptop, Loader2, Monitor, Plus, Smartphone, Tablet, X } from "lucide-react";
import Portal from "@/components/common/Portal";
import ConfirmModal from "@/components/common/ConfirmModal";
import NeonButton from "@/components/common/NeonButton";
import { toast } from "@/components/common/Toast";
import { useMe } from "@/hooks/useMe";
import { memberApi } from "@/lib/memberApi";
import type { DeviceInviteCreated, MemberDevice } from "@/types/member";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";

const MAX_DEVICES = 5; // 서버와 같은 값 (member_service.MAX_DEVICES)

export function DeviceIcon({ name, size = 18 }: { name: string; size?: number }) {
  const n = name.toLowerCase();
  if (/iphone|android|폰/.test(n)) return <Smartphone size={size} />;
  if (/ipad|탭|tablet/.test(n)) return <Tablet size={size} />;
  if (/mac|노트북|laptop/.test(n)) return <Laptop size={size} />;
  return <Monitor size={size} />;
}

function day(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function seen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? "오늘" : day(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 기기 한 줄 — 이름 · 이 기기 / 최근 접속 / 추가한 날 · [끊기] */
export function DeviceRow({
  d,
  current,
  onRemove,
}: {
  d: MemberDevice;
  current?: boolean;
  onRemove?: () => void;
}) {
  const sub = current ? "이 기기" : d.lastSeenAt ? `최근 접속 ${seen(d.lastSeenAt)}` : `${day(d.addedAt)} ${d.primary ? "등록" : "추가"}`;
  return (
    <li className="flex min-h-[56px] items-center gap-3 rounded-[14px] border border-white/[0.07] bg-black/25 px-4 py-2.5">
      <span className={current ? "text-white" : "text-white/45"}>
        <DeviceIcon name={d.name} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-pretendard text-[15px] font-semibold text-white">{d.name}</p>
        <p className="flex items-center gap-1.5 font-pretendard text-[12.5px] text-white/45">
          {current && <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B3B] shadow-[0_0_6px_#FF3B3B]" />}
          {sub}
        </p>
      </div>
      {onRemove && (
        <NeonButton tone="white" onClick={onRemove} className="h-10 shrink-0 md:h-9">
          끊기
        </NeonButton>
      )}
    </li>
  );
}

function left(until: string, now: number): string {
  const ms = new Date(until).getTime() - now;
  if (!(ms > 0)) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 다른 기기 추가 — QR 과 8자리 코드 (30분). 새 기기가 붙으면 목록으로 돌아간다 */
function AddDevice({ invite, onBack }: { invite: DeviceInviteCreated; onBack: () => void }) {
  const svg = useMemo(() => {
    try {
      return qrSvg(invite.qr);
    } catch {
      return "";
    }
  }, [invite.qr]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remain = left(invite.expiresAt, now);
  const alive = remain !== "0:00";
  const code = `${invite.code.slice(0, 4)}-${invite.code.slice(4)}`;

  return (
    <div className="grid items-center gap-5 md:grid-cols-[200px_minmax(0,1fr)] md:gap-6">
      <div className="aspect-square w-full max-w-[200px] justify-self-center rounded-xl bg-white p-3">
        {svg ? (
          // qrcode 가 만든 SVG 문자열 (서버가 준 링크만 담는다)
          <div className={`h-full w-full [&>svg]:h-full [&>svg]:w-full ${alive ? "" : "opacity-20"}`} dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="flex h-full items-center justify-center font-pretendard text-xs text-black/40">QR 만드는 중…</div>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1.5 rounded-[14px] border border-white/[0.08] bg-[#0a0a0c] px-[18px] py-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
          <span className="font-pretendard text-[13px] font-semibold text-white/50">
            {alive ? `코드 · ${remain} 남음` : "코드 만료"}
          </span>
          <b
            className={`font-mono text-[36px] font-bold leading-[1.1] tracking-[0.06em] md:text-[40px] ${alive ? "text-white" : "text-white/25 line-through"}`}
          >
            {code}
          </b>
        </div>
        <p className="truncate font-mono text-[11px] text-white/30" title={invite.server}>
          서버 {invite.server}
          {!invite.cloudflare && " · 개발용 토큰"}
        </p>
        <div className="flex justify-end">
          <NeonButton tone="white" className="max-md:w-full" onClick={onBack}>
            목록으로
          </NeonButton>
        </div>
      </div>
    </div>
  );
}

/** 내 기기 — 내가 쓰는 기기 목록, 하나씩 끊기, [다른 기기 추가] */
export default function MyDevicesModal({ onClose }: { onClose: () => void }) {
  const { me, refetch } = useMe();
  const qc = useQueryClient();
  const [invite, setInvite] = useState<DeviceInviteCreated | null>(null);
  const [removing, setRemoving] = useState<MemberDevice | null>(null);
  const devices = me?.devices ?? [];
  const count = useRef(devices.length);

  // QR 을 띄운 동안 3초마다 내 기기 목록을 다시 본다 — 새 기기가 붙으면 목록으로
  useVisibleInterval(() => refetch(), invite ? 3000 : null, { immediate: false });
  const lastName = devices[devices.length - 1]?.name;
  useEffect(() => {
    if (invite && devices.length > count.current) {
      toast.success(`${lastName ?? "새 기기"} 추가됨`);
      setInvite(null);
    }
    count.current = devices.length;
  }, [devices.length, lastName, invite]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const start = useMutation({
    mutationFn: memberApi.deviceInvite,
    onSuccess: (res) => {
      count.current = devices.length;
      setInvite(res);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => memberApi.removeMyDevice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("기기를 끊었어요");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const full = devices.length >= MAX_DEVICES;

  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm max-md:items-end max-md:pb-[calc(16px+env(safe-area-inset-bottom))] max-md:pt-[calc(16px+env(safe-area-inset-top))]">
        <div className="absolute inset-0" onClick={onClose} />
        <div
          role="dialog"
          aria-label="내 기기"
          data-tour="my-devices"
          className="relative z-10 flex max-h-full w-full max-w-[560px] flex-col gap-4 overflow-y-auto rounded-[20px] border border-white/10 bg-[#151515] p-5 shadow-2xl md:rounded-[24px] md:p-7"
        >
          <div className="flex items-center gap-3">
            <h2 className="font-mbc text-2xl text-white">{invite ? "다른 기기 추가" : "내 기기"}</h2>
            {!invite && devices.length > 0 && (
              <span className="font-orbitron text-[12px] tracking-widest text-white/35">
                {devices.length}/{MAX_DEVICES}
              </span>
            )}
            <button
              onClick={onClose}
              className="-mr-2 ml-auto rounded-full p-2.5 text-white/50 hover:bg-white/10 hover:text-white md:mr-0 md:p-1"
              aria-label="닫기"
            >
              <X size={20} />
            </button>
          </div>

          {invite ? (
            <AddDevice invite={invite} onBack={() => setInvite(null)} />
          ) : (
            <>
              <ul data-tour="my-devices.list" className="flex flex-col gap-2">
                {devices.map((d) => (
                  <DeviceRow
                    key={d.id}
                    d={d}
                    current={d.id === me?.deviceId}
                    onRemove={d.id !== me?.deviceId && devices.length > 1 ? () => setRemoving(d) : undefined}
                  />
                ))}
              </ul>
              <NeonButton
                data-tour="my-devices.add"
                className="h-12 w-full md:h-12"
                icon={start.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                disabled={full || start.isPending}
                onClick={() => start.mutate()}
              >
                {full ? `기기는 ${MAX_DEVICES}대까지` : "다른 기기 추가"}
              </NeonButton>
            </>
          )}
        </div>
      </div>
      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id);
          setRemoving(null);
        }}
        title="기기 끊기"
        message={`${removing?.name ?? "이 기기"}에서는 더 이상 ONAIR에 들어올 수 없어요`}
        confirmText="끊기"
        isDestructive
      />
    </Portal>
  );
}

/** 부장 이상 — 한 사람의 기기 목록과 하나씩 끊기 (기기 전부는 [내보내기]) */
export function MemberDevicesModal({
  name,
  memberId,
  devices,
  onClose,
}: {
  name: string;
  memberId: string;
  devices: MemberDevice[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { me } = useMe();
  const [removing, setRemoving] = useState<MemberDevice | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => memberApi.removeDevice(memberId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("기기를 끊었어요");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mine = me?.memberId === memberId;
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm max-md:items-end max-md:pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="absolute inset-0" onClick={onClose} />
        <div role="dialog" aria-label={`${name} 기기`} className="relative z-10 flex max-h-full w-full max-w-[480px] flex-col gap-4 overflow-y-auto rounded-[20px] border border-white/10 bg-[#151515] p-5 shadow-2xl md:rounded-[24px] md:p-7">
          <div className="flex items-center gap-3">
            <h2 className="min-w-0 truncate font-mbc text-2xl text-white">{name} 기기</h2>
            <button onClick={onClose} className="-mr-2 ml-auto rounded-full p-2.5 text-white/50 hover:bg-white/10 hover:text-white md:mr-0 md:p-1" aria-label="닫기">
              <X size={20} />
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {devices.map((d) => {
              const current = mine && d.id === me?.deviceId;
              return (
                <DeviceRow
                  key={d.id}
                  d={d}
                  current={current}
                  onRemove={!current && devices.length > 1 ? () => setRemoving(d) : undefined}
                />
              );
            })}
          </ul>
        </div>
      </div>
      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id);
          setRemoving(null);
        }}
        title="기기 끊기"
        message={`${name} 님의 ${removing?.name ?? "기기"}에서는 더 이상 ONAIR에 들어올 수 없어요`}
        confirmText="끊기"
        isDestructive
      />
    </Portal>
  );
}
