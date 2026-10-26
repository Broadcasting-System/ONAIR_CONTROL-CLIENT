import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeWebSocket } from "@/test/fakeSocket";
import { backoffDelay, useReconnectingSocket } from "./reconnectingSocket";

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.reset();
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("backoffDelay", () => {
  it("상한이 두 배씩 늘다가 maxMs 에서 멈춘다", () => {
    const top = () => 1; // 지터 최댓값
    expect([0, 1, 2, 3, 4, 5, 6, 10].map((n) => backoffDelay(n, {}, top))).toEqual([
      1000, 2000, 4000, 8000, 10_000, 10_000, 10_000, 10_000,
    ]);
  });

  it("지터로 상한의 절반~상한 사이에 흩어진다", () => {
    expect(backoffDelay(2, {}, () => 0)).toBe(2000);
    expect(backoffDelay(2, {}, () => 0.5)).toBe(3000);
    expect(backoffDelay(2, {}, () => 1)).toBe(4000);
  });
});

const socketsFor = (url: string) => FakeWebSocket.all.filter((s) => s.url === url);

/** 간격은 0.5초부터 (기본값 1초와 상관없이 고정), 지터는 최댓값 */
function setup(url = "ws://x/a", random = () => 1) {
  const onMessage = vi.fn();
  const hook = renderHook(
    ({ u }) => useReconnectingSocket(u, { onMessage }, { random, baseMs: 500 }),
    {
      initialProps: { u: url as string | null },
    },
  );
  return { ...hook, onMessage };
}

