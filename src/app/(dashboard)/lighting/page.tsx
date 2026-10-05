"use client";

import { useEffect, useState } from "react";
import SectionHeader from "@/components/common/SectionHeader";
import { HallSwitcher, LockToggle, Notice, Panel, StatusChip } from "@/components/hall/HallControls";
import LightStrip, { LightMasterStrip, presetOf } from "@/components/hall/LightStrip";
import { useHalls } from "@/hooks/useHalls";
import { useLighting } from "@/hooks/useLighting";
import { useMe } from "@/hooks/useMe";
import { usePersistentState } from "@/hooks/usePersistentState";
import { cn } from "@/lib/utils";

// 믹서와 같은 콘솔 본체 판
const BOARD =
  "rounded-2xl border border-black/80 bg-[linear-gradient(180deg,#1d1d20_0%,#141416_55%,#101012_100%)] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-1px_0_rgba(0,0,0,0.6),0_20px_40px_-16px_rgba(0,0,0,0.8)]";

export default function LightingPage() {
  const { halls: allHalls, isLoading: hallsLoading } = useHalls();
  const halls = allHalls.filter((h) => h.hasLighting);
  const [hallId, setHallId] = usePersistentState<string | null>("onair.lighting.hall", null);
  // 믹서처럼 열 때마다 잠긴 상태로 시작한다 — 들어오자마자 조명이 바뀌는 일이 없게
  const [locked, setLocked] = useState(true);
  const current = halls.find((h) => h.id === hallId) ?? halls[0];

  useEffect(() => {
    if (current && current.id !== hallId) setHallId(current.id);
  }, [current, hallId, setHallId]);

  const {
    state, error, setIntensity, setColor, setAllColor, setMaster, setBlackout, recallScene, isRecalling,
    saveScene, isSavingScene, deleteScene,
  } = useLighting(current?.id ?? null);
  const { canOperate, isAdmin } = useMe();
  const [sceneName, setSceneName] = useState("");
  const [sceneFade, setSceneFade] = useState(2);
  const [saving, setSaving] = useState(false);

  const connected = !!state?.connected;
  const operable = canOperate && !locked && connected;
  const fixtures = state?.fixtures ?? [];
  const colorFixtures = fixtures.filter((f) => f.hasColor);
  // 색 LED 가 모두 같은 색이면 '전체' 줄에서 그 색이 켜진다
  const allPreset = colorFixtures.length ? presetOf(colorFixtures[0].value.color) : null;
  const allColor =
    allPreset && colorFixtures.every((f) => presetOf(f.value.color)?.name === allPreset.name) ? allPreset : null;

  if (!hallsLoading && halls.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader>조명</SectionHeader>
        <Notice tone="info">
          아직 조명이 설정된 공간이 없습니다. 강당 노트북에 USB-DMX 변환기를 꽂은 뒤 관리자가 조명 세팅에서 조명 목록을 넣으면
          여기에 나타납니다.
        </Notice>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="flex flex-wrap items-center gap-5">
        <SectionHeader className="mb-0">조명</SectionHeader>
        <HallSwitcher halls={halls} value={current?.id} onChange={setHallId} />
        <div className="ml-auto flex items-center gap-2.5">
          <StatusChip
            tone={connected ? "good" : "off"}
            label={`${state?.driver === "mock" ? "모의 장비" : "DMX"} ${connected ? "online" : "offline"}`}
          />
          <LockToggle checked={locked} onChange={setLocked} />
        </div>
      </header>

      {error && <Notice>{error.message}</Notice>}
      {state && !connected && <Notice>조명에 연결되지 않았습니다 — {state.detail}</Notice>}
      {!canOperate && <Notice tone="info">보기 전용 기기입니다. 조작은 운영 권한이 있는 기기에서 가능합니다.</Notice>}

      <Panel title="장면" hint="누르면 저장된 조명 상태로 바뀌어요">
        <div className="flex flex-wrap items-center gap-2.5">
          {(state?.scenes ?? []).map((scene) => {
            const active = state?.current === scene.id;
            return (
              <div key={scene.id} className="group relative">
                <button
                  type="button"
                  disabled={!operable || isRecalling}
                  onClick={() => recallScene(scene.id)}
                  className={cn(
                    "flex h-[54px] min-w-[112px] items-center justify-center gap-2.5 rounded-[14px] border px-[18px] font-mbc text-[17px] transition-all disabled:cursor-not-allowed",
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_10px_rgba(0,0,0,0.4)]",
                    active
                      ? "border-[#FF3B3B]/55 bg-[linear-gradient(180deg,rgba(255,59,59,0.22),rgba(255,59,59,0.08))] text-white"
                      : "border-white/[0.08] bg-[linear-gradient(180deg,#1d1d21,#131316)] text-white/70 enabled:hover:text-white",
                  )}
                >
                  <span
                    className={cn("h-[7px] w-[7px] rounded-full", active ? "bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" : "bg-white/15")}
                    aria-hidden
                  />
                  {scene.name}
                  <span className="font-orbitron text-[9px] tracking-[0.1em] text-white/35">
                    {scene.fade ? `${scene.fade}S` : "즉시"}
                  </span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    aria-label={`${scene.name} 장면 삭제`}
                    onClick={() => deleteScene(scene.id)}
                    className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs text-white hover:bg-red-500 group-hover:flex"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {isAdmin &&
            (saving ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = sceneName.trim();
                  if (!name) return;
                  saveScene(name, sceneFade);
                  setSceneName("");
                  setSaving(false);
                }}
              >
                <input
                  autoFocus
                  value={sceneName}
                  onChange={(e) => setSceneName(e.target.value)}
                  maxLength={20}
                  placeholder="장면 이름 (예: 조회)"
                  className="h-11 w-44 rounded-xl border border-white/10 bg-[#141414] px-3 font-pretendard text-sm text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none"
                />
                <label className="flex items-center gap-1.5 font-pretendard text-sm text-white/55">
                  바뀌는 시간
                  <input
                    type="number"
                    min={0}
                    max={60}
                    step={0.5}
                    value={sceneFade}
                    onChange={(e) => setSceneFade(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
                    className="h-11 w-16 rounded-xl border border-white/10 bg-[#141414] px-2 text-center font-orbitron text-sm text-white focus:border-white/30 focus:outline-none"
                  />
                  초
                </label>
                <button
                  type="submit"
                  disabled={!sceneName.trim() || isSavingScene}
                  className="h-11 rounded-xl border border-white/15 bg-white/10 px-4 font-mbc text-sm text-white hover:bg-white/15 disabled:opacity-40"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => setSaving(false)}
                  className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 font-mbc text-sm text-white/60"
                >
                  취소
                </button>
              </form>
            ) : (
              <button
                type="button"
                disabled={!connected}
                onClick={() => setSaving(true)}
                className="flex h-[54px] items-center rounded-[14px] border border-dashed border-white/20 px-[18px] font-mbc text-[15px] text-white/45 hover:text-white/75 disabled:opacity-40"
              >
                + 지금 상태 저장
              </button>
            ))}

          {state && state.scenes.length === 0 && !isAdmin && (
            <span className="font-pretendard text-sm text-white/40">저장된 장면이 없습니다.</span>
          )}
        </div>
      </Panel>

      <Panel title="조명" hint="페이더로 밝기 · 아래 버튼으로 색" className="flex min-h-[520px] flex-1 flex-col">
        {fixtures.length === 0 ? (
          <Notice tone="info">조명 목록이 비어 있습니다. 관리자가 조명 세팅에서 조명을 넣어 주세요.</Notice>
        ) : (
          <div className="flex min-h-0 flex-1 gap-3">
            {/* 조명이 많으면 줄을 바꿔 쌓는다 */}
            <div className={cn(BOARD, "min-w-0 flex-1 overflow-y-auto p-3")}>
              <div className="flex flex-wrap content-start gap-1.5">
                {fixtures.map((f) => (
                  <LightStrip
                    key={f.id}
                    fixture={f}
                    master={state?.master ?? 100}
                    blackout={!!state?.blackout}
                    disabled={!operable}
                    onIntensity={(v) => setIntensity(f.id, v)}
                    onColor={(c) => setColor(f.id, c)}
                  />
                ))}
              </div>
            </div>
            {/* '전체' 줄은 오른쪽에 고정 — 조명이 몇 줄이 되든 같은 자리 */}
            <div className={cn(BOARD, "flex shrink-0 items-start p-3")}>
              <LightMasterStrip
                master={state?.master ?? 100}
                blackout={!!state?.blackout}
                allColor={allColor}
                hasColor={colorFixtures.length > 0}
                disabled={!operable}
                onMaster={setMaster}
                onAllColor={setAllColor}
                onBlackout={setBlackout}
              />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
