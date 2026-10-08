import { getApiBase } from "@/lib/apiBase";
import { backendBase } from "@/lib/backend";
import { failure, post, put, request, seg } from "@/lib/http";
import type {
  ChatAction,
  ChatSessionDetail,
  ChatSessionSummary,
  ChatSettings,
  ChatSettingsUpdate,
  ChatStatus,
  ChatStreamEvent,
  ChatTestResult,
  ChatUpload,
  SendMessageBody,
} from "@/types/chat";

const STREAM_TYPES = new Set(["user", "text", "tool", "action", "link", "error", "done"]);

/** SSE 이벤트 한 덩어리("event: …\ndata: …") → 이벤트. 모르는 이벤트·깨진 JSON 은 버린다 */
function parseBlock(block: string): ChatStreamEvent | null {
  let type = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue; // 빈 줄·주석(keep-alive)
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") type = value.trim();
    else if (field === "data") data.push(value);
  }
  if (!data.length || !STREAM_TYPES.has(type)) return null;
  try {
    const payload = JSON.parse(data.join("\n")) as Record<string, unknown>;
    return { ...payload, type } as ChatStreamEvent;
  } catch {
    return null;
  }
}

/**
 * 메시지 보내기 — 답은 text/event-stream 으로 조금씩 온다.
 * 프록시가 모아서 한 번에 보내도(버퍼링) 같은 방식으로 이벤트를 하나씩 넘긴다.
 * signal 로 멈추면 AbortError 를 던진다.
 */
async function sendMessage(
  sessionId: string,
  body: SendMessageBody,
  onEvent: (e: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${getApiBase()}/chat/sessions/${seg(sessionId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await failure(res);

  let buf = "";
  const drain = (final: boolean) => {
    // \r\n 이 조각 사이에서 갈려도 버퍼 전체를 다시 바꾸니 괜찮다
    buf = buf.replace(/\r\n/g, "\n");
    let at: number;
    while ((at = buf.indexOf("\n\n")) >= 0) {
      const ev = parseBlock(buf.slice(0, at));
      buf = buf.slice(at + 2);
      if (ev) onEvent(ev);
    }
    if (final && buf.trim()) {
      const ev = parseBlock(buf);
      buf = "";
      if (ev) onEvent(ev);
    }
  };

  if (!res.body) {
    buf = await res.text();
    drain(true);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      drain(false);
    }
    buf += decoder.decode();
    drain(true);
  } finally {
    reader.releaseLock();
  }
}

/** 첨부 올리기 — 진행률을 보려고 XHR 을 쓴다 */
function uploadFile(file: File, onProgress?: (ratio: number) => void, signal?: AbortSignal): Promise<ChatUpload> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getApiBase()}/chat/uploads`);
    xhr.responseType = "text";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* 본문 없음 */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) {
        resolve(body as ChatUpload);
        return;
      }
      const detail = (body as { detail?: unknown } | null)?.detail;
      reject(
        new Error(
          typeof detail === "string"
            ? detail
            : xhr.status === 413
              ? "파일이 너무 커요"
              : xhr.status === 403
                ? "이 작업을 수행할 권한이 없습니다."
                : "파일을 올리지 못했어요.",
        ),
      );
    };
    xhr.onerror = () => reject(new Error("서버에 연결하지 못했어요."));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** 본문이 없을 수도 있는 DELETE */
async function remove(path: string): Promise<void> {
  const res = await fetch(`${getApiBase()}${path}`, { method: "DELETE" });
  if (!res.ok) throw await failure(res);
}

/** 서버가 준 첨부 주소(/api/…) → 지금 접속 방식(같은 주소·데스크탑 프록시·:8000)에 맞는 절대 주소 */
export function chatAssetUrl(url: string | undefined | null): string {
  if (!url) return "";
  if (/^(https?:|blob:|data:)/.test(url)) return url;
  if (url.startsWith("/api/")) return `${backendBase()}${url}`;
  return `${getApiBase()}${url.startsWith("/") ? "" : "/"}${url}`;
}

export const chatApi = {
  /** 켜졌는지·사용량 (누구나) */
  status: () => request<ChatStatus>("/chat/status"),

  /** 최고 관리자 */
  settings: () => request<ChatSettings>("/chat/settings"),
  saveSettings: (body: ChatSettingsUpdate) => put<ChatSettings>("/chat/settings", body),
  testSettings: () => post<ChatTestResult>("/chat/settings/test"),

  sessions: async () => {
    const r = await request<ChatSessionSummary[] | { sessions: ChatSessionSummary[] }>("/chat/sessions");
    return Array.isArray(r) ? r : (r.sessions ?? []);
  },
  createSession: () => post<ChatSessionSummary>("/chat/sessions"),
  session: (id: string) => request<ChatSessionDetail>(`/chat/sessions/${seg(id)}`),
  deleteSession: (id: string) => remove(`/chat/sessions/${seg(id)}`),

  sendMessage,
  uploadFile,

  /** rows — 표를 고쳤으면 고친 행 전체 */
  confirmAction: (id: string, rows?: Record<string, unknown>[]) =>
    post<ChatAction>(`/chat/actions/${seg(id)}/confirm`, rows ? { rows } : {}),
  cancelAction: (id: string) => post<ChatAction>(`/chat/actions/${seg(id)}/cancel`),
};
