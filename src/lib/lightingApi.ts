import { del, post, put, request, seg } from "@/lib/http";
import type {
  CaptureResult, FixtureItem, FixtureOverlap, LightColor, LightingConnection, LightingState, LightScene,
} from "@/types/lighting";

const base = (hall: string) => `/halls/${seg(hall)}/lighting`;

export const lightingApi = {
  state: (hall: string) => request<LightingState>(base(hall)),
  // fixtures 를 빼면 전체 조명. 색은 색 LED 에만 들어간다
  set: (hall: string, body: { fixtures?: string[]; intensity?: number; color?: LightColor; fade?: number }) =>
    post<{ success: boolean }>(`${base(hall)}/set`, body),
  master: (hall: string, level: number) => post<{ success: boolean }>(`${base(hall)}/master`, { level }),
  blackout: (hall: string, on: boolean) => post<{ success: boolean }>(`${base(hall)}/blackout`, { on }),
  recallScene: (hall: string, sceneId: string) =>
    post<{ success: boolean; scene: string }>(`${base(hall)}/scenes/${seg(sceneId)}/recall`),
  // 장면 저장·삭제는 관리자 (서버가 경로로 막는다)
  saveScene: (hall: string, name: string, fade: number) =>
    post<LightScene>(`${base(hall)}/scenes`, { name, fade }),
  deleteScene: (hall: string, sceneId: string) => del<{ success: boolean }>(`${base(hall)}/scenes/${seg(sceneId)}`),

  // 조명 세팅 (관리자) — 조명 목록·연결 방식. 연결을 저장하면 이 공간의 조명 설정이 생긴다
  updateConfig: (hall: string, fixtures: FixtureItem[]) =>
    put<{ fixtures: number; overlaps: FixtureOverlap[] }>(`${base(hall)}/config`, { fixtures }),
  updateConnection: (hall: string, conn: LightingConnection) =>
    put<{ device?: unknown; warning?: string }>(`${base(hall)}/connection`, conn),
  // 콘솔이 지금 보내는 DMX 를 seconds 초 동안 읽는다
  capture: (hall: string, seconds = 3) => post<CaptureResult>(`${base(hall)}/capture`, { seconds }),
  // DMX 주소 하나를 직접 켜 본다. 주소가 없으면 시험 값을 모두 해제, 값이 없으면 그 주소만 해제
  channelTest: (hall: string, body: { address?: number; value?: number }) =>
    post<{ success: boolean }>(`${base(hall)}/channel-test`, body),
  remove: (hall: string) => del<{ success: boolean }>(base(hall)),
};
