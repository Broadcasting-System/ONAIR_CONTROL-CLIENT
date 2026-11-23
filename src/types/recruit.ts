/** 방송부 모집 — 서버 app/services/recruit_service.py 가 주는 모양 (계약: _자료/모집-API-계약.md) */

export type QuestionKind = "text" | "choice";

export interface RecruitQuestion {
  id: string;
  kind: QuestionKind;
  title: string;
  required: boolean;
  /** 객관식 옵션 (주관식이면 []) */
  options: string[];
  /** 객관식 '기타' 칸 */
  allowOther: boolean;
  /** 주관식 글자 수 */
  maxLength: number;
}

export interface RecruitFaq {
  q: string;
  a: string;
}

export interface InterviewSettings {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  start: string;
  place: string;
  /** 한 사람 몇 분 */
  minutes: number;
  /** 몇 명마다 쉬기 (0 이면 안 쉼) — 부장에게만 */
  breakEvery?: number;
  /** 쉬는 시간 몇 분 — 부장에게만 */
  breakMinutes?: number;
  /** 준비할 것 — 부장에게만 */
  prep?: string;
}

export interface RecruitRules {
  schoolOnly: boolean;
  oncePerPerson: boolean;
}

/** draft 초안 · upcoming 열었지만 시작 전 · open 받는 중 · closed 마감 · announced 발표함 */
export type RecruitPhase = "draft" | "upcoming" | "open" | "closed" | "announced";

/** 지난 기수 경쟁률 */
export interface RecruitHistory {
  cohort: number;
  quota: number | null;
  applied: number;
  ratio?: number | null;
}

/** 공개 공고 (로그인 없어도) */
export interface RecruitPublicInfo {
  id: string;
  cohort: number;
  title: string;
  body: string;
  quota: number | null;
  /** ISO */
  applyStart: string | null;
  applyEnd: string | null;
  interview: InterviewSettings;
  announceAt: string | null;
  /** 공고에 적는 발표 예정일 (안내용) */
  announcePlanned: string | null;
  confirmBy: string | null;
  questions: RecruitQuestion[];
  faq: RecruitFaq[];
  rules: RecruitRules;
  /** 개인정보 동의 문구 (안 고쳤으면 기본 문구) */
  consent: string;
  phase: RecruitPhase;
  accepting: boolean;
  applied: number;
  ratio: number | null;
  history?: RecruitHistory[];
}

export interface RecruitCounts {
  applied: number;
  cancelled: number;
  results: { pass: number; fail: number; reserve: number; undecided: number };
  confirm: { accepted: number; declined: number; pending: number; expired: number };
}

/** 숫자 문장 한 줄 — '올해 종이' 3,214 '번 울렸고' 처럼 label + value + unit */
export interface RecruitStat {
  /** bells 울린 종 · broadcasts 방송 · recordings 녹음·녹화 · events 행사 지원 */
  key: string;
  label: string;
  value: number;
  unit: string;
  /** 이 숫자를 센 첫 날 (학년 시작보다 뒤일 수 있다) */
  from?: string;
}

/** 올해 숫자 — 학년 시작(since)부터 실제 기록만. 못 만들면 null */
export interface RecruitStats {
  since: string;
  items: RecruitStat[];
}

/** 부장이 보는 모집 (GET /recruit, PUT /recruit/{rid}) */
export interface Recruit extends RecruitPublicInfo {
  status: "draft" | "open" | "closed";
  consentCustom: boolean;
  pastHistory: RecruitHistory[];
  createdAt: string | null;
  createdBy: string;
  updatedAt: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  counts: RecruitCounts;
}

/** GET /recruit/current — 공고 + 로그인한 학교 계정 */
export interface RecruitPublic {
  recruit: RecruitPublicInfo | null;
  history: RecruitHistory[];
  stats?: RecruitStats | null;
  email?: string | null;
}

export type RecruitResult = "pass" | "fail" | "reserve";
/** 입부 확정 — accepted 확정 · declined 거절 · pending 아직 · expired 기한 지남 */
export type ConfirmState = "pending" | "accepted" | "declined" | "expired";

