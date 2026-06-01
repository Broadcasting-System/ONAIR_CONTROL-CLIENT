import { backendBase } from "@/lib/backend";

export function getApiBase(): string {
  // 명시 env override가 있으면 그것, 없으면 접속 호스트 기준 자동 유추
  return `${backendBase()}/api`;
}
