import { getApiBase } from "@/lib/apiBase";

/** 서버 API 호출. 실패하면 서버가 준 detail 메시지를 담아 Error를 던진다. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    let message = res.status === 403 ? "이 작업을 수행할 권한이 없습니다." : "요청을 처리하지 못했습니다.";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
    } catch {
      /* 본문 없음 */
    }
    throw new Error(message);
  }
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

/** 경로 조각 인코딩 */
export const seg = encodeURIComponent;
