"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Laptop, Monitor, Smartphone } from "lucide-react";
import InputModal from "@/components/common/InputModal";
import EmptyState from "@/components/common/EmptyState";
import NeonButton from "@/components/common/NeonButton";
import Select from "@/components/common/Select";
import { toast } from "@/components/common/Toast";
import { TimeConfirm } from "@/components/time/TimeToolbar";
import { RowMenu, StatusDot, adminField, adminPanel, chipCls } from "@/components/devices/adminUi";
import { useMe } from "@/hooks/useMe";
import { del, put, request, seg, HttpError } from "@/lib/http";
import { cn } from "@/lib/utils";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";

/* 관리 › 기기 (시안 기기) — 이 기기 줄 + 기기 등록, Tailscale IP 기기 목록(권한·마지막 접속·⋯) */

/** 예전 기기(Tailscale IP) 역할 — 서버는 admin=부장, operator=부원, viewer=보기로 읽는다 */
type DeviceRole = "admin" | "operator" | "viewer";

interface Device {
  ip: string;
  name: string;
  owner: string;
  role: DeviceRole;
  label: string;
  lastSeenAt: string | null;
  online: boolean;
  userAgent?: string;
}

const ROLES: { value: DeviceRole; label: string }[] = [
  { value: "viewer", label: "보기" },
  { value: "operator", label: "부원" },
  { value: "admin", label: "부장" },
];

type Kind = "phone" | "laptop" | "pc";

/** 이름이나 User-Agent 로 기기 종류 짐작. 모르면 PC */
function kindOf(d: Device): Kind {
  const n = `${d.label} ${d.name}`.toLowerCase();
  const ua = (d.userAgent ?? "").toLowerCase();
  if (/iphone|android|폰|phone|galaxy/.test(n) || /iphone|android.*mobile|mobile safari/.test(ua)) return "phone";
  if (/macbook|노트북|laptop|그램|gram|ipad|탭|tablet/.test(n) || /ipad|macintosh/.test(ua)) return "laptop";
  return "pc";
}

function KindIcon({ d }: { d: Device }) {
  const k = kindOf(d);
  const Icon = k === "phone" ? Smartphone : k === "laptop" ? Laptop : Monitor;
  return (
    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-white/[0.12] text-white/70">
      <Icon size={16} />
    </span>
  );
}

/** 마지막 접속 — 접속 중(1분 안) · 방금 · n분 전 · n시간 전 · 어제 · n일 전 · 날짜 */
function lastSeen(d: Device): string {
  if (!d.lastSeenAt) return "기록 없음";
  const t = new Date(d.lastSeenAt);
  if (Number.isNaN(t.getTime())) return "기록 없음";
  const s = Math.max(0, (Date.now() - t.getTime()) / 1000);
  if (s < 120) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  const today = new Date();
  const days = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) /
      86400_000,
  );
  if (days <= 0) return `${Math.floor(s / 3600)}시간 전`;
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  return `${t.getFullYear()}. ${t.getMonth() + 1}. ${t.getDate()}.`;
}

function LastSeen({ d }: { d: Device }) {
  if (d.online)
    return (
      <span className="inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap font-pretendard text-[13px] font-medium text-white/80">
        <StatusDot ok />
        접속 중
      </span>
    );
  return (
    <span className="shrink-0 whitespace-nowrap font-pretendard text-[13px] font-medium text-white/45" title={d.lastSeenAt?.replace("T", " ") ?? undefined}>
      {lastSeen(d)}
    </span>
  );
}

const roleCls = "h-11 gap-1.5 rounded-[8px] border-white/[0.12] bg-transparent px-2.5 font-mbc text-[12.5px] md:h-7";

const errText = (e: unknown) => (e instanceof HttpError || e instanceof Error ? e.message : "저장하지 못했어요");

