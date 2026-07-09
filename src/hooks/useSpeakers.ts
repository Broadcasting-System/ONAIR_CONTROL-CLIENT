import { useSpeakerStore } from "@/stores/speakerStore";
import { SPEAKER_ITEMS } from "@/constants/speakers";
import { useEffect, useCallback } from "react";
import { SpeakerZone } from "@/types/speaker";
import { getApiBase } from "@/lib/apiBase";

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
    const BASE = getApiBase();
    try {
      const res = await fetch(`${BASE}/speakers/status`);
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
    const BASE = getApiBase();
    const res = await fetch(`${BASE}/speakers/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets, action }),
    });
    const data: SpeakerControlResponse = await res.json();
    if (!res.ok || !data.success) throw new Error("스피커 제어 실패");
  };

  const toggleSpeaker = async (target: "all" | "grade" | string) => {
    // 클로저에 갇힌 zones가 아니라 항상 스토어의 최신 상태를 읽는다.
    // (빠르게 여러 방을 연속 클릭할 때 예전 배열로 덮어써져 토글이 사라지는 경쟁 상태 방지)
    const store = useSpeakerStore.getState;
    const current = store().zones;

    if (target === "all") {
      const allOn = current.every((z) => z.status === "on");
      const newStatus = allOn ? "off" : "on";
      const snapshot = current;
      store().setZones(current.map((z) => ({ ...z, status: newStatus })));
      try {
        await callControl(["전체"], newStatus);
      } catch {
        store().setZones(snapshot);
      }
      return;
    }

    if (target === "grade") {
      // 반(班) zone = "1-1", "2-3", "3-4" 처럼 (학년)-(반) 형식만 대상
      const isClass = (name: string) => /^\d+-\d+/.test(name);
      const classZones = current.filter((z) => isClass(z.name));
      const allOn = classZones.every((z) => z.status === "on");
      const newStatus = allOn ? "off" : "on";
      const snapshot = current;
      store().setZones(
        current.map((z) => (isClass(z.name) ? { ...z, status: newStatus } : z)),
      );
      try {
        await callControl(classZones.map((z) => z.name), newStatus);
      } catch {
        store().setZones(snapshot);
      }
      return;
    }

    // 개별 스피커 토글 — 존 하나만 함수형으로 갱신/롤백해 다른 클릭과 충돌하지 않음
    const zone = current.find((z) => z.id === target);
    if (!zone) return;
    const oldStatus = zone.status;
    const newStatus = oldStatus === "on" ? "off" : "on";
    store().updateZoneStatus(target, newStatus);
    try {
      await callControl([zone.name], newStatus);
    } catch {
      store().updateZoneStatus(target, oldStatus);
    }
  };

  // 긴급정지용 — 토글이 아니라 강제 OFF
  const allOff = useCallback(async () => {
    setZones(zones.map((z) => ({ ...z, status: "off" })));
    try {
      await callControl(["전체"], "off");
    } catch {
      /* ignore */
    }
  }, [zones, setZones]);

  return {
    zones,
    toggleSpeaker,
    allOff,
    loadStatus,
  };
}
