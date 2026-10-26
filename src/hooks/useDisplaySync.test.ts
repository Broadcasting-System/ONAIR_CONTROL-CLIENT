import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeWebSocket } from "@/test/fakeSocket";
import { useDisplaySync } from "./useDisplaySync";

const video = (url: string, ts = 1) => ({ command: "display", type: "video", url, serverTimestamp: ts });

/** 초기 상태 fetch — 테스트가 원하는 때 응답을 준다 */
function deferredFetch() {
  let resolve!: (body: unknown) => void;
  const fetchMock = vi.fn(
    () => new Promise<Response>((r) => (resolve = (body) => r({ ok: true, json: async () => body } as Response))),
  );
  return { fetchMock, respond: (body: unknown) => resolve(body) };
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.reset();
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useDisplaySync", () => {
  it("소켓으로 받은 송출 내용을 보여 주고 standby 면 비운다", () => {
    vi.stubGlobal("fetch", deferredFetch().fetchMock);
    const { result } = renderHook(() => useDisplaySync(1));
    const ws = FakeWebSocket.last();
    act(() => {
      ws.open();
      ws.message(video("/a.mp4"));
    });
    expect(result.current.content?.type).toBe("video");
    act(() => ws.message({ command: "display", type: "standby" }));
    expect(result.current.content).toBeNull();
  });

  it("끊기면 다시 붙고, 다시 붙은 소켓이 주는 상태로 맞춘다", () => {
    vi.stubGlobal("fetch", deferredFetch().fetchMock);
    const { result } = renderHook(() => useDisplaySync(1));
    const first = FakeWebSocket.last();
    act(() => {
      first.open();
      first.message(video("/a.mp4"));
      first.serverClose();
    });
    expect(FakeWebSocket.all).toHaveLength(1);
    act(() => vi.advanceTimersByTime(3000));
    expect(FakeWebSocket.all).toHaveLength(2);
    // 끊긴 사이 송출이 꺼졌다 — 서버는 붙자마자 standby 를 보낸다
    act(() => {
      FakeWebSocket.last().open();
      FakeWebSocket.last().message({ command: "display", type: "standby" });
    });
    expect(result.current.content).toBeNull();
  });

  // 회귀: e5c7dd0 — CH2 송출을 끄고 CH1 로 돌아가면 옛 소켓이 다시 붙어 엉뚱한 채널 내용이 들어오던 버그
  it("채널을 바꾸면 옛 채널 소켓은 다시 붙지 않고, 늦게 온 옛 메시지도 무시한다", async () => {
    vi.stubGlobal("fetch", deferredFetch().fetchMock);
    const { result, rerender } = renderHook(({ ch }) => useDisplaySync(ch), { initialProps: { ch: 1 } });
    const ch1 = FakeWebSocket.last();
    act(() => ch1.open());

    rerender({ ch: 2 });
    const ch2 = FakeWebSocket.last();
    expect(ch2.url).toContain("channel=2");
    await act(async () => {
      await Promise.resolve(); // 옛 소켓의 onclose(비동기)가 뒤늦게 온다
      vi.advanceTimersByTime(10_000);
    });
    expect(FakeWebSocket.all.filter((s) => !s.url.includes("channel="))).toHaveLength(1); // CH1 은 처음 하나뿐

    act(() => {
      ch1.message(video("/ch1.mp4")); // 닫히는 중에 도착한 CH1 메시지
      ch2.open();
      ch2.message({ command: "display", type: "standby" });
    });
    expect(result.current.content).toBeNull();
  });

  it("소켓이 먼저 상태를 줬으면 늦게 온 초기 fetch 결과로 덮어쓰지 않는다", async () => {
    const f = deferredFetch();
    vi.stubGlobal("fetch", f.fetchMock);
    const { result } = renderHook(() => useDisplaySync(1));
    act(() => {
      FakeWebSocket.last().open();
      FakeWebSocket.last().message(video("/new.mp4", 2));
    });
    await act(async () => {
      f.respond(video("/old.mp4", 1));
      await vi.runAllTimersAsync();
    });
    expect(result.current.content?.url).toContain("/new.mp4");
  });
});
