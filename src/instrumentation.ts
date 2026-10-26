import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, sentryOptions } from "@/lib/sentryOptions";

// 서버(Next 서버·엣지) 쪽 오류 모으기 — DSN 이 없으면 아무것도 안 한다
export async function register() {
  if (SENTRY_DSN) Sentry.init(sentryOptions);
}

export const onRequestError = Sentry.captureRequestError;
