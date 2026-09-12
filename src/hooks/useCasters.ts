import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { put, request } from "@/lib/http";
import { toast } from "@/components/common/Toast";
import type { Caster } from "@/constants/casters";

interface CastersResponse {
  casters: Caster[];
}

const KEY = ["casters"] as const;

/** 방송부 명단 — 서버 data/casters.json (GET/PUT /casters, 저장은 명단 전체 교체) */
export function useCasters() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => request<CastersResponse>("/casters"),
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: (casters: Caster[]) => put<CastersResponse>("/casters", { casters }),
    onSuccess: (res) => {
      qc.setQueryData(KEY, res);
      toast.success(`방송부 명단을 저장했습니다. (${res.casters.length}명)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    casters: query.data?.casters,
    error: query.error as Error | null,
    save: save.mutate,
    isSaving: save.isPending,
  };
}
