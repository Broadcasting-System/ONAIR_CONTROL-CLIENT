export type NavItem = {
  label: string;
  subLabel: string;
  path: string;
  adminOnly?: boolean;
  isNew?: boolean;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
};

export const NAVIGATION_GROUPS: NavGroup[] = [
  {
    title: "LIVE",
    items: [
      { label: "메인 세팅", subLabel: "MAIN", path: "/main" },
      { label: "스피커 지도", subLabel: "SPEAKER MAP", path: "/speakers", isNew: true },
      { label: "미디어 송출", subLabel: "MEDIA", path: "/media" },
      { label: "현수막", subLabel: "BANNER", path: "/banner" },
    ],
  },
  {
    title: "HALL",
    items: [
      { label: "오디오 믹서", subLabel: "MIXER", path: "/mixer", isNew: true },
      { label: "영상 매트릭스", subLabel: "VIDEO MATRIX", path: "/matrix", isNew: true },
      { label: "조명", subLabel: "LIGHTING", path: "/lighting", isNew: true },
    ],
  },
  {
    title: "SETUP",
    items: [
      // 관리자에게는 '예약 현황' 탭이 함께 보인다 (구 시보 스케줄 메뉴)
      { label: "시보 설정", subLabel: "TIME", path: "/time" },
      { label: "파일 관리", subLabel: "FILES", path: "/files" },
      { label: "방송부", subLabel: "BROAD CASTER", path: "/caster" },
    ],
  },
  {
    title: "ADMIN",
    adminOnly: true,
    items: [
      // 부원(초대·승인·권한)·기기·접근 로그 탭 — 부장 이상
      { label: "기기·부원 관리", subLabel: "DEVICES · MEMBERS", path: "/devices", adminOnly: true },
    ],
  },
];

/** 그룹을 펼친 전체 목록 */
export const NAVIGATION_ITEMS: NavItem[] = NAVIGATION_GROUPS.flatMap((g) => g.items);
