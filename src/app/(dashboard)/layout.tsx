"use client";

import { NAVIGATION_ITEMS } from "@/constants/navigation";
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

      <aside className="relative flex w-[245px] flex-col bg-transparent pt-[56px] pl-[10px] z-20">

        <nav className="flex flex-col gap-4">
          {NAVIGATION_ITEMS.filter((item) => !item.adminOnly || role === "admin").map((item) => {
            const isActive = pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "group flex flex-col justify-center h-[72px] rounded-lg border border-transparent px-5 transition-all duration-200",
                  isActive
                    ? "border-sidebar-border bg-white/5 shadow-[0_0_15px_-5px_rgba(255,255,255,0.1)]"
                    : "hover:bg-white/5 hover:text-white"
                )}
              >
                <span className={cn("text-xl font-medium font-mbc leading-none mb-1", isActive ? "text-white" : "text-white/40 group-hover:text-white/70")}>
                  {item.label}
                </span>
                <span className={cn("text-[14px] font-medium font-orbitron text-white/30 uppercase tracking-widest", isActive ? "text-white/50" : "text-white/20 group-hover:text-white/40")}>
                  {item.subLabel}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* 현재 기기 역할 배지 */}
        <div className="mt-auto mb-6 pr-[10px]">
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
