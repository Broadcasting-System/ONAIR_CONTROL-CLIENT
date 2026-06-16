export type NavItem = {
  label: string;
  subLabel: string;
  path: string;
  adminOnly?: boolean;
};

export const NAVIGATION_ITEMS: NavItem[] = [
  { label: "메인 세팅", subLabel: "MAIN", path: "/main" },
  { label: "시보 설정", subLabel: "TIME", path: "/time" },
  { label: "파일 관리", subLabel: "FILES", path: "/files" },
  { label: "현수막", subLabel: "BANNER", path: "/banner" },
  { label: "미디어 송출", subLabel: "MEDIA", path: "/media" },
  { label: "방송부", subLabel: "BROAD CASTER", path: "/caster" },
  { label: "시보 스케줄", subLabel: "SCHEDULER", path: "/scheduler", adminOnly: true },
  { label: "기기 관리", subLabel: "DEVICES", path: "/devices", adminOnly: true },
  { label: "접근 로그", subLabel: "LOGS", path: "/logs", adminOnly: true },
];
