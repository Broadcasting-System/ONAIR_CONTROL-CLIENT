export type NavItem = {
  label: string;
  subLabel: string;
  path: string;
  adminOnly?: boolean;
  /** 부장 이상에게는 숨긴다 (같은 화면을 관리 메뉴로 따로 본다) */
  hideForAdmin?: boolean;
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
      { label: "자동 음향", subLabel: "AUTO MIX", path: "/auto-audio", isNew: true },
      { label: "녹음·녹화", subLabel: "RECORDING", path: "/recording", isNew: true },
    ],
  },
  {
    title: "SETUP",
    items: [
      // 관리자에게는 '예약 현황' 탭이 함께 보인다 (구 시보 스케줄 메뉴)
      { label: "시보 설정", subLabel: "TIME", path: "/time" },
      { label: "파일 관리", subLabel: "FILES", path: "/files" },
      // 방송부 명단은 기기·부원 관리 › 부원 › 방송부로 합쳤다. 부장이 아니면 그 보기만 여기서 (내 소개 고치기)
      { label: "방송부", subLabel: "CREW", path: "/devices", hideForAdmin: true },
    ],
  },
  {
    title: "ADMIN",
    adminOnly: true,
    items: [
      // 부원(초대·승인·권한·방송부 명단)·기기·접근 로그 탭 — 부장 이상
      { label: "기기·부원 관리", subLabel: "DEVICES · MEMBERS", path: "/devices", adminOnly: true },
    ],
  },
];

/** 그룹을 펼친 전체 목록 */
export const NAVIGATION_ITEMS: NavItem[] = NAVIGATION_GROUPS.flatMap((g) => g.items);
