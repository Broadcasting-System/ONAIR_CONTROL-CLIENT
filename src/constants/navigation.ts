export type NavItem = {
  label: string;
  subLabel: string;
  path: string;
  adminOnly?: boolean;
  /** 부장 이상에게는 숨긴다 (같은 화면을 관리 메뉴로 따로 본다) */
  hideForAdmin?: boolean;
  /** 부원 이상에게만 */
  operatorOnly?: boolean;
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
      { label: "메인", subLabel: "MAIN", path: "/main" },
      // 송출 화면·현수막 탭 (옛 /banner → /media?tab=banner)
      { label: "송출", subLabel: "BROADCAST", path: "/media" },
      // 선생님 요청 (teacher.bssmcast.com) — 부원 이상
      { label: "요청함", subLabel: "REQUESTS", path: "/requests", operatorOnly: true },
      { label: "스피커 지도", subLabel: "SPEAKER MAP", path: "/speakers" },
    ],
  },
  {
    title: "HALL",
    items: [
      // 믹서·자동 음향 탭 (옛 /auto-audio → /mixer?tab=auto)
      { label: "오디오", subLabel: "AUDIO", path: "/mixer" },
      // 영상 매트릭스는 다목적홀 장비가 고쳐질 때까지 메뉴에서 뺌 (/matrix 주소는 그대로)
      { label: "조명", subLabel: "LIGHTING", path: "/lighting" },
      { label: "녹음·녹화", subLabel: "RECORDING", path: "/recording" },
    ],
  },
  {
    title: "SETUP",
    items: [
      // 관리자에게는 '예약 현황'·'야간 절전' 탭이 함께 보인다 (구 시보 스케줄 메뉴)
      { label: "시보", subLabel: "TIME", path: "/time" },
      { label: "파일", subLabel: "FILES", path: "/files" },
      // 방송부 명단은 관리 › 부원 › 방송부로 합쳤다. 부장이 아니면 그 보기만 여기서 (내 소개 고치기)
      { label: "방송부", subLabel: "CREW", path: "/devices", hideForAdmin: true },
    ],
  },
  {
    title: "ADMIN",
    adminOnly: true,
    items: [
      // 부원(초대·승인·권한·방송부 명단)·Cloudflare·기기·스피커 매핑·강당 장비·접근 로그 탭 — 부장 이상
      { label: "관리", subLabel: "ADMIN", path: "/devices", adminOnly: true },
      { label: "로그", subLabel: "LOG", path: "/logs", adminOnly: true },
    ],
  },
];

/** 그룹을 펼친 전체 목록 */
export const NAVIGATION_ITEMS: NavItem[] = NAVIGATION_GROUPS.flatMap((g) => g.items);
