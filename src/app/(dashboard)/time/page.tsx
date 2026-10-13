"use client";

import { useState, useEffect, useMemo } from "react";

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
      {isAdmin && (
        <PageTabs tour="time.tab" tabs={TIME_TABS} value={tab} onChange={setTab} className="mx-auto mt-2" />
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
      <div className="flex flex-1 flex-col mt-4 h-full overflow-hidden relative">
        <div className="flex-shrink-0 mb-2 w-full flex justify-center">
          <div data-tour="time.live-badge" className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
            <span className="font-mbc text-xs text-emerald-200/90">
              {liveGroupId
                ? `GROUP ${liveGroupId} 송출 중${isSpecialActive ? " · 특별(P) 모드" : ""}`
                : "송출 중인 시보 없음"}
            </span>
          </div>
        </div>
        <div data-tour="time.group-tabs" className="flex-shrink-0 mb-6 w-full flex justify-center">
          <GroupTab
            groups={groups}
            activeGroupId={activeGroup.id}
            onSelect={selectGroup}
          />
        </div>

        <div className="flex flex-1 gap-[40px] min-h-0 relative max-w-[1500px] mx-auto w-full">
          <div className="flex flex-col w-[600px] h-full flex-shrink-0">
            <div data-tour="time.days" className="mb-[24px]">
              <DaySelector
                days={DAYS}
                activeDay={activeDay}
                onSelect={selectDay}
              />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
              <div data-tour="time.bells" className="grid grid-cols-2 gap-x-[16px] gap-y-[10px] w-full">
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

          <div className="flex flex-col flex-1 h-full min-h-0">
            <div className="flex-1 overflow-y-auto min-h-0 mb-4">
              {editingBellId !== null ? (
                <BellEditor
                  bell={editingBell}
                  speakers={speakers}
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
                {/* 특별(P) 모드 — 보고 있는 탭과 상관없이 송출 중인 그룹에 켜고 끈다 */}
                <Button
                  tour="time.special"
                  label={`특별(P) 모드 ${isSpecialActive ? "ON" : "OFF"}`}
                  onClick={() => setSpecialMode(!isSpecialActive)}
                  disabled={liveGroupId == null}
                  color={isSpecialActive ? "#c4b5fd" : "white"}
                  glowSize={isSpecialActive ? "18px" : "8px"}
                  className="h-[64px]"
                />
                <Button
                  tour="time.add"
                  label="시보 추가"
                  onClick={handleCreateNew}
                  color={isAddingNew ? "red" : "white"}
                  className="h-[64px]"
                />
                <Button
                  tour="time.send"
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
