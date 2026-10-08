import type { Role } from "@/types/member";

/** 빈 대화에 보이는 추천 — 누르면 바로 보내거나(text), 파일을 고르게 한다(upload) */
export interface Suggestion {
  label: string;
  /** 보낼 말 (upload 면 파일을 고른 뒤 입력 칸에 채워 둔다) */
  text: string;
  /** 파일 고르기 accept */
  upload?: string;
}

const GENERAL: Suggestion[] = [
  { label: "지금 상태 알려줘", text: "지금 상태 알려줘" },
  { label: "뭐 할 수 있어?", text: "여기서 뭐 할 수 있어?" },
];

const IMAGE = "image/*,application/pdf";
const VIDEO = "video/*,image/*";

/** 경로 앞부분 → 그 화면에서 할 만한 것 */
const BY_PAGE: { prefix: string; items: Suggestion[]; minRole?: Role }[] = [
  {
    prefix: "/time",
    items: [
      { label: "시간표 사진으로 시보 만들기", text: "이 시간표로 시보 만들어 줘", upload: IMAGE },
      { label: "오늘 울리는 시보 보여줘", text: "오늘 울리는 시보 목록 보여줘" },
      { label: "다음 시보는 언제야?", text: "다음 시보는 언제 울려?" },
    ],
  },
  {
    prefix: "/scheduler",
    items: [
      { label: "오늘 예약 방송 보여줘", text: "오늘 예약된 방송 보여줘" },
      { label: "예약 방송 만들기", text: "예약 방송 하나 만들고 싶어" },
    ],
  },
  {
    prefix: "/main",
    items: [
      { label: "영상 올려서 송출하기", text: "이 영상 송출 화면에 띄워 줘", upload: VIDEO },
      { label: "송출 화면에 뭐 나와?", text: "송출 화면에 지금 뭐 나오고 있어?" },
      { label: "하단 배너 바꾸기", text: "하단 배너 글자 바꾸고 싶어" },
    ],
  },
  {
    prefix: "/media",
    items: [
      { label: "영상 올려서 송출하기", text: "이 영상 송출 화면에 띄워 줘", upload: VIDEO },
      { label: "송출 화면에 뭐 나와?", text: "송출 화면에 지금 뭐 나오고 있어?" },
      { label: "송출 화면 비우기", text: "송출 화면 비워 줘" },
      // 송출 › 현수막 탭 (옛 /banner)
      { label: "배너에 지금 뭐라고 나와?", text: "하단 배너에 지금 뭐라고 나와?" },
    ],
  },
  {
    prefix: "/speakers",
    items: [
      { label: "켜진 스피커 알려줘", text: "지금 켜진 스피커 알려줘" },
      { label: "파일 올려서 교실에 방송하기", text: "이 파일을 교실 스피커로 방송해 줘", upload: "audio/*,video/*" },
    ],
  },
  {
    prefix: "/mixer",
    items: [
      { label: "강당 믹서 상태 알려줘", text: "강당 믹서 지금 상태 알려줘" },
      { label: "믹서 씬 바꾸기", text: "강당 믹서 씬 바꾸고 싶어" },
      // 오디오 › 자동 음향 탭 (옛 /auto-audio)
      { label: "자동 음향 켜져 있어?", text: "자동 음향 지금 켜져 있어?" },
    ],
  },
  {
    prefix: "/matrix",
    items: [{ label: "영상 매트릭스 연결 보여줘", text: "영상 매트릭스 지금 연결 상태 보여줘" }],
  },
  {
    prefix: "/lighting",
    items: [
      { label: "조명 장면 뭐 있어?", text: "강당 조명 장면 뭐 있어?" },
      { label: "조명 장면 바꾸기", text: "강당 조명 장면 바꾸고 싶어" },
    ],
  },
  {
    prefix: "/recording",
    items: [
      { label: "녹음·녹화 상태 알려줘", text: "녹음·녹화 지금 상태 알려줘" },
      { label: "녹음 시작하기", text: "녹음 시작해 줘" },
    ],
  },
  {
    prefix: "/files",
    items: [
      { label: "파일 올려서 보관함에 저장", text: "이 파일 파일 보관함에 저장해 줘", upload: "*/*" },
      { label: "최근 올린 파일 보여줘", text: "최근에 올린 파일 보여줘" },
    ],
  },
  {
    prefix: "/devices",
    minRole: "lead",
    items: [{ label: "오늘 접근 로그 요약", text: "오늘 접근 로그 요약해 줘" }],
  },
];

const RANK: Record<Role, number> = { guest: 0, alumni: 0, teacher: 0, member: 1, lead: 2, superadmin: 3 };

export function suggestionsFor(pathname: string, role: Role): Suggestion[] {
  const page = BY_PAGE.find((p) => pathname.startsWith(p.prefix) && RANK[role] >= RANK[p.minRole ?? "member"]);
  return [...(page?.items ?? []), ...GENERAL].slice(0, 6);
}
