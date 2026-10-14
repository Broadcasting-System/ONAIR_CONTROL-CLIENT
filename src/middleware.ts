import { NextResponse, type NextRequest } from "next/server";

/** 학생용 live 주소(live.bssmcast.com) — 화면은 /live 하나만. 첫 주소(/)는 /live 로, 다른 화면은 첫 주소로 돌려보낸다.
 *  (API 는 Cloudflare 터널이 서버로 바로 보내고, 서버도 보기 전용 경로만 연다 — 서버 app/services/live_access.py) */
const LIVE_HOSTS = (process.env.NEXT_PUBLIC_LIVE_HOSTS ?? "live.bssmcast.com")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const STATIC = /\.(?:svg|png|jpe?g|webp|ico|woff2?|ttf|otf|css|js|map|webmanifest|txt)$/;

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (!LIVE_HOSTS.includes(host)) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === "/") return NextResponse.rewrite(new URL("/live", req.url));
  if (pathname === "/live" || pathname.startsWith("/_next/") || pathname.startsWith("/fonts/") || STATIC.test(pathname)) {
    return NextResponse.next();
  }
  // 터널 뒤에서는 req.url 이 서버 안쪽 주소(127.0.0.1:3001)라, 학생이 친 주소(Host)와 https 로 첫 화면을 만든다
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return NextResponse.redirect(`${proto}://${req.headers.get("host")}/`);
}

export const config = {
  matcher: ["/((?!api/|uploads/|health).*)"],
};