describe("useReconnectingSocket", () => {
  it("서버가 계속 안 받으면 간격을 늘려 가며 다시 붙는다", () => {
    setup();
    const waits: number[] = [];
    for (let i = 0; i < 6; i++) {
      act(() => FakeWebSocket.last().serverClose());
      const before = FakeWebSocket.all.length;
      let waited = 0;
      while (FakeWebSocket.all.length === before) {
        act(() => vi.advanceTimersByTime(100));
        waited += 100;
      }
      waits.push(waited);
    }
    expect(waits).toEqual([500, 1000, 2000, 4000, 8000, 10_000]);
  });

  it("다시 붙어 서버 상태를 받으면 간격을 처음으로 돌린다", () => {
    setup();
    act(() => FakeWebSocket.last().serverClose());
    act(() => vi.advanceTimersByTime(500));
    act(() => FakeWebSocket.last().serverClose());
    act(() => vi.advanceTimersByTime(1000));
    act(() => {
      FakeWebSocket.last().open();
      FakeWebSocket.last().message({ command: "display", type: "standby" });
      FakeWebSocket.last().serverClose();
    });
    const before = FakeWebSocket.all.length;
    act(() => vi.advanceTimersByTime(500));
    expect(FakeWebSocket.all.length).toBe(before + 1);
  });

  it("열리자마자 닫히면(메시지 없음) 붙은 것으로 보지 않는다 — 간격이 계속 는다", () => {
    setup();
    for (const wait of [500, 1000]) {
      act(() => {
        FakeWebSocket.last().open();
        FakeWebSocket.last().serverClose();
      });
      act(() => vi.advanceTimersByTime(wait));
    }
    act(() => {
      FakeWebSocket.last().open();
      FakeWebSocket.last().serverClose();
    });
    const before = FakeWebSocket.all.length;
    act(() => vi.advanceTimersByTime(1999));
    expect(FakeWebSocket.all.length).toBe(before);
    act(() => vi.advanceTimersByTime(1));
    expect(FakeWebSocket.all.length).toBe(before + 1);
  });

  it("상태: 처음 connecting → 서버 메시지 open → 끊기면 reconnecting 과 끊긴 시각", () => {
    vi.setSystemTime(new Date("2026-10-26T09:00:00+09:00"));
    const { result } = setup();
    expect(result.current).toEqual({ status: "connecting", staleSince: null });
    act(() => {
      FakeWebSocket.last().open();
      FakeWebSocket.last().message({ hi: 1 });
    });
    expect(result.current).toEqual({ status: "open", staleSince: null });
    act(() => FakeWebSocket.last().serverClose());
    const lostAt = Date.now();
    expect(result.current).toEqual({ status: "reconnecting", staleSince: lostAt });
    // 다시 붙기를 여러 번 실패해도 끊긴 시각은 처음 그대로
    act(() => vi.advanceTimersByTime(500));
    act(() => FakeWebSocket.last().serverClose());
    expect(result.current.staleSince).toBe(lostAt);
    act(() => vi.advanceTimersByTime(1000));
    act(() => {
      FakeWebSocket.last().open();
      FakeWebSocket.last().message({ hi: 2 });
    });
    expect(result.current).toEqual({ status: "open", staleSince: null });
  });

  it("JSON 이 아닌 메시지는 넘기지 않는다", () => {
    const { onMessage } = setup();
    act(() => {
      FakeWebSocket.last().open();
      FakeWebSocket.last().onmessage?.(new MessageEvent("message", { data: "not json" }));
      FakeWebSocket.last().message({ ok: true });
    });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({ ok: true });
  });

  it("주소가 바뀌면 옛 소켓은 다시 붙지 않고 늦게 온 옛 메시지도 버린다", async () => {
    const { rerender, onMessage } = setup("ws://x/ch1");
    const old = FakeWebSocket.last();
    act(() => old.open());
    rerender({ u: "ws://x/ch2" });
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(30_000);
    });
    act(() => old.message({ from: "ch1" }));
    expect(socketsFor("ws://x/ch1")).toEqual([old]);
    expect(socketsFor("ws://x/ch2")).toHaveLength(1);
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("주소가 null 이면 붙지 않고, 화면이 사라지면 닫는다", async () => {
    const { rerender, unmount } = setup(null as unknown as string);
    expect(FakeWebSocket.all).toHaveLength(0);
    rerender({ u: "ws://x/a" });
    const ws = FakeWebSocket.last();
    unmount();
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(30_000);
    });
    expect(ws.readyState).toBe(FakeWebSocket.CLOSED);
    expect(FakeWebSocket.all).toHaveLength(1);
  });

  it("기기 네트워크가 돌아오면(online) 기다리지 않고 바로 붙는다", () => {
    setup();
    for (const wait of [500, 1000, 2000]) {
      act(() => FakeWebSocket.last().serverClose());
      act(() => vi.advanceTimersByTime(wait));
    }
    act(() => FakeWebSocket.last().serverClose()); // 이제 4초 기다릴 차례
    const before = FakeWebSocket.all.length;
    act(() => window.dispatchEvent(new Event("online")));
    expect(FakeWebSocket.all.length).toBe(before + 1);
    // 예약돼 있던 다시 붙기는 취소 — 두 개가 생기지 않는다
    act(() => vi.advanceTimersByTime(4000));
    expect(FakeWebSocket.all.length).toBe(before + 1);
  });

  it("heartbeat — 붙어 있는 동안만 보낸다", () => {
    const onMessage = vi.fn();
    renderHook(() =>
      useReconnectingSocket(
        "ws://x/a",
        { onMessage },
        { heartbeat: { everyMs: 5000, message: { type: "ping" } } },
      ),
    );
    const ws = FakeWebSocket.last();
    act(() => ws.open());
    act(() => vi.advanceTimersByTime(10_000));
    expect(ws.sent).toEqual(['{"type":"ping"}', '{"type":"ping"}']);
    act(() => ws.serverClose());
    act(() => vi.advanceTimersByTime(300)); // 다시 붙기 전
    expect(ws.sent).toHaveLength(2);
  });

  it("끊겨 있다가 채널을 바꾸면 새 채널은 connecting 부터 — 옛 채널의 끊긴 시각을 넘겨받지 않는다", () => {
    const { result, rerender } = setup("ws://x/ch1");
    act(() => FakeWebSocket.last().serverClose());
    expect(result.current.status).toBe("reconnecting");
    rerender({ u: "ws://x/ch2" });
    expect(result.current).toEqual({ status: "connecting", staleSince: null });
  });
});
