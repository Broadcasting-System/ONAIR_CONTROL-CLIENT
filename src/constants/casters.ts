export interface Caster {
  id: string; // 안정 식별자 (이름 바뀌어도 유지)
  name: string;
  cohort: number; // 기수
  role: "leader" | "member"; // 부장(빨강) | 부원(초록)
  title?: string; // 역할 부제 (예: "당근 인턴")
  bio?: string; // 소개
}

// 기수별 방송부원 명단은 서버(data/casters.json)에 있다 — useCasters 훅으로 읽고 저장한다.
// 편집은 컨트롤 편집 UI(/caster?edit=1)에서.

/** 기수별로 묶어 정렬된 그룹 반환 */
export function groupCastersByCohort(list: Caster[]): { cohort: number; members: Caster[] }[] {
  const map = new Map<number, Caster[]>();
  for (const c of list) {
    if (!map.has(c.cohort)) map.set(c.cohort, []);
    map.get(c.cohort)!.push(c);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([cohort, members]) => ({ cohort, members }));
}

/** bio가 없을 때 보여줄 기본 소개. 예: "방송부 4기 부원 류승찬입니다." */
export function defaultCasterBio(c: Caster): string {
  const role = c.role === "leader" ? "부장" : "부원";
  return `방송부 ${c.cohort}기 ${role} ${c.name}입니다.`;
}

/** 상세 패널의 역할 부제 텍스트 */
export function casterSubtitle(c: Caster): string {
  const base = c.role === "leader" ? `방송부 ${c.cohort}기 부장` : `방송부 ${c.cohort}기 부원`;
  if (c.title && c.title !== base) return `${base} / ${c.title}`;
  return base;
}