/** 지원자 한 사람 (부원에게는 이름·학번·반·면접 시각만) */
export interface RecruitApplication {
  id: string;
  name: string;
  studentId: string;
  grade: number | null;
  class: number | null;
  number: number | null;
  status: "active" | "cancelled";
  /** 면접 자리 (0부터) */
  slot: number | null;
  /** 면접 순서 (1부터) */
  no: number | null;
  interviewAt: string | null;
  // 부장에게만
  phone?: string;
  answers?: Record<string, string>;
  consentAt?: string | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  result?: RecruitResult | null;
  reserveRank?: number | null;
  promoted?: boolean;
  confirm?: ConfirmState | null;
  confirmAt?: string | null;
  confirmBy?: string | null;
  // 면접 기록을 볼 수 있는 부원에게만 (평균은 내가 점수를 줬을 때만)
  myScore?: number | null;
  scoreCount?: number;
  average?: number | null;
}

/** 큐시트 쉬는 시간 — beforeNo 번 앞에 */
export interface InterviewBreak {
  beforeNo: number;
  at: string;
  minutes: number;
}

/** GET /recruit/{rid}/applications */
export interface ApplicationList {
  recruit: Recruit | RecruitPublicInfo;
  total: number;
  applications: RecruitApplication[];
  groups: { grade: number | null; class: number | null; count: number; ids: string[] }[];
  breaks: InterviewBreak[];
  canManage: boolean;
  canRecord: boolean;
  /** "10기 면접 기록은 9기까지만 볼 수 있어요" */
  recordRule: string;
  cancelled?: RecruitApplication[];
}

/** GET /recruit/{rid}/applications/{aid} (부장) */
export interface ApplicationDetail extends RecruitApplication {
  questions: RecruitQuestion[];
  interview: { at: string | null; place: string };
}

/** GET /recruit/me */
export interface MyApplication {
  recruit: RecruitPublicInfo | null;
  email?: string | null;
  application: {
    id: string;
    name: string;
    studentId: string;
    phone: string;
    answers: Record<string, string>;
    status: "active" | "cancelled";
    submittedAt: string | null;
    updatedAt: string | null;
    cancelledBy: string | null;
  } | null;
  /** 마감 전에는 고칠 수 있다 */
  canEdit?: boolean;
  /** 마감 뒤 자리가 정해지면 */
  interview: {
    at: string | null;
    no: number;
    place: string;
    minutes: number | null;
    prep: string;
  } | null;
  /** 발표 전이면 null. 지원자에게 예비는 없다 — 추가 합격 전까지 fail, 올라가면 pass */
  result: RecruitResult | null;
  /** 추가 합격으로 합격 */
  extra?: boolean;
  /** by = 이 사람의 확정 기한 (추가 합격자는 자기 기한) */
  confirm?: { status: ConfirmState; by: string | null; at: string | null } | null;
  memberId?: string | null;
}

export interface RecordAuthor {
  id?: string;
  name: string;
  cohort: number | null;
}

/** GET/PUT .../record */
export interface InterviewRecord {
  applicationId?: string;
  name?: string;
  studentId?: string;
  text: string;
  version: number;
  updatedBy: RecordAuthor | null;
  updatedAt: string | null;
  editors: RecordAuthor[];
  myScore: number | null;
  scoreCount: number;
  /** 내가 점수를 줬을 때만 */
  average: number | null;
}

/** GET .../confirmations (부장) — 합격자 줄의 status 는 입부 확정 상태 */
export type ConfirmationRow = Omit<RecruitApplication, "status"> & {
  status: ConfirmState;
  at: string | null;
  confirmBy: string | null;
  promoted: boolean;
};

export interface ConfirmationList {
  quota: number | null;
  confirmBy: string | null;
  announceAt: string | null;
  announced: boolean;
  counts: { accepted: number; pending: number; declined: number; expired: number };
  total: number;
  /** 빈자리 = 모집 인원 − (확정 + 아직) */
  vacancies: number;
  applications: ConfirmationRow[];
  reserves: (RecruitApplication & { reserveRank: number | null })[];
  declined: ConfirmationRow[];
}
