"use client";

import { NAVIGATION_GROUPS } from "@/constants/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ToastHost } from "@/components/common/Toast";
import { ROLE_DOT } from "@/components/devices/roleStyle";
import { useMe } from "@/hooks/useMe";
import ChatPanel, { useChatShortcutLabel } from "@/components/chat/ChatPanel";
import { useChatPanel } from "@/stores/chatStore";
import MobileTabBar from "@/components/mobile/MobileTabBar";
import MyDevicesModal from "@/components/devices/MyDevicesModal";
import { useRequestCounts } from "@/components/requests/RequestsPanel";

/** 사이드바 아래 — CUE 열고 닫기 (Cmd/Ctrl + K) */
function ChatToggle() {
  const open = useChatPanel((s) => s.open);
  const toggle = useChatPanel((s) => s.toggle);
  const shortcut = useChatShortcutLabel();
  return (
    <button
      type="button"
      data-tour="nav.cue"
      onClick={toggle}
      aria-pressed={open}
      title={`CUE (${shortcut})`}
      className={cn(
        "mb-2 flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-left transition-colors",
        open
          ? "border-sidebar-border bg-white/5 text-white"
          : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/5 hover:text-white",
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", open ? "bg-[#FF3B3B]" : "bg-white/25")} />
      <span className="flex-1 font-mbc text-[14px]">CUE</span>
      <span className="font-orbitron text-[10px] tracking-widest text-white/30">{shortcut}</span>
    </button>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, role, isAdmin, canOperate } = useMe();
  const [devicesOpen, setDevicesOpen] = useState(false);
  // 요청함 — 새 요청과 승인 기다리는 선생님(부장 이상) 수
  const reqCounts = useRequestCounts(canOperate);
  const newRequests = (reqCounts.data?.new ?? 0) + (isAdmin ? (reqCounts.data?.pendingTeachers ?? 0) : 0);
  const hasDevices = me?.status === "approved" && (me.devices?.length ?? 0) > 0;

  // 초대받은 기기인데 아직 등록 전이거나 승인 대기면 첫 화면(등록·승인 대기)으로
  const needsWelcome = !!me && (me.status === "pending" || (me.status === "unregistered" && me.canRegister));
  useEffect(() => {
    if (needsWelcome) router.replace("/welcome");
  }, [needsWelcome, router]);

  // 폰으로 처음 열면(주소 없이 들어오면 /main) 폰 홈으로 — 한 번만, 그 뒤 방송 화면은 더보기에서
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    try {
      // 홈을 이미 봤으면(홈의 '방송'·'마이크 방송' 바로가기로 /main 에 가는 경우) 되돌리지 않는다
      if (pathname === "/home") {
        window.sessionStorage.setItem("onair.m.home", "1");
        return;
      }
      if (pathname !== "/main") return;
      if (window.sessionStorage.getItem("onair.m.home")) return;
      window.sessionStorage.setItem("onair.m.home", "1");
    } catch {
      return;
    }
    router.replace("/home");
  }, [pathname, router]);

  return (
    <div className="relative flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0505] to-black opacity-80" />
        <div className="absolute inset-0 bg-[url('/onair_background.png')] bg-cover bg-center opacity-40 mix-blend-screen" />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
      </div>

      <aside className="relative z-20 hidden min-h-0 w-[245px] md:flex flex-col bg-transparent pl-[10px] pt-10">
        <nav className="no-scrollbar flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
          {NAVIGATION_GROUPS.filter((group) => !group.adminOnly || isAdmin).map((group) => (
            <div key={group.title} className="flex flex-col gap-1.5">
              <span className="px-5 font-orbitron text-[10px] tracking-[0.3em] text-white/25">
                {group.title}
              </span>
              {group.items
                .filter((item) => (isAdmin ? !item.hideForAdmin : !item.adminOnly))
                .filter((item) => !item.operatorOnly || canOperate)
                .map((item) => {
                  const isActive = pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      data-tour={`nav.${item.path.slice(1)}`}
                      className={cn(
                        "group flex h-[56px] flex-col justify-center rounded-lg border border-transparent px-5 transition-all duration-200",
                        isActive
                          ? "border-sidebar-border bg-white/5 shadow-[0_0_15px_-5px_rgba(255,255,255,0.1)]"
                          : "hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "mb-1 flex items-center gap-2 font-mbc text-lg font-medium leading-none",
                          isActive ? "text-white" : "text-white/40 group-hover:text-white/70",
                        )}
                      >
                        {item.label}
                        {item.path === "/requests" && newRequests > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF3B3B] px-1.5 font-pretendard text-[12px] font-extrabold text-white">
                            {newRequests}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "font-orbitron text-[11px] font-medium uppercase tracking-widest",
                          isActive ? "text-white/50" : "text-white/20 group-hover:text-white/40",
                        )}
                      >
                        {item.subLabel}
                      </span>
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>

        {/* 현재 기기 역할 배지 — 등록된 기기면 누르면 내 기기 */}
        <div className="mt-auto mb-6 shrink-0 pr-[10px] pt-4">
          {canOperate && <ChatToggle />}
          <button
            type="button"
            data-tour="nav.me"
            disabled={!hasDevices}
            onClick={() => setDevicesOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-colors enabled:hover:border-white/20 enabled:hover:bg-white/[0.06] disabled:cursor-default"
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", ROLE_DOT[role])} />
            <div className="min-w-0">
              <p className="truncate font-mbc text-[13px] text-white/70">
                {me?.name ?? "연결 중…"}
              </p>
              <p className="font-orbitron text-[10px] uppercase tracking-widest text-white/30">
                {me?.roleLabel ?? "…"}
              </p>
            </div>
          </button>
        </div>
      </aside>
      {devicesOpen && <MyDevicesModal onClose={() => setDevicesOpen(false)} />}

      <main className="relative flex-1 overflow-auto bg-transparent">
        <div className="relative z-10 min-h-full px-4 pb-[calc(84px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))] md:p-10">
          {children}
        </div>
      </main>

      <ChatPanel />

      <MobileTabBar />

      <ToastHost />
    </div>
  );
}
