/** 장비 조작(믹서·영상 매트릭스·조명)의 낙관적 업데이트 — 누르면 바로 바뀌고, 장비 명령이 실패하면 되돌린다 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hallApi } from "@/lib/hallApi";
import { lightingApi } from "@/lib/lightingApi";
import type { MixerState, VideoMatrixState } from "@/types/hall";
import type { LightingState } from "@/types/lighting";
import { useLighting } from "./useLighting";
import { useMixer } from "./useMixer";
import { useVideoMatrix } from "./useVideoMatrix";

vi.mock("@/lib/hallApi", () => ({
  hallApi: { mixer: vi.fn(), setChannel: vi.fn(), matrix: vi.fn(), route: vi.fn() },
}));
vi.mock("@/lib/lightingApi", () => ({ lightingApi: { state: vi.fn(), master: vi.fn() } }));
vi.mock("@/components/common/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const api = vi.mocked(hallApi);
const light = vi.mocked(lightingApi);

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

/** 테스트가 원하는 때 끝내는 장비 명령 */
function pending<T>() {
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((_, rj) => (reject = rj));
  return { promise, fail: (msg: string) => reject(new Error(msg)) };
}

const mixer = (level: number) =>
  ({
    connected: true,
    capabilities: [],
    channels: [{ id: "ch1", name: "마이크 1", level, mute: false, meter: null }],
    master: null,
  }) as unknown as MixerState;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useMixer 페이더", () => {
  it("명령이 끝나기 전에 화면 값이 먼저 바뀐다", async () => {
    api.mixer.mockResolvedValue(mixer(40));
    api.setChannel.mockReturnValue(pending<{ success: boolean }>().promise);
    const { result } = renderHook(() => useMixer("hall"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state?.channels[0].level).toBe(40));

    act(() => result.current.setLevel("ch1", 80));
    await waitFor(() => expect(result.current.state?.channels[0].level).toBe(80));
  });

  it("장비 명령이 실패하면 서버가 아는 값으로 돌아간다", async () => {
    api.mixer.mockResolvedValue(mixer(40));
    const cmd = pending<{ success: boolean }>();
    api.setChannel.mockReturnValue(cmd.promise);
    const { result } = renderHook(() => useMixer("hall"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state?.channels[0].level).toBe(40));

    act(() => result.current.setLevel("ch1", 80));
    await waitFor(() => expect(result.current.state?.channels[0].level).toBe(80));
    await act(async () => cmd.fail("콘솔 응답 없음"));
    await waitFor(() => expect(result.current.state?.channels[0].level).toBe(40));
  });

  // 서버까지 끊겨 명령도, 다시 읽기도 실패하면 — 장비는 안 바뀌었는데 화면만 바뀐 채로 남으면 안 된다
  it("다시 읽기까지 실패해도 누르기 전 값으로 되돌린다", async () => {
    api.mixer.mockResolvedValueOnce(mixer(40)).mockRejectedValue(new Error("서버 연결 끊김"));
    const cmd = pending<{ success: boolean }>();
    api.setChannel.mockReturnValue(cmd.promise);
    const { result } = renderHook(() => useMixer("hall"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state?.channels[0].level).toBe(40));

    act(() => result.current.setLevel("ch1", 80));
    await waitFor(() => expect(result.current.state?.channels[0].level).toBe(80));
    await act(async () => cmd.fail("서버 연결 끊김"));
    await waitFor(() => expect(result.current.state?.channels[0].level).toBe(40));
  });
});

describe("useVideoMatrix 라우팅", () => {
  it("다시 읽기까지 실패해도 원래 입력으로 되돌린다", async () => {
    const state = { connected: true, outputs: [{ no: 1, name: "강당 프로젝터", input: 2 }] } as unknown as VideoMatrixState;
    api.matrix.mockResolvedValueOnce(state).mockRejectedValue(new Error("서버 연결 끊김"));
    const cmd = pending<{ success: boolean }>();
    api.route.mockReturnValue(cmd.promise as never);
    const { result } = renderHook(() => useVideoMatrix("hall"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state?.outputs[0].input).toBe(2));

    act(() => result.current.route(1, 3));
    await waitFor(() => expect(result.current.state?.outputs[0].input).toBe(3));
    await act(async () => cmd.fail("매트릭스 응답 없음"));
    await waitFor(() => expect(result.current.state?.outputs[0].input).toBe(2));
  });
});

describe("useLighting 마스터", () => {
  it("다시 읽기까지 실패해도 원래 밝기로 되돌린다", async () => {
    const state = { connected: true, fixtures: [], master: 100, blackout: false } as unknown as LightingState;
    light.state.mockResolvedValueOnce(state).mockRejectedValue(new Error("서버 연결 끊김"));
    const cmd = pending<never>();
    light.master.mockReturnValue(cmd.promise);
    const { result } = renderHook(() => useLighting("hall"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state?.master).toBe(100));

    act(() => result.current.setMaster(30));
    await waitFor(() => expect(result.current.state?.master).toBe(30));
    await act(async () => cmd.fail("조명 노드 응답 없음"));
    await waitFor(() => expect(result.current.state?.master).toBe(100));
  });
});
