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

  const toggleSpeaker = (target: "all" | "grade" | string) => {
    if (target === "all") {
      const allOn = zones.every((z) => z.status === "on");
      const newStatus = allOn ? "off" : "on";
      setZones(zones.map((z) => ({ ...z, status: newStatus })));
      return;
    }

    if (target === "grade") {
      const grades = ["1학년", "2학년", "3학년"];
      const gradeZones = zones.filter((z) => grades.some((g) => z.name.startsWith(g)));
      const allOn = gradeZones.every((z) => z.status === "on");
      const newStatus = allOn ? "off" : "on";

      setZones(
        zones.map((z) =>
          grades.some((g) => z.name.startsWith(g)) ? { ...z, status: newStatus } : z,
        ),
      );
      return;
    }

    setZones(
      zones.map((z) =>
        z.id === target ? { ...z, status: z.status === "on" ? "off" : "on" } : z,
      ),
    );
  };

  return {
    zones,
    updateZoneStatus,
    toggleSpeaker,
  };
}
