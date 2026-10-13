"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";

import GroupTab from "@/components/time/GroupTab";
import DaySelector from "@/components/time/DaySelector";
import BellCard from "@/components/time/BellCard";
import BellEditor from "@/components/time/BellEditor";
import GroupActions from "@/components/time/GroupActions";
import Button from "@/components/common/Button";
import { useTimeGroups } from "@/hooks/useTimeGroups";
import { useFiles } from "@/hooks/useFiles";
import { Speaker, Bell, AudioFile } from "@/types/time";
import { useSpeakerMatrix } from "@/hooks/useSpeakerMatrix";
import { DAYS } from "@/constants/days";
import ConfirmModal from "@/components/common/ConfirmModal";
import PageTabs from "@/components/common/PageTabs";
import SchedulerPanel from "@/components/time/SchedulerPanel";
import EnergyPanel from "@/components/time/EnergyPanel";
import { useMe } from "@/hooks/useMe";
import { useTabParam } from "@/hooks/useTabParam";
import { useIsMobile } from "@/hooks/useIsMobile";

const TIME_TAB_KEYS = ["table", "schedule", "energy"] as const;
const TIME_TABS = [
  { key: "table" as const, label: "시간표" },
  { key: "schedule" as const, label: "예약 현황" },
  { key: "energy" as const, label: "야간 절전" },
];

