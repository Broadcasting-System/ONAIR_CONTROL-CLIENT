"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, SlidersVertical, Users, Ellipsis } from "lucide-react";
import CueRing from "@/components/common/CueRing";
import { useMe } from "@/hooks/useMe";
import { cn } from "@/lib/utils";

/** 폰 하단 탭 — 홈·홀·CUE·관리·더보기 (부장 미만은 관리 자리에 방송부) */
const HALL = ["/hall", "/mixer", "/lighting", "/recording", "/matrix"];
const ADMIN = ["/devices", "/logs"];

export default function MobileTabBar() {
  const pathname = usePathname();
  const { isAdmin, canOperate } = useMe();
  const on = (p: string[]) => p.some((x) => pathname === x || pathname.startsWith(x + "/"));
  const tabs = [
    { href: "/home", label: "홈", icon: <House size={23} strokeWidth={1.8} />, active: on(["/home"]) },
    { href: "/hall", label: "홀", icon: <SlidersVertical size={23} strokeWidth={1.8} />, active: on(HALL) },
    ...(canOperate
      ? [{ href: "/cue", label: "CUE", icon: <CueRing size={24} spin={false} />, active: on(["/cue"]) }]
      : []),
    { href: "/devices", label: isAdmin ? "관리" : "방송부", icon: <Users size={23} strokeWidth={1.8} />, active: on(ADMIN) },
    {
      href: "/more",
      label: "더보기",
      icon: <Ellipsis size={23} strokeWidth={1.8} />,
      active: !on(["/home", "/cue", ...HALL, ...ADMIN]),
    },
  ];
  return (
    <nav
      aria-label="메뉴"
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-white/[0.08] bg-[rgba(12,12,14,0.82)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          data-tour={`tab.${t.href.slice(1)}`}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "flex h-[62px] flex-1 flex-col items-center justify-center gap-1 font-pretendard text-[11px] font-medium transition-colors",
            t.active ? "text-white [&_svg]:text-[#FF3B3B]" : "text-white/40",
          )}
        >
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
