"use client";

import { create } from "zustand";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (message: string, type: ToastType) => void;
  remove: (id: number) => void;
}

let seq = 0;

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, type) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3200);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** 어디서든 호출 가능한 ONAIR 알림 (브라우저 alert 대체). */
export const toast = {
  success: (m: string) => useToastStore.getState().push(m, "success"),
  error: (m: string) => useToastStore.getState().push(m, "error"),
  info: (m: string) => useToastStore.getState().push(m, "info"),
};

const TYPE_STYLE: Record<ToastType, { ring: string; dot: string; label: string }> = {
  success: { ring: "border-green-500/40 shadow-[0_0_24px_-8px_#22c55e]", dot: "bg-green-400 shadow-[0_0_10px_#22c55e]", label: "완료" },
  error: { ring: "border-red-500/40 shadow-[0_0_24px_-8px_#ef4444]", dot: "bg-red-400 shadow-[0_0_10px_#ef4444]", label: "오류" },
  info: { ring: "border-white/25 shadow-[0_0_24px_-8px_rgba(255,255,255,0.4)]", dot: "bg-white/80", label: "알림" },
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  return (
    <>
      <style>{`
        @keyframes onairToastIn {
          0% { opacity: 0; transform: translateX(24px) scale(0.96); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
      <div className="pointer-events-none fixed top-6 right-6 z-[1000] flex flex-col gap-3">
        {toasts.map((t) => {
          const s = TYPE_STYLE[t.type];
          return (
            <button
              key={t.id}
              onClick={() => remove(t.id)}
              style={{ animation: "onairToastIn 220ms ease-out" }}
              className={cn(
                "pointer-events-auto flex min-w-[260px] max-w-[420px] items-center gap-3 rounded-2xl border bg-[#0d0d10]/95 px-5 py-4 text-left backdrop-blur-md",
                s.ring,
              )}
            >
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", s.dot)} />
              <div className="flex flex-col gap-0.5">
                <span className="font-orbitron text-[10px] uppercase tracking-widest text-white/40">
                  ONAIR · {s.label}
                </span>
                <span className="font-pretendard text-[15px] leading-snug text-white whitespace-pre-line">
                  {t.message}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
