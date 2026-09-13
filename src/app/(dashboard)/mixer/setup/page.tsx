"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, RotateCcw, Save } from "lucide-react";
import SectionHeader from "@/components/common/SectionHeader";
import { toast } from "@/components/common/Toast";
import { HallSwitcher, Notice, StatusChip } from "@/components/hall/HallControls";
import ChannelsStep from "@/components/hall/setup/ChannelsStep";
import ConnectionStep from "@/components/hall/setup/ConnectionStep";
import ModeStep from "@/components/hall/setup/ModeStep";
import ScenesStep from "@/components/hall/setup/ScenesStep";
import { type Draft, draftProblems, serialize, toConfig, toDraft } from "@/components/hall/setup/draft";
import { ActionButton } from "@/components/hall/setup/ui";
import { useHalls } from "@/hooks/useHalls";
import { useMe } from "@/hooks/useMe";
import { useMixer } from "@/hooks/useMixer";
import { usePersistentState } from "@/hooks/usePersistentState";
import { hallApi } from "@/lib/hallApi";
import { cn } from "@/lib/utils";
import { DRIVER_LABEL, type MixerState } from "@/types/hall";

type StepKey = "connection" | "channels" | "scenes" | "mode";

/** 믹서 현장 세팅 — 콘솔을 꽂은 뒤 이 화면만으로 연결·채널·씬·조작 범위를 맞추고 바로 시험한다 */
export default function MixerSetupPage() {
  const qc = useQueryClient();
  const { halls: allHalls, isLoading: hallsLoading } = useHalls();
  const halls = allHalls.filter((h) => h.hasMixer);
  const [hallId, setHallId] = usePersistentState<string | null>("onair.mixer.hall", null);
  const current = halls.find((h) => h.id === hallId) ?? halls[0];
  const { state, error } = useMixer(current?.id ?? null);
  const { isAdmin } = useMe();
  const [step, setStep] = useState<StepKey>("connection");
  const [connKey, setConnKey] = useState(0);

  useEffect(() => {
    if (current && current.id !== hallId) setHallId(current.id);
  }, [current, hallId, setHallId]);

  // 채널·씬·조작 범위 초안 — 4초마다 오는 상태로 덮이지 않게, 공간마다 한 번만 채운다
  const [draft, setDraft] = useState<Draft | null>(null);
  const [base, setBase] = useState("");
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!state || !current || loadedFor.current === current.id) return;
    const d = toDraft(state);
    setDraft(d);
    setBase(serialize(d));
    loadedFor.current = current.id;
  }, [state, current]);

  const dirty = !!draft && serialize(draft) !== base;
  const hiqnet = state?.connection.driver === "hiqnet";
  const problems = draft ? draftProblems(draft, !!hiqnet) : [];
  const [saving, setSaving] = useState(false);

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
    setHallId(id);
  };

  const reset = () => {
    if (!state) return;
    const d = toDraft(state);
    setDraft(d);
    setBase(serialize(d));
  };

  const saveConfig = async () => {
    if (!draft || !current) return;
    setSaving(true);
    try {
      await hallApi.updateMixerConfig(current.id, toConfig(draft, !!hiqnet));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["mixer", current.id] }),
        qc.invalidateQueries({ queryKey: ["hallsStatus"] }),
      ]);
      const fresh = qc.getQueryData<MixerState>(["mixer", current.id]);
      if (fresh) {
        const d = toDraft(fresh);
        setDraft(d);
        setBase(serialize(d));
      }
      toast.success("믹서 구성을 저장했습니다. 이제 시험 버튼으로 확인하세요.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!hallsLoading && halls.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader>믹서 현장 세팅</SectionHeader>
        <Notice tone="info">설정된 오디오 믹서가 없습니다. 서버의 config/halls.json 에 공간을 추가하세요.</Notice>
      </div>
    );
  }

  const connected = !!state?.connected;
  const channelsWithAddr = draft?.channels.filter((c) => c.fader.trim()).length ?? 0;
  const steps: { key: StepKey; title: string; sub: string; done: boolean }[] = [
    {
      key: "connection",
      title: "연결",
      sub: !state
        ? "불러오는 중"
        : state.connection.driver === "mock"
          ? "모의 장비"
          : connected
            ? `${DRIVER_LABEL[state.driver] ?? state.driver} 연결됨`
            : "연결 안 됨",
      done: connected && state?.connection.driver !== "mock",
    },
    {
      key: "channels",
      title: "채널",
      sub: draft ? (hiqnet ? `${draft.channels.length}개 · 주소 ${channelsWithAddr}` : `${draft.channels.length}개`) : "-",
      done: !!draft && hiqnet && draft.channels.length > 0 && channelsWithAddr === draft.channels.length,
    },
    {
      key: "scenes",
      title: "씬",
      sub: draft ? `${draft.scenes.length}개` : "-",
      done: !!draft && draft.scenes.length > 0,
    },
    {
      key: "mode",
      title: "조작 범위",
      sub: draft ? (draft.mode === "scenes" ? "씬 전환만" : "채널 조작") : "-",
      done: !!draft,
    },
  ];

  return (
    <div className="flex min-h-full flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <Link
          href="/mixer"
          className="flex h-9 items-center gap-1 rounded-xl px-2 font-mbc text-sm text-white/50 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ChevronLeft size={16} />
          오디오 믹서
        </Link>
        <SectionHeader className="mb-0">믹서 현장 세팅</SectionHeader>
        <HallSwitcher halls={halls} value={current?.id} onChange={switchHall} />
        <div className="ml-auto flex items-center gap-2.5">
          <StatusChip
            tone={connected ? "good" : "off"}
            label={`${DRIVER_LABEL[state?.driver ?? ""] ?? state?.driver ?? "-"} ${connected ? "online" : "offline"}`}
          />
        </div>
      </header>

      {!isAdmin && <Notice>관리자 기기에서만 세팅을 바꿀 수 있어요. 지금은 보기만 됩니다.</Notice>}
      {error && <Notice>{error.message}</Notice>}
      {state && !connected && state.connection.driver !== "mock" && (
        <Notice>믹서에 연결되지 않았어요 — {state.detail}</Notice>
      )}

      {/* 단계 */}
      <nav className="grid grid-cols-4 gap-2.5">
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

      {!state || !current || !draft ? (
        <p className="py-10 text-center font-pretendard text-sm text-white/35">믹서 정보를 불러오는 중…</p>
      ) : (
        <div className={cn("flex flex-col gap-5", !isAdmin && "pointer-events-none opacity-60")}>
          {step === "connection" && (
            <ConnectionStep
              key={`${current.id}-${connKey}`}
              hallId={current.id}
              state={state}
              onSaved={() => setConnKey((k) => k + 1)}
            />
          )}
          {step === "channels" && (
            <ChannelsStep hallId={current.id} state={state} draft={draft} setDraft={setDraft} configDirty={dirty} />
          )}
          {step === "scenes" && (
            <ScenesStep hallId={current.id} state={state} draft={draft} setDraft={setDraft} configDirty={dirty} />
          )}
          {step === "mode" && <ModeStep state={state} draft={draft} setDraft={setDraft} />}
        </div>
      )}

      {/* 채널·씬·조작 범위는 한 번에 저장 */}
      {step !== "connection" && draft && dirty && (
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
              onClick={saveConfig}
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
