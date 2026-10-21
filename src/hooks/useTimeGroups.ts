import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Group, DayType, Bell, DaySchedule } from "@/types/time";
import { useBellClipboard } from "./useBellClipboard";
import { getApiBase } from "@/lib/apiBase";
import { toast } from "@/components/common/Toast";
import { DAYS, WEEKDAYS, dayTypeOf } from "@/constants/days";
import { diffDay, samePair } from "@/components/time/bellUtils";
import { useQueryClient } from "@tanstack/react-query";
import type { DeviceSyncResult } from "@/constants/deviceBell";
import { DEVICE_BELL_KEY } from "./useDeviceBell";

const DAY_ORDER: DayType[] = DAYS.map((d) => d.value);
const emptyDays = (): DaySchedule[] => DAY_ORDER.map((dayType) => ({ dayType, bells: [] }));

/** name 은 서버가 준 이름(없으면 ""). 화면에는 groupLabel 로 보인다. */
const INITIAL_GROUPS: Group[] = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: "", days: emptyDays() }));

export const groupLabel = (g: { id: number; name?: string | null }) => g.name?.trim() || `GROUP ${g.id}`;

let seq = 0;
const newId = (tag: string) => `${Date.now().toString(36)}${(seq++).toString(36)}${tag}`;

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

export interface GroupDiff {
  /** 아직 서버에 안 보낸 시보 수 (고침·추가·지움) */
  count: number;
  /** 바뀐 요일 */
  days: Set<DayType>;
  /** 요일별 '바뀜' 줄 id */
  changed: Map<DayType, Set<string>>;
}

