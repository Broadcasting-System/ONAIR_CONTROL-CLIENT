/** CUE(채팅) — 서버 /api/chat 계약 */

export type UploadKind = "image" | "pdf" | "video" | "audio" | "other";

/** POST /chat/uploads 결과 */
export interface ChatUpload {
  uploadId: string;
  kind: UploadKind;
  name: string;
  size: number;
  /** /api/chat/uploads/<id>/file */
  url: string;
  thumbUrl?: string;
  meta?: { durationSec?: number; width?: number; height?: number };
}

export type ToolStatus = "running" | "done" | "error";

export interface ChatTool {
  id: string;
  name: string;
  /** "시보 목록 보는 중" */
  label: string;
  status: ToolStatus;
  summary?: string;
}

export interface ChatLink {
  label: string;
  href: string;
}

export interface TablePreview {
  kind: "table";
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  editable?: boolean;
}

export type ActionPreview =
  | TablePreview
  | { kind: "list"; items: string[] }
  | { kind: "kv"; items: [string, string][] };

export type ActionStatus = "pending" | "running" | "done" | "error" | "cancelled" | "expired";

/** 바꾸는 도구의 확인 카드 */
export interface ChatAction {
  id: string;
  tool: string;
  /** "시보 12개 등록" */
  title: string;
  summary?: string;
  /** danger = 지우기·전체 바꾸기·관리자 설정 → 빨간 확인 */
  risk: "change" | "danger";
  preview?: ActionPreview;
  status: ActionStatus;
  /** 실행 결과 한 줄 */
  result?: string;
  /** 만든 뒤 10분 */
  expiresAt: string;
}

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  uploads?: ChatUpload[];
  tools?: ChatTool[];
  actions?: ChatAction[];
  links?: ChatLink[];
  tours?: ChatTour[];
}

/** CUE 화면 튜토리얼 한 단계 — target 은 화면 요소의 data-tour 이름표(없으면 설명만 가운데) */
export interface TourStep {
  href: string;
  target?: string;
  title: string;
  text: string;
}

export interface ChatTour {
  title: string;
  steps: TourStep[];
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ChatSessionDetail {
  id: string;
  title: string;
  messages: DisplayMessage[];
}

export interface ChatUsage {
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

/** GET /chat/status — 누구나 */
export interface ChatStatus {
  enabled: boolean;
  /** no_key · disabled · … */
  reason?: string | null;
  driver: string;
  model: string;
  keySet: boolean;
  keyHint: string | null;
  usage: { today: ChatUsage };
  limits: { daily: number; perUser: number };
  /** 최고 관리자 — 설정을 볼 수 있다 */
  canConfigure: boolean;
}

/** GET·PUT /chat/settings — 최고 관리자 */
export interface ChatSettings {
  keySet: boolean;
  keyHint: string | null;
  model: string;
  /** 서버는 {id,label} 로 준다 (예전 계약은 id 문자열) */
  models: (string | { id: string; label?: string })[];
  enabled: boolean;
  dailyRequestLimit: number;
  userDailyLimit: number;
}

export interface ChatSettingsUpdate {
  /** null = 키 지우기. 값은 절대 응답으로 돌아오지 않는다 */
  apiKey?: string | null;
  model?: string;
  enabled?: boolean;
  dailyRequestLimit?: number;
  userDailyLimit?: number;
}

export interface ChatTestResult {
  ok: boolean;
  model: string;
  message: string;
}

/** POST /chat/sessions/{id}/messages 본문 */
export interface SendMessageBody {
  text: string;
  uploadIds?: string[];
  /** 지금 보고 있는 컨트롤 경로 */
  page?: string;
}

/** SSE 이벤트 (event: <type>) */
export type ChatStreamEvent =
  | { type: "user"; message: DisplayMessage }
  | { type: "text"; delta: string }
  | ({ type: "tool" } & ChatTool)
  | { type: "action"; action: ChatAction }
  | ({ type: "link" } & ChatLink)
  | ({ type: "tour" } & ChatTour)
  | { type: "error"; message: string }
  | { type: "done"; message: DisplayMessage; usage?: { inputTokens: number; outputTokens: number } };
