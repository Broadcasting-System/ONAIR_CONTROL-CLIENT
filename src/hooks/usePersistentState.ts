import { useCallback, useEffect, useState } from "react";

/** 이 기기에만 기억하는 화면 설정(선택한 공간, 조작 잠금 등). 저장소를 못 쓰면 기본값으로 동작. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* 저장소 사용 불가 — 기본값 유지 */
    }
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* 저장 실패는 무시 */
      }
    },
    [key],
  );

  return [value, update] as const;
}
