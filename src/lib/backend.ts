/**
 * 백엔드(FastAPI) 및 디스플레이 앱 주소 유추.
 * - 명시 env 가 있으면 그 값을 사용 (override).
 * - 없으면 현재 접속한 호스트 기준으로 자동 구성 → localhost / LAN IP 모두 자동 대응.
 */
export function backendBase(): string {
  const override = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (override && override.trim()) return override.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

export function backendWs(path: string): string {
  const override = process.env.NEXT_PUBLIC_WS_URL;
  if (override && override.trim() && path === "/api/display/ws") {
    return override;
  }
  return backendBase().replace(/^http/, "ws") + path;
}

/** 현수막 송출(디스플레이 앱) 주소. 포트는 NEXT_PUBLIC_BANNER_DISPLAY_PORT(기본 3000). */
export function displayAppBase(): string {
  const override = process.env.NEXT_PUBLIC_BANNER_DISPLAY_URL;
  if (override && override.trim()) return override.replace(/\/$/, "");
  const port = process.env.NEXT_PUBLIC_BANNER_DISPLAY_PORT || "3000";
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }
  return `http://localhost:${port}`;
}
