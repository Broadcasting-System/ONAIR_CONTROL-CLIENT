import { useState } from "react";
import { ScheduleItem } from "@/types/schedule";

const MOCK_SCHEDULES: ScheduleItem[] = [
  {
    id: "1",
    title: "영어 듣기 평가",
    scheduledTime: "2020.04.03",
    day: "수 목요일",
    type: "BROADCAST",
    active: true,
  },
  {
    id: "2",
    title: "학교폭력예방 교육 영상",
    scheduledTime: "2020.04.03",
    day: "수 목요일",
    type: "BROADCAST",
    active: false,
  },
  {
    id: "3",
    title: "학예제",
    scheduledTime: "2020.04.03",
    day: "금요일",
    type: "BROADCAST",
    active: false,
  },
];

export function useSchedule() {
  const [schedules] = useState<ScheduleItem[]>(MOCK_SCHEDULES);

  return { schedules };
}
