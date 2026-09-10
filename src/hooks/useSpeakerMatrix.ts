import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { speakerApi } from "@/lib/speakerApi";

export const SPEAKER_MATRIX_KEY = ["speakerMatrix"] as const;

/** 서버의 스피커 구역표. 학교마다 다르므로 코드에 박지 않고 항상 서버에서 받는다. */
export function useSpeakerMatrix() {
  const query = useQuery({
    queryKey: SPEAKER_MATRIX_KEY,
    queryFn: speakerApi.matrix,
    staleTime: 30_000,
  });

  // 한 구역이 여러 칸(앰프 2대 등)에 걸칠 수 있어 이름은 중복을 없애고 표 순서대로
  const names = useMemo(
    () => Array.from(new Set((query.data?.cells ?? []).flat().filter(Boolean))),
    [query.data],
  );

  return { matrix: query.data, names, isLoading: query.isLoading, isError: query.isError };
}
