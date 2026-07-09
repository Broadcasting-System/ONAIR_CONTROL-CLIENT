"use client";

import { useMemo, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import bssmFloorMap from "@/constants/bssmFloorMap.json";
import { ROOM_TO_SPEAKER, OFFMAP_SPEAKERS } from "@/constants/speakerMap";
import { SpeakerZone } from "@/types/speaker";
import { cn } from "@/lib/utils";

interface FloorElement {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  interactive: boolean | null;
}
type Floors = Record<string, { label: string; elements: FloorElement[] }>;

const FLOORS = (bssmFloorMap as unknown as { floors: Floors }).floors;
const FLOOR_KEYS = Object.keys(FLOORS);

/** 지도 위 스피커 on/off 뷰. 방 클릭 → 해당 스피커 토글, 켜짐=초록.
 *  상태/토글은 useSpeakers(zones/onToggle)를 그대로 받아 재사용(백엔드 무변경). */
export function SpeakerFloorMap({
  zones,
  onToggle,
}: {
  zones: SpeakerZone[];
  onToggle: (id: string) => void;
}) {
  const [floor, setFloor] = useState(FLOOR_KEYS[0]);
  const elements = useMemo(() => FLOORS[floor]?.elements ?? [], [floor]);
  const zoneByName = useMemo(
    () => new Map(zones.map((z) => [z.name, z])),
    [zones],
  );

  // 층별 실제 비율(bounding box)로 스테이지 종횡비 설정 → 층마다 모양 보존
  const bbox = useMemo(() => {
    let w = 0;
    let h = 0;
    for (const e of elements) {
      w = Math.max(w, e.x + e.width);
      h = Math.max(h, e.y + e.height);
    }
    return { w: w || 100, h: h || 100 };
  }, [elements]);

  const roomOn = (name: string) => {
    const sp = ROOM_TO_SPEAKER[name];
    return sp ? zoneByName.get(sp)?.status === "on" : false;
  };
  const clickRoom = (name: string) => {
    const sp = ROOM_TO_SPEAKER[name];
    const z = sp ? zoneByName.get(sp) : undefined;
    if (z) onToggle(z.id);
  };

  const offZones = OFFMAP_SPEAKERS
    .map((n) => zones.find((z) => z.name === n))
    .filter((z): z is SpeakerZone => !!z);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 층 탭 */}
      <div className="flex gap-2">
        {FLOOR_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setFloor(k)}
            className={cn(
              "rounded-lg px-4 py-1.5 font-mbc text-sm transition-colors",
              floor === k
                ? "bg-white/20 text-white"
                : "bg-white/5 text-white/50 hover:bg-white/10",
            )}
          >
            {FLOORS[k].label}
          </button>
        ))}
      </div>

      {/* 지도 (줌/팬) */}
      <div
        className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/30"
        style={{ minHeight: 360 }}
      >
        <TransformWrapper minScale={0.4} maxScale={5} centerOnInit limitToBounds={false}>
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              className="relative"
              style={{
                width: "min(96%, 880px)",
                aspectRatio: `${bbox.w} / ${bbox.h}`,
              }}
            >
              {elements.map((el) => {
                const mapped = !!ROOM_TO_SPEAKER[el.name];
                const on = roomOn(el.name);
                return (
                  <div
                    key={el.id}
                    onClick={() => clickRoom(el.name)}
                    title={el.name}
                    style={{
                      position: "absolute",
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.width}%`,
                      height: `${el.height}%`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: 2,
                      overflow: "hidden",
                      lineHeight: 1.15,
                      fontSize: "clamp(7px, 1vw, 12px)",
                      border: "1px solid",
                      cursor: mapped ? "pointer" : "default",
                      borderColor: mapped
                        ? on
                          ? "#22c55e"
                          : "rgba(255,255,255,0.25)"
                        : "rgba(255,255,255,0.08)",
                      background: mapped
                        ? on
                          ? "rgba(34,197,94,0.4)"
                          : "rgba(255,255,255,0.05)"
                        : "rgba(255,255,255,0.02)",
                      color: mapped
                        ? on
                          ? "#eafff1"
                          : "#d1d5db"
                        : "rgba(255,255,255,0.28)",
                      fontWeight: mapped ? 600 : 400,
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                  >
                    <span style={{ pointerEvents: "none" }}>{el.name}</span>
                  </div>
                );
              })}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* 기타 — 지도에 없는 스피커 (복도·SRC 등) */}
      {offZones.length > 0 && (
        <div>
          <div className="mb-2 font-mbc text-xs text-white/40">
            기타 (지도 밖)
          </div>
          <div className="flex flex-wrap gap-2">
            {offZones.map((z) => (
              <button
                key={z.id}
                onClick={() => onToggle(z.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 font-pretendard text-sm transition-colors",
                  z.status === "on"
                    ? "border-green-500 bg-green-500/25 text-green-100"
                    : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10",
                )}
              >
                {z.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
