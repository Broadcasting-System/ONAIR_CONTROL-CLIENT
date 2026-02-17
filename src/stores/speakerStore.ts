import { create } from "zustand";
import { SpeakerState, SpeakerZone } from "@/types/speaker";

interface SpeakerStore extends SpeakerState {
  setZones: (zones: SpeakerZone[]) => void;
  updateZoneStatus: (id: string, status: "on" | "off" | "error") => void;
  setMasterUnknown: (unknown: boolean) => void;
}

export const useSpeakerStore = create<SpeakerStore>((set) => ({
  zones: [],
  masterUnknown: false,
  setZones: (zones) => set({ zones }),
  updateZoneStatus: (id, status) =>
    set((state) => ({
      zones: state.zones.map((z) => (z.id === id ? { ...z, status } : z)),
    })),
  setMasterUnknown: (masterUnknown) => set({ masterUnknown }),
}));
