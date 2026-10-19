"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";

import GroupPicker, { type GroupPickerItem } from "@/components/time/GroupPicker";
import LiveBellStatus from "@/components/time/LiveBellStatus";
import DaySelector from "@/components/time/DaySelector";
import BellTimeline from "@/components/time/BellTimeline";
import BellEditor from "@/components/time/BellEditor";
import { ApplyButtons, CopyDaysButton, MoreMenu, TimeConfirm } from "@/components/time/TimeToolbar";
import { buildSections, samePair, sortBells, upcomingBells } from "@/components/time/bellUtils";
import SchedulerPanel from "@/components/time/SchedulerPanel";
import EnergyPanel from "@/components/time/EnergyPanel";
import PageTabs from "@/components/common/PageTabs";
import SectionHeader from "@/components/common/SectionHeader";
import { toast } from "@/components/common/Toast";
import { groupLabel, useTimeGroups } from "@/hooks/useTimeGroups";
import { useFiles } from "@/hooks/useFiles";
import { useSpeakerMatrix } from "@/hooks/useSpeakerMatrix";
import { useMe } from "@/hooks/useMe";
import { useTabParam } from "@/hooks/useTabParam";
import { useIsMobile } from "@/hooks/useIsMobile";
import { DAYS, DAY_LABEL, WEEKDAYS, dayTypeOf } from "@/constants/days";
import { Bell, AudioFile, DayType } from "@/types/time";
import { TOUR_CLOSE_EVENT } from "@/stores/tourStore";
import { cn } from "@/lib/utils";

const TIME_TAB_KEYS = ["table", "schedule", "energy"] as const;
const TIME_TABS = [
  { key: "table" as const, label: "시간표" },
  { key: "schedule" as const, label: "예약 현황" },
  { key: "energy" as const, label: "야간 절전" },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** 지금 시각 — 분이 바뀔 때마다 (서버 렌더와 어긋나지 않게 처음엔 null) */
function useMinuteNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      t = setTimeout(tick, 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 30);
    };
    tick();
    return () => clearTimeout(t);
  }, []);
  return now;
}

function SpecialSwitch({ on, disabled, onToggle, className }: { on: boolean; disabled: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-tour="time.special"
      disabled={disabled}
      onClick={onToggle}
      title={disabled ? "울리는 그룹이 없어요" : undefined}
      className={cn(
        "flex h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[11px] border px-3 font-mbc text-[14px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 md:h-10",
        on ? "border-[#FF3B3B]/45 bg-[#FF3B3B]/10 text-white" : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white",
        className,
      )}
    >
      특별 시간표로 울리기
      <span className={cn("relative h-5 w-[34px] shrink-0 rounded-full transition-colors", on ? "bg-[#FF3B3B]" : "bg-white/15")}>
        <i
          className={cn(
            "absolute top-[3px] h-[14px] w-[14px] rounded-full transition-all",
            on ? "left-[17px] bg-white" : "left-[3px] bg-white/70",
          )}
        />
      </span>
    </button>
  );
}

