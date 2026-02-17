export interface ScheduleItem {
  id: string;
  title: string;
  scheduledTime: string;
  type: "BROADCAST" | "ALARM" | "ANNOUNCEMENT";
  active: boolean;
}
