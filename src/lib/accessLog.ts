/* 접근 로그 (GET /api/logs) — 서버 기록 한 줄을 '누가 · 무엇을 · 어디에' 로 읽는다.
   서버는 바꾸는 요청마다 method·path·status 를 남기고(main.py 미들웨어), 대상(target)·값(detail)을 덧붙인다.
   부원·Cloudflare 관리(MEMBER·CLOUDFLARE)·디스코드 말로 조작(ASSIST)·CUE(via chat)·실시간 방송(WS) 은 따로 남긴다.
   서버가 스스로 한 일(시보·예약 방송·야간 절전·자동 음향·서버 켜고 끄기 등)은 method AUTO, path /auto/<kind> 로 남긴다. */

export interface LogEntry {
  ts: string;
  ip?: string;
  device?: string;
  owner?: string;
  role?: string;
  method: string;
  path: string;
  status: number;
  /** 부원 신원이면 부원 아이디·이름 (예전 서버 기록에는 없다) */
  memberId?: string;
  member?: string;
  /** 요청 본문으로만 알 수 있는 동작 이름 ('스피커 켜기')·CUE 확인 카드 제목 */
  action?: string;
  via?: string;
  tool?: string;
  /** 대상 이름 (채널·스피커·부원 이름 등) */
  target?: string;
  /** 값 (페이더 dB·바꾼 내용 등) — 펼친 줄에서 보여 준다 */
  detail?: string;
  /** ASSIST 기록 */
  text?: string;
}

export interface Described {
  label: string;
  group: string;
  /** 덧붙일 짧은 값 (대상 이름·CUE 카드 제목) */
  extra?: string;
  /** 서버가 남긴 값 — 펼친 줄에서 */
  detail?: string;
}

type Rule = [method: string, pattern: RegExp, label: string, group: string];

const H = "/api/halls/[^/]+";

