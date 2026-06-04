"use client";

import { NAVIGATION_ITEMS } from "@/constants/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastHost } from "@/components/common/Toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="relative flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0505] to-black opacity-80" />
        <div className="absolute inset-0 bg-[url('/onair_background.png')] bg-cover bg-center opacity-40 mix-blend-screen" />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
      </div>

      <aside className="relative flex w-[245px] flex-col bg-transparent pt-[56px] pl-[10px] z-20">

        <nav className="flex flex-col gap-4">
          {NAVIGATION_ITEMS.map((item) => {
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
