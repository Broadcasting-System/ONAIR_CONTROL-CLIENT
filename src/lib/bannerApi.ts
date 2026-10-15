import { getApiBase } from "@/lib/apiBase";
import { displayAppBase } from "@/lib/backend";

export type BannerScene = "blank" | "image" | "gif" | "scoreboard" | "timer" | "default";

export type TimerPayload = {
  durationSec: number;
  label?: string;
  mode?: "down" | "up";
  color?: string;
};

export type DefaultBannerPayload = {
  mainText: string;
  subText1: string;
  subText2: string;
};

export type ScoreAnim =
  | "slamshine"
  | "slam"
  | "shine"
  | "neon"
  | "drop"
  | "collide";

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
  { key: "collide", label: "충돌 합체" },
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
  /** 지금 떠 있는 저장한 현수막 (저장 안 한 것이면 null) */
  savedId?: string | null;
  /** 지금 현수막을 띄운 시각(ms) */
  since?: number | null;
}

/** 저장한 현수막 */
export interface SavedBanner {
  id: string;
  name: string;
  scene: BannerScene;
  payload: Record<string, unknown>;
  createdAt?: string | number | null;
  updatedAt?: string | number | null;
}

/** scene + payload를 서버에 송출(broadcast). savedId 를 주면 어느 저장한 현수막인지도 남긴다. */
export async function updateBanner(
  scene: BannerScene,
  payload: Record<string, unknown>,
  savedId?: string | null,
): Promise<void> {
  const res = await fetch(`${getApiBase()}/banner/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(savedId === undefined ? { scene, payload } : { scene, payload, savedId }),
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

// ---------------------------------------------------------------- 저장한 현수막

function toSaved(x: unknown): SavedBanner | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (o.id === undefined || o.id === null) return null;
  return {
    id: String(o.id),
    name: typeof o.name === "string" ? o.name : "",
    scene: (o.scene as BannerScene) ?? "default",
    payload: (o.payload as Record<string, unknown>) ?? {},
    createdAt: (o.createdAt as string | number | null) ?? null,
    updatedAt: (o.updatedAt as string | number | null) ?? (o.createdAt as string | number | null) ?? null,
  };
}

/** 저장한 현수막 목록. 서버에 기능이 없으면 null (화면에서 숨긴다). */
export async function fetchSavedBanners(): Promise<SavedBanner[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/banner/saved`);
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    const list = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items;
    if (!Array.isArray(list)) return null;
    return list.map(toSaved).filter((x): x is SavedBanner => !!x);
  } catch {
    return null;
  }
}

async function savedResult(res: Response, what: string): Promise<SavedBanner> {
  if (!res.ok) throw new Error(`${what} failed: ${res.status}`);
  const item = toSaved(await res.json().catch(() => null));
  if (!item) throw new Error(`${what}: bad response`);
  return item;
}

export async function createSavedBanner(body: { name: string; scene: BannerScene; payload: Record<string, unknown> }): Promise<SavedBanner> {
  const res = await fetch(`${getApiBase()}/banner/saved`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return savedResult(res, "saved create");
}

export async function updateSavedBanner(
  id: string,
  patch: Partial<{ name: string; scene: BannerScene; payload: Record<string, unknown> }>,
): Promise<SavedBanner> {
  const res = await fetch(`${getApiBase()}/banner/saved/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return savedResult(res, "saved update");
}

export async function deleteSavedBanner(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/banner/saved/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`saved delete failed: ${res.status}`);
}
