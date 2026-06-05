"use client";

import { useCallback, useEffect, useState } from "react";
import SectionHeader from "@/components/common/SectionHeader";
import { getApiBase } from "@/lib/apiBase";
import { cn } from "@/lib/utils";
import { toast } from "@/components/common/Toast";
import { useMe, Role } from "@/hooks/useMe";

interface Device {
  ip: string;
  name: string;
  owner: string;
  role: Role;
  label: string;
}

const ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "관리자" },
  { value: "operator", label: "운영" },
  { value: "viewer", label: "보기 전용" },
];

export default function DevicesPage() {
  const { me } = useMe();
  const [devices, setDevices] = useState<Device[]>([]);
  const [denied, setDenied] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [newRole, setNewRole] = useState<Role>("operator");

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/devices`);
      if (res.status === 403) {
        setDenied(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices ?? []);
        setDenied(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const save = useCallback(
    async (ip: string, patch: { label?: string; role?: Role }) => {
      try {
        const res = await fetch(`${getApiBase()}/devices/${encodeURIComponent(ip)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error();
        toast.success("기기 설정을 저장했습니다.");
        fetchDevices();
      } catch {
        toast.error("저장 실패 (권한 또는 네트워크).");
      }
    },
    [fetchDevices],
  );

  const addDevice = useCallback(async () => {
    const ip = newIp.trim();
    if (!ip) return;
    await save(ip, { role: newRole });
    setNewIp("");
  }, [newIp, newRole, save]);

  if (denied) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader>기기 관리</SectionHeader>
        <p className="font-pretendard text-white/40">관리자만 볼 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <SectionHeader>기기 관리</SectionHeader>

      {/* 내 기기 안내 */}
      {me && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <p className="font-mbc text-sm text-white/50">
            내 기기 IP{" "}
            <span className="font-orbitron text-white/80">{me.ip}</span>
            <span className="ml-2 text-white/30">({me.role})</span>
          </p>
          <p className="mt-1 font-pretendard text-xs text-white/30">
            이 IP를 서버 <code className="text-white/50">.env</code>의{" "}
            <code className="text-white/50">ADMIN_IPS</code>에 넣으면 항상 관리자입니다.
          </p>
        </div>
      )}

      {/* IP로 기기 추가 */}
      <div className="flex items-end gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
        <div className="flex flex-col gap-1">
          <span className="font-mbc text-xs text-white/40">Tailscale IP</span>
          <input
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder="100.x.x.x"
            className="h-10 w-48 rounded-lg border border-white/10 bg-[#141414] px-3 font-orbitron text-sm text-white focus:border-white/30 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mbc text-xs text-white/40">역할</span>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Role)}
            className="h-10 rounded-lg border border-white/10 bg-[#141414] px-3 font-pretendard text-sm text-white focus:outline-none"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={addDevice}
          disabled={!newIp.trim()}
          className="h-10 rounded-lg border border-white/15 bg-white/10 px-5 font-mbc text-sm text-white hover:bg-white/15 disabled:opacity-40"
        >
          등록
        </button>
      </div>

      {/* 등록 기기 목록 */}
      <div className="flex-1 overflow-auto rounded-2xl border border-white/5 bg-[#0a0a0a]">
        <table className="w-full text-left font-pretendard text-sm">
          <thead className="sticky top-0 bg-[#0a0a0a] text-white/40">
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 font-mbc font-normal">기기</th>
              <th className="px-4 py-3 font-mbc font-normal">IP</th>
              <th className="px-4 py-3 font-mbc font-normal">라벨</th>
              <th className="px-4 py-3 font-mbc font-normal">역할</th>
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-white/30">
                  등록된 기기가 없습니다. 위에서 IP로 추가하세요.
                </td>
              </tr>
            ) : (
              devices.map((d) => (
                <tr key={d.ip} className="border-b border-white/5">
                  <td className="px-4 py-2.5 text-white/80">
                    {d.name}
                    {d.owner ? <span className="text-white/30"> · {d.owner}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 font-orbitron text-xs text-white/50">{d.ip}</td>
                  <td className="px-4 py-2.5">
                    <input
                      defaultValue={d.label}
                      onBlur={(e) => {
                        if (e.target.value !== d.label) save(d.ip, { label: e.target.value });
                      }}
                      placeholder="(이름)"
                      className="h-9 w-40 rounded-lg border border-white/10 bg-[#141414] px-3 text-white/80 focus:border-white/30 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={d.role}
                      onChange={(e) => save(d.ip, { role: e.target.value as Role })}
                      className={cn(
                        "h-9 rounded-lg border bg-[#141414] px-3 text-white focus:outline-none",
                        d.role === "admin"
                          ? "border-emerald-500/40"
                          : d.role === "operator"
                            ? "border-sky-500/40"
                            : "border-white/10",
                      )}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
