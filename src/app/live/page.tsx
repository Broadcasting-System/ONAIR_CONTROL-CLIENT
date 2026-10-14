"use client";

import { Suspense } from "react";
import LiveApp from "@/components/live/LiveApp";

/** 학생용 live 화면 — live.bssmcast.com 첫 주소. 학교 구글 계정으로 들어와 지금 송출 중인 화면을 본다 */
export default function LivePage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-[#0b0b0d]" />}>
      <LiveApp />
    </Suspense>
  );
}
