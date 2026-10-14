/** 이 기기 이름 — [다른 기기 추가]로 붙일 때 목록에 보일 이름 (앱이 심어 둔 OS, 없으면 브라우저 정보) */
export function thisDeviceName(): string {
  if (typeof window === "undefined") return "";
  const p = (window as unknown as { __ONAIR_APP_PLATFORM__?: string }).__ONAIR_APP_PLATFORM__ ?? "";
  const ua = navigator.userAgent;
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // 데스크톱 모드 iPad
  if (p === "ios" || /iPhone|iPad/.test(ua) || touchMac) return /iPad/.test(ua) || touchMac ? "iPad" : "iPhone";
  if (p === "android" || /Android/.test(ua)) return "Android";
  if (p === "macos" || /Macintosh/.test(ua)) return "Mac";
  if (p === "windows" || /Windows/.test(ua)) return "Windows";
  return "";
}
