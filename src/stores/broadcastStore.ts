import { create } from "zustand";
import { BroadcastState } from "@/types/broadcast";

interface BroadcastStore extends BroadcastState {
  setBroadcast: (state: Partial<BroadcastState>) => void;
}

export const useBroadcastStore = create<BroadcastStore>((set) => ({
  status: "IDLE",
  setBroadcast: (newState) => set((state) => ({ ...state, ...newState })),
}));
