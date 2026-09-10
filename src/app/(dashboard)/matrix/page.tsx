"use client";

import { useEffect, useState } from "react";
import SectionHeader from "@/components/common/SectionHeader";
import ConfirmModal from "@/components/common/ConfirmModal";
import { ConfigButton, MatrixLabelsModal } from "@/components/hall/HallConfigModal";
import { HallSwitcher, LockToggle, Notice, Panel, StatusChip } from "@/components/hall/HallControls";
import { useHalls } from "@/hooks/useHalls";
import { useMe } from "@/hooks/useMe";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useVideoMatrix } from "@/hooks/useVideoMatrix";
import { cn } from "@/lib/utils";
import { DRIVER_LABEL, type MatrixPort } from "@/types/hall";

export default function VideoMatrixPage() {
  const { halls: allHalls, isLoading: hallsLoading } = useHalls();
  const halls = allHalls.filter((h) => h.hasVideoMatrix);
  const [hallId, setHallId] = usePersistentState<string | null>("onair.matrix.hall", null);
  const [locked, setLocked] = usePersistentState("onair.matrix.locked", false);
  const current = halls.find((h) => h.id === hallId) ?? halls[0];

  useEffect(() => {
    if (current && current.id !== hallId) setHallId(current.id);
  }, [current, hallId, setHallId]);

  const { state, error, route, routeAll, applyPreset, savePreset, isSavingPreset, deletePreset } =
    useVideoMatrix(current?.id ?? null);
  const { canOperate, isAdmin } = useMe();
  const [confirmAll, setConfirmAll] = useState<MatrixPort | null>(null);
  const [presetName, setPresetName] = useState("");
  const [editing, setEditing] = useState(false);

  const connected = !!state?.connected;
  const operable = canOperate && !locked && connected;
  const inputName = (no: number | null) => state?.inputs.find((i) => i.no === no)?.name ?? "알 수 없음";

  if (!hallsLoading && halls.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader>영상 매트릭스</SectionHeader>
        <Notice tone="info">설정된 영상 매트릭스가 없습니다. 서버의 config/halls.json 에 추가하세요.</Notice>
      </div>
    );
  }

  const inputs = state?.inputs ?? [];
  const outputs = state?.outputs ?? [];

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="flex flex-wrap items-center gap-5">
        <SectionHeader className="mb-0">영상 매트릭스</SectionHeader>
        <HallSwitcher halls={halls} value={current?.id} onChange={setHallId} />
        {state?.model && <span className="font-pretendard text-sm text-white/35">{state.model}</span>}
        <div className="ml-auto flex items-center gap-2.5">
          {isAdmin && state && <ConfigButton label="이름 편집" onClick={() => setEditing(true)} />}
          <StatusChip
            tone={connected ? "good" : "off"}
            label={`${DRIVER_LABEL[state?.driver ?? ""] ?? state?.driver ?? "-"} ${connected ? "online" : "offline"}`}
          />
          {connected && (
            <StatusChip
              tone={state?.stateSource === "device" ? "good" : "warn"}
              label={state?.stateSource === "device" ? "장비 상태" : "추정 상태"}
            />
          )}
          <LockToggle checked={locked} onChange={setLocked} />
        </div>
      </header>

      {error && <Notice>{error.message}</Notice>}
      {state && !connected && <Notice>영상 매트릭스에 연결되지 않았습니다 — {state.detail}</Notice>}
      {connected && state?.stateSource === "assumed" && (
        <Notice tone="info">
          이 장비는 현재 라우팅을 알려주지 않아, ONAIR가 마지막으로 보낸 명령 기준으로 표시합니다. 장비 앞면에서 직접
          바꾸면 화면과 달라질 수 있습니다.
        </Notice>
      )}
      {!canOperate && <Notice tone="info">보기 전용 기기입니다. 조작은 운영 권한이 있는 기기에서 가능합니다.</Notice>}

      <div className="flex min-h-0 flex-1 gap-5">
        <Panel title="라우팅" hint="행 = 출력(화면), 열 = 입력(소스) · 입력 이름을 누르면 모든 화면이 그 입력으로" className="min-w-0 flex-1">
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `170px repeat(${inputs.length || 1}, minmax(0, 1fr))` }}
          >
            <div className="flex h-[66px] items-end px-1 pb-2 font-pretendard text-xs text-white/35">출력 \ 입력</div>
            {inputs.map((i) => (
              <button
                key={`in-${i.no}`}
                type="button"
                disabled={!operable}
                onClick={() => setConfirmAll(i)}
                className="flex h-[66px] flex-col items-center justify-center rounded-xl bg-black/40 transition-colors enabled:hover:bg-white/[0.07] disabled:cursor-not-allowed"
              >
                <span className="font-orbitron text-[10px] tracking-[0.14em] text-white/35">IN {i.no}</span>
                <span className="mt-0.5 line-clamp-2 max-w-full break-keep px-1 text-center font-mbc text-sm leading-tight text-white">{i.name}</span>
              </button>
            ))}

            {outputs.map((o) => (
              <div key={`row-${o.no}`} className="contents">
                <div className="flex h-[56px] flex-col justify-center rounded-xl bg-black/40 px-4">
                  <span className="font-orbitron text-[10px] tracking-[0.14em] text-white/35">OUT {o.no}</span>
                  <span className="mt-0.5 truncate font-mbc text-sm text-white">{o.name}</span>
                </div>
                {inputs.map((i) => {
                  const on = o.input === i.no;
                  return (
                    <button
                      key={`cell-${o.no}-${i.no}`}
                      type="button"
                      aria-label={`${o.name} ← ${i.name}`}
                      aria-pressed={on}
                      disabled={!operable || on}
                      onClick={() => route(o.no, i.no)}
                      className={cn(
                        "flex h-[56px] items-center justify-center rounded-xl transition-colors disabled:cursor-default",
                        on ? "bg-red-400/15" : "bg-white/[0.025] enabled:hover:bg-white/[0.08]",
                      )}
                    >
                      <span
                        className={cn(
                          "h-4 w-4 rounded-full",
                          on ? "bg-[#ff5a5a] shadow-[0_0_12px_#ff5a5a]" : "border-[1.5px] border-white/15",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Panel>

        <div className="flex w-[340px] shrink-0 flex-col gap-5">
          <Panel title="출력 현황">
            <div className="flex flex-col gap-2">
              {outputs.map((o) => (
                <div key={o.no} className="flex h-12 items-center gap-2.5 rounded-xl bg-black/40 px-3.5 font-pretendard text-sm">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      o.input ? "bg-[#00FF57] shadow-[0_0_8px_#00FF57]" : "bg-[#585858]",
                    )}
                  />
                  <span className="truncate text-white/85">{o.name}</span>
                  <span className="ml-auto shrink-0 font-mbc text-red-400">{o.input ? inputName(o.input) : "-"}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="프리셋">
            <div className="grid grid-cols-2 gap-2.5">
              {(state?.presets ?? []).map((p) => (
                <div key={p.id} className="group relative">
                  <button
                    type="button"
                    disabled={!operable}
                    onClick={() => applyPreset(p.id)}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-transparent bg-black/40 px-2 font-mbc text-[15px] text-white transition-all enabled:hover:border-red-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {p.name}
                  </button>
                  {p.custom && isAdmin && (
                    <button
                      type="button"
                      aria-label={`${p.name} 프리셋 삭제`}
                      onClick={() => deletePreset(p.id)}
                      className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs text-white hover:bg-red-500 group-hover:flex"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isAdmin && (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = presetName.trim();
                  if (!name) return;
                  savePreset(name);
                  setPresetName("");
                }}
              >
                <input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  maxLength={30}
                  placeholder="현재 상태를 프리셋으로 저장"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-dashed border-white/20 bg-transparent px-3 font-pretendard text-sm text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!presetName.trim() || isSavingPreset || !connected}
                  className="h-11 shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 font-mbc text-sm text-white hover:bg-white/15 disabled:opacity-40"
                >
                  저장
                </button>
              </form>
            )}
          </Panel>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmAll !== null}
        onClose={() => setConfirmAll(null)}
        onConfirm={() => {
          if (confirmAll) routeAll(confirmAll.no);
          setConfirmAll(null);
        }}
        title="전체 화면 전환"
        message={`모든 출력 화면을 '${confirmAll?.name ?? ""}' 입력으로 바꿉니다. 계속하시겠습니까?`}
        confirmText="전환"
      />

      {editing && state && current && (
        <MatrixLabelsModal hallId={current.id} state={state} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
