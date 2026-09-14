import { getApiBase } from "@/lib/apiBase";

/** 실패한 응답 → 서버가 준 detail 메시지를 담은 Error */
async function failure(res: Response): Promise<Error> {
  let message = res.status === 403 ? "이 작업을 수행할 권한이 없습니다." : "요청을 처리하지 못했습니다.";
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") message = body.detail;
  } catch {
    /* 본문 없음 */
  }
  return new Error(message);
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
