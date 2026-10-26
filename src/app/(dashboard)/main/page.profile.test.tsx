/**
 * 메인 화면 렌더 측정 (React Profiler) — 아무것도 바뀌지 않는 1분 동안 무엇이 몇 번 다시 그려지는가.
 *
 * 조건: jsdom, 가짜 타이머로 60초. 서버 응답은 고정 — 스피커 상태는 그대로, 응답 시간(latency)만 매번 조금씩 다르다
 * (실제 서버도 그렇다). 방송 칸(BroadcastCard)과 방송 모니터(DisplayMirror)는 렌더 횟수만 세는 가짜로 바꾼다.
 * `MEASURE=1 pnpm vitest run main/page.profile` 이면 표를 찍는다.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { Profiler, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MainPage from "./page";

const renders = { broadcast: 0, mirror: 0, statusCard: 0 };

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/broadcast/BroadcastCard", () => ({
  default: function BroadcastCard() {
    renders.broadcast += 1;
    return null;
  },
}));
vi.mock("@/components/display/DisplayMirror", () => ({
  DisplayMirror: function DisplayMirror() {
    renders.mirror += 1;
    return null;
  },
}));
vi.mock("@/components/StatusCard", async (importOriginal) => {
  const real = (await importOriginal()) as { default: (p: object) => ReactNode };
  return {
    default: function StatusCard(props: object) {
      renders.statusCard += 1;
      return real.default(props);
    },
  };
});

// 학교와 같은 구역 58개 (10행 × 6열 중 58칸)
const names = Array.from({ length: 58 }, (_, i) => `구역${i + 1}`);
const cells = Array.from({ length: 10 }, (_, r) => names.slice(r * 6, r * 6 + 6));
let latency = 20;
let active = ["구역1", "구역2"];

function respond(url: string): unknown {
  if (url.includes("/speakers/matrix"))
    return { rows: 10, cols: 6, driver: { kind: "mock", rows: 10, cols: 6 }, cells };
  if (url.includes("/speakers/status")) return { active_devices: active, total_devices: 58 };
  if (url.includes("/network/status"))
    return { speaker_controller: "online", internet: "online", latency: (latency += 1.3) };
  if (url.includes("/display/status")) return { type: "standby" };
  if (url.includes("/halls/status")) return { total: 2, connected: 2, devices: [] };
  if (url.includes("/members/me"))
    return { role: "operator", name: "측정", status: "approved", devices: [] };
  return {};
}

beforeEach(() => {
  vi.useFakeTimers();
  renders.broadcast = renders.mirror = renders.statusCard = 0;
  active = ["구역1", "구역2"];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (input: string) =>
        ({ ok: true, status: 200, json: async () => respond(String(input)) }) as Response,
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function measureIdleMinute() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let commits = 0;
  let renderMs = 0;
  render(
    <QueryClientProvider client={qc}>
      <Profiler
        id="main"
        onRender={(_id, _phase, actual) => {
          commits += 1;
          renderMs += actual;
        }}
      >
        <MainPage />
      </Profiler>
    </QueryClientProvider>,
  );
  // 첫 화면 — 모든 응답이 들어올 때까지
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  commits = 0;
  renderMs = 0;
  renders.broadcast = renders.mirror = renders.statusCard = 0;

  for (let s = 0; s < 60; s++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
  return { commits, renderMs: Math.round(renderMs), ...renders };
}

describe("메인 화면 — 바뀐 게 없는 1분", () => {
  it("다시 그리는 횟수", async () => {
    const r = await measureIdleMinute();
    if (process.env.MEASURE) console.table(r);
    // 응답 시간 카드(5초마다 12번) 말고는 다시 그릴 까닭이 없다
    expect(r.broadcast).toBe(0);
    expect(r.mirror).toBe(0);
    expect(r.statusCard).toBe(0);
    expect(r.commits).toBeLessThanOrEqual(12);
  });

  it("스피커 상태가 바뀌면 스피커 칸은 다시 그린다 (방송 칸·모니터는 그대로)", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={qc}>
        <MainPage />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    renders.broadcast = renders.mirror = renders.statusCard = 0;
    active = ["구역1", "구역2", "구역3"]; // 다른 기기가 구역3 을 켰다
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(renders.statusCard).toBe(58);
    expect(renders.broadcast + renders.mirror).toBe(0);
    expect(view.getAllByText("ON")).toHaveLength(3);
  });
});
