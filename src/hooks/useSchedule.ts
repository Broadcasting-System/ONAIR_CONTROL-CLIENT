import { useState } from "react";
import { ScheduleItem } from "@/types/schedule";

export function useSchedule() {
  const [schedules] = useState<ScheduleItem[]>([]);

  return { schedules };
}
