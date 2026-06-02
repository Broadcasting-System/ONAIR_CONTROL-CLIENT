import { getApiBase } from "@/lib/apiBase";
import { displayAppBase } from "@/lib/backend";

export type BannerScene = "blank" | "image" | "gif" | "scoreboard";

export type ScoreAnim = "slamshine" | "slam" | "shine" | "neon" | "drop";

export type VictoryState = {
  side: "left" | "right";
  name?: string;
  at: number;
} | null;

export const SCORE_ANIM_OPTIONS: { key: ScoreAnim; label: string }[] = [
  { key: "slamshine", label: "임팩트+샤인" },
  { key: "slam", label: "임팩트 슬램" },
  { key: "shine", label: "샤인 스윕" },
  { key: "neon", label: "네온 점등" },
  { key: "drop", label: "바운스 드롭" },
];

export interface TeamState {
  name?: string;
  score: number; // 메인 스코어 (현재 세트 득점)
  set: number; // 세트 스코어 (획득 세트 수)
}

export interface ScoreboardPayload {
  title: string;
  subtitle: string;
  titleSize: number; // 제목 폰트 크기 (디자인 px)
  subtitleSize: number; // 부제목 폰트 크기 (디자인 px)
  showSet: boolean; // 세트 스코어 표시 여부
  targetScore: number; // 몇 점 내기 (매치포인트/듀스 판정)
  scoreAnim: ScoreAnim; // 득점 애니메이션 (승리 WIN에도 동일 임팩트+샤인 적용)
  victory: VictoryState; // 승리 트리거
  courtChange: { at: number } | null; // 코트 체인지 트리거
  teamA: TeamState;
  teamB: TeamState;
}

export interface BannerOverlay {
  title: string;
  subtitle: string;
  titleSize: number; // 디자인 px (6845×552 기준)
  subtitleSize: number;
  showSubtitle: boolean;
  color: string;
  position: "top" | "center" | "bottom";
  visible: boolean;
}

export interface ImagePayload {
  url: string;
  fit?: "cover" | "contain";
  overlay?: BannerOverlay;
}

export interface GifPayload {
  url: string;
}

export interface BannerStatus {
  displays: number;
  total: number;
  scene: BannerScene;
  serverTimestamp: number | null;
}

export interface BannerStateResponse {
  scene: BannerScene;
  payload: Record<string, unknown>;
  serverTimestamp?: number | null;
}

/** scene + payload를 서버에 송출(broadcast). */
export async function updateBanner(
  scene: BannerScene,
  payload: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${getApiBase()}/banner/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scene, payload }),
  });
  if (!res.ok) throw new Error(`banner update failed: ${res.status}`);
}

/** blank로 초기화 (송출 끔). */
export async function clearBanner(): Promise<void> {
  const res = await fetch(`${getApiBase()}/banner/clear`, { method: "POST" });
  if (!res.ok) throw new Error(`banner clear failed: ${res.status}`);
}

/** 현재 서버 상태 조회 (초기 로드용). */
export async function fetchBannerState(): Promise<BannerStateResponse | null> {
  try {
    const res = await fetch(`${getApiBase()}/banner/state`);
    if (!res.ok) return null;
    return (await res.json()) as BannerStateResponse;
  } catch {
    return null;
  }
}

/** 연결된 송출 개수 등 (LIVE 표시용). */
export async function fetchBannerStatus(): Promise<BannerStatus | null> {
  try {
    const res = await fetch(`${getApiBase()}/banner/status`);
    if (!res.ok) return null;
    return (await res.json()) as BannerStatus;
  } catch {
    return null;
  }
}

/** 송출 페이지(디스플레이 앱)의 미리보기 URL. */
export function getDisplayPreviewUrl(): string {
  // role=control → 미리보기는 LIVE 송출 카운트에 잡히지 않음
  return `${displayAppBase()}/banner?debug=1&role=control`;
}
