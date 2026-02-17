export type BroadcastStatus = "IDLE" | "ON_AIR" | "PAUSED";

export interface BroadcastState {
  status: BroadcastStatus;
  title?: string;
  startTime?: string;
  channelId?: string;
}
