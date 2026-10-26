import { SENTRY_DSN, sentryOptions } from "@/lib/sentryOptions";

// 브라우저 오류 모으기 (docs/sentry.md) — DSN 이 있을 때만 SDK 를 따로 불러온다.
// 위에서 바로 import 하면 DSN 이 없어도 모든 페이지 공통 JS 가 102kB → 169kB 로 커진다
if (SENTRY_DSN) {
  void import("@sentry/nextjs").then((Sentry) => Sentry.init(sentryOptions));
}
