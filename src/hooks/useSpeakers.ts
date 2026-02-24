import { useSpeakerStore } from "@/stores/speakerStore";
import { SPEAKER_ITEMS } from "@/constants/speakers";
import { useEffect, useCallback } from "react";
import { SpeakerZone } from "@/types/speaker";

interface SpeakersStatusResponse {
  active_devices: string[];
  total_devices: number;
}

interface SpeakerControlResponse {
  success: boolean;
  targets: string[];
  action: string;
}

export function useSpeakers() {
  const { zones, setZones } = useSpeakerStore();

  const loadStatus = useCallback(async () => {
    const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
    try {
      const res = await fetch(`${BASE_URL}/speakers/status`);
      if (!res.ok) throw new Error("스피커 상태 로드 실패");
      const data: SpeakersStatusResponse = await res.json();
      const activeSet = new Set(data.active_devices);
      const initialZones: SpeakerZone[] = SPEAKER_ITEMS.map((item, idx) => ({
        id: String(idx),
        name: item.label,
        status: activeSet.has(item.label) ? "on" : "off",
      }));
      setZones(initialZones);
    } catch {
      const fallback: SpeakerZone[] = SPEAKER_ITEMS.map((item, idx) => ({
        id: String(idx),
        name: item.label,
        status: "off",
      }));
      setZones(fallback);
    }
  }, [setZones]);

  useEffect(() => {
    if (zones.length === 0) {
      loadStatus();
    }
  }, [zones.length, loadStatus]);

  const callControl = async (targets: string[], action: "on" | "off") => {
    const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
    const res = await fetch(`${BASE_URL}/speakers/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets, action }),
    });
    const data: SpeakerControlResponse = await res.json();
    if (!res.ok || !data.success) throw new Error("스피커 제어 실패");
  };

  const toggleSpeaker = async (target: "all" | "grade" | string) => {
    const previousZones = zones;

    if (target === "all") {
      const allOn = zones.every((z) => z.status === "on");
      const newStatus = allOn ? "off" : "on";
      setZones(zones.map((z) => ({ ...z, status: newStatus })));
      try {
        await callControl(["전체"], newStatus);
      } catch {
        setZones(previousZones);
      }
      return;
    }

    if (target === "grade") {
      const gradeNames = ["1학년", "2학년", "3학년"];
      const gradeZones = zones.filter((z) => gradeNames.some((g) => z.name.startsWith(g)));
      const allOn = gradeZones.every((z) => z.status === "on");
      const newStatus = allOn ? "off" : "on";
      setZones(
        zones.map((z) =>
          gradeNames.some((g) => z.name.startsWith(g)) ? { ...z, status: newStatus } : z,
        ),
      );
      try {
        const gradeTargets = gradeNames.filter((g) =>
          gradeZones.some((z) => z.name.startsWith(g)),
        );
        await callControl(gradeTargets, newStatus);
      } catch {
        setZones(previousZones);
      }
      return;
    }

    const zone = zones.find((z) => z.id === target);
    if (!zone) return;
    const newStatus = zone.status === "on" ? "off" : "on";
    setZones(zones.map((z) => (z.id === target ? { ...z, status: newStatus } : z)));
    try {
      await callControl([zone.name], newStatus);
    } catch {
      setZones(previousZones);
    }
  };

  return {
    zones,
    toggleSpeaker,
    loadStatus,
  };
}
