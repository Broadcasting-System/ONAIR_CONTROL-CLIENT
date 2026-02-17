import { create } from "zustand";
import { ScheduleItem } from "@/types/schedule";

interface ScheduleStore {
  schedules: ScheduleItem[];
  setSchedules: (schedules: ScheduleItem[]) => void;
}

export const useScheduleStore = create<ScheduleStore>((set) => ({
  schedules: [],
  setSchedules: (schedules) => set({ schedules }),
}));
