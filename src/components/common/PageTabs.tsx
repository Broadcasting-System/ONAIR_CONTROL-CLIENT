"use client";

import { cn } from "@/lib/utils";

export interface PageTab<T extends string> {
  key: T;
  label: string;
}

interface PageTabsProps<T extends string> {
  tabs: PageTab<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** 페이지 안의 보조 화면 전환 (메인 세팅의 표/지도 토글과 같은 모양) */
export default function PageTabs<T extends string>({ tabs, value, onChange, className }: PageTabsProps<T>) {
  return (
    <div className={cn("flex w-fit gap-1 rounded-lg bg-white/5 p-1", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "rounded-md px-4 py-1 font-mbc text-sm transition-colors",
            value === tab.key ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
