import { useState, useCallback, useEffect } from "react";
import { Group, DayType, Bell, DaySchedule } from "@/types/time";
import { useBellClipboard } from "./useBellClipboard";
import { getApiBase } from "@/lib/apiBase";
import { toast } from "@/components/common/Toast";

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

/** 서버 오류 사유를 사람이 읽을 문장으로 (FastAPI 검증 오류 목록 포함) */
async function errorText(res: Response): Promise<string> {
  try {
    const detail = (await res.json())?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail))
      return detail
        .map((d) => String(d?.msg ?? "").replace(/^Value error, /, ""))
        .filter(Boolean)
        .join("\n");
  } catch {
    /* 본문 없음 */
  }
  return "";
}

export const useTimeGroups = () => {
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [activeGroupId, setActiveGroupId] = useState<number>(1);
  const [activeDay, setActiveDay] = useState<DayType>("M");
  // 그룹별 특별(P) 모드 활성 여부 (서버 isSpecialActive)
  const [specialActive, setSpecialActive] = useState<Record<number, boolean>>({});

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

  /** 서버 시간표로 화면을 맞춘다. sync 를 주면 방금 보낸 그룹·요일만 맞춘다 —
   *  다른 그룹이나 P 탭에서 편집 중이던(아직 안 보낸) 내용이 서버 값으로 덮이지 않게. */
  const fetchTimeTable = useCallback(async (sync?: { group: number; days: string[] }) => {
    try {
      const BASE = getApiBase();
      const endpoint = `${BASE}/time`;
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        const serverData = json.data;
        // 그룹별 특별모드 플래그 동기화
        setSpecialActive((prev) => {
          if (sync) return { ...prev, [sync.group]: !!serverData[sync.group]?.isSpecialActive };
          const map: Record<number, boolean> = {};
          for (const key of Object.keys(serverData)) {
            map[Number(key)] = !!serverData[key]?.isSpecialActive;
          }
          return map;
        });
        setGroups((prev) =>
          prev.map((g) => {
            if (sync && g.id !== sync.group) return g;
            const groupData = serverData[g.id];
            if (!groupData || !groupData.schedules) return g;

            // 서버에 저장된 요일 스케줄로 교체 (sync 면 보낸 요일만)
            const serverSchedules: DaySchedule[] = groupData.schedules;
            return {
              ...g,
              days: g.days.map((d) => {
                if (sync && !sync.days.includes(d.dayType)) return d;
                const found = serverSchedules.find((s) => s.dayType === d.dayType);
                return found ? found : d;
              }),
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

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await errorText(res);
        toast.error("시보 전송에 실패했습니다." + (msg ? `\n${msg.slice(0, 200)}` : ""));
        return;
      }

      fetchTimeTable({ group: activeGroupId, days: payload.schedule.map((d) => d.dayType) });
      // 전송 = 이 그룹이 지금부터 울리는 그룹이 된다 (P 탭이면 특별 모드도 켜짐) — 그대로 알려준다
      toast.success(
        activeDay === "P"
          ? `GROUP ${activeGroupId} 특별(P) 시보를 적용했습니다 — 지금부터 매일 P 시보가 울립니다.`
          : `GROUP ${activeGroupId} 평일 시보를 적용했습니다 — 지금부터 이 그룹이 울립니다.`,
      );
    } catch (err: unknown) {
      console.error(err);
      toast.error("시보 전송 중 오류가 발생했습니다.");
    }
  }, [activeGroupId, activeDay, activeGroup.days, fetchTimeTable]);

  /** 특별(P) 모드 ON/OFF를 서버에 전송. ON이면 P 스케줄이 매일 동작(평일 억제). */
  const setSpecialMode = useCallback(
    async (active: boolean) => {
      // 낙관적 반영
      setSpecialActive((prev) => ({ ...prev, [activeGroupId]: active }));
      try {
        const res = await fetch(`${getApiBase()}/time/special`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId: activeGroupId, active }),
        });
        if (!res.ok) throw new Error(await errorText(res));
        toast.success(
          active
            ? `특별(P) 모드 ON — GROUP ${activeGroupId}이(가) 지금 울리는 그룹이 되고, P 시보가 매일 동작합니다.`
            : `특별(P) 모드 OFF — GROUP ${activeGroupId}이(가) 지금 울리는 그룹이 되고, 평일 시보로 복귀합니다.`,
        );
      } catch (err) {
        // 롤백
        setSpecialActive((prev) => ({ ...prev, [activeGroupId]: !active }));
        console.error(err);
        toast.error("특별(P) 모드 전환에 실패했습니다.");
      }
    },
    [activeGroupId],
  );

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
    isSpecialActive: !!specialActive[activeGroupId],
    setSpecialMode,
  };
};
