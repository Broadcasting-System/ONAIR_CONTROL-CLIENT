import { create } from "zustand";

export const MAX_CHANNELS = 5;

interface ChannelStore {
  /** 현재 컨트롤이 조작 중인 송출 채널 (1..MAX_CHANNELS). */
  channel: number;
  setChannel: (channel: number) => void;
}

export const useChannelStore = create<ChannelStore>((set) => ({
  channel: 1,
  setChannel: (channel) =>
    set({ channel: Math.min(MAX_CHANNELS, Math.max(1, Math.floor(channel))) }),
}));
