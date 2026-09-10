import { useSpeakerStore } from "@/stores/speakerStore";
import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { speakerApi } from "@/lib/speakerApi";
import { SPEAKER_MATRIX_KEY } from "@/hooks/useSpeakerMatrix";
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
  const queryClient = useQueryClient();

  const loadStatus = useCallback(async () => {
    const BASE = getApiBase();
    try {
      // 구역 이름은 서버 구역표(스피커 매핑)에서 — 학교마다 다르다
      const matrix = await queryClient.fetchQuery({
        queryKey: SPEAKER_MATRIX_KEY,
        queryFn: speakerApi.matrix,
        staleTime: 30_000,
      });
      const names = Array.from(new Set(matrix.cells.flat().filter(Boolean)));
      const res = await fetch(`${BASE}/speakers/status`);
      const data: SpeakersStatusResponse | null = res.ok ? await res.json() : null;
      const activeSet = new Set(data?.active_devices ?? []);
      const nextZones: SpeakerZone[] = names.map((name, idx) => ({
        id: String(idx),
        name,
        status: activeSet.has(name) ? "on" : "off",
      }));
      setZones(nextZones);
    } catch {
      setZones([]);
    }
  }, [setZones, queryClient]);

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
    // 제어 실패 시 로컬 추측으로 되돌리지 않고 서버 실제 상태로 재동기화한다.
    // (서버는 명령을 기록한 뒤 매트릭스로 전송하므로, 로컬 롤백은 서버와 어긋나
    //  "지도엔 켜짐, 새로고침하면 꺼짐" 같은 불일치를 만든다.)

    if (target === "all") {
      const allOn = current.every((z) => z.status === "on");
      const newStatus = allOn ? "off" : "on";
      store().setZones(current.map((z) => ({ ...z, status: newStatus })));
      try {
        await callControl(["전체"], newStatus);
      } catch {
        await loadStatus();
      }
      return;
    }

    if (target === "grade") {
      // 반(班) zone = "1-1", "2-3", "3-4" 처럼 (학년)-(반) 형식만 대상
      const isClass = (name: string) => /^\d+-\d+/.test(name);
      const classZones = current.filter((z) => isClass(z.name));
      const allOn = classZones.every((z) => z.status === "on");
      const newStatus = allOn ? "off" : "on";
      store().setZones(
        current.map((z) => (isClass(z.name) ? { ...z, status: newStatus } : z)),
      );
      try {
        await callControl(classZones.map((z) => z.name), newStatus);
      } catch {
        await loadStatus();
      }
      return;
    }

    // 개별 스피커 토글 — 존 하나만 함수형으로 갱신해 다른 클릭과 충돌하지 않음
    const zone = current.find((z) => z.id === target);
    if (!zone) return;
    const newStatus = zone.status === "on" ? "off" : "on";
    store().updateZoneStatus(target, newStatus);
    try {
      await callControl([zone.name], newStatus);
    } catch {
      await loadStatus();
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
