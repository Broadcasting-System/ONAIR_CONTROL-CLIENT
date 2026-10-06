"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, RotateCcw, Save } from "lucide-react";
import SectionHeader from "@/components/common/SectionHeader";
import { toast } from "@/components/common/Toast";
import { HallSwitcher, Notice, StatusChip } from "@/components/hall/HallControls";
import LightingCheckStep from "@/components/hall/lighting/LightingCheckStep";
import LightingConnectionStep from "@/components/hall/lighting/LightingConnectionStep";
import LightingFixturesStep from "@/components/hall/lighting/LightingFixturesStep";
import {
  type FixtureRow,
  coveredAddrs,
  groupRuns,
  rowProblems,
  serializeRows,
  toItems,
  toRows,
} from "@/components/hall/lighting/fixtureDraft";
import { useTestLight } from "@/components/hall/lighting/useTestLight";
import { ActionButton } from "@/components/hall/setup/ui";
import { useHalls } from "@/hooks/useHalls";
import { useLighting } from "@/hooks/useLighting";
import { useMe } from "@/hooks/useMe";
import { usePersistentState } from "@/hooks/usePersistentState";
import { lightingApi } from "@/lib/lightingApi";
import { cn } from "@/lib/utils";
import type { CaptureResult, LightingState } from "@/types/lighting";

type StepKey = "connection" | "fixtures" | "check";

// 조명 콘솔이 강당에만 있어서 처음엔 강당을 고른다
const DEFAULT_HALL = "auditorium";

function kindLabel(s?: LightingState): string {
  if (!s?.configured || !s.connection) return "조명";
  if (s.connection.driver === "mock") return "모의 장비";
  return s.connection.interface === "esp32" ? "조명 노드" : "USB-DMX";
}

