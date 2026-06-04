"use client";

import { useState, useEffect } from "react";

import GroupTab from "@/components/time/GroupTab";
import DaySelector from "@/components/time/DaySelector";
import BellCard from "@/components/time/BellCard";
import BellEditor from "@/components/time/BellEditor";
import GroupActions from "@/components/time/GroupActions";
import Button from "@/components/common/Button";
import { useTimeGroups } from "@/hooks/useTimeGroups";
import { useFiles } from "@/hooks/useFiles";
import { Speaker, Bell, AudioFile } from "@/types/time";
import { SPEAKER_ITEMS } from "@/constants/speakers";
import { DAYS } from "@/constants/days";
import ConfirmModal from "@/components/common/ConfirmModal";
import { cn } from "@/lib/utils";

const SPEAKERS: Speaker[] = SPEAKER_ITEMS.map((s) => ({
  id: s.label,
  name: s.label,
}));

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
    isSpecialActive,
    setSpecialMode,
  } = useTimeGroups();

  const { files, fetchFiles } = useFiles();
  const [editingBellId, setEditingBellId] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

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

  return (
    <div className="flex flex-col h-full w-full pb-10">
      <div className="flex flex-1 flex-col mt-4 h-full overflow-hidden relative">
        <div className="flex-shrink-0 mb-6 w-full flex justify-center">
          <GroupTab
            groups={groups}
            activeGroupId={activeGroup.id}
            onSelect={selectGroup}
          />
        </div>

        <div className="flex flex-1 gap-[40px] min-h-0 relative max-w-[1500px] mx-auto w-full">
          <div className="flex flex-col w-[600px] h-full flex-shrink-0">
            <div className="mb-[16px]">
              <DaySelector
                days={DAYS}
                activeDay={activeDay}
                onSelect={selectDay}
              />
            </div>

            {/* 특별(P) 모드 토글 — ON이면 P 시보가 매일 동작(평일 억제) */}
            <div
              className={cn(
                "mb-[24px] flex items-center justify-between rounded-2xl border px-5 py-4 transition-colors",
                isSpecialActive
                  ? "border-[#c4b5fd]/60 bg-[#a78bfa]/12"
                  : "border-white/10 bg-white/[0.02]",
              )}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-mbc text-[15px] text-white">
                  특별(P) 모드 {isSpecialActive ? "ON" : "OFF"}
                </span>
                <span className="font-pretendard text-xs text-white/40">
                  켜면 요일과 무관하게 <b className="text-white/60">P 시보가 매일</b> 반복됩니다 (평일 시보는 잠시 중단).
                </span>
              </div>
              <button
                onClick={() => setSpecialMode(!isSpecialActive)}
                className={cn(
                  "relative h-[34px] w-[64px] shrink-0 rounded-full transition-colors",
                  isSpecialActive ? "bg-[#a78bfa]" : "bg-white/15",
                )}
                aria-pressed={isSpecialActive}
              >
                <span
                  className={cn(
                    "absolute top-[3px] h-[28px] w-[28px] rounded-full bg-white shadow transition-all",
                    isSpecialActive ? "left-[33px]" : "left-[3px]",
                  )}
                />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
              <div className="grid grid-cols-2 gap-x-[16px] gap-y-[10px] w-full">
                {bells.map((bell) => (
                  <BellCard
                    key={bell.id}
                    bell={bell}
                    isSelected={editingBellId === bell.id}
                    onClick={() => setEditingBellId(bell.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col flex-1 h-full min-h-0">
            <div className="flex-1 overflow-y-auto min-h-0 mb-4">
              {editingBellId !== null ? (
                <BellEditor
                  bell={editingBell}
                  speakers={SPEAKERS}
                  audioFiles={audioFiles}
                  onSave={handleSaveBell}
                  onDelete={editingBell ? handleDeleteBell : undefined}
                />
              ) : (
                <div className="h-full w-full flex flex-col justify-center items-end pb-[160px]">
                  <GroupActions
                    onCopy={copyBells}
                    onPaste={pasteBells}
                    onReset={() => setIsResetModalOpen(true)}
                    hasCopiedData={hasCopiedData}
                  />
                </div>
              )}
            </div>

            <div className="flex-shrink-0 flex justify-end pb-4">
              <div className="flex flex-col gap-[20px] w-full max-w-[340px]">
                <Button
                  label="시보 추가"
                  onClick={handleCreateNew}
                  color={isAddingNew ? "red" : "white"}
                  className="h-[64px]"
                />
                <Button
                  label="시보 전송"
                  onClick={sendTimeTable}
                  color="#9EFAE1"
                  glowSize="20px"
                  className="h-[64px]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={() => {
          resetBells();
          setEditingBellId(null);
        }}
        title="시보 초기화"
        message="현재 선택된 요일의 시보가 모두 삭제됩니다. 계속하시겠습니까?"
        confirmText="초기화"
        isDestructive={true}
      />
    </div >
  );
}
