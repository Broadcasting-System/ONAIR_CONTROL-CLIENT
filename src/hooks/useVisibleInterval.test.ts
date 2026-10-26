import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVisibleInterval } from "./useVisibleInterval";

let state: DocumentVisibilityState = "visible";
const setVisibility = (v: DocumentVisibilityState) => {
  state = v;
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  vi.useFakeTimers();
  state = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => state);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useVisibleInterval", () => {
  it("보이는 동안 처음 한 번 + ms 마다 부른다", () => {
    const fn = vi.fn();
    renderHook(() => useVisibleInterval(fn, 5000));
    expect(fn).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(15_000));
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("숨기면 부르지 않고, 다시 보이면 바로 한 번", () => {
    const fn = vi.fn();
    renderHook(() => useVisibleInterval(fn, 5000));
    act(() => setVisibility("hidden"));
    act(() => vi.advanceTimersByTime(60_000));
    expect(fn).toHaveBeenCalledTimes(1); // 처음 한 번뿐 — 숨긴 1분 동안 12번 아낌
    act(() => setVisibility("visible"));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("ms 가 null 이면 멈추고, 화면이 사라지면 정리한다", () => {
    const fn = vi.fn();
    const { rerender, unmount } = renderHook(({ ms }) => useVisibleInterval(fn, ms), {
      initialProps: { ms: null as number | null },
    });
    act(() => vi.advanceTimersByTime(30_000));
    expect(fn).not.toHaveBeenCalled();
    rerender({ ms: 3000 });
    expect(fn).toHaveBeenCalledTimes(1);
    unmount();
    act(() => vi.advanceTimersByTime(30_000));
    act(() => setVisibility("visible"));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("늘 최신 fn 을 부른다 (fn 이 바뀌어도 타이머를 다시 만들지 않는다)", () => {
    const a = vi.fn();
    const b = vi.fn();
    const { rerender } = renderHook(({ fn }) => useVisibleInterval(fn, 1000, { immediate: false }), {
      initialProps: { fn: a },
    });
    rerender({ fn: b });
    act(() => vi.advanceTimersByTime(1000));
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});