export default function DevicesPanel({ onDenied }: { onDenied: () => void }) {
  const { me } = useMe();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<DeviceRole>("operator");
  const [renaming, setRenaming] = useState<Device | null>(null);
  const [removing, setRemoving] = useState<Device | null>(null);
  const [busy, setBusy] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  // 기기 등록 칸은 목록 아래 — 열면 보이게 민다
  useEffect(() => {
    if (adding) requestAnimationFrame(() => addRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }, [adding]);

  const fetchDevices = useCallback(async () => {
    try {
      const data = await request<{ devices: Device[] }>("/devices");
      setDevices(data.devices ?? []);
    } catch (e) {
      if (e instanceof HttpError && e.status === 403) onDenied();
      else setDevices((d) => d ?? []);
    }
  }, [onDenied]);

  useVisibleInterval(fetchDevices, 30_000); // 마지막 접속·접속 중

  const save = useCallback(
    async (ip: string, patch: { label?: string; role?: DeviceRole }, done = "저장했어요") => {
      setBusy(true);
      try {
        await put(`/devices/${seg(ip)}`, patch);
        toast.success(done);
        await fetchDevices();
        return true;
      } catch (e) {
        toast.error(errText(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [fetchDevices],
  );

  const remove = async (d: Device) => {
    setBusy(true);
    try {
      await del(`/devices/${seg(d.ip)}`);
      toast.success(`${d.label || d.name} 기기를 지웠어요`);
      await fetchDevices();
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const ip = newIp.trim();
  const ipOk = /^[0-9a-fA-F.:]{3,45}$/.test(ip);
  const register = async () => {
    if (!ipOk) return;
    const ok = await save(ip, { role: newRole, ...(newName.trim() ? { label: newName.trim() } : {}) }, "기기를 등록했어요");
    if (ok) {
      setNewIp("");
      setNewName("");
      setNewRole("operator");
      setAdding(false);
    }
  };

  const roleSelect = (d: Device, className?: string) => (
    <Select
      value={d.role}
      onChange={(role) => save(d.ip, { role }, `${d.label || d.name} 권한을 ${ROLES.find((r) => r.value === role)?.label}으로 바꿨어요`)}
      options={ROLES}
      disabled={busy}
      aria-label={`${d.label || d.name} 권한`}
      className={cn(roleCls, className)}
      contentClassName="min-w-[120px]"
    />
  );

  const menu = (d: Device, first: boolean) => (
    <RowMenu
      tour={first ? "devices.more" : undefined}
      label={`${d.label || d.name} 더 보기`}
      items={[
        { label: "이름 바꾸기", onClick: () => setRenaming(d) },
        { label: "지우기", danger: true, onClick: () => setRemoving(d) },
      ]}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pb-4 md:overflow-auto">
      {/* 이 기기 + 기기 등록 */}
      <div className="flex items-center gap-3">
        <div data-tour="devices.my-ip" className={cn(adminPanel, "flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 px-4 py-2.5")}>
          <StatusDot ok />
          <span className="shrink-0 font-pretendard text-[13px] font-medium text-white/70">이 기기</span>
          <span className="min-w-0 truncate font-orbitron text-[13px] text-white">{me?.ip ?? ""}</span>
          {me?.roleLabel && (
            <span className="inline-flex h-7 shrink-0 items-center rounded-[8px] border border-white/[0.12] px-2.5 font-mbc text-[12.5px] text-white">
              {me.roleLabel}
            </span>
          )}
        </div>
        <NeonButton data-tour="devices.add.open" className="max-md:px-4" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          기기 등록
        </NeonButton>
      </div>

      {/* 기기 목록 */}
      <div data-tour="devices.table" className={cn(adminPanel, "px-1 py-1.5")}>
        <div className="hidden h-10 grid-cols-[34px_minmax(0,1fr)_170px_110px_130px_36px] items-center gap-3 px-4 font-mbc text-[12.5px] text-white/40 md:grid">
          <span />
          <span>기기</span>
          <span>Tailscale IP</span>
          <span>권한</span>
          <span>마지막 접속</span>
          <span />
        </div>
        {devices === null ? (
          <p className="px-4 py-8 text-center font-pretendard text-sm text-white/35">불러오는 중…</p>
        ) : devices.length === 0 ? (
          <EmptyState>기기가 없어요</EmptyState>
        ) : (
          devices.map((d, i) => (
            <div key={d.ip} className="border-t border-white/[0.05] first:border-t-0 md:first:border-t">
              {/* PC */}
              <div className="hidden h-[60px] grid-cols-[34px_minmax(0,1fr)_170px_110px_130px_36px] items-center gap-3 px-4 md:grid">
                <KindIcon d={d} />
                <span className="min-w-0 truncate font-pretendard text-[14px] font-bold text-white" title={d.owner ? `${d.label || d.name} · ${d.owner}` : undefined}>
                  {d.label || d.name}
                  {d.owner && <span className="ml-2 font-medium text-white/35">{d.owner}</span>}
                </span>
                <span className="truncate font-orbitron text-[12.5px] text-white/70">{d.ip}</span>
                <span>{roleSelect(d)}</span>
                <LastSeen d={d} />
                {menu(d, i === 0)}
              </div>
              {/* 폰 */}
              <div className="flex items-center gap-3 px-3 py-3 md:hidden">
                <KindIcon d={d} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="min-w-0 truncate font-pretendard text-[15px] font-bold text-white">{d.label || d.name}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate font-orbitron text-[12px] text-white/60">{d.ip}</span>
                    <LastSeen d={d} />
                  </span>
                </div>
                {roleSelect(d, "shrink-0")}
                {menu(d, false)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 기기 등록 */}
      {adding && (
        <div ref={addRef} data-tour="devices.add" className={cn(adminPanel, "flex w-full scroll-mb-24 flex-col gap-3 p-4 md:max-w-[560px] md:p-5")}>
          <h3 className="font-mbc text-[17px] text-white">기기 등록</h3>
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              data-tour="devices.add.ip"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && register()}
              placeholder="Tailscale IP 100.x.x.x"
              inputMode="decimal"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-label="Tailscale IP"
              className={cn(adminField, "md:h-[42px] md:flex-1")}
            />
            <input
              data-tour="devices.add.name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && register()}
              placeholder="이름"
              maxLength={40}
              aria-label="이름"
              className={cn(adminField, "md:h-[42px] md:w-[180px]")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div data-tour="devices.add.role" role="radiogroup" aria-label="권한" className="flex gap-1.5">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={newRole === r.value}
                  onClick={() => setNewRole(r.value)}
                  className={cn(chipCls(newRole === r.value), "font-mbc md:h-[34px]")}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2 max-md:mt-1 max-md:w-full">
              <NeonButton tone="white" onClick={() => setAdding(false)} className="max-md:flex-1">
                취소
              </NeonButton>
              <NeonButton data-tour="devices.add.submit" className="min-w-[120px] max-md:flex-1" disabled={!ipOk || busy} onClick={register}>
                등록
              </NeonButton>
            </div>
          </div>
        </div>
      )}

      <InputModal
        isOpen={!!renaming}
        onClose={() => setRenaming(null)}
        title="기기 이름 바꾸기"
        placeholder="이름"
        initialValue={renaming ? renaming.label || renaming.name : ""}
        confirmText="바꾸기"
        onConfirm={async (v) => {
          if (renaming) await save(renaming.ip, { label: v.trim() }, "이름을 바꿨어요");
          setRenaming(null);
        }}
      />
      <TimeConfirm
        open={!!removing}
        title="기기 지우기"
        message={removing ? `${removing.label || removing.name} (${removing.ip})\n지우면 이 IP 는 보기 권한으로 돌아가요.` : ""}
        confirmText="지우기"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
      />
    </div>
  );
}
