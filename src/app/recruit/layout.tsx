import type { Metadata } from "next";
import { ToastHost } from "@/components/common/Toast";
import "@/components/recruit/recruit.css";

export const metadata: Metadata = {
  title: "ONAIR 방송부 모집",
  description: "BSSM 방송부 모집 공고와 지원",
};

/** 방송부 모집 — 학교 계정이면 부원이 아니어도 들어온다 (대시보드 메뉴·등록 화면 없이) */
export default function RecruitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-black">
      {children}
      <ToastHost />
    </div>
  );
}