export default function TimePage() {
  const {
    groups,
    activeGroup,
    activeDay,
    bells,
    diffs,
    hasCopiedData,
    selectGroup,
    selectDay,
    saveBell,
    deleteBell,
    copyToDays,
    copyBells,
    pasteBells,
    resetBells,
    sendTimeTable,
    renameGroup,
    liveGroupId,
    liveGroup,
    liveName,
    isSpecialActive,
    setSpecialMode,
    loaded,
  } = useTimeGroups();

  const { files, fetchFiles } = useFiles();
  const { isAdmin, isSuperadmin } = useMe();
  const { names: speakerNames } = useSpeakerMatrix();
  const sections = useMemo(() => buildSections(speakerNames), [speakerNames]);
  const [tab, setTab] = useTabParam(TIME_TAB_KEYS, "table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [liveConfirm, setLiveConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const isMobile = useIsMobile();
  const now = useMinuteNow();

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const audioFiles: AudioFile[] = (files.audio || []).map((file) => ({
    id: file.id,
    name: file.fileName,
    url: file.fileUrl,
  }));

  const today = now ? dayTypeOf(now) : null;
  const isLive = liveGroupId === activeGroup.id;
  // 지금 시각 선: 오늘 요일을 볼 때, 또는 특별 시간표로 울리는 그룹의 특별 탭을 볼 때
  const isTodayView = !!now && (activeDay === today || (activeDay === "P" && isLive && isSpecialActive));
  const nowHM = isTodayView && now ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : null;

  const sorted = useMemo(() => sortBells(bells), [bells]);
  // PC 는 고른 시보가 없으면 다음 시보(오늘이 아니면 첫 시보)를 편집 패널에 띄운다
  const fallbackId = isMobile ? null : ((nowHM && sorted.find((b) => b.time > nowHM)) || sorted[0])?.id ?? null;
  const currentId = selectedId ?? fallbackId;
  const isAddingNew = currentId === "new";
  const editingBell = currentId && !isAddingNew ? bells.find((b) => b.id === currentId) || null : null;

  // 지운 시보를 고르고 있었다면 풀기
  useEffect(() => {
    if (selectedId && selectedId !== "new" && !bells.some((b) => b.id === selectedId)) setSelectedId(null);
  }, [selectedId, bells]);

  useEffect(() => {
    setSelectedId(null);
  }, [activeGroup.id, activeDay]);

  // CUE 튜토리얼이 자기가 연 창을 끝에 정리할 때
  useEffect(() => {
    const close = () => setSelectedId(null);
    window.addEventListener(TOUR_CLOSE_EVENT, close);
    return () => window.removeEventListener(TOUR_CLOSE_EVENT, close);
  }, []);

  const dayBells = (d: DayType) => activeGroup.days.find((x) => x.dayType === d)?.bells ?? [];
  const dayCounts = Object.fromEntries(DAYS.map((d) => [d.value, dayBells(d.value).length])) as Record<DayType, number>;

  // 울리는 요일: 같은 이름·시간 시보가 있는 평일들 (특별 탭이면 숨김)
  const initialDays: DayType[] | null =
    activeDay === "P"
      ? null
      : editingBell
        ? WEEKDAYS.filter((w) => w === activeDay || dayBells(w).some((b) => samePair(b, editingBell)))
        : [activeDay];

  const diff = diffs.get(activeGroup.id);
  const unsent = diff?.count ?? 0;
  const changed = diff?.changed.get(activeDay) ?? new Set<string>();

  const pickerGroups: GroupPickerItem[] = groups.map((g) => ({
    id: g.id,
    name: g.name || null,
    weekdayCount: g.days.filter((d) => d.dayType !== "P").reduce((n, d) => n + d.bells.length, 0),
    specialCount: g.days.find((d) => d.dayType === "P")?.bells.length ?? 0,
    unsent: diffs.get(g.id)?.count ?? 0,
  }));

  const upcoming = useMemo(
    () => (liveGroup && now ? upcomingBells(liveGroup.days, isSpecialActive, now) : null),
    [liveGroup, isSpecialActive, now],
  );

  const handleSave = (bell: Bell, days: DayType[] | null) => {
    saveBell(bell, editingBell, days);
    // 폰은 창을 닫고, PC 는 저장한 시보를 계속 고르고 있는다 (이 요일을 끈 경우만 풀기)
    if (isMobile || (days && !days.includes(activeDay))) setSelectedId(null);
    else setSelectedId(editingBell?.id ?? bell.id);
  };

  const handleDelete = () => {
    if (editingBell) deleteBell(editingBell.id);
    setSelectedId(null);
  };

  const apply = async (activate: boolean) => {
    setBusy(true);
    try {
      await sendTimeTable(activate);
    } finally {
      setBusy(false);
    }
  };
  const onApply = (activate: boolean) => (activate && !isLive ? setLiveConfirm(true) : void apply(activate));

  const editorKey = `${activeGroup.id}-${activeDay}-${currentId}`;
  const editor =
    currentId !== null && (isAddingNew || editingBell) ? (
      <BellEditor
        key={editorKey}
        bell={editingBell}
        sections={sections}
        testSpeaker={isSuperadmin}
        audioFiles={audioFiles}
        initialDays={initialDays}
        onSave={handleSave}
        onDelete={editingBell ? handleDelete : undefined}
        className="md:h-full"
      />
    ) : null;

  const thisName = groupLabel(activeGroup);

  return (
    <div className="flex w-full flex-col max-md:pb-16 md:h-[calc(100dvh-80px)] md:min-h-[620px]">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <SectionHeader className="mb-0">시보</SectionHeader>
        {isAdmin && (
          <PageTabs
            tour="time.tab"
            tabs={TIME_TABS}
            value={tab}
            onChange={setTab}
            className="rounded-xl [&>button]:rounded-[9px] [&>button]:px-[15px] [&>button]:py-3 md:[&>button]:py-[7px]"
          />
        )}
        {tab === "table" && (
          <LiveBellStatus
            liveName={liveName}
            next={upcoming?.next ?? null}
            after={upcoming?.after ?? null}
            prevAt={upcoming?.prevAt ?? null}
            special={isSpecialActive}
            className="w-full md:ml-auto md:w-auto"
          />
        )}
      </header>

      {isAdmin && tab === "schedule" ? (
        <div className="mt-6 flex min-h-0 flex-1 flex-col">
          <SchedulerPanel />
        </div>
      ) : isAdmin && tab === "energy" ? (
        <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto">
          <EnergyPanel />
        </div>
      ) : (
        <GroupPicker
          className="mt-4 flex-1 md:mt-5"
          groups={pickerGroups}
          activeId={activeGroup.id}
          liveId={liveGroupId}
          onSelect={selectGroup}
          onRename={renameGroup}
          right={
            <SpecialSwitch
              on={isSpecialActive}
              disabled={liveGroupId == null}
              onToggle={() => setSpecialMode(!isSpecialActive)}
              className="mb-1.5 max-md:hidden"
            />
          }
        >
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
            <DaySelector days={DAYS} activeDay={activeDay} today={today} onSelect={selectDay} className="w-full md:w-auto" />
            <div className="flex items-center gap-2 md:ml-auto">
              <SpecialSwitch
                on={isSpecialActive}
                disabled={liveGroupId == null}
                onToggle={() => setSpecialMode(!isSpecialActive)}
                className="min-w-0 flex-1 justify-between md:hidden"
              />
              <CopyDaysButton activeDay={activeDay} counts={dayCounts} onCopy={copyToDays} />
              <MoreMenu
                canCopy={bells.length > 0}
                canPaste={hasCopiedData}
                onCopy={() => {
                  copyBells();
                  toast.success(`${DAY_LABEL[activeDay]} 시보 ${bells.length}개를 복사해 뒀어요`);
                }}
                onPaste={pasteBells}
                onReset={() => setResetOpen(true)}
              />
              <ApplyButtons isLive={isLive} count={unsent} busy={busy || !loaded} onApply={onApply} className="max-md:hidden" />
            </div>
          </div>

          <div className="mt-3 grid min-h-0 flex-1 gap-4 md:mt-3.5 md:grid-cols-[minmax(0,470px)_minmax(0,1fr)]">
            <BellTimeline
              bells={bells}
              selectedId={currentId}
              changed={changed}
              sections={sections}
              nowHM={nowHM}
              scrollKey={`${activeGroup.id}-${activeDay}-${isTodayView}`}
              adding={isAddingNew}
              onSelect={setSelectedId}
              onAdd={() => setSelectedId("new")}
              className="max-md:min-h-[320px]"
            />
            <div className="hidden min-h-0 flex-col rounded-[20px] border border-white/[0.08] bg-[rgba(8,8,10,0.55)] px-[22px] py-[18px] md:flex">
              {!isMobile && editor ? (
                editor
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center font-pretendard">
                  <p className="text-[15px] text-white/45">{bells.length ? "고른 시보가 없어요" : "이 요일은 시보가 없어요"}</p>
                </div>
              )}
            </div>
          </div>
        </GroupPicker>
      )}

      {/* 폰: 적용하기는 하단 탭 위에 붙는 막대 */}
      {tab === "table" && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-white/[0.08] bg-[rgba(12,12,14,0.9)] px-4 py-2.5 backdrop-blur-xl md:hidden">
          <ApplyButtons isLive={isLive} count={unsent} busy={busy || !loaded} onApply={onApply} className="w-full" />
        </div>
      )}

      {isMobile &&
        editor &&
        createPortal(
          <div data-tour-layer className="fixed inset-0 z-[70] flex flex-col bg-[#0b0b0d] md:hidden">
            <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.08] px-2 pb-2 pt-[calc(8px+env(safe-area-inset-top))]">
              <button
                type="button"
                data-tour-close
                aria-label="닫기"
                onClick={() => setSelectedId(null)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white/80 active:bg-white/10"
              >
                <ChevronLeft size={26} />
              </button>
              <h2 className="min-w-0 flex-1 truncate font-mbc text-[18px] text-white/70">
                {thisName} · {DAY_LABEL[activeDay]}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">{editor}</div>
          </div>,
          document.body,
        )}

      <TimeConfirm
        open={resetOpen}
        title="이 요일 비우기"
        message={`${thisName} ${DAY_LABEL[activeDay]} 시보 ${bells.length}개를 모두 지워요. 적용하기를 눌러야 서버에도 반영돼요.`}
        confirmText="비우기"
        danger
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          resetBells();
          setSelectedId(null);
        }}
      />
      <TimeConfirm
        open={liveConfirm}
        title="이 시간표로 울릴까요?"
        message={
          (liveName ? `지금 울리는 ${liveName} 대신 ${thisName} 시간표로 울려요.` : `${thisName} 시간표로 울려요.`) +
          (isSpecialActive && liveName ? "\n특별 시간표로 울리기는 꺼져요." : "")
        }
        confirmText="울리기"
        onClose={() => setLiveConfirm(false)}
        onConfirm={() => void apply(true)}
      />
    </div>
  );
}
