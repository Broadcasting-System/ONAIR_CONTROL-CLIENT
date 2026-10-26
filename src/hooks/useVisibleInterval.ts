import { useEffect, useRef } from "react";

/**
 * 화면이 보일 때만 ms 마다 fn — 숨긴 탭·최소화한 앱에서는 멈추고, 다시 보이면 바로 한 번 부른다.
 * TanStack Query 의 refetchInterval 은 원래 이렇게 동작한다(refetchIntervalInBackground 기본 false).
 * 손으로 setInterval 하던 폴링을 같은 규칙으로 맞춘다. ms 가 null 이면 멈춘다.
 * immediate — 시작할 때 한 번 바로 부를지 (기본 true)
 */
export function useVisibleInterval(fn: () => void, ms: number | null, { immediate = true } = {}) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (ms == null) return;
    const visible = () => document.visibilityState !== "hidden";
    if (immediate && visible()) fnRef.current();
    const id = setInterval(() => {
      if (visible()) fnRef.current();
    }, ms);
    const onVisible = () => {
      if (visible()) fnRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, immediate]);
}
