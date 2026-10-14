"use client";

import { Suspense } from "react";
import TeacherApp from "@/components/teacher/TeacherApp";

/** 선생님 요청 — teacher.bssmcast.com 첫 주소 */
export default function TeacherPage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-[#101010]" />}>
      <TeacherApp />
    </Suspense>
  );
}
