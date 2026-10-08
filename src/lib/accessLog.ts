/* 접근 로그 (GET /api/logs) — 서버 기록 한 줄을 '누가 · 무엇을' 로 읽는다.
   서버는 바꾸는 요청마다 method·path·status 를 남기고(main.py 미들웨어),
   부원·Cloudflare 관리(MEMBER·CLOUDFLARE)·디스코드 말로 조작(ASSIST)·CUE(via chat) 는 따로 남긴다. */

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
  /** MEMBER·CLOUDFLARE 기록의 대상 이름 */
  target?: string;
  detail?: string;
  /** ASSIST 기록 */
  text?: string;
}

export interface Described {
  label: string;
  group: string;
  /** 덧붙일 짧은 값 (대상 이름·CUE 카드 제목) */
  extra?: string;
}

type Rule = [method: string, pattern: RegExp, label: string, group: string];

const H = "/api/halls/[^/]+";

/** 위에서부터 처음 맞는 규칙. method "*" 는 아무거나 */
const RULES: Rule[] = [
  // 송출·현수막·방송
  ["*", /^\/api\/display\/clear/, "송출 끄기", "송출"],
  ["*", /^\/api\/display\/timer/, "타이머 송출", "송출"],
  ["*", /^\/api\/display\/show/, "미디어 송출", "송출"],
  ["*", /^\/api\/display\/youtube/, "유튜브 송출", "송출"],
  ["*", /^\/api\/display\/screen/, "화면 공유", "송출"],
  ["*", /^\/api\/display\/player/, "재생 조작", "송출"],
  ["*", /^\/api\/display\/slide/, "슬라이드 넘기기", "송출"],
  ["*", /^\/api\/display\/overlay/, "자막 송출", "송출"],
  ["*", /^\/api\/display/, "송출 조작", "송출"],
  ["*", /^\/api\/banner\/clear/, "현수막 끄기", "현수막"],
  ["*", /^\/api\/banner/, "현수막 바꾸기", "현수막"],
  ["*", /^\/api\/broadcast\/execute/, "방송 내보내기", "방송"],
  ["*", /^\/api\/broadcast\/preview/, "방송 미리 듣기", "방송"],
  ["DELETE", /^\/api\/broadcast\/schedule\//, "방송 예약 취소", "방송"],
  ["*", /^\/api\/broadcast/, "방송 예약", "방송"],
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
  ["*", /^\/api\/time/, "시보 저장", "시보"],
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
  ["*", /^\/api\/mail/, "메일 설정", "메일·Cloudflare"],
  ["*", /^\/api\/cloudflare\/settings/, "Cloudflare 연결 설정", "메일·Cloudflare"],
  ["*", /^\/api\/cloudflare\/access\/emails/, "로그인 허용 이메일", "메일·Cloudflare"],
  ["*", /^\/api\/cloudflare\/access\/devices/, "기기 접속 키 지우기", "메일·Cloudflare"],
  ["*", /^\/api\/cloudflare\/mail/, "메일 주소 관리", "메일·Cloudflare"],
  ["*", /^\/api\/cloudflare/, "Cloudflare 관리", "메일·Cloudflare"],
  // CUE·말로 조작 (API 로 바로 부른 것)
  ["*", /^\/api\/chat\/settings/, "CUE 설정", "CUE"],
  ["*", /^\/api\/chat\/actions\/[^/]+\/confirm/, "CUE · 확인 카드 실행", "CUE"],
  ["*", /^\/api\/chat\/actions\/[^/]+\/cancel/, "CUE · 확인 카드 취소", "CUE"],
  ["*", /^\/api\/chat\/uploads/, "CUE · 첨부", "CUE"],
  ["*", /^\/api\/chat/, "CUE · 대화", "CUE"],
  ["*", /^\/api\/assist\/aliases/, "말로 조작 별칭", "말로 조작"],
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
  confirm: "CUE · 확인 카드 실행",
  cancel: "CUE · 확인 카드 취소",
  expired: "CUE · 확인 카드 만료",
  settings: "CUE 설정",
};

const lastSeg = (path: string) => path.split("/").filter(Boolean).pop() ?? "";

function byRules(method: string, path: string): { label: string; group: string } {
  const p = path.split("?")[0];
  for (const [m, re, label, group] of RULES) {
    if ((m === "*" || m === method) && re.test(p)) return { label, group };
  }
  return { label: "기타 조작", group: "기타" };
}

/** 기록 한 줄 → 사람이 읽을 동작 */
export function describe(l: LogEntry): Described {
  const method = (l.method || "").toUpperCase();
  if (method === "MEMBER") {
    return { label: MEMBER_ACTIONS[lastSeg(l.path)] ?? "부원 관리", group: "부원", extra: l.target || undefined };
  }
  if (method === "CLOUDFLARE") {
    return {
      label: CLOUDFLARE_ACTIONS[lastSeg(l.path)] ?? "Cloudflare 관리",
      group: "메일·Cloudflare",
      extra: l.target || undefined,
    };
  }
  if (method === "ASSIST") {
    return { label: lastSeg(l.path) === "execute" ? "말로 조작 · 실행" : "말로 조작 · 계획", group: "말로 조작" };
  }
  if (method === "CHAT") {
    const kind = lastSeg(l.path);
    return { label: CHAT_EVENTS[kind] ?? "CUE", group: "CUE", extra: kind === "settings" ? undefined : l.action || undefined };
  }
  const base = byRules(method, l.path);
  if (l.via === "chat") {
    // CUE 도구가 부른 요청 — 동작은 경로로, 카드 제목은 옆에
    return { label: `CUE · ${base.label}`, group: "CUE", extra: l.action || undefined };
  }
  return { label: l.action || base.label, group: base.group };
}

export interface Person {
  key: string;
  name: string;
  /** 이름 옆 작은 글씨 — 기수·IP */
  sub: string;
}

const ROLE_LABEL: Record<string, string> = {
  superadmin: "최고 관리자",
  lead: "부장",
  member: "부원",
  alumni: "졸업",
  teacher: "교사",
  guest: "미등록",
  admin: "부장",
  operator: "부원",
  viewer: "보기",
};

export const roleLabel = (role?: string) => (role ? ROLE_LABEL[role] ?? "" : "");

const LOCAL = new Set(["127.0.0.1", "::1", "localhost"]);

/** 기록 한 줄 → 누가. 부원 이름이 있으면 그 이름, 없으면 기기 이름·IP */
export function personOf(l: LogEntry): Person {
  const ip = l.ip && l.ip !== "unknown" ? l.ip : "";
  if (l.member) {
    return { key: `m:${l.memberId || l.member}`, name: l.member, sub: l.owner || roleLabel(l.role) };
  }
  if (l.method === "ASSIST" && l.owner) {
    // 디스코드에서 부른 사람 — "이름 (디스코드 아이디)" 에서 이름만
    const name = l.owner.replace(/\s*\([^)]*\)\s*$/, "") || l.owner;
    return { key: `d:${name}`, name, sub: "디스코드" };
  }
  const device = l.device && l.device !== ip ? l.device : "";
  if (device) return { key: `d:${device}`, name: device, sub: ip };
  if (ip && LOCAL.has(ip)) return { key: "server", name: "서버", sub: "" };
  if (ip) return { key: `ip:${ip}`, name: ip, sub: "" };
  return { key: "unknown", name: "알 수 없음", sub: "" };
}

/** 실패 결과 한 단어 */
export function failWord(status: number): string {
  if (status === 401 || status === 403) return "권한 없음";
  if (status === 404) return "없음";
  if (status === 409) return "막힘";
  if (status === 410) return "만료";
  if (status === 413) return "너무 큼";
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
  entry: LogEntry;
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

/** 최신순 기록 → 화면 줄. 같은 사람·같은 동작·같은 결과가 1분 안에 잇달아 오면 한 줄로 */
export function toRows(logs: LogEntry[]): LogRow[] {
  const rows: LogRow[] = [];
  for (const entry of dropDuplicates(logs)) {
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
      continue;
    }
    rows.push({ entry, person, what, failed, count: 1, day: entry.ts.slice(0, 10), firstTs: entry.ts });
  }
  return rows;
}
