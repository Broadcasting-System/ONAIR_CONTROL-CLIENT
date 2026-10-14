import { create } from "zustand";
import type { ChatTour } from "@/types/chat";
import { useChatPanel } from "@/stores/chatStore";

/** 튜토리얼이 화면에 '열어 둔 편집 창을 닫아 줘'라고 알리는 이벤트 — 닫혀 있을 때만 보이는 것을 찾을 때, 끝날 때 */
export const TOUR_CLOSE_EVENT = "onair:tour-close";

/** CUE 화면 튜토리얼 — 지금 보여 주는 단계. 시작하면 CUE 창을 접고, 끝나면 열려 있던 그대로 돌려 놓는다
 *  (폰은 CUE 가 하단 탭 화면(/cue)이라, CUE 탭에서 시작했으면 끝날 때 그 탭으로 돌아간다 — returnTo 를 TourOverlay 가 옮김) */
interface TourStore {
  tour: ChatTour | null;
  index: number;
  chatWasOpen: boolean;
  startedOnCueTab: boolean;
  returnTo: string | null;
  clearReturn: () => void;
  start: (tour: ChatTour) => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
}

export const useTour = create<TourStore>((set, get) => ({
  tour: null,
  index: 0,
  chatWasOpen: false,
  startedOnCueTab: false,
  returnTo: null,
  clearReturn: () => set({ returnTo: null }),
  start: (tour) => {
    if (!tour.steps.length) return;
    const chat = useChatPanel.getState();
    const onCueTab =
      typeof window !== "undefined" &&
      window.location.pathname === "/cue" &&
      window.matchMedia("(max-width: 767px)").matches;
    set({
      tour,
      index: 0,
      chatWasOpen: get().tour ? get().chatWasOpen : chat.open,
      startedOnCueTab: get().tour ? get().startedOnCueTab : onCueTab,
      returnTo: null,
    });
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
    const cue = get().startedOnCueTab;
    set({ tour: null, index: 0, chatWasOpen: false, startedOnCueTab: false, returnTo: cue ? "/cue" : null });
    if (reopen) useChatPanel.getState().setOpen(true);
  },
}));