export const useTimeGroups = () => {
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  // 서버 시간표를 한 번이라도 받기 전에는 보내지 않는다 (빈 시간표로 덮어쓰지 않게)
  const [loaded, setLoaded] = useState(false);
  // 서버에서 마지막으로 받은 시간표 — 안 보낸 변경을 세고, 재조회가 편집 중인 요일을 덮지 않게 비교한다
  const [server, setServer] = useState<Group[]>(INITIAL_GROUPS);
  const serverRef = useRef<Group[]>(INITIAL_GROUPS);
  const [activeGroupId, setActiveGroupId] = useState<number>(1);
  const [activeDay, setActiveDay] = useState<DayType>("M");
  // 지금 울리는 그룹과 특별(P) 모드 — 특별 모드는 송출 중인 그룹에 하나뿐인 스위치
  const [live, setLive] = useState<{ groupId: number | null; special: boolean; name: string | null }>({
    groupId: null,
    special: false,
    name: null,
  });
  const pickedLiveTab = useRef(false);
  const qc = useQueryClient();

  // 처음엔 오늘 요일 (주말이면 월)
  useEffect(() => {
    const today = dayTypeOf(new Date());
    if (today) setActiveDay(today);
  }, []);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/time/active`);
      if (!res.ok) return;
      const j = await res.json();
      const groupId = j.activeGroupId != null ? Number(j.activeGroupId) : null;
      const name = typeof j.name === "string" && j.name.trim() ? j.name.trim() : null;
      setLive({ groupId, special: !!j.special, name });
      // 화면을 처음 열면 송출 중인 그룹 탭부터
      if (!pickedLiveTab.current) {
        pickedLiveTab.current = true;
        if (groupId) setActiveGroupId(groupId);
      }
    } catch {
      /* 다음 주기에 다시 */
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, 4000);
    return () => clearInterval(id);
  }, [fetchLive]);

  const { clipboard, copy, paste } = useBellClipboard();

  const activeGroup = groups.find((g) => g.id === activeGroupId) || groups[0];
  const bells = useMemo(
    () => activeGroup.days.find((d) => d.dayType === activeDay)?.bells ?? [],
    [activeGroup, activeDay],
  );

  const selectGroup = useCallback((id: number) => setActiveGroupId(id), []);
  const selectDay = useCallback((day: DayType) => setActiveDay(day), []);

  /** 보고 있는 그룹의 요일들을 고친다 */
  const mutateDays = useCallback(
    (fn: (days: DaySchedule[]) => DaySchedule[]) => {
      setGroups((prev) => prev.map((g) => (g.id === activeGroupId ? { ...g, days: fn(g.days) } : g)));
    },
    [activeGroupId],
  );
  const mutateDay = useCallback(
    (fn: (bells: Bell[]) => Bell[]) =>
      mutateDays((days) => days.map((d) => (d.dayType === activeDay ? { ...d, bells: fn(d.bells) } : d))),
    [mutateDays, activeDay],
  );

  const addBell = useCallback((bell: Bell) => mutateDay((b) => [...b, bell]), [mutateDay]);
  const updateBell = useCallback(
    (id: string, bell: Bell) => mutateDay((b) => b.map((x) => (x.id === id ? bell : x))),
    [mutateDay],
  );
  const deleteBell = useCallback((id: string) => mutateDay((b) => b.filter((x) => x.id !== id)), [mutateDay]);
  const replaceBells = useCallback((next: Bell[]) => mutateDay(() => next), [mutateDay]);

  /** 편집 창 저장. days 를 주면(평일) 켜진 요일마다 이 시보를 넣거나 고치고,
   *  꺼진 요일에서는 원래 짝(같은 이름·시간)을 지운다. origin 은 고치기 전 시보(새 시보면 null). */
  const saveBell = useCallback(
    (bell: Bell, origin: Bell | null, days: DayType[] | null) => {
      if (!days || activeDay === "P") {
        if (origin) updateBell(origin.id, bell);
        else addBell(bell);
        return;
      }
      mutateDays((all) =>
        all.map((d) => {
          if (!WEEKDAYS.includes(d.dayType)) return d;
          const list = d.bells;
          const here = d.dayType === activeDay;
          const idx = here
            ? origin
              ? list.findIndex((b) => b.id === origin.id)
              : -1
            : list.findIndex((b) => samePair(b, origin ?? bell));
          if (days.includes(d.dayType)) {
            if (idx >= 0) return { ...d, bells: list.map((b, i) => (i === idx ? { ...bell, id: b.id } : b)) };
            return { ...d, bells: [...list, { ...bell, id: here ? bell.id : newId(d.dayType) }] };
          }
          return idx >= 0 ? { ...d, bells: list.filter((_, i) => i !== idx) } : d;
        }),
      );
    },
    [activeDay, addBell, updateBell, mutateDays],
  );

  /** 지금 요일 시보를 고른 요일들에 덮어쓴다 */
  const copyToDays = useCallback(
    (targets: DayType[]) => {
      mutateDays((all) => {
        const src = all.find((d) => d.dayType === activeDay)?.bells ?? [];
        return all.map((d) =>
          targets.includes(d.dayType) && d.dayType !== activeDay
            ? { ...d, bells: src.map((b) => ({ ...b, id: newId(d.dayType) })) }
            : d,
        );
      });
    },
    [mutateDays, activeDay],
  );

  const copyBells = useCallback(() => copy(bells), [bells, copy]);
  const pasteBells = useCallback(() => {
    const next = paste();
    if (next) replaceBells(next.map((b) => ({ ...b, id: newId(activeDay) })));
  }, [paste, replaceBells, activeDay]);
  const resetBells = useCallback(() => replaceBells([]), [replaceBells]);

  /** 서버 시간표로 화면을 맞춘다. 로컬이 지난번 서버 값 그대로인 요일만 새 값으로 바꾸고,
   *  고쳐 놓고 안 보낸 요일은 둔다. force 로 준 그룹·요일(방금 보낸 것)은 무조건 서버 값으로. */
  const fetchTimeTable = useCallback(async (force?: { group: number; days: DayType[] }) => {
    try {
      const res = await fetch(`${getApiBase()}/time`);
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !json.data) return;
      setLoaded(true);
      const data = json.data as Record<string, { name?: string; schedules?: DaySchedule[] }>;
      const next: Group[] = INITIAL_GROUPS.map((g) => {
        const gd = data[g.id];
        return {
          id: g.id,
          name: typeof gd?.name === "string" ? gd.name.trim() : "",
          days: DAY_ORDER.map((dayType) => ({
            dayType,
            bells: gd?.schedules?.find((s) => s.dayType === dayType)?.bells ?? [],
          })),
        };
      });
      const prevServer = serverRef.current;
      serverRef.current = next;
      setServer(next);
      setGroups((prev) =>
        prev.map((g) => {
          const ns = next.find((x) => x.id === g.id)!;
          const ps = prevServer.find((x) => x.id === g.id)!;
          return {
            ...g,
            name: ns.name,
            days: g.days.map((d) => {
              const nd = ns.days.find((x) => x.dayType === d.dayType)!;
              const pd = ps.days.find((x) => x.dayType === d.dayType)!;
              const forced = force && force.group === g.id && force.days.includes(d.dayType);
              return forced || diffDay(d.bells, pd.bells).count === 0 ? nd : d;
            }),
          };
        }),
      );
    } catch (err: unknown) {
      console.error("Failed to load timetable", err);
    }
  }, []);

  useEffect(() => {
    fetchTimeTable();
    // CUE가 시보를 바꾸면 다시 읽는다
    const onRefresh = () => fetchTimeTable();
    window.addEventListener("onair:refresh", onRefresh);
    return () => window.removeEventListener("onair:refresh", onRefresh);
  }, [fetchTimeTable]);

  /** 그룹마다 안 보낸 변경 */
  const diffs = useMemo(() => {
    const out = new Map<number, GroupDiff>();
    for (const g of groups) {
      const s = server.find((x) => x.id === g.id);
      const diff: GroupDiff = { count: 0, days: new Set(), changed: new Map() };
      for (const d of g.days) {
        const r = diffDay(d.bells, s?.days.find((x) => x.dayType === d.dayType)?.bells ?? []);
        diff.changed.set(d.dayType, r.changed);
        if (r.count) {
          diff.count += r.count;
          diff.days.add(d.dayType);
        }
      }
      out.set(g.id, diff);
    }
    return out;
  }, [groups, server]);

  /** 보고 있는 그룹을 서버로 보낸다. activate 면 이 그룹이 울리는 그룹이 되고, 아니면 저장만 한다.
   *  평일과 특별(P)은 서버가 따로 받아서, 바뀐 쪽만 보낸다. 적용하기면 마지막 장비 전송 결과를 돌려준다. */
  const sendTimeTable = useCallback(
    async (activate: boolean): Promise<DeviceSyncResult | null> => {
      const g = activeGroup;
      const diff = diffs.get(g.id);
      const weekday = WEEKDAYS.some((w) => diff?.days.has(w));
      const special = !!diff?.days.has("P");
      const reqs: boolean[] = [];
      if (weekday) reqs.push(false);
      if (special) reqs.push(true);
      if (reqs.length === 0) {
        if (!activate) return null;
        reqs.push(activeDay === "P");
      }
      const sent: DayType[] = [];
      let device: DeviceSyncResult | null = null;
      try {
        for (const isSpecialOnly of reqs) {
          const schedule = g.days.filter((d) => (d.dayType === "P") === isSpecialOnly);
          const res = await fetch(`${getApiBase()}/time`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groupId: g.id, isSpecialOnly, schedule, activate }),
          });
          if (!res.ok) {
            const msg = await errorText(res);
            toast.error("시보를 보내지 못했어요" + (msg ? `\n${msg.slice(0, 200)}` : ""));
            break;
          }
          sent.push(...schedule.map((d) => d.dayType));
          const j = await res.json().catch(() => null);
          if (j?.device) device = j.device as DeviceSyncResult;
        }
      } catch (err: unknown) {
        console.error(err);
        toast.error("시보를 보내지 못했어요");
      }
      if (sent.length) {
        const name = groupLabel(g);
        toast.success(
          !activate
            ? `${name} 시간표를 저장했어요`
            : live.groupId === g.id
              ? `${name} 시보를 적용했어요`
              : `이제 ${name} 시간표로 울려요`,
        );
      }
      await fetchTimeTable(sent.length ? { group: g.id, days: sent } : undefined);
      fetchLive();
      if (device) qc.invalidateQueries({ queryKey: DEVICE_BELL_KEY });
      return device;
    },
    [activeGroup, activeDay, diffs, fetchTimeTable, fetchLive, live.groupId, qc],
  );

  /** 그룹 이름 바꾸기 (서버에 바로). 빈 이름이면 지운다. */
  const renameGroup = useCallback(
    async (id: number, name: string) => {
      const res = await fetch(`${getApiBase()}/time/groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      }).catch(() => null);
      if (!res || !res.ok) {
        const msg = res ? await errorText(res) : "";
        toast.error(msg || "이름을 바꾸지 못했어요");
        throw new Error(msg || "rename failed");
      }
      const set = (list: Group[]) => list.map((g) => (g.id === id ? { ...g, name: name.trim() } : g));
      serverRef.current = set(serverRef.current);
      setServer(serverRef.current);
      setGroups(set);
      fetchLive();
    },
    [fetchLive],
  );

  /** 송출 중인 그룹의 특별(P) 모드를 켜고 끈다. 송출 그룹은 그대로. ON이면 그 그룹 P 시보가 매일 울린다. */
  const setSpecialMode = useCallback(
    async (active: boolean) => {
      if (live.groupId == null) return;
      try {
        const res = await fetch(`${getApiBase()}/time/special`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        });
        if (!res.ok) {
          const msg = await errorText(res);
          toast.error(msg || "특별 시간표를 바꾸지 못했어요");
          return;
        }
        setLive((prev) => ({ ...prev, special: active }));
        toast.success(active ? "특별 시간표로 울려요" : "평일 시간표로 울려요");
        // 장비 TIMER LINK — 꺼져 있거나 잘 바뀌었으면 조용히, 못 바꿨거나 종 뒤로 미뤘으면 알린다
        const device = ((await res.json().catch(() => null))?.device ?? null) as DeviceSyncResult | null;
        if (device) {
          if (device.status === "failed") toast.error(device.message);
          else if (device.status === "deferred") toast.info(device.message);
          qc.invalidateQueries({ queryKey: DEVICE_BELL_KEY });
        }
      } catch (err) {
        console.error(err);
        toast.error("특별 시간표를 바꾸지 못했어요");
      } finally {
        fetchLive();
      }
    },
    [live.groupId, fetchLive, qc],
  );

  const liveGroup = live.groupId != null ? server.find((g) => g.id === live.groupId) ?? null : null;

  return {
    groups,
    serverGroups: server,
    activeGroup,
    activeDay,
    bells,
    diffs,
    hasCopiedData: clipboard !== null && clipboard.length > 0,
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
    loaded,
    liveGroupId: live.groupId,
    liveGroup,
    liveName: live.groupId != null ? live.name || (liveGroup ? groupLabel(liveGroup) : `GROUP ${live.groupId}`) : null,
    isSpecialActive: live.special,
    setSpecialMode,
  };
};
