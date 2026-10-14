import { NextResponse, type NextRequest } from "next/server";

/** 학생용 live 주소(live.bssmcast.com)·외부 화면 공유 주소(share.bssmcast.com) — 화면은 /live·/share 하나만.
 *  첫 주소(/)는 그 화면으로, 다른 화면은 첫 주소로 돌려보낸다.
 *  (API 는 Cloudflare 터널이 서버로 바로 보내고, 서버도 보기 전용 경로만 연다 — 서버 app/services/live_access.py) */
const hosts = (raw: string) =>
  raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
const LIVE_HOSTS = hosts(process.env.NEXT_PUBLIC_LIVE_HOSTS ?? "live.bssmcast.com");
const SHARE_HOSTS = hosts(process.env.NEXT_PUBLIC_SHARE_HOSTS ?? "share.bssmcast.com");

const STATIC = /\.(?:svg|png|jpe?g|webp|ico|woff2?|ttf|otf|css|js|map|webmanifest|txt)$/;

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const page = LIVE_HOSTS.includes(host) ? "/live" : SHARE_HOSTS.includes(host) ? "/share" : null;
  if (!page) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === "/") return NextResponse.rewrite(new URL(page, req.url));
  if (pathname === page || pathname.startsWith("/_next/") || pathname.startsWith("/fonts/") || STATIC.test(pathname)) {
    return NextResponse.next();
  }
  // 터널 뒤에서는 req.url 이 서버 안쪽 주소(127.0.0.1:3001)라, 학생이 친 주소(Host)와 https 로 첫 화면을 만든다
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return NextResponse.redirect(`${proto}://${req.headers.get("host")}/`);
}

export const config = {
  matcher: ["/((?!api/|uploads/|health).*)"],
};
