import { create } from "zustand";
import type { ChatTour } from "@/types/chat";
import { useChatPanel } from "@/stores/chatStore";

/** CUE 화면 튜토리얼 — 지금 보여 주는 단계. 시작하면 CUE 창을 접고, 끝나면 열려 있던 그대로 돌려 놓는다 */
interface TourStore {
  tour: ChatTour | null;
  index: number;
  chatWasOpen: boolean;
  start: (tour: ChatTour) => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
}

export const useTour = create<TourStore>((set, get) => ({
  tour: null,
  index: 0,
  chatWasOpen: false,
  start: (tour) => {
    if (!tour.steps.length) return;
    const chat = useChatPanel.getState();
    set({ tour, index: 0, chatWasOpen: get().tour ? get().chatWasOpen : chat.open });
    if (chat.open) chat.setOpen(false);
  },
  next: () => {
    const { tour, index } = get();
    if (!tour) return;
    if (index + 1 >= tour.steps.length) get().stop();
    else set({ index: index + 1 });
  },
  prev: () => set((s) => ({ index: Math.max(0, s.index - 1) })),
  stop: () => {
    const reopen = get().chatWasOpen;
    set({ tour: null, index: 0, chatWasOpen: false });
    if (reopen) useChatPanel.getState().setOpen(true);
  },
}));
