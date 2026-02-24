import { useState, useCallback } from "react";
import { Group, DayType, Bell } from "@/types/time";
import { useBellClipboard } from "./useBellClipboard";

const INITIAL_GROUPS: Group[] = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1,
  name: `GROUP ${i + 1}`,
  days: [
    { dayType: "M", bells: [] },
    { dayType: "T", bells: [] },
    { dayType: "W", bells: [] },
    { dayType: "TH", bells: [] },
    { dayType: "F", bells: [] },
    { dayType: "P", bells: [] },
  ],
}));

export const useTimeGroups = () => {
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [activeGroupId, setActiveGroupId] = useState<number>(1);
  const [activeDay, setActiveDay] = useState<DayType>("M");

  const { clipboard, copy, paste } = useBellClipboard();

  const activeGroup = groups.find((g) => g.id === activeGroupId) || groups[0];
  const activeDaySchedule = activeGroup.days.find((d) => d.dayType === activeDay);
  const bells = activeDaySchedule?.bells || [];

  const selectGroup = useCallback((id: number) => {
    setActiveGroupId(id);
  }, []);

  const selectDay = useCallback((day: DayType) => {
    setActiveDay(day);
  }, []);

  const addBell = useCallback(
    (bell: Bell) => {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== activeGroupId) return g;
          return {
            ...g,
            days: g.days.map((d) => {
              if (d.dayType !== activeDay) return d;
              return { ...d, bells: [...d.bells, bell] };
            }),
          };
        })
      );
    },
    [activeGroupId, activeDay]
  );

  const updateBell = useCallback(
    (id: string, updatedBell: Bell) => {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== activeGroupId) return g;
          return {
            ...g,
            days: g.days.map((d) => {
              if (d.dayType !== activeDay) return d;
              return {
                ...d,
                bells: d.bells.map((b) => (b.id === id ? updatedBell : b)),
              };
            }),
          };
        })
      );
    },
    [activeGroupId, activeDay]
  );

  const deleteBell = useCallback(
    (id: string) => {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== activeGroupId) return g;
          return {
            ...g,
            days: g.days.map((d) => {
              if (d.dayType !== activeDay) return d;
              return { ...d, bells: d.bells.filter((b) => b.id !== id) };
            }),
          };
        })
      );
    },
    [activeGroupId, activeDay]
  );

  const replaceBells = useCallback(
    (newBells: Bell[]) => {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== activeGroupId) return g;
          return {
            ...g,
            days: g.days.map((d) => {
              if (d.dayType !== activeDay) return d;
              return { ...d, bells: newBells };
            }),
          };
        })
      );
    },
    [activeGroupId, activeDay]
  );

  const copyBells = useCallback(() => {
    copy(bells);
  }, [bells, copy]);

  const pasteBells = useCallback(() => {
    const newBells = paste();
    if (newBells) {
      replaceBells(newBells);
    }
  }, [paste, replaceBells]);

  const resetBells = useCallback(() => {
    replaceBells([]);
  }, [replaceBells]);

  const sendTimeTable = useCallback(async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
      const endpoint = baseUrl.endsWith("/api") ? `${baseUrl}/time` : `${baseUrl}/api/time`;

      const payload = {
        groupId: activeGroupId,
        isSpecialOnly: activeDay === "P",
        schedule: activeDay === "P"
          ? activeGroup.days.filter((d) => d.dayType === "P")
          : activeGroup.days.filter((d) => d.dayType !== "P")
      };

      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      console.error(err);
    }
  }, [activeGroupId, activeDay, activeGroup.days]);

  return {
    groups,
    activeGroup,
    activeDay,
    bells,
    hasCopiedData: clipboard !== null && clipboard.length > 0,
    selectGroup,
    selectDay,
    addBell,
    updateBell,
    deleteBell,
    copyBells,
    pasteBells,
    resetBells,
    sendTimeTable,
  };
};
