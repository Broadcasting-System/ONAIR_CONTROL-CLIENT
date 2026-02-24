"use client";

import { useState, useEffect } from "react";
import SectionHeader from "@/components/common/SectionHeader";
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

const SPEAKERS: Speaker[] = SPEAKER_ITEMS.map((s, idx) => ({
  id: `spk-${idx}`,
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
      <SectionHeader>시보 설정</SectionHeader>

      <div className="flex flex-1 flex-col mt-[40px] h-full overflow-hidden">
        {/* Top: Groups */}
        <div className="flex-shrink-0 mb-[60px] max-w-[1610px]">
          <GroupTab
            groups={groups}
            activeGroupId={activeGroup.id}
            onSelect={selectGroup}
          />
        </div>

        {/* Bottom: Split Editor Layout */}
        <div className="flex flex-1 gap-[62px] min-h-0 relative max-w-[1610px]">
          {/* Left Panel */}
          <div className="flex flex-col w-[684px] h-full flex-shrink-0">
            {/* Day Selector */}
            <div className="mb-[32px]">
              <DaySelector
                days={DAYS.map((d) => d.value)}
                activeDay={activeDay}
                onSelect={selectDay}
              />
            </div>

            {/* Bells List */}
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

          {/* Right Panel */}
          <div className="flex flex-col flex-1 pb-[100px] relative h-full">
            {editingBellId !== null ? (
              <BellEditor
                bell={editingBell}
                speakers={SPEAKERS}
                audioFiles={audioFiles}
                onSave={handleSaveBell}
                onDelete={editingBell ? handleDeleteBell : undefined}
              />
            ) : (
              <div className="h-full w-[864px] flex items-center justify-end relative pb-[200px]">
                <GroupActions
                  onCopy={copyBells}
                  onPaste={pasteBells}
                  onReset={() => setIsResetModalOpen(true)}
                  hasCopiedData={hasCopiedData}
                />
              </div>
            )}

            {/* Global Bottom Actions */}
            <div className="absolute bottom-0 right-0 flex flex-col gap-[28px] w-[495px]">
              <Button
                label="시보 추가"
                onClick={handleCreateNew}
                color={isAddingNew ? "red" : "white"}
                className="h-[58px]"
              />
              <Button
                label="시보 전송"
                onClick={sendTimeTable}
                color="white"
                className="h-[58px]"
              />
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
    </div>
  );
}
