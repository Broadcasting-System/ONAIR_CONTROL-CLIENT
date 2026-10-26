/**
 * Sentry 공통 설정 — 브라우저(instrumentation-client)·서버(instrumentation)가 같이 쓴다.
 * DSN 이 없으면 init 하지 않는다(아무것도 보내지 않음). 학교 서버 .env 에 NEXT_PUBLIC_SENTRY_DSN 을 넣으면 켜진다.
 *
 * - 오류만 모은다(성능 추적 0) — 서버 PC·학교 망에 부담을 주지 않게. NEXT_PUBLIC_SENTRY_TRACES 로 바꿀 수 있다
 * - 개인 정보: 기본 PII(IP·쿠키·사용자) 보내지 않음. 주소의 쿼리(초대 코드·QR 토큰 등)는 지운다
 */
import type { ErrorEvent } from "@sentry/nextjs";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

/** URL 의 ?쿼리 와 #조각 을 지운다 — 초대 코드·등록 토큰이 주소에 실릴 때가 있다 */
export function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, "");
}

export function scrub(event: ErrorEvent): ErrorEvent {
  if (event.request?.url) event.request.url = stripQuery(event.request.url);
  if (event.request) {
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.headers;
  }
  for (const b of event.breadcrumbs ?? []) {
    if (typeof b.data?.url === "string") b.data.url = stripQuery(b.data.url);
    if (typeof b.data?.to === "string") b.data.to = stripQuery(b.data.to);
    if (typeof b.data?.from === "string") b.data.from = stripQuery(b.data.from);
  }
  return event;
}

export const sentryOptions = {
  dsn: SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV || "production",
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES || 0),
  sendDefaultPii: false,
  beforeSend: scrub,
};