/** 위에서부터 처음 맞는 규칙. method "*" 는 아무거나 */
const RULES: Rule[] = [
  // 송출·현수막
  ["*", /^\/api\/display\/clear/, "송출 끄기", "송출"],
  ["*", /^\/api\/display\/switch/, "스위처 송출", "송출"],
  ["*", /^\/api\/display\/timer/, "타이머 송출", "송출"],
  ["*", /^\/api\/display\/show/, "미디어 송출", "송출"],
  ["*", /^\/api\/display\/youtube/, "유튜브 송출", "송출"],
  ["*", /^\/api\/display\/screen/, "화면 송출", "송출"],
  ["*", /^\/api\/display\/player/, "재생 조작", "송출"],
  ["*", /^\/api\/display\/slide/, "슬라이드 넘기기", "송출"],
  ["*", /^\/api\/display\/overlay/, "자막 송출", "송출"],
  ["*", /^\/api\/display/, "송출 조작", "송출"],
  ["*", /^\/api\/banner\/clear/, "현수막 끄기", "현수막"],
  ["*", /^\/api\/banner/, "현수막 바꾸기", "현수막"],
  // 방송·목소리
  ["*", /^\/api\/broadcast\/execute/, "방송 내보내기", "방송"],
  ["*", /^\/api\/broadcast\/preview/, "방송 미리 듣기", "방송"],
  ["*", /^\/api\/broadcast\/clip/, "녹음 방송", "방송"],
  ["WS", /^\/api\/broadcast\/live/, "마이크 방송", "방송"],
  ["DELETE", /^\/api\/broadcast\/schedule\//, "방송 예약 취소", "방송"],
  ["*", /^\/api\/broadcast\/schedule/, "방송 예약", "방송"],
  ["*", /^\/api\/broadcast/, "방송 조작", "방송"],
  ["*", /^\/api\/tts\/preview/, "목소리 미리 듣기", "방송"],
  ["*", /^\/api\/tts\/settings\/test/, "목소리 연결 시험", "방송"],
  ["*", /^\/api\/tts/, "목소리 설정", "방송"],
  // 화면 공유 (외부 화면)
  ["POST", /^\/api\/share\/room/, "공유 코드 만들기", "화면 공유"],
  ["DELETE", /^\/api\/share\/room/, "공유 받기 끝내기", "화면 공유"],
  ["*", /^\/api\/share\/requests\/[^/]+\/approve/, "화면 공유 허용", "화면 공유"],
  ["*", /^\/api\/share\/requests\/[^/]+\/reject/, "화면 공유 거절", "화면 공유"],
  ["*", /^\/api\/share\/requests\/[^/]+\/end/, "화면 공유 끊기", "화면 공유"],
  ["*", /^\/api\/share\/join/, "화면 공유 요청", "화면 공유"],
  ["*", /^\/api\/share\/me\/end/, "화면 공유 끝내기", "화면 공유"],
  ["*", /^\/api\/share/, "화면 공유 조작", "화면 공유"],
  // 학생용 live 채팅 (보낸 채팅·지우기·막기는 WS 기록에 동작 이름이 붙어 온다)
  ["*", /^\/api\/live\/chat\/words/, "live 채팅 금지어 바꾸기", "live 채팅"],
  ["*", /^\/api\/live\/chat/, "live 채팅", "live 채팅"],
  // 선생님 바로 방송 (마이크는 끝날 때 한 줄, 글은 내보낼 때 한 줄 — 사람은 선생님)
  ["WS", /^\/api\/teacher\/live/, "방송 · 마이크", "방송"],
  ["*", /^\/api\/teacher\/now/, "방송 · 글", "방송"],
  // 요청 (선생님 → 방송부)
  ["*", /^\/api\/teacher\/register/, "선생님 등록", "요청"],
  ["*", /^\/api\/teacher\/uploads/, "요청 파일 올리기", "요청"],
  ["*", /^\/api\/teacher\/requests\/[^/]+\/cancel/, "요청 취소", "요청"],
  ["*", /^\/api\/teacher\/requests\/[^/]+\/comment/, "요청 댓글", "요청"],
  ["*", /^\/api\/teacher\/requests/, "요청 보냄", "요청"],
  ["*", /^\/api\/teacher\/tts-preview/, "목소리 미리 듣기", "요청"],
  ["*", /^\/api\/teacher/, "요청 조작", "요청"],
  ["*", /^\/api\/requests\/teachers\/[^/]+\/approve/, "선생님 승인", "요청"],
  ["*", /^\/api\/requests\/teachers\/[^/]+\/tier/, "선생님 권한 바꾸기", "요청"],
  ["*", /^\/api\/requests\/teachers\/[^/]+\/revoke/, "선생님 내보내기", "요청"],
  ["*", /^\/api\/requests\/[^/]+\/accept/, "요청 받기", "요청"],
  ["*", /^\/api\/requests\/[^/]+\/reject/, "요청 거절", "요청"],
  ["*", /^\/api\/requests\/[^/]+\/done/, "요청 끝냄", "요청"],
  ["*", /^\/api\/requests\/[^/]+\/comment/, "요청 댓글", "요청"],
  ["*", /^\/api\/requests/, "요청함 조작", "요청"],
  // 스피커
  ["*", /^\/api\/speakers\/control/, "스피커 조작", "스피커"],
  ["*", /^\/api\/speakers\/matrix\/backups\/[^/]+\/restore/, "스피커 매핑 되돌리기", "스피커"],
  ["*", /^\/api\/speakers\/matrix/, "스피커 매핑 저장", "스피커"],
  ["*", /^\/api\/speakers\/calibration/, "스피커 매핑 시험", "스피커"],
  ["*", /^\/api\/speakers\/connection\/test/, "스피커 연결 시험", "스피커"],
  ["*", /^\/api\/speakers\/connection/, "스피커 연결 설정", "스피커"],
  ["*", /^\/api\/speakers\/learn/, "스피커 장비 배우기", "스피커"],
  ["*", /^\/api\/speakers/, "스피커 조작", "스피커"],
  // 시보·절전·파일
  ["*", /^\/api\/time\/special/, "특별 시간표", "시보"],
  ["*", /^\/api\/time\/groups/, "시보 그룹 이름", "시보"],
  ["*", /^\/api\/time/, "시간표 적용", "시보"],
  ["*", /^\/api\/energy\/run/, "야간 절전 실행", "시보"],
  ["*", /^\/api\/energy/, "야간 절전 예약", "시보"],
  ["*", /^\/api\/casters/, "방송부 명단 저장", "부원"],
  ["POST", /^\/api\/files\/upload/, "파일 올리기", "파일"],
  ["DELETE", /^\/api\/files/, "파일 지우기", "파일"],
  ["PATCH", /^\/api\/files/, "파일 이름 바꾸기", "파일"],
  ["*", /^\/api\/files/, "파일 바꾸기", "파일"],
  // 믹서·자동 음향
  ["*", new RegExp(`^${H}/mixer/scene`), "믹서 씬 전환", "믹서"],
  ["*", new RegExp(`^${H}/mixer/channels/[^/]+/param/`), "채널 처리 조절", "믹서"],
  ["*", new RegExp(`^${H}/mixer/channels/[^/]+/address/`), "채널 주소 저장", "믹서"],
  ["*", new RegExp(`^${H}/mixer/channels/`), "믹서 채널 조작", "믹서"],
  ["*", new RegExp(`^${H}/mixer/fx/`), "이펙트 설정", "믹서"],
  ["*", new RegExp(`^${H}/mixer/config`), "믹서 설정 저장", "믹서"],
  ["*", new RegExp(`^${H}/mixer/connection/test`), "믹서 연결 시험", "믹서"],
  ["*", new RegExp(`^${H}/mixer/connection`), "믹서 연결 설정", "믹서"],
  ["*", new RegExp(`^${H}/mixer/learn`), "믹서 주소 찾기", "믹서"],
  ["*", new RegExp(`^${H}/mixer/(test|debug)/`), "믹서 시험", "믹서"],
  ["*", new RegExp(`^${H}/mixer`), "믹서 조작", "믹서"],
  ["*", new RegExp(`^${H}/auto-audio/[^/]+/enabled`), "자동 음향 켜기·끄기", "자동 음향"],
  ["*", new RegExp(`^${H}/auto-audio/channels/[^/]+/resume`), "자동 음향 다시 돌리기", "자동 음향"],
  ["*", new RegExp(`^${H}/auto-audio/settings`), "자동 음향 설정", "자동 음향"],
  ["*", new RegExp(`^${H}/auto-audio`), "자동 음향 값 저장", "자동 음향"],
  // 영상 매트릭스
  ["*", new RegExp(`^${H}/matrix/presets/[^/]+/apply`), "영상 프리셋 적용", "영상"],
  ["DELETE", new RegExp(`^${H}/matrix/presets/`), "영상 프리셋 지우기", "영상"],
  ["*", new RegExp(`^${H}/matrix/presets`), "영상 프리셋 저장", "영상"],
  ["*", new RegExp(`^${H}/matrix/route-all`), "영상 전체 전환", "영상"],
  ["*", new RegExp(`^${H}/matrix/route`), "영상 라우팅", "영상"],
  ["*", new RegExp(`^${H}/matrix/config`), "영상 이름 저장", "영상"],
  ["*", new RegExp(`^${H}/matrix/connection/test`), "영상 연결 시험", "영상"],
  ["*", new RegExp(`^${H}/matrix/connection`), "영상 연결 설정", "영상"],
  ["*", new RegExp(`^${H}/matrix/test/`), "영상 시험", "영상"],
  ["*", new RegExp(`^${H}/matrix`), "영상 매트릭스 조작", "영상"],
  // 조명·음악 조명
  ["*", new RegExp(`^${H}/lighting/blackout`), "조명 암전", "조명"],
  ["*", new RegExp(`^${H}/lighting/master`), "조명 전체 밝기", "조명"],
  ["*", new RegExp(`^${H}/lighting/set`), "조명 조절", "조명"],
  ["*", new RegExp(`^${H}/lighting/scenes/[^/]+/recall`), "조명 장면 불러오기", "조명"],
  ["*", new RegExp(`^${H}/lighting/scenes/order`), "조명 장면 순서", "조명"],
  ["DELETE", new RegExp(`^${H}/lighting/scenes/`), "조명 장면 지우기", "조명"],
  ["PUT", new RegExp(`^${H}/lighting/scenes/`), "조명 장면 고치기", "조명"],
  ["*", new RegExp(`^${H}/lighting/scenes`), "조명 장면 저장", "조명"],
  ["*", new RegExp(`^${H}/lighting/channel-test`), "조명 채널 시험", "조명"],
  ["*", new RegExp(`^${H}/lighting/capture`), "조명 콘솔 읽기", "조명"],
  ["*", new RegExp(`^${H}/lighting/connection`), "조명 연결 설정", "조명"],
  ["DELETE", new RegExp(`^${H}/lighting$`), "조명 설정 지우기", "조명"],
  ["*", new RegExp(`^${H}/lighting`), "조명 설정", "조명"],
  ["*", new RegExp(`^${H}/music-light/shows/[^/]+/start`), "음악 조명 틀기", "조명"],
  ["*", new RegExp(`^${H}/music-light/stop`), "음악 조명 멈춤", "조명"],
  ["*", new RegExp(`^${H}/music-light/live`), "음악 조명 박자 따라가기", "조명"],
  ["DELETE", new RegExp(`^${H}/music-light/shows/`), "음악 조명 쇼 지우기", "조명"],
  ["PUT", new RegExp(`^${H}/music-light/shows/`), "음악 조명 쇼 고치기", "조명"],
  ["*", new RegExp(`^${H}/music-light/shows`), "음악 조명 쇼 올리기", "조명"],
  ["*", new RegExp(`^${H}/music-light`), "음악 조명 설정", "조명"],
  // 녹음·녹화
  ["*", new RegExp(`^${H}/recording/start`), "녹음 시작", "녹음·녹화"],
  ["*", new RegExp(`^${H}/recording/stop`), "녹음 멈춤", "녹음·녹화"],
  ["*", new RegExp(`^${H}/recording/sends`), "녹음 채널 설정", "녹음·녹화"],
  ["*", new RegExp(`^${H}/recording`), "녹음 설정", "녹음·녹화"],
  ["*", /^\/api\/av\/start/, "녹화 시작", "녹음·녹화"],
  ["*", /^\/api\/av\/stop/, "녹화 멈춤", "녹음·녹화"],
  ["*", /^\/api\/av\/channels/, "녹화 채널 설정", "녹음·녹화"],
  ["*", /^\/api\/av\/items\/[^/]+\/retry/, "녹화 다시 만들기", "녹음·녹화"],
  ["DELETE", /^\/api\/av\/items\//, "녹화 지우기", "녹음·녹화"],
  ["*", /^\/api\/av\/items\//, "녹화 이름 바꾸기", "녹음·녹화"],
  ["DELETE", /^\/api\/recordings\/merge\//, "합치기 취소", "녹음·녹화"],
  ["*", /^\/api\/recordings\/merge/, "녹음 합치기", "녹음·녹화"],
  ["DELETE", /^\/api\/recordings\/videos\//, "영상 파일 지우기", "녹음·녹화"],
  ["*", /^\/api\/recordings\/videos/, "영상 파일 올리기", "녹음·녹화"],
  ["*", /^\/api\/recordings\/[^/]+\/import/, "녹음 가져오기", "녹음·녹화"],
  ["DELETE", /^\/api\/recordings\//, "녹음 지우기", "녹음·녹화"],
  ["*", /^\/api\/recordings/, "녹음 이름 바꾸기", "녹음·녹화"],
  // 강당 장비·기기
  ["*", /^\/api\/halls\/discover/, "장비 찾기", "기기"],
  ["*", /^\/api\/halls\/bridge/, "강당 노트북 설정", "기기"],
  ["*", /^\/api\/devices/, "기기 권한 설정", "기기"],
  // 부원 (부원 기록이 없는 예전 서버·실패한 요청)
  ["*", /^\/api\/members\/register/, "등록 요청", "부원"],
  ["*", /^\/api\/members\/invite-code\/redeem/, "초대 코드 입력", "부원"],
  ["*", /^\/api\/members\/me\/devices\/invite/, "기기 추가 코드", "부원"],
  ["*", /^\/api\/members\/me\/devices\/attach/, "기기 연결", "부원"],
  ["DELETE", /^\/api\/members\/[^/]+\/devices\//, "기기 빼기", "부원"],
  ["DELETE", /^\/api\/members\/invites\//, "초대 취소", "부원"],
  ["*", /^\/api\/members\/invites/, "초대 만들기", "부원"],
  ["*", /^\/api\/members\/[^/]+\/approve/, "부원 승인", "부원"],
  ["*", /^\/api\/members\/[^/]+\/revoke/, "부원 내보내기", "부원"],
  ["*", /^\/api\/members\/[^/]+\/graduate/, "졸업 처리", "부원"],
  ["DELETE", /^\/api\/members\/[^/]+\/photo/, "카드 사진 지우기", "부원"],
  ["*", /^\/api\/members\/[^/]+\/photo/, "카드 사진 올리기", "부원"],
  ["*", /^\/api\/members\/[^/]+\/profile/, "소개 고치기", "부원"],
  ["*", /^\/api\/members\/(me\/discord-code|discord-link)/, "디스코드 연결", "부원"],
  ["DELETE", /^\/api\/members\/roster\//, "명단에서 지우기", "부원"],
  ["*", /^\/api\/members\/roster/, "명단에 추가", "부원"],
  ["*", /^\/api\/members\/settings/, "부원 설정", "부원"],
  ["*", /^\/api\/members\//, "부원 정보 고치기", "부원"],
  // 메일·Cloudflare
  ["*", /^\/api\/mail\/members\/[^/]+\/resend/, "확인 메일 다시 보내기", "메일·Cloudflare"],
  ["*", /^\/api\/mail\/members\/[^/]+\/dev-verify/, "메일 확인 처리", "메일·Cloudflare"],
  ["*", /^\/api\/mail\/settings\/sync/, "메일 규칙 맞추기", "메일·Cloudflare"],
  ["*", /^\/api\/mail/, "메일 설정", "메일·Cloudflare"],
  ["*", /^\/api\/cloudflare\/settings\/test/, "Cloudflare 연결 시험", "메일·Cloudflare"],
  ["*", /^\/api\/cloudflare\/settings/, "Cloudflare 연결 설정", "메일·Cloudflare"],
  ["*", /^\/api\/cloudflare\/mail\/destinations\/[^/]+\/resend/, "확인 메일 다시 보내기", "메일·Cloudflare"],
  ["*", /^\/api\/cloudflare\/mail\/sync/, "메일 규칙 맞추기", "메일·Cloudflare"],
  ["*", /^\/api\/cloudflare\/access\/emails/, "로그인 허용 이메일", "메일·Cloudflare"],
  ["*", /^\/api\/cloudflare\/access\/devices/, "기기 접속 키 지우기", "메일·Cloudflare"],
  ["*", /^\/api\/cloudflare\/mail/, "메일 주소 관리", "메일·Cloudflare"],
  ["*", /^\/api\/cloudflare/, "Cloudflare 관리", "메일·Cloudflare"],
  // CUE·말로 조작 (API 로 바로 부른 것)
  ["*", /^\/api\/chat\/settings\/test/, "CUE 연결 시험", "CUE"],
  ["*", /^\/api\/chat\/settings/, "CUE 설정", "CUE"],
  ["*", /^\/api\/chat\/actions\/[^/]+\/confirm/, "확인 카드 실행", "CUE"],
  ["*", /^\/api\/chat\/actions\/[^/]+\/cancel/, "확인 카드 취소", "CUE"],
  ["*", /^\/api\/chat\/uploads/, "CUE 에 첨부", "CUE"],
  ["*", /^\/api\/chat\/sessions\/[^/]+\/messages/, "CUE 에게 말하기", "CUE"],
  ["DELETE", /^\/api\/chat\/sessions\//, "CUE 대화 지우기", "CUE"],
  ["*", /^\/api\/chat\/sessions/, "CUE 대화 시작", "CUE"],
  ["*", /^\/api\/chat/, "CUE 대화", "CUE"],
  ["*", /^\/api\/assist\/aliases/, "말로 조작 별칭", "말로 조작"],
  ["*", /^\/api\/assist\/moderate/, "말로 조작 검토", "말로 조작"],
  ["*", /^\/api\/assist/, "말로 조작", "말로 조작"],
];

/** 부원 관리 기록(method MEMBER) — path 끝의 동작 이름 */
const MEMBER_ACTIONS: Record<string, string> = {
  register: "등록 요청",
  approve: "부원 승인",
  revoke: "부원 내보내기",
  graduate: "졸업 처리",
  role: "역할 바꾸기",
  edit: "부원 정보 고치기",
  mail: "ONAIR 메일 바꾸기",
  profile: "소개 고치기",
  photo: "카드 사진",
  invite: "초대 만들기",
  "invite-cancel": "초대 취소",
  "roster-add": "명단에 추가",
  "roster-delete": "명단에서 지우기",
  discord: "디스코드 연결",
  "device-add": "기기 추가",
  "device-invite": "기기 추가 코드",
  "device-remove": "기기 빼기",
  "mail-resend": "확인 메일 다시 보내기",
  "mail-dev-verify": "메일 확인 처리",
};

/** Cloudflare 관리 기록(method CLOUDFLARE) */
const CLOUDFLARE_ACTIONS: Record<string, string> = {
  "mail-address-add": "메일 주소 추가",
  "mail-address-delete": "메일 주소 지우기",
  "mail-resend": "확인 메일 다시 보내기",
  "mail-sync": "메일 규칙 맞추기",
  "access-email-add": "로그인 이메일 추가",
  "access-email-remove": "로그인 이메일 빼기",
  "device-key-delete": "기기 접속 키 지우기",
  settings: "Cloudflare 연결 설정",
};

/** CUE 가 API 를 부르지 않고 남긴 일 (확인·취소·만료·설정) */
const CHAT_EVENTS: Record<string, string> = {
  confirm: "확인 카드 실행",
  cancel: "확인 카드 취소",
  expired: "확인 카드 만료",
  settings: "CUE 설정",
};

/** 서버가 스스로 한 일(method AUTO) — /auto/<kind> 의 분류와 동작 이름이 없을 때 쓸 이름 */
const AUTO_KINDS: Record<string, [label: string, group: string]> = {
  bell: ["시보", "시보"],
  broadcast: ["예약 방송", "방송"],
  teacher: ["선생님 요청 방송", "요청"],
  display: ["예약 송출", "송출"],
  energy: ["야간 절전", "시보"],
  "auto-audio": ["자동 음향", "자동 음향"],
  server: ["서버", "서버"],
  speaker: ["스피커", "스피커"],
  recording: ["녹음·녹화", "녹음·녹화"],
  "live-chat": ["live 채팅 막기", "live 채팅"],
  "live-stream": ["live 중계", "live 중계"],
  mirror: ["실시간 미러", "실시간 미러"],
};

const isAuto = (l: LogEntry) => (l.method || "").toUpperCase() === "AUTO";

const lastSeg = (path: string) => path.split("/").filter(Boolean).pop() ?? "";

function byRules(method: string, path: string): { label: string; group: string } {
  const p = path.split("?")[0];
  for (const [m, re, label, group] of RULES) {
    if ((m === "*" || m === method) && re.test(p)) return { label, group };
  }
  return { label: "기타 조작", group: "기타" };
}

const opt = (v?: string) => (v && v.trim() ? v.trim() : undefined);

/** 선생님 바로 방송 기록 (WS /api/teacher/live · POST /api/teacher/now) */
const TEACHER_NOW = /^\/api\/teacher\/(live|now)(\/|$)/;

/** 서버가 남긴 동작 이름 '마이크 방송 시작 · 1-1, 1-2' → 이름과 나머지 */
function splitAction(action: string): { label: string; rest?: string } {
  const k = action.indexOf(" · ");
  return k > 0 ? { label: action.slice(0, k), rest: opt(action.slice(k + 3)) } : { label: action };
}

/** 기록 한 줄 → 사람이 읽을 동작 */
export function describe(l: LogEntry): Described {
  const method = (l.method || "").toUpperCase();
  const target = opt(l.target);
  const detail = opt(l.detail);
  if (method === "AUTO") {
    const kind = AUTO_KINDS[lastSeg(l.path.split("?")[0])];
    return { label: opt(l.action) ?? kind?.[0] ?? "자동 실행", group: kind?.[1] ?? "기타", extra: target, detail };
  }
  if (method === "MEMBER") {
    return { label: MEMBER_ACTIONS[lastSeg(l.path)] ?? "부원 관리", group: "부원", extra: target, detail };
  }
  if (method === "CLOUDFLARE") {
    return { label: CLOUDFLARE_ACTIONS[lastSeg(l.path)] ?? "Cloudflare 관리", group: "메일·Cloudflare", extra: target, detail };
  }
  if (method === "ASSIST") {
    return {
      label: lastSeg(l.path) === "execute" ? "말로 조작 실행" : "말로 조작 계획",
      group: "말로 조작",
      extra: target ?? opt(l.text),
      detail,
    };
  }
  if (method === "CHAT") {
    const kind = lastSeg(l.path);
    return { label: CHAT_EVENTS[kind] ?? "CUE", group: "CUE", extra: kind === "settings" ? target : opt(l.action) ?? target, detail };
  }
  const base = byRules(method, l.path);
  if (l.via === "chat") {
    // CUE 도구가 부른 요청 — 사람은 CUE, 동작은 경로로, 카드 제목은 옆에
    return { ...base, extra: target ?? opt(l.action), detail };
  }
  if (l.action && TEACHER_NOW.test(l.path.split("?")[0])) {
    // '방송 · 마이크' 는 이름 그대로 (뒤가 대상이 아니라 마이크·글). 예전 기록의 '바로 방송 · …' 도 '방송 · …' 으로
    return { label: l.action.replace(/^바로 방송 · /, "방송 · "), group: base.group, extra: target, detail };
  }
  if (l.action) {
    const a = splitAction(l.action);
    return { label: a.label, group: base.group, extra: target ?? a.rest, detail };
  }
  return { ...base, extra: target, detail };
}

/** 화면에서 아예 숨기는 기록 — 외부 화면 미리보기 사진 (지금 서버는 안 남기지만 예전 기록에 있다) */
export function isHidden(l: LogEntry): boolean {
  return /^\/api\/share\/me\/snapshot/.test(l.path.split("?")[0]);
}

/** 아바타 모양 — 사람이면 이름 두 글자, 나머지는 테두리만 있는 아이콘형 */
export type PersonKind = "member" | "teacher" | "pc" | "share" | "cue" | "device" | "ip" | "auto";

export interface Person {
  key: string;
  name: string;
  /** 이름 옆 작은 글씨 — 기수·역할 */
  sub: string;
  kind: PersonKind;
}

const ROLE_LABEL: Record<string, string> = {
  superadmin: "최고 관리자",
  lead: "부장",
  member: "부원",
  alumni: "졸업",
  teacher: "선생님",
  guest: "미등록",
  admin: "부장",
  operator: "부원",
  viewer: "보기",
};

export const roleLabel = (role?: string) => (role ? ROLE_LABEL[role] ?? "" : "");

const LOCAL = new Set(["127.0.0.1", "::1", "localhost"]);

const joinSub = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ");

/** 아바타 글자 — '서정현' → '정현', 두 글자 이름은 그대로, 메일은 앞 두 글자 */
export function initials(name: string): string {
  const n = name.includes("@") ? name.split("@")[0] : name;
  if (/^[가-힣]{3,4}$/.test(n)) return n.slice(-2);
  return n.slice(0, 2).toUpperCase();
}

/** 사람(부원·기기) 쪽만 — CUE·외부 화면은 personOf 가 가른다 */
function actorOf(l: LogEntry): Person {
  const ip = l.ip && l.ip !== "unknown" ? l.ip : "";
  const role = roleLabel(l.role);
  if (l.member) {
    return { key: `m:${l.memberId || l.member}`, name: l.member, sub: joinSub(l.owner, role), kind: l.role === "teacher" ? "teacher" : "member" };
  }
  if (l.method === "ASSIST" && l.owner) {
    // 디스코드에서 부른 사람 — "이름 (디스코드 아이디)" 에서 이름만
    const name = l.owner.replace(/\s*\([^)]*\)\s*$/, "") || l.owner;
    return { key: `d:${name}`, name, sub: "디스코드", kind: "member" };
  }
  const device = l.device && l.device !== ip ? l.device : "";
  if (device) {
    // 기수가 붙어 있거나 메일 계정·선생님이면 사람, 아니면 기기
    if (l.role === "teacher") return { key: `d:${device}`, name: device, sub: "선생님", kind: "teacher" };
    // live 채팅 — 이름 옆에 학교 메일
    if ((l.owner ?? "").includes("@")) return { key: `e:${l.owner}`, name: device, sub: l.owner ?? "", kind: "member" };
    if (/^\d+기$/.test(l.owner ?? "") || device.includes("@")) {
      return { key: `d:${device}`, name: device, sub: joinSub(l.owner, role), kind: "member" };
    }
    return { key: `d:${device}`, name: device, sub: "기기", kind: "device" };
  }
  if (ip && LOCAL.has(ip)) return { key: "pc", name: "방송실 PC", sub: "", kind: "pc" };
  if (ip) return { key: `ip:${ip}`, name: ip, sub: "", kind: "ip" };
  return { key: "unknown", name: "알 수 없음", sub: "", kind: "ip" };
}

/** 서버가 스스로 한 일 — 사람 수에는 넣지 않는다 */
export const AUTO_PERSON: Person = { key: "auto", name: "자동", sub: "", kind: "auto" };

/** 기록 한 줄 → 누가. CUE 가 부른 요청은 CUE, 외부 화면이 보낸 요청은 외부 화면 */
export function personOf(l: LogEntry): Person {
  if (isAuto(l)) return AUTO_PERSON;
  const p = l.path.split("?")[0];
  if (l.via === "chat" && (l.method || "").toUpperCase() !== "CHAT") {
    const who = actorOf(l);
    return { key: "cue", name: "CUE", sub: who.kind === "pc" || who.kind === "ip" ? "" : `${who.name} 요청`, kind: "cue" };
  }
  if (!l.member && /^\/api\/share\/(join|me\/)/.test(p)) return { key: "share", name: "외부 화면", sub: "", kind: "share" };
  return actorOf(l);
}

/** 실패 결과 한 단어. 서버가 스스로 한 일(AUTO)은 409 면 건너뜀, 나머지는 실패 */
export function failWord(status: number, method?: string): string {
  if ((method || "").toUpperCase() === "AUTO") return status === 409 ? "건너뜀" : "실패";
  if (status === 401 || status === 403) return "권한 없음";
  if (status === 404) return "없음";
  if (status === 409) return "막힘";
  if (status === 410) return "만료";
  if (status === 413) return "너무 큼";
  if (status === 429) return "너무 잦음";
  if (status >= 500) return "서버 오류";
  return "실패";
}

const toMs = (ts: string) => {
  const t = Date.parse(ts);
  return Number.isNaN(t) ? 0 : t;
};

/* 부원·Cloudflare 관리·말로 조작은 서버가 두 줄을 남긴다 (요청 한 줄 + 사람이 읽을 기록 한 줄).
   읽을 기록이 있으면 같은 IP 에서 2초 안에 온 요청 줄은 숨긴다. */
const AUDIT_PATHS: Record<string, RegExp> = {
  MEMBER: /^\/api\/(members|mail)\//,
  CLOUDFLARE: /^\/api\/(cloudflare|mail)\//,
  ASSIST: /^\/api\/assist\//,
};

export function dropDuplicates(logs: LogEntry[]): LogEntry[] {
  const audits = logs.filter((l) => AUDIT_PATHS[l.method]);
  if (audits.length === 0) return logs;
  return logs.filter((l) => {
    if (AUDIT_PATHS[l.method] || l.status >= 400) return true;
    const t = toMs(l.ts);
    return !audits.some(
      (a) => AUDIT_PATHS[a.method].test(l.path) && (a.ip || "") === (l.ip || "") && Math.abs(toMs(a.ts) - t) <= 2000,
    );
  });
}

export interface LogRow {
  /** 가장 늦은 기록 */
  entry: LogEntry;
  /** 한 줄로 묶인 기록 전부 (최신순) */
  items: LogEntry[];
  person: Person;
  what: Described;
  failed: boolean;
  /** 같은 사람이 같은 일을 잇달아 한 수 (페이더 끌기 등) */
  count: number;
  /** 'YYYY-MM-DD' */
  day: string;
  /** 한 줄로 묶인 것 중 가장 이른 시각 */
  firstTs: string;
}

/** 최신순 기록 → 화면 줄. 같은 사람·같은 동작·같은 대상·같은 결과가 1분 안에 잇달아 오면 한 줄로 */
export function toRows(logs: LogEntry[]): LogRow[] {
  const rows: LogRow[] = [];
  for (const entry of dropDuplicates(logs.filter((l) => !isHidden(l)))) {
    const person = personOf(entry);
    const what = describe(entry);
    const failed = entry.status >= 400;
    const prev = rows[rows.length - 1];
    if (
      prev &&
      prev.person.key === person.key &&
      prev.what.label === what.label &&
      prev.what.extra === what.extra &&
      prev.failed === failed &&
      prev.day === entry.ts.slice(0, 10) &&
      Math.abs(toMs(prev.firstTs) - toMs(entry.ts)) <= 60_000
    ) {
      prev.count += 1;
      prev.firstTs = entry.ts;
      prev.items.push(entry);
      continue;
    }
    rows.push({ entry, items: [entry], person, what, failed, count: 1, day: entry.ts.slice(0, 10), firstTs: entry.ts });
  }
  return rows;
}
