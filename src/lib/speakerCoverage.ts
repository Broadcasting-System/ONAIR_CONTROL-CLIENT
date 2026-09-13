import bssmFloorMap from "@/constants/bssmFloorMap.json";
import {
  ROOM_TO_SPEAKER,
  CELL_TO_SPEAKER,
  SPEAKER_GROUPS,
} from "@/constants/speakerMap";

export interface FloorElement {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  interactive: boolean | null;
}
export type Floors = Record<string, { label: string; elements: FloorElement[] }>;

export const FLOORS = (bssmFloorMap as unknown as { floors: Floors }).floors;
export const FLOOR_KEYS = Object.keys(FLOORS);

/** 이름 없는 칸(건물 외곽선·미사용 구역) */
export function isOutline(el: FloorElement): boolean {
  return !el.name || el.name === "X";
}

/** 한 칸을 담당하는 스피커들. [0]=직접 담당, 뒤는 그 스피커를 묶는 그룹(SRC1-1 등).
 *  복도는 방 이름이 전부 "복도"라 이름으로 구분이 안 되므로 "층:id" 를 먼저 본다. */
export function speakersOfCell(floor: string, el: FloorElement): string[] {
  const direct =
    CELL_TO_SPEAKER[`${floor}:${el.id}`] ?? ROOM_TO_SPEAKER[el.name];
  if (!direct) return [];
  const groups = Object.entries(SPEAKER_GROUPS)
    .filter(([, members]) => members.includes(direct))
    .map(([name]) => name);
  return [direct, ...groups];
}

export interface Coverage {
  /** 이 스피커가 담당하는 칸의 지명들 (같은 이름이 여러 층에 있으면 중복 가능) */
  cells: string[];
  /** 담당 칸이 있는 층 (오름차순) */
  floors: string[];
}

/** 스피커 → 담당 구역. 지도 데이터에서 한 번만 계산한다. */
export const SPEAKER_COVERAGE: Record<string, Coverage> = (() => {
  const acc: Record<string, { cells: string[]; floors: Set<string> }> = {};
  for (const [floor, data] of Object.entries(FLOORS)) {
    for (const el of data.elements) {
      if (isOutline(el)) continue;
      for (const sp of speakersOfCell(floor, el)) {
        const entry = (acc[sp] ??= { cells: [], floors: new Set() });
        entry.cells.push(el.name);
        entry.floors.add(floor);
      }
    }
  }
  return Object.fromEntries(
    Object.entries(acc).map(([sp, v]) => [
      sp,
      { cells: v.cells, floors: [...v.floors].sort() },
    ]),
  );
})();

/** 표 칩에 붙일 짧은 설명. "3곳 함께" / "2층" / "지도 밖" */
export function coverageTag(speaker: string): string {
  const cov = SPEAKER_COVERAGE[speaker];
  if (!cov || cov.cells.length === 0) return "지도 밖";
  if (cov.cells.length > 1) return `${cov.cells.length}곳 함께`;
  return cov.floors[0] ? `${cov.floors[0]}층` : "지도";
}
