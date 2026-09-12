"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import SectionHeader from "@/components/common/SectionHeader";
import StatusCard from "@/components/StatusCard";
import ConfirmModal from "@/components/common/ConfirmModal";
import { cn } from "@/lib/utils";
import {
  Caster,
  casterSubtitle,
  defaultCasterBio,
  groupCastersByCohort,
} from "@/constants/casters";
import { useCasters } from "@/hooks/useCasters";

function CasterInner() {
  const params = useSearchParams();
  const editMode = params.get("edit") === "1";

  const { casters, error, save, isSaving } = useCasters();
  // 편집 중인 사본. null이면 서버 명단을 그대로 보여 준다 (저장·되돌리기 후 다시 null)
  const [draft, setDraft] = useState<Caster[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const list = draft ?? casters ?? [];
  const groups = groupCastersByCohort(list);
  const selected =
    list.find((c) => c.id === selectedId) ??
    (selectedId === null ? list.find((c) => c.name === "류승찬") : undefined) ??
    list[0];

  // 서버 명단을 복사해 편집을 시작 (명단을 아직 못 불러왔으면 빈 목록을 저장하지 않도록 casters 필수)
  const edit = (fn: (prev: Caster[]) => Caster[]) =>
    setDraft((prev) => fn(prev ?? (casters ?? []).map((c) => ({ ...c }))));

  const update = (patch: Partial<Caster>) =>
    edit((prev) => prev.map((c) => (c.id === selected?.id ? { ...c, ...patch } : c)));

  const addMember = () => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `new-${Date.now()}`;
    const nc: Caster = {
      id,
      name: "새 부원",
      cohort: selected?.cohort ?? 6,
      role: "member",
    };
    edit((prev) => [...prev, nc]);
    setSelectedId(id);
  };

  const removeSelected = () => {
    const remaining = list.filter((c) => c.id !== selected?.id);
    setDraft(remaining);
    setSelectedId(remaining[0]?.id ?? "");
    setConfirmDelete(false);
  };

  const revert = () => {
    setDraft(null);
  };

  const onSave = () => {
    // 성공하면 훅이 서버가 정리한 명단으로 캐시를 갈아 끼우므로 사본은 버린다
    save(list, { onSuccess: () => setDraft(null) });
  };

  return (
    <div className="flex h-[calc(100dvh-80px)] w-full gap-14 px-[20px]">
      {/* 좌측: 기수별 부원 목록 */}
      <div className="flex w-[460px] shrink-0 flex-col gap-6 overflow-y-auto pr-2">
        <div className="flex items-center justify-between">
          <SectionHeader>방송부</SectionHeader>
          {editMode && (
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 font-mbc text-xs text-amber-300">
              편집 모드
            </span>
          )}
        </div>

        {groups.map((g) => (
          <div key={g.cohort} className="flex flex-col gap-3">
            <h3 className="font-mbc text-lg text-white/90">방송부 {g.cohort}기</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {g.members.map((m) => {
                const active = selected?.id === m.id;
                return (
                  <StatusCard
                    key={m.id}
                    label={m.name}
                    status={m.role === "leader" ? "error" : "good"}
                    text={`${m.cohort}기`}
                    variant="network"
                    labelClassName="text-[30px] text-left pl-1"
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      "h-[86px] cursor-pointer gap-1 px-5 py-3",
                      active &&
                        "bg-white/10 ring-1 ring-white/30 shadow-[0_0_18px_-6px_rgba(255,255,255,0.3)]",
                    )}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {editMode && casters && (
          <button
            onClick={addMember}
            className="mt-1 rounded-xl border border-dashed border-white/20 py-3 font-mbc text-sm text-white/60 transition-colors hover:border-white/40 hover:text-white"
          >
            ＋ 부원 추가
          </button>
        )}
      </div>

      {/* 우측: 선택된 부원 상세 / 편집 */}
      <div className="flex flex-1 flex-col overflow-y-auto pr-4 pt-1">
        {!selected ? (
          <p className="font-pretendard text-white/40">
            {casters
              ? "부원이 없습니다."
              : error
                ? `방송부 명단을 불러오지 못했습니다: ${error.message}`
                : "불러오는 중…"}
          </p>
        ) : !editMode ? (
          // ---------- 읽기 모드 ----------
          <>
            <h1 className="font-mbc text-5xl font-bold leading-none text-white">
              {selected.name}
            </h1>
            <p className="mt-4 font-mbc text-xl text-white/70">
              {casterSubtitle(selected)}
            </p>
            <div className="mt-10 max-w-[1000px] whitespace-pre-line font-pretendard text-[18px] leading-relaxed text-white/75">
              {selected.bio ?? defaultCasterBio(selected)}
            </div>
          </>
        ) : (
          // ---------- 편집 모드 ----------
          <div className="flex max-w-[900px] flex-col gap-5">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="이름">
                <input
                  value={selected.name}
                  onChange={(e) => update({ name: e.target.value })}
                  className="h-[48px] w-[220px] rounded-xl border border-white/10 bg-[#141414] px-4 font-pretendard text-lg text-white focus:border-white/30 focus:outline-none"
                />
              </Field>
              <Field label="기수">
                <input
                  type="number"
                  value={selected.cohort}
                  onChange={(e) => update({ cohort: Number(e.target.value) || 0 })}
                  className="h-[48px] w-[90px] rounded-xl border border-white/10 bg-[#141414] px-4 font-pretendard text-lg text-white focus:border-white/30 focus:outline-none"
                />
              </Field>
              <Field label="역할">
                <div className="flex overflow-hidden rounded-xl border border-white/10">
                  {(["leader", "member"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => update({ role: r })}
                      className={cn(
                        "h-[48px] px-5 font-mbc text-sm transition-colors",
                        selected.role === r
                          ? r === "leader"
                            ? "bg-red-500/20 text-red-200"
                            : "bg-green-500/20 text-green-200"
                          : "bg-transparent text-white/40 hover:bg-white/5",
                      )}
                    >
                      {r === "leader" ? "부장" : "부원"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <Field label="직함 / 한 줄 (회사·역할 등)">
              <input
                value={selected.title ?? ""}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="예: 팀모노리스 / 당근 인턴"
                className="h-[48px] w-full rounded-xl border border-white/10 bg-[#141414] px-4 font-pretendard text-[15px] text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
              />
            </Field>

            <Field label="소개글">
              <textarea
                value={selected.bio ?? ""}
                onChange={(e) => update({ bio: e.target.value })}
                rows={10}
                placeholder={defaultCasterBio(selected)}
                className="w-full resize-y rounded-xl border border-white/10 bg-[#141414] px-4 py-3 font-pretendard text-[16px] leading-relaxed text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
              />
              <p className="mt-1 font-pretendard text-xs text-white/30">
                비워두면 송출 시 &quot;{defaultCasterBio(selected)}&quot; 로 표시됩니다.
              </p>
            </Field>

            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={onSave}
                disabled={isSaving}
                className="rounded-xl border border-green-500/40 bg-green-500/15 px-6 py-3 font-mbc text-green-200 transition-colors hover:bg-green-500/25 disabled:opacity-50"
              >
                {isSaving ? "저장 중…" : "저장"}
              </button>
              <button
                onClick={revert}
                disabled={isSaving}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-mbc text-white/60 hover:bg-white/10 disabled:opacity-50"
              >
                되돌리기
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={isSaving}
                className="ml-auto rounded-xl border border-red-400/40 bg-red-400/10 px-5 py-3 font-mbc text-red-300 hover:bg-red-400/20 disabled:opacity-50"
              >
                이 부원 삭제
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={removeSelected}
        title="부원 삭제"
        message={`${selected?.name ?? ""} 부원을 명단에서 삭제합니다. (저장해야 반영됩니다)`}
        confirmText="삭제"
        isDestructive
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="font-mbc text-sm text-white/50">{label}</label>
      {children}
    </div>
  );
}

export default function CasterPage() {
  return (
    <Suspense fallback={null}>
      <CasterInner />
    </Suspense>
  );
}
