import { create } from "zustand";
import { SpeakerState } from "@/types/speaker";

interface SpeakerStore extends SpeakerState {
  updateZone: (id: string, active: boolean) => void;
  setMasterUnknown: (unknown: boolean) => void;
}

export const useSpeakerStore = create<SpeakerStore>((set) => ({
  zones: [],
  masterUnknown: false,
  updateZone: (id, active) =>
    set((state) => ({
      zones: state.zones.map((z) => (z.id === id ? { ...z, active } : z)),
    })),
  setMasterUnknown: (masterUnknown) => set({ masterUnknown }),
}));
