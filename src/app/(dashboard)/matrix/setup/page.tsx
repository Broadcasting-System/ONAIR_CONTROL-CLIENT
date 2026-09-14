"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import SectionHeader from "@/components/common/SectionHeader";
import { toast } from "@/components/common/Toast";
import { HallSwitcher, Notice, StatusChip } from "@/components/hall/HallControls";
import MatrixConnectionForm from "@/components/hall/matrix/MatrixConnectionForm";
import { useHalls } from "@/hooks/useHalls";
import { useMe } from "@/hooks/useMe";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useVideoMatrix } from "@/hooks/useVideoMatrix";
import { cn } from "@/lib/utils";
import { DRIVER_LABEL } from "@/types/hall";

/** 영상 매트릭스 현장 세팅 — USB-RS232 를 꽂은 뒤 이 화면만으로 노트북·COM 포트·명령 문법을 맞추고 바로 시험한다 */
export default function MatrixSetupPage() {
  const { halls: allHalls, isLoading: hallsLoading } = useHalls();
  const halls = allHalls.filter((h) => h.hasVideoMatrix);
  const [hallId, setHallId] = usePersistentState<string | null>("onair.matrix.hall", null);
  const current = halls.find((h) => h.id === hallId) ?? halls[0];
  const { state, error } = useVideoMatrix(current?.id ?? null);
  const { isAdmin } = useMe();
  const [formKey, setFormKey] = useState(0);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (current && current.id !== hallId) setHallId(current.id);
  }, [current, hallId, setHallId]);

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

  if (!hallsLoading && halls.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader>매트릭스 현장 세팅</SectionHeader>
        <Notice tone="info">설정된 영상 매트릭스가 없습니다. 서버의 config/halls.json 에 공간을 추가하세요.</Notice>
      </div>
    );
  }

  const connected = !!state?.connected;

  return (
    <div className="flex min-h-full flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <Link
          href="/matrix"
          className="flex h-9 items-center gap-1 rounded-xl px-2 font-mbc text-sm text-white/50 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ChevronLeft size={16} />
          영상 매트릭스
        </Link>
        <SectionHeader className="mb-0">매트릭스 현장 세팅</SectionHeader>
        <HallSwitcher halls={halls} value={current?.id} onChange={switchHall} />
        {state?.model && <span className="font-pretendard text-sm text-white/35">{state.model}</span>}
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
        <Notice>영상 매트릭스에 연결되지 않았어요 — {state.detail}</Notice>
      )}

      {!state || !current ? (
        <p className="py-10 text-center font-pretendard text-sm text-white/35">영상 매트릭스 정보를 불러오는 중…</p>
      ) : (
        <div className={cn(!isAdmin && "pointer-events-none opacity-60")}>
          <MatrixConnectionForm
            key={`${current.id}-${formKey}`}
            hallId={current.id}
            state={state}
            onSaved={() => setFormKey((k) => k + 1)}
            onDirty={setDirty}
          />
        </div>
      )}
    </div>
  );
}
