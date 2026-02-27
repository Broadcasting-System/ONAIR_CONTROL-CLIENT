import { useState, useCallback, useEffect } from "react";
import { Group, DayType, Bell, DaySchedule } from "@/types/time";
import { useBellClipboard } from "./useBellClipboard";
import { getApiBase } from "@/lib/apiBase";

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
    const currentBells = activeGroup.days.find((d) => d.dayType === activeDay)?.bells || [];
    copy(currentBells);
  }, [activeGroup.days, activeDay, copy]);

  const pasteBells = useCallback(() => {
    const newBells = paste();
    if (newBells) {
      replaceBells(newBells);
    }
  }, [paste, replaceBells]);

  const resetBells = useCallback(() => {
    replaceBells([]);
  }, [replaceBells]);

  const fetchTimeTable = useCallback(async () => {
    try {
      const BASE = getApiBase();
      const endpoint = `${BASE}/time`;
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        const serverData = json.data;
        setGroups((prev) =>
          prev.map((g) => {
            const groupData = serverData[g.id];
            if (!groupData || !groupData.schedules) return g;

            // Override days with what's in the server's schedules array for this group
            const serverSchedules: DaySchedule[] = groupData.schedules;
            return {
              ...g,
              days: g.days.map(d => {
                const found = serverSchedules.find(s => s.dayType === d.dayType);
                return found ? found : d;
              })
            };
          })
        );
      }
    } catch (err: unknown) {
      console.error("Failed to load timetable", err);
    }
  }, []);

  useEffect(() => {
    fetchTimeTable();
  }, [fetchTimeTable]);

  const sendTimeTable = useCallback(async () => {
    try {
      const BASE = getApiBase();
      const endpoint = `${BASE}/time`;

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

      // On success, refresh the whole timetable to stay in sync
      fetchTimeTable();
    } catch (err: unknown) {
      console.error(err);
    }
  }, [activeGroupId, activeDay, activeGroup.days, fetchTimeTable]);

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
