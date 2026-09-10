import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { post, put, request } from "@/lib/http";
import { toast } from "@/components/common/Toast";

export type EnergyDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface EnergyConfig {
  enabled: boolean;
  /** HH:MM */
  time: string;
  days: EnergyDay[];
  /** 송출 화면도 대기 화면으로 */
  displays: boolean;
}

export interface EnergyRun {
  at: string;
  speakers?: string[];
  displays?: number[];
  skipped?: string;
  error?: string;
}

export interface EnergyState extends EnergyConfig {
  nextRun: string | null;
  lastRun: EnergyRun | null;
}

const KEY = ["energy"] as const;

/** 야간 절전 — 정해진 시각에 켜진 스피커·송출 화면 끄기 (GET/PUT /energy, POST /energy/run) */
export function useEnergy() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => request<EnergyState>("/energy"),
    refetchInterval: 30_000,
  });

  const save = useMutation({
    mutationFn: (config: EnergyConfig) => put<EnergyState>("/energy", config),
    onSuccess: (state) => {
      qc.setQueryData(KEY, state);
      toast.success(state.enabled ? "야간 절전 예약을 저장했습니다." : "야간 절전을 껐습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const run = useMutation({
    mutationFn: () => post<EnergyRun>("/energy/run"),
    onSuccess: (r) => {
      toast.success(`스피커 ${r.speakers?.length ?? 0}곳 · 송출 화면 ${r.displays?.length ?? 0}개를 껐습니다.`);
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: KEY });
    },
  });

  return {
    state: query.data,
    error: query.error as Error | null,
    save: save.mutate,
    isSaving: save.isPending,
    runNow: () => run.mutate(),
    isRunning: run.isPending,
  };
}
