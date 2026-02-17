"use client";

import { NAVIGATION_ITEMS } from "@/constants/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full bg-black text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="flex w-[280px] flex-col border-r border-white/10 bg-[#0A0A0A] p-6 z-20">
        <div className="mb-12">
          <h1 className="text-2xl font-bold tracking-tighter">메인 세팅</h1>
          <p className="text-xs text-white/30 uppercase tracking-widest">MAIN</p>
        </div>

        <nav className="flex flex-col gap-3">
          {NAVIGATION_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "group flex flex-col rounded-lg border border-transparent px-5 py-3 transition-all duration-200",
                  isActive
                    ? "border-white/10 bg-white/5 shadow-[0_0_15px_-5px_rgba(255,255,255,0.1)]"
                    : "hover:bg-white/5 hover:text-white"
                )}
              >
                <span className={cn("text-base font-bold", isActive ? "text-white" : "text-white/40 group-hover:text-white/70")}>
                  {item.label}
                </span>
                <span className={cn("text-[10px] font-bold uppercase tracking-widest", isActive ? "text-white/50" : "text-white/20 group-hover:text-white/40")}>
                  {item.subLabel}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="relative flex-1 overflow-auto bg-black">
        {/* Background Overlay */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {/* Gradient fallback if image is missing */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a0505] to-black opacity-80" />
          {/* We assume bg-main.png is provided by user in public folder, but using a div placeholder for now */}
          <div className="absolute inset-0 bg-[url('/bg-main.png')] bg-cover bg-center opacity-40 mix-blend-screen" />
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
        </div>

        <div className="relative z-10 p-10 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
