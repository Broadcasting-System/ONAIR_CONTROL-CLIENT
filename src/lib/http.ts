import { getApiBase } from "@/lib/apiBase";

/** 서버가 실패로 답한 요청 — 화면에 보일 detail 메시지와 HTTP 상태 */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** react-query retry — 4xx(설정·권한 문제)는 다시 해 봐야 같으니 바로 실패로, 네트워크·5xx 만 3번까지 */
export function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 3;
}

/** 실패한 응답 → 서버가 준 detail 메시지를 담은 Error */
export async function failure(res: Response): Promise<Error> {
  let message = res.status === 403 ? "이 작업을 수행할 권한이 없습니다." : "요청을 처리하지 못했습니다.";
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") message = body.detail;
  } catch {
    /* 본문 없음 */
  }
  return new HttpError(message, res.status);
}

/** 서버 API 호출. 실패하면 서버가 준 detail 메시지를 담아 Error를 던진다. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

/** 파일 올리기 (multipart) — Content-Type 은 브라우저가 경계값과 함께 붙인다 */
export async function upload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, { method: "POST", body: form });
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

/** 파일 받기 (POST) — 서버가 만든 파일을 브라우저 다운로드로 저장한다 */
export async function download(path: string, body: unknown, filename: string): Promise<void> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await failure(res);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 경로 조각 인코딩 */
export const seg = encodeURIComponent;
