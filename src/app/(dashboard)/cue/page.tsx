"use client";

import { useMobileOnly } from "@/components/mobile/useMobileOnly";

/** 폰 CUE 탭 — 대화 창(ChatPanel)이 이 주소에서 전체 화면으로 열린다 */
export default function MobileCuePage() {
  useMobileOnly("/main");
  return null;
}
