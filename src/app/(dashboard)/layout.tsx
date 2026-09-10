"use client";

import { NAVIGATION_GROUPS } from "@/constants/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastHost } from "@/components/common/Toast";
import { useMe } from "@/hooks/useMe";

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자",
  operator: "운영",
  viewer: "보기 전용",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { me, role } = useMe();

  return (
    <div className="relative flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0505] to-black opacity-80" />
        <div className="absolute inset-0 bg-[url('/onair_background.png')] bg-cover bg-center opacity-40 mix-blend-screen" />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
      </div>

      <aside className="relative z-20 flex min-h-0 w-[245px] flex-col bg-transparent pl-[10px] pt-10">
        <nav className="flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
          {NAVIGATION_GROUPS.filter((group) => !group.adminOnly || role === "admin").map((group) => (
            <div key={group.title} className="flex flex-col gap-1.5">
              <span className="px-5 font-orbitron text-[10px] tracking-[0.3em] text-white/25">
                {group.title}
              </span>
              {group.items
                .filter((item) => !item.adminOnly || role === "admin")
                .map((item) => {
                  const isActive = pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
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
                        {item.isNew && (
                          <span className="rounded border border-red-400/50 px-1 font-orbitron text-[9px] leading-[14px] tracking-wider text-red-400">
                            NEW
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

        {/* 현재 기기 역할 배지 */}
        <div className="mt-auto mb-6 shrink-0 pr-[10px] pt-4">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                role === "admin"
                  ? "bg-emerald-400"
                  : role === "operator"
                    ? "bg-sky-400"
                    : "bg-white/30",
              )}
            />
            <div className="min-w-0">
              <p className="truncate font-mbc text-[13px] text-white/70">
                {me?.name ?? "연결 중…"}
              </p>
              <p className="font-orbitron text-[10px] uppercase tracking-widest text-white/30">
                {ROLE_LABEL[role] ?? role}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="relative flex-1 overflow-auto bg-transparent">
        <div className="relative z-10 p-10 min-h-full">
          {children}
        </div>
      </main>

      <ToastHost />
    </div>
  );
}
