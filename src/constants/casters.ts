export interface Caster {
  name: string;
  cohort: number; // 기수
  role: "leader" | "member"; // 부장(빨강) | 부원(초록)
  title?: string; // 역할 부제 (예: "당근 인턴")
  bio?: string; // 소개
}

const RYU_BIO = `류승찬은 신이다.
그냥 신이다.

류승찬은 어떤 대회나 어떤 일을 하더라도 최소 2위를 하는 미친 능력을 가지고 있다. 이를 통하여 그가 나간 모든 대회에서 1등 혹은 2등을 하였다.

결국 신이 되어버린 류승찬은 3학년이 되어 다양한 엄청난 기업들 면접을 보고 다녔다. 물론 그가 면접관을 상대로 질문을 하는 면접관보다 한 수 위에 있는, 사실상 그가 면접관을 상대로 면접관이 되는 기이한 행동들을 보였으며 그 결과 토스, 당근, 라인, 쿠팡, 네이버, 카카오, 구글, 피그마 등의 엄청난 기업들에 합격한다.

회사에서는 서로 류승찬이라는 신을 모시기 위해 노력하며 뒷돈까지 주며 모시려고 하였다. 하지만 신께서는 '나는 이런곳에 갈 자격이 안 된다' 라고 생각하셔서 작은 기업들에 기부한다는 생각으로 들어가셨다....`;

// 기수별 방송부원. role: "leader"는 부장(빨강 점), "member"는 부원(초록 점).
// bio는 자유롭게 편집하세요.
export const CASTERS: Caster[] = [
  // 2기
  { name: "양유빈", cohort: 2, role: "leader", title: "방송부 2기 부장" },
  { name: "박우빈", cohort: 2, role: "member", title: "핀다" },
  { name: "김병찬", cohort: 2, role: "member", title: "바질컴퍼니" },
  { name: "윤동현", cohort: 2, role: "member" },
  // 3기
  { name: "김예진", cohort: 3, role: "leader", title: "건강보험심사평가원" },
  { name: "이민준", cohort: 3, role: "member", title: "모비어스" },
  { name: "박성현", cohort: 3, role: "member", title: "화영" },
  { name: "조예설", cohort: 3, role: "member", title: "엘스페이스" },
  // 4기
  {
    name: "류승찬",
    cohort: 4,
    role: "leader",
    title: "팀모노리스",
    bio: RYU_BIO,
  },
  {
    name: "서정현",
    cohort: 4,
    role: "member",
    title: "미취업",
    bio: "지금 사용중인 이 온에어를 개발했다.",
  },
  { name: "조아라", cohort: 4, role: "member" },
  { name: "김예빈", cohort: 4, role: "member", title: "화영" },
  // 5기
  { name: "박성준", cohort: 5, role: "leader", title: "방송부 5기 부장" },
  { name: "김가은", cohort: 5, role: "member" },
  { name: "강준석", cohort: 5, role: "member" },
  { name: "조현우", cohort: 5, role: "member" },
  // 6기 (부장 미정 — 전원 부원)
  { name: "양유진", cohort: 6, role: "member" },
  { name: "조재윤", cohort: 6, role: "member" },
  { name: "육은체", cohort: 6, role: "member" },
  { name: "구범준", cohort: 6, role: "member" },
];

/** 기수별로 묶어 정렬된 그룹 반환 */
export function groupCastersByCohort(): { cohort: number; members: Caster[] }[] {
  const map = new Map<number, Caster[]>();
  for (const c of CASTERS) {
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
