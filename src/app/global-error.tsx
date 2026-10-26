"use client";

import { useEffect } from "react";
import { SENTRY_DSN } from "@/lib/sentryOptions";

/** 화면 전체가 오류로 멈췄을 때 — Sentry 로 보내고 다시 시도할 수 있게 (레이아웃까지 깨졌을 때라 스타일은 직접) */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (SENTRY_DSN) void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b0b0d", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <strong style={{ fontSize: 22 }}>화면에 문제가 생겼어요</strong>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>방송·시보는 서버에서 계속 돌아가요. 화면만 다시 열면 돼요.</span>
          <button
            onClick={reset}
            style={{ marginTop: 8, padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 15, cursor: "pointer" }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
