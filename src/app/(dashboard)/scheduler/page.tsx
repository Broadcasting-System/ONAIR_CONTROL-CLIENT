import { redirect } from "next/navigation";

/** 옛 메뉴 주소 — 시보 설정의 '예약 현황' 탭으로 옮겨졌다. */
export default function SchedulerRedirect() {
  redirect("/time?tab=schedule");
}
