import { del, post, request, seg } from "@/lib/http";
import type { LightColor, LightingState, LightScene } from "@/types/lighting";

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
};
