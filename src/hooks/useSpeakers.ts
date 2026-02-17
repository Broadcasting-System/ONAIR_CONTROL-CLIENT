import { useSpeakerStore } from "@/stores/speakerStore";
import { SPEAKER_ITEMS } from "@/constants/speakers";
import { useEffect } from "react";
import { SpeakerZone } from "@/types/speaker";

export function useSpeakers() {
  const { zones, setZones, updateZoneStatus } = useSpeakerStore();

  useEffect(() => {
    if (zones.length === 0) {
      const initialZones: SpeakerZone[] = SPEAKER_ITEMS.map((item, idx) => ({
        id: String(idx),
        name: item.label,
        status: item.status,
      }));
      setZones(initialZones);
    }
  }, [zones.length, setZones]);

  const toggleAll = (status: "on" | "off") => {
    const newZones = zones.map((z) => ({ ...z, status }));
    setZones(newZones);
  };

  const toggleGrade = (grade: string, status: "on" | "off") => {
    const newZones = zones.map((z) => {
      if (z.name.startsWith(grade)) {
        return { ...z, status };
      }
      return z;
    });
    setZones(newZones);
  };

  return {
    zones,
    updateZoneStatus,
    toggleAll,
    toggleGrade,
  };
}
