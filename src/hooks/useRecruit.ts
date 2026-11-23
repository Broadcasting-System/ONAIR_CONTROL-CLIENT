import { useQuery } from "@tanstack/react-query";
import { HttpError, retryUnlessClientError } from "@/lib/http";
import { recruitApi } from "@/lib/recruitApi";

/** 방송부 모집 react-query 열쇠 */
export const recruitKeys = {
  current: ["recruit", "current"] as const,
  me: ["recruit", "me"] as const,
  list: ["recruit", "list"] as const,
  apps: (rid: string) => ["recruit", rid, "apps"] as const,
  app: (rid: string, aid: string) => ["recruit", rid, "app", aid] as const,
  record: (rid: string, aid: string) => ["recruit", rid, "record", aid] as const,
  confirmations: (rid: string) => ["recruit", rid, "confirmations"] as const,
};

/** 공개 공고 (로그인 없어도) */
export function useRecruitCurrent() {
  return useQuery({
    queryKey: recruitKeys.current,
    queryFn: recruitApi.current,
    retry: retryUnlessClientError,
    refetchInterval: 60_000,
  });
}

/** 내 지원 현황 — 로그인 안 했거나 학교 계정이 아니면 서버가 4xx 라 null 로 */
export function useMyApplication(enabled = true) {
  return useQuery({
    queryKey: recruitKeys.me,
    enabled,
    queryFn: async () => {
      try {
        return await recruitApi.me();
      } catch (e) {
        if (e instanceof HttpError && (e.status === 404 || e.status === 401 || e.status === 403))
          return null;
        throw e;
      }
    },
    retry: retryUnlessClientError,
    refetchInterval: 30_000,
  });
}