/** 조명 세팅 — ① 연결 → ② 조명 찾기·목록 → ③ 확인. 조명을 처음 켜는 곳이라 모든 공간이 보인다 */
export default function LightingSetupPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { halls, isLoading: hallsLoading } = useHalls();
  const [hallId, setHallId] = usePersistentState<string | null>("onair.lighting.hall", null);
  const current = halls.find((h) => h.id === hallId) ?? halls.find((h) => h.id === DEFAULT_HALL) ?? halls[0];
  const { state, error } = useLighting(current?.id ?? null);
  const { isAdmin } = useMe();
  const [step, setStep] = useState<StepKey>("connection");
  const [connKey, setConnKey] = useState(0);
  const [captures, setCaptures] = useState<Record<string, CaptureResult>>({});
  const { lit, light, clear: clearLight } = useTestLight(current?.id ?? null);

  useEffect(() => {
    if (current && current.id !== hallId) setHallId(current.id);
  }, [current, hallId, setHallId]);

  // 조명 목록 초안 — 3초마다 오는 상태로 덮이지 않게, 공간마다 한 번만 채운다
  const [rows, setRows] = useState<FixtureRow[] | null>(null);
  const [base, setBase] = useState("");
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!state || !current || state.hall.id !== current.id || loadedFor.current === current.id) return;
    const r = toRows(state);
    setRows(r);
    setBase(serializeRows(r));
    loadedFor.current = current.id;
  }, [state, current]);

  const types = state?.types ?? {};
  const dirty = !!rows && serializeRows(rows) !== base;
  const problems = rows ? rowProblems(rows, types) : [];
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const capture = current ? (captures[current.id] ?? null) : null;

  // 저장 안 한 채로 창을 닫으려 하면 붙잡는다
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const switchHall = (id: string) => {
    if (dirty) {
      toast.error("저장하거나 되돌린 뒤 공간을 바꿀 수 있어요.");
      return;
    }
    if (lit) void clearLight();
    setHallId(id);
    setStep("connection");
  };

  const reloadRows = (s: LightingState) => {
    const r = toRows(s);
    setRows(r);
    setBase(serializeRows(r));
  };

  const reset = () => {
    if (state) reloadRows(state);
  };

  /** 조명 목록 저장 — 성공하면 true */
  const saveRows = async (): Promise<boolean> => {
    if (!rows || !current) return false;
    setSaving(true);
    try {
      const res = await lightingApi.updateConfig(current.id, toItems(rows));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["lighting", current.id] }),
        qc.invalidateQueries({ queryKey: ["halls"] }),
      ]);
      const fresh = qc.getQueryData<LightingState>(["lighting", current.id]);
      if (fresh) reloadRows(fresh);
      if (res.overlaps.length) {
        toast.info(`조명 ${res.fixtures}개를 저장했습니다. 주소가 겹치는 곳이 ${res.overlaps.length}군데 있어요.`);
      } else {
        toast.success(`조명 ${res.fixtures}개를 저장했습니다.`);
      }
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    setFinishing(true);
    try {
      if (dirty && !(await saveRows())) return;
      if (state?.configured) await clearLight();
      router.push("/lighting");
    } finally {
      setFinishing(false);
    }
  };

  const onRemoved = async () => {
    if (!current) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["lighting", current.id] }),
      qc.invalidateQueries({ queryKey: ["halls"] }),
    ]);
    const fresh = qc.getQueryData<LightingState>(["lighting", current.id]);
    if (fresh) reloadRows(fresh);
    setCaptures((c) => {
      const next = { ...c };
      delete next[current.id];
      return next;
    });
    setStep("connection");
    setConnKey((k) => k + 1);
  };

  if (!hallsLoading && halls.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader>조명 세팅</SectionHeader>
        <Notice tone="info">설정된 공간이 없습니다. 서버의 config/halls.json 에 공간을 추가하세요.</Notice>
      </div>
    );
  }

  const configured = !!state?.configured;
  const connected = !!state?.connected;
  const mock = state?.connection?.driver === "mock";
  const savedCount = state?.fixtures.length ?? 0;
  const runs = capture ? groupRuns(capture.used) : [];
  const covered = rows ? coveredAddrs(rows, types) : new Set<number>();
  const missing = capture ? capture.used.filter((u) => !covered.has(u.address)).length : 0;

  const connSub = !state
    ? "불러오는 중"
    : !configured
      ? "아직 안 함"
      : mock
        ? "모의 장비"
        : `${kindLabel(state)} ${state.connection?.virtual ? "가상" : state.connection?.port || "포트 없음"}${connected ? "" : " · 연결 안 됨"}`;

  const steps: { key: StepKey; title: string; sub: string; done: boolean }[] = [
    { key: "connection", title: "연결", sub: connSub, done: configured && connected && !mock },
    {
      key: "fixtures",
      title: "조명 찾기·목록",
      sub: rows ? `${rows.length}개${capture ? ` / ${runs.length}묶음` : ""}` : "-",
      done: configured && savedCount > 0 && !dirty,
    },
    {
      key: "check",
      title: "확인",
      sub: "켜 보고 끝내기",
      done: configured && connected && savedCount > 0 && !dirty && !!capture && missing === 0,
    },
  ];

  return (
    <div className="flex min-h-full flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <Link
          href="/lighting"
          className="flex h-9 items-center gap-1 rounded-xl px-2 font-mbc text-sm text-white/50 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ChevronLeft size={16} />
          조명
        </Link>
        <SectionHeader className="mb-0">조명 세팅</SectionHeader>
        <HallSwitcher halls={halls} value={current?.id} onChange={switchHall} />
        <div className="ml-auto flex items-center gap-2.5">
          <StatusChip
            tone={configured && connected ? "good" : "off"}
            label={configured ? `${kindLabel(state)} ${connected ? "online" : "offline"}` : "조명 없음"}
          />
        </div>
      </header>

      {!isAdmin && <Notice>관리자 기기에서만 세팅을 바꿀 수 있어요. 지금은 보기만 됩니다.</Notice>}
      {error && <Notice>{error.message}</Notice>}
      {state && configured && !connected && <Notice>조명에 연결되지 않았어요 — {state.detail}</Notice>}

      {/* 단계 */}
      <nav className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {steps.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStep(s.key)}
            aria-current={step === s.key ? "step" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
              step === s.key
                ? "border-[#FF3B3B]/55 bg-[#FF3B3B]/10"
                : "border-white/[0.08] bg-black/25 hover:bg-white/[0.05]",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-orbitron text-sm",
                s.done ? "bg-[#00FF57]/15 text-[#00FF57]" : step === s.key ? "bg-[#FF3B3B] text-white" : "bg-white/10 text-white/50",
              )}
            >
              {s.done ? <Check size={15} strokeWidth={3} /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={cn("block font-mbc text-[15px]", step === s.key ? "text-white" : "text-white/70")}>
                {s.title}
              </span>
              <span className="block truncate font-pretendard text-xs text-white/40">{s.sub}</span>
            </span>
          </button>
        ))}
      </nav>

      {!state || !current || !rows || state.hall.id !== current.id ? (
        <p className="py-10 text-center font-pretendard text-sm text-white/35">조명 정보를 불러오는 중…</p>
      ) : (
        <div className={cn("flex flex-col gap-5", !isAdmin && "pointer-events-none opacity-60")}>
          {step === "connection" && (
            <LightingConnectionStep
              key={`${current.id}-${connKey}`}
              hallId={current.id}
              hallName={current.name}
              state={state}
              onSaved={() => setConnKey((k) => k + 1)}
              onNext={() => setStep("fixtures")}
            />
          )}
          {step === "fixtures" && (
            <LightingFixturesStep
              key={current.id}
              hallId={current.id}
              state={state}
              rows={rows}
              setRows={setRows}
              capture={capture}
              setCapture={(c) => setCaptures((m) => ({ ...m, [current.id]: c }))}
              lit={lit}
              light={light}
              clearLight={clearLight}
            />
          )}
          {step === "check" && (
            <LightingCheckStep
              hallId={current.id}
              hallName={current.name}
              state={state}
              rows={rows}
              dirty={dirty}
              capture={capture}
              clearLight={clearLight}
              onFinish={finish}
              finishing={finishing || saving}
              onRemoved={onRemoved}
            />
          )}
        </div>
      )}

      {/* 조명 목록은 한 번에 저장 */}
      {step !== "connection" && rows && dirty && (
        <div className="sticky bottom-0 z-20 mt-auto flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#161616]/95 px-5 py-3 shadow-[0_-12px_30px_-12px_rgba(0,0,0,0.8)] backdrop-blur">
          <span className="font-mbc text-sm text-amber-200/85">저장 안 한 변경이 있어요</span>
          {problems.length > 0 && (
            <span className="font-pretendard text-xs text-red-300/85">· {problems.join(" · ")}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ActionButton tone="ghost" icon={<RotateCcw size={14} />} onClick={reset}>
              되돌리기
            </ActionButton>
            <ActionButton
              tone="primary"
              icon={<Save size={15} />}
              busy={saving}
              onClick={() => void saveRows()}
              disabled={problems.length > 0 || !isAdmin}
            >
              저장
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
