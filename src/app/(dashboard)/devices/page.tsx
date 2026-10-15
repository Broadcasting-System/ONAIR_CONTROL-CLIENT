"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SectionHeader from "@/components/common/SectionHeader";
import Select from "@/components/common/Select";
import { getApiBase } from "@/lib/apiBase";
import { toast } from "@/components/common/Toast";
import { useMe } from "@/hooks/useMe";
import PageTabs from "@/components/common/PageTabs";
import CrewView from "@/components/devices/CrewView";
import MembersPanel from "@/components/devices/MembersPanel";
import SpeakerMappingPanel from "@/components/devices/SpeakerMappingPanel";
import BridgePanel from "@/components/devices/BridgePanel";
import CloudflarePanel from "@/components/devices/CloudflarePanel";
import { useTabParam } from "@/hooks/useTabParam";

/** 예전 기기(Tailscale IP) 역할 — 서버는 admin=부장, operator=부원, viewer=졸업(보기)으로 읽는다 */
type DeviceRole = "admin" | "operator" | "viewer";

interface Device {
  ip: string;
  name: string;
  owner: string;
  role: DeviceRole;
  label: string;
}

const ROLES: { value: DeviceRole; label: string }[] = [
  { value: "admin", label: "부장 권한" },
  { value: "operator", label: "부원 권한" },
  { value: "viewer", label: "보기 전용" },
];

const DEVICE_TAB_KEYS = ["members", "cloudflare", "devices", "speakers", "bridges"] as const;
const DEVICE_TABS = [
  { key: "members" as const, label: "부원" },
  { key: "cloudflare" as const, label: "Cloudflare" },
  { key: "devices" as const, label: "기기" },
  { key: "speakers" as const, label: "스피커 매핑" },
  { key: "bridges" as const, label: "강당 장비" },
];

