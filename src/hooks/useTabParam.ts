import { useCallback, useEffect, useState } from "react";

/**
 * 페이지 탭 상태를 URL `?tab=` 과 맞춘다.
 * 옛 메뉴 주소(/scheduler, /logs)가 탭 주소로 넘어오도록 하기 위함.
 * useSearchParams 대신 window.location을 읽어 정적 렌더링(Suspense 경계) 제약을 피한다.
 */
export function useTabParam<T extends string>(tabs: readonly T[], fallback: T) {
  const [tab, setTab] = useState<T>(fallback);
  const allowed = tabs.join("|");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && allowed.split("|").includes(requested)) setTab(requested as T);
  }, [allowed]);

  const change = useCallback((next: T) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }, []);

  return [tab, change] as const;
}