export default function TimePage() {
  const {
    groups,
    activeGroup,
    activeDay,
    bells,
    hasCopiedData,
    selectGroup,
    selectDay,
    addBell,
    updateBell,
    deleteBell,
    copyBells,
    pasteBells,
    resetBells,
    sendTimeTable,
    liveGroupId,
    isSpecialActive,
    setSpecialMode,
  } = useTimeGroups();

  const { files, fetchFiles } = useFiles();
  const { isAdmin } = useMe();
  const { names: speakerNames } = useSpeakerMatrix();
  const speakers: Speaker[] = useMemo(
    () => speakerNames.map((name) => ({ id: name, name })),
    [speakerNames],
  );
  const [tab, setTab] = useTabParam(TIME_TAB_KEYS, "table");
  const [editingBellId, setEditingBellId] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const audioFiles: AudioFile[] = (files.audio || []).map((file) => ({
    id: file.id,
    name: file.fileName,
    url: file.fileUrl,
  }));

  const editingBell =
    editingBellId && editingBellId !== "new"
      ? bells.find((b) => b.id === editingBellId) || null
      : null;

  useEffect(() => {
    if (editingBellId && editingBellId !== "new" && !editingBell) {
      setEditingBellId(null);
    }
  }, [editingBellId, editingBell, bells]);

  const isAddingNew = editingBellId === "new";

  const handleCreateNew = () => {
    setEditingBellId("new");
  };

  const handleSaveBell = (bell: Bell) => {
    if (isAddingNew) {
      addBell(bell);
    } else {
      updateBell(bell.id, bell);
    }
    setEditingBellId(null);
  };

  const handleDeleteBell = () => {
    if (editingBell) {
      deleteBell(editingBell.id);
    }
    setEditingBellId(null);
  };

  useEffect(() => {
    setEditingBellId(null);
  }, [activeGroup.id, activeDay]);

  const editor =
    editingBellId !== null ? (
      <BellEditor
        bell={editingBell}
        speakers={speakers}
        audioFiles={audioFiles}
        onSave={handleSaveBell}
        onDelete={editingBell ? handleDeleteBell : undefined}
      />
    ) : null;

  return (
    <div className="flex flex-col h-full w-full pb-10">
      {isAdmin && (
        <PageTabs
          tour="time.tab"
          tabs={TIME_TABS}
          value={tab}
          onChange={setTab}
          className="mx-auto mt-2 max-md:[&>button]:min-h-[44px] max-md:[&>button]:text-[15px]"
        />
      )}
      {isAdmin && tab === "schedule" ? (
        <div className="mt-6 flex min-h-0 flex-1 flex-col">
          <SchedulerPanel />
        </div>
      ) : isAdmin && tab === "energy" ? (
        <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto">
          <EnergyPanel />
        </div>
      ) : (
      <div className="relative mt-4 flex flex-1 flex-col md:h-full md:overflow-hidden">
        <div className="flex-shrink-0 mb-2 w-full flex justify-center">
          <div data-tour="time.live-badge" className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
            <span className="font-mbc text-xs text-emerald-200/90">
              {liveGroupId
                ? `GROUP ${liveGroupId} 송출 중${isSpecialActive ? " · 특별(P) 모드" : ""}`
                : "송출 중인 시보 없음"}
            </span>
          </div>
        </div>
        <div data-tour="time.group-tabs" className="no-scrollbar -mx-4 mb-4 flex w-auto flex-shrink-0 overflow-x-auto px-4 md:mx-0 md:mb-6 md:w-full md:justify-center md:overflow-visible md:px-0">
          <GroupTab
            groups={groups}
            activeGroupId={activeGroup.id}
            onSelect={selectGroup}
          />
        </div>

        <div className="relative mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col gap-6 md:flex-row md:gap-[40px]">
          <div className="flex w-full flex-shrink-0 flex-col md:h-full md:w-[600px]">
            <div data-tour="time.days" className="mb-4 md:mb-[24px]">
              <DaySelector
                days={DAYS}
                activeDay={activeDay}
                onSelect={selectDay}
              />
            </div>

            <div className="custom-scrollbar md:flex-1 md:overflow-y-auto md:pr-4">
              <div data-tour="time.bells" className="grid w-full grid-cols-1 gap-y-0 md:grid-cols-2 md:gap-x-[16px] md:gap-y-[10px]">
                {bells.map((bell) => (
                  <BellCard
                    key={bell.id}
                    bell={bell}
                    allSpeakers={speakerNames}
                    isSelected={editingBellId === bell.id}
                    onClick={() => setEditingBellId(bell.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col md:h-full">
            <div className="min-h-0 md:mb-4 md:flex-1 md:overflow-y-auto">
              {editor && !isMobile ? (
                editor
              ) : (
                <div className="flex w-full flex-col md:h-full md:items-end md:justify-center md:pb-[160px]">
                  <GroupActions
                    onCopy={copyBells}
                    onPaste={pasteBells}
                    onReset={() => setIsResetModalOpen(true)}
                    hasCopiedData={hasCopiedData}
                  />
                </div>
              )}
            </div>

            <div className="order-first mb-3 flex flex-shrink-0 justify-end md:order-none md:mb-0 md:pb-4">
              <div className="flex w-full flex-col gap-3 md:max-w-[340px] md:gap-[20px]">
                {/* 특별(P) 모드 — 보고 있는 탭과 상관없이 송출 중인 그룹에 켜고 끈다 */}
                <Button
                  tour="time.special"
                  label={`특별(P) 모드 ${isSpecialActive ? "ON" : "OFF"}`}
                  onClick={() => setSpecialMode(!isSpecialActive)}
                  disabled={liveGroupId == null}
                  color={isSpecialActive ? "#c4b5fd" : "white"}
                  glowSize={isSpecialActive ? "18px" : "8px"}
                  className="h-[56px] md:h-[64px]"
                />
                <Button
                  tour="time.add"
                  label="시보 추가"
                  onClick={handleCreateNew}
                  color={isAddingNew ? "red" : "white"}
                  className="h-[56px] md:h-[64px]"
                />
                <Button
                  tour="time.send"
                  label="시보 전송"
                  onClick={sendTimeTable}
                  color="#9EFAE1"
                  glowSize="20px"
                  className="h-[56px] md:h-[64px]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {isMobile &&
        editor &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex flex-col bg-[#0b0b0d] md:hidden">
            <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.08] px-2 pb-2 pt-[calc(8px+env(safe-area-inset-top))]">
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setEditingBellId(null)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white/80 active:bg-white/10"
              >
                <ChevronLeft size={26} />
              </button>
              <h2 className="min-w-0 flex-1 truncate font-mbc text-[20px] text-white">
                {isAddingNew ? "시보 추가" : editingBell?.label || "시보"}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
              {editor}
            </div>
          </div>,
          document.body,
        )}

      <ConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={() => {
          resetBells();
          setEditingBellId(null);
        }}
        title="시보 초기화"
        message="이 요일 시보를 모두 지워요"
        confirmText="초기화"
        isDestructive={true}
      />
    </div >
  );
}
