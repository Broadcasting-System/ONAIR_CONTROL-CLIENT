/**
 * 백엔드(FastAPI) 및 디스플레이 앱 주소 유추.
 * - 명시 env 가 있으면 그 값을 사용 (override).
 * - 같은 주소 모드(아래 isSameOrigin)면 지금 주소 그대로 (/api 는 같은 호스트가 받음).
 * - 없으면 현재 접속한 호스트 기준으로 자동 구성 → localhost / LAN IP 모두 자동 대응.
 */

declare global {
  interface Window {
    /** ONAIR 데스크탑 앱(로컬 프록시) 등이 넣어 주는 표시 — /api 를 같은 주소로 부른다 */
    __ONAIR_SAME_ORIGIN__?: boolean;
    /** 같은 주소 모드에서 현수막 송출 화면 주소를 따로 줄 때 */
    __ONAIR_DISPLAY_BASE__?: string;
  }
}

/** 데스크탑 앱 프록시가 켠 표시. 프록시만 접속 키를 붙일 수 있어서 env override 보다 우선. */
function desktopProxy(): boolean {
  return typeof window !== "undefined" && window.__ONAIR_SAME_ORIGIN__ === true;
}

/** Cloudflare 로 들어오는 주소 — 거기서는 터널이 /api 를 서버로 나눠 주므로 같은 주소로 부른다.
 *  학교 안에서 IP·localhost 로 열면 예전처럼 :8000 으로. (쉼표로 여러 개, 기본 onair.bssmcast.com) */
function viaPublicHost(): boolean {
  if (typeof window === "undefined") return false;
  const hosts = (process.env.NEXT_PUBLIC_SAME_ORIGIN_HOSTS ?? "onair.bssmcast.com,live.bssmcast.com,share.bssmcast.com,teacher.bssmcast.com")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return hosts.includes(window.location.hostname.toLowerCase());
}

/** 같은 주소 모드: 데스크탑 앱 프록시, Cloudflare 주소로 접속, 또는 NEXT_PUBLIC_API_SAME_ORIGIN=1. */
export function isSameOrigin(): boolean {
  return desktopProxy() || viaPublicHost() || process.env.NEXT_PUBLIC_API_SAME_ORIGIN === "1";
}

/** localhost / IPv6 루프백은 127.0.0.1(IPv4)로 강제.
 *  → 8000 포트를 IPv6(::1)로 점유한 다른 프로세스(예: Docker)로 새는 것 방지. */
function resolveHost(host: string): string {
  if (host === "localhost" || host === "::1" || host === "[::1]") return "127.0.0.1";
  return host;
}

export function backendBase(): string {
  if (desktopProxy() || viaPublicHost()) return window.location.origin;
  const override = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (override && override.trim()) return override.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    if (isSameOrigin()) return window.location.origin;
    return `${window.location.protocol}//${resolveHost(window.location.hostname)}:8000`;
  }
  return "http://127.0.0.1:8000";
}

/** 저장된 파일 URL을 '보는 기기 기준' 서버 주소로 다시 맞춘다.
 *  보낸 기기가 어떤 주소(127.0.0.1, 테일스케일 IP 등)로 저장했든 우리 파일 경로(/api/files, /uploads)면
 *  backendBase() 로 바꾼다. 안 그러면 onair.bssmcast.com(https)에서 http 주소를 못 불러 검은 화면이 된다.
 *  외부 URL(유튜브 등)은 그대로. 송출 화면(onair-display)의 resolveMediaUrl 과 같은 규칙. */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return "";
  const base = backendBase();
  try {
    const u = new URL(url, base);
    if (u.pathname.startsWith("/api/files/") || u.pathname.startsWith("/uploads/")) {
      return base + u.pathname + u.search;
    }
    return url;
  } catch {
    return url;
  }
}

/** 파일 목록·올리기 응답의 주소들을 resolveMediaUrl 로 — 서버는 자기가 받은 Host 로 절대 주소를 만들어서
 *  데스크탑 앱(로컬 프록시) 안에서는 프록시를 건너뛰고 Cloudflare 로 바로 가 접속 키 없이 막힌다(사진이 깨짐). */
export function withMediaUrls<T extends { fileUrl?: string; thumbnailUrl?: string | null; hlsUrl?: string | null; urls?: string[] }>(f: T): T {
  return {
    ...f,
    ...(f.fileUrl ? { fileUrl: resolveMediaUrl(f.fileUrl) } : {}),
    ...(f.thumbnailUrl ? { thumbnailUrl: resolveMediaUrl(f.thumbnailUrl) } : {}),
    ...(f.hlsUrl ? { hlsUrl: resolveMediaUrl(f.hlsUrl) } : {}),
    ...(f.urls ? { urls: f.urls.map((u) => resolveMediaUrl(u)) } : {}),
  };
}

export function backendWs(path: string, channel?: number, role?: string): string {
  const override = process.env.NEXT_PUBLIC_WS_URL;
  const base =
    !desktopProxy() && !viaPublicHost() && override && override.trim() && path === "/api/display/ws"
      ? override
      : backendBase().replace(/^http/, "ws") + path;
  const params: string[] = [];
  if (channel && channel > 1) params.push(`channel=${channel}`);
  if (role) params.push(`role=${role}`);
  if (params.length === 0) return base;
  return base + (base.includes("?") ? "&" : "?") + params.join("&");
}

/** 현수막 송출(디스플레이 앱) 주소. 포트는 NEXT_PUBLIC_BANNER_DISPLAY_PORT(기본 3000). */
export function displayAppBase(): string {
  const override = process.env.NEXT_PUBLIC_BANNER_DISPLAY_URL;
  if (override && override.trim()) return override.replace(/\/$/, "");
  if (typeof window !== "undefined" && isSameOrigin() && window.__ONAIR_DISPLAY_BASE__) {
    return window.__ONAIR_DISPLAY_BASE__.replace(/\/$/, "");
  }
  const port = process.env.NEXT_PUBLIC_BANNER_DISPLAY_PORT || "3000";
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }
  return `http://localhost:${port}`;
}
