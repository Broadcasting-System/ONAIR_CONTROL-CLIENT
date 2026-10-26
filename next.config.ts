import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // 메뉴를 합치며 옮긴 옛 주소 — 즐겨찾기·CUE 링크가 그대로 열리게
  async redirects() {
    return [
      { source: "/banner", destination: "/media?tab=banner", permanent: false },
      { source: "/auto-audio", destination: "/mixer?tab=auto", permanent: false },
    ];
  },
};

// Sentry (docs/sentry.md) — 소스맵은 SENTRY_AUTH_TOKEN 이 있을 때만 올린다(없으면 빌드만, 업로드 없음)
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
