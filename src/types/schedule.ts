export interface ScheduleItem {
  id: string;
  title: string;
  scheduledTime: string;
  day?: string;
  type: "BROADCAST" | "ALARM" | "ANNOUNCEMENT";
  active: boolean;
}