export default function DevicesPage() {
  const { me, isAdmin, loading } = useMe();
  const [devices, setDevices] = useState<Device[]>([]);
  const [denied, setDenied] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [newRole, setNewRole] = useState<DeviceRole>("operator");
  const [tab, setTab] = useTabParam(DEVICE_TAB_KEYS, "members");
  const tabsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // 접근 로그 탭은 로그 메뉴로 옮겼다 — 예전 주소(?tab=logs)는 그쪽으로
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "logs") router.replace("/logs");
  }, [router]);

  // 폰에서 탭 줄이 옆으로 넘치면 고른 탭이 보이게 밀어 둔다
  useEffect(() => {
    const box = tabsRef.current;
    const btn = box?.querySelector<HTMLElement>(`[data-tour="devices.tab.${tab}"]`);
    if (!box || !btn || box.scrollWidth <= box.clientWidth) return;
    const offset = btn.getBoundingClientRect().left - box.getBoundingClientRect().left;
    box.scrollTo({ left: box.scrollLeft + offset - (box.clientWidth - btn.offsetWidth) / 2, behavior: "smooth" });
  }, [tab, isAdmin]);

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
    if (isAdmin) fetchDevices();
  }, [fetchDevices, isAdmin]);

  const save = useCallback(
    async (ip: string, patch: { label?: string; role?: DeviceRole }) => {
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
        toast.error("저장하지 못했어요");
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

  // 부장이 아니면 방송부 보기만 (내 소개는 여기서 고친다)
  if (!isAdmin) {
    if (loading) return null;
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <SectionHeader className="mb-0 max-md:mt-1 max-md:text-[26px] max-md:leading-none">방송부</SectionHeader>
        <CrewView />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader>관리</SectionHeader>
        <p className="font-pretendard text-white/40">권한 없음</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:h-full md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-x-5 md:gap-y-3">
        <SectionHeader className="mb-0 max-md:mt-1 max-md:text-[26px] max-md:leading-none">관리</SectionHeader>
        <div ref={tabsRef} className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
          <PageTabs
            tour="devices.tab"
            tabs={DEVICE_TABS}
            value={tab}
            onChange={setTab}
            className="max-md:[&>button]:min-h-[44px] max-md:[&>button]:shrink-0 max-md:[&>button]:whitespace-nowrap max-md:[&>button]:text-[15px]"
          />
        </div>
      </div>

      {tab === "members" ? (
        <MembersPanel />
      ) : tab === "cloudflare" ? (
        <CloudflarePanel />
      ) : tab === "speakers" ? (
        <SpeakerMappingPanel />
      ) : tab === "bridges" ? (
        <BridgePanel />
      ) : (
      <>
      {/* 내 기기 안내 */}
      {me && (
        <div data-tour="devices.my-ip" className="rounded-[20px] border border-white/[0.09] bg-white/[0.045] px-4 py-3.5 md:rounded-xl md:border-white/10 md:bg-white/[0.03] md:px-5 md:py-4">
          <p className="font-mbc text-sm text-white/50">
            내 기기 IP{" "}
            <span className="font-orbitron text-white/80">{me.ip}</span>
            <span className="ml-2 text-white/30">{me.roleLabel}</span>
          </p>
        </div>
      )}

      {/* IP로 기기 추가 */}
      <div data-tour="devices.add" className="grid grid-cols-[1fr_auto] items-end gap-3 rounded-[20px] border border-white/[0.09] bg-white/[0.045] px-4 py-3.5 md:flex md:rounded-xl md:border-white/10 md:bg-white/[0.03] md:px-5 md:py-4">
        <div className="col-span-2 flex flex-col gap-1">
          <span className="font-mbc text-xs text-white/40">Tailscale IP</span>
          <input
            data-tour="devices.add.ip"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder="100.x.x.x"
            className="h-11 w-full rounded-lg border border-white/10 bg-[#141414] px-3 font-orbitron text-base text-white focus:border-white/30 focus:outline-none md:h-10 md:w-48 md:text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mbc text-xs text-white/40">역할</span>
          <Select tour="devices.add.role" value={newRole} onChange={setNewRole} options={ROLES} aria-label="역할" className="max-md:h-11" />
        </div>
        <button
          data-tour="devices.add.submit"
          onClick={addDevice}
          disabled={!newIp.trim()}
          className="h-11 rounded-lg border border-white/15 bg-white/10 px-5 font-mbc text-sm text-white hover:bg-white/15 disabled:opacity-40 md:h-10"
        >
          등록
        </button>
      </div>

      {/* 등록 기기 목록 */}
      <div data-tour="devices.table" className="flex-1 overflow-auto rounded-[20px] border border-white/[0.09] bg-white/[0.045] md:rounded-2xl md:border-white/5 md:bg-[#0a0a0a]">
        {/* 폰 — 표 대신 카드 */}
        <div className="flex flex-col divide-y divide-white/[0.07] md:hidden">
          {devices.length === 0 ? (
            <p className="px-4 py-8 text-center font-pretendard text-sm text-white/30">등록된 기기가 없어요</p>
          ) : (
            devices.map((d) => (
              <div key={d.ip} className="flex flex-col gap-2.5 px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-3 font-pretendard text-sm">
                  <span className="min-w-0 truncate text-white/80">
                    {d.name}
                    {d.owner ? <span className="text-white/30"> · {d.owner}</span> : null}
                  </span>
                  <span className="shrink-0 font-orbitron text-xs text-white/50">{d.ip}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    defaultValue={d.label}
                    onBlur={(e) => {
                      if (e.target.value !== d.label) save(d.ip, { label: e.target.value });
                    }}
                    placeholder="이름"
                    className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#141414] px-3 font-pretendard text-base text-white/80 focus:border-white/30 focus:outline-none"
                  />
                  <Select
                    value={d.role}
                    onChange={(role) => save(d.ip, { role })}
                    options={ROLES}
                    aria-label={`${d.name} 역할`}
                    className="h-11"
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <table className="hidden w-full text-left font-pretendard text-sm md:table">
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
                  등록된 기기가 없어요
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
                      placeholder="이름"
                      className="h-9 w-40 rounded-lg border border-white/10 bg-[#141414] px-3 text-white/80 focus:border-white/30 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={d.role}
                      onChange={(role) => save(d.ip, { role })}
                      options={ROLES}
                      aria-label={`${d.name} 역할`}
                      className="h-9"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}
