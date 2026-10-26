import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrub, stripQuery } from "./sentryOptions";

describe("Sentry 개인 정보 지우기", () => {
  it("주소의 쿼리·조각을 지운다 (초대 코드·등록 토큰)", () => {
    expect(stripQuery("https://onair.bssmcast.com/welcome?invite=AB12CD34#x")).toBe("https://onair.bssmcast.com/welcome");
    expect(stripQuery("/main")).toBe("/main");
  });

  it("요청의 쿼리·쿠키·헤더와 이동 기록의 주소 쿼리를 지운다", () => {
    const event = {
      request: {
        url: "https://onair.bssmcast.com/teacher?code=1234",
        query_string: "code=1234",
        cookies: { CF_Authorization: "secret" },
        headers: { "cf-access-jwt-assertion": "secret" },
      },
      breadcrumbs: [
        { category: "fetch", data: { url: "https://onair.bssmcast.com/api/members/invite?token=t" } },
        { category: "navigation", data: { from: "/welcome?invite=x", to: "/main" } },
      ],
    } as unknown as ErrorEvent;
    const out = scrub(event);
    expect(out.request).toEqual({ url: "https://onair.bssmcast.com/teacher" });
    expect(out.breadcrumbs?.[0].data?.url).toBe("https://onair.bssmcast.com/api/members/invite");
    expect(out.breadcrumbs?.[1].data).toEqual({ from: "/welcome", to: "/main" });
  });
});
