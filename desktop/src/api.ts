// Rust 명령 부르기. 브라우저(vite 미리보기)에서 열면 가짜 응답으로 화면만 보여준다.
import { invoke } from "@tauri-apps/api/core";

export interface AppStateView {
  configured: boolean;
  server: string | null;
  api: string | null;
  clientIdHint: string | null;
  savedAt: number | null;
  proxyPort: number;
  version: string;
  logDir: string | null;
  platform: string;
  storeError: string | null;
}

export interface ParsedLink {
  server: string;
  clientId: string;
  clientIdHint: string;
  api: string | null;
  invite: string | null;
  exp: number | null;
}

export interface SaveResult {
  saved: boolean;
  ok: boolean;
  canForce: boolean;
  httpStatus: number | null;
  message: string;
  member: unknown;
}

const inTauri = "__TAURI_INTERNALS__" in window;

export async function call<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (inTauri) return invoke<T>(cmd, args);
  return mock(cmd, args) as T;
}

// ---- 미리보기용 가짜 응답 ----
function mock(cmd: string, args?: Record<string, unknown>): unknown {
  const preview = new URLSearchParams(location.search).get("preview");
  const configured = preview === "configured";
  switch (cmd) {
    case "get_state":
      return {
        configured,
        server: configured ? "https://onair.bssmcast.com" : null,
        api: configured ? "https://onair.bssmcast.com/" : null,
        clientIdHint: configured ? "8f2c….access" : null,
        savedAt: configured ? Date.now() / 1000 : null,
        proxyPort: 53817,
        version: "0.1.0",
        logDir: "~/Library/Logs/kr.bssm.onair",
        platform: "macos",
        storeError: null,
      } satisfies AppStateView;
    case "pending_link":
      return null;
    case "parse_link": {
      const link = String(args?.link ?? "");
      if (!link.startsWith("onair:")) throw "링크에 등록 정보(d=…)가 없어요.";
      return { server: "https://onair.bssmcast.com", clientId: "x", clientIdHint: "8f2c….access", api: null, invite: "K3-7Q9", exp: Date.now() / 1000 + 7 * 86400 };
    }
    case "verify_and_save":
      return { saved: true, ok: true, canForce: true, httpStatus: 404, message: "서버에 연결됐어요.", member: null };
    default:
      return null;
  }
}
