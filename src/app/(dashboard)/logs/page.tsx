import { redirect } from "next/navigation";

/** 옛 메뉴 주소 — 기기 관리의 '접근 로그' 탭으로 옮겨졌다. */
export default function LogsRedirect() {
  redirect("/devices?tab=logs");
}
