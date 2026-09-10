import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const MAX_CHANNELS = 5;

interface ChannelStore {
  /** 현재 컨트롤이 조작 중인 송출 채널 (1..MAX_CHANNELS). */
  channel: number;
  setChannel: (channel: number) => void;
}

const clamp = (channel: number) => Math.min(MAX_CHANNELS, Math.max(1, Math.floor(channel) || 1));

// 새로고침해도 고르던 채널을 유지한다(탭별 sessionStorage) — 조용히 CH1로 돌아가
// 다음 클릭이 엉뚱한 화면에 송출되는 일을 막는다.
// SSR 결과(CH1)와 어긋나지 않도록 skipHydration 후 화면에서 rehydrate() 한다.
export const useChannelStore = create<ChannelStore>()(
  persist(
    (set) => ({
      channel: 1,
      setChannel: (channel) => set({ channel: clamp(channel) }),
    }),
    {
      name: "onair.media.channel",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ channel: s.channel }),
      merge: (persisted, current) => ({
        ...current,
        channel: clamp((persisted as Partial<ChannelStore> | undefined)?.channel ?? current.channel),
      }),
      skipHydration: true,
    },
  ),
);
