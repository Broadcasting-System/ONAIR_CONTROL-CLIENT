"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
const PAD = 12; // 지도 상자 안쪽 여백(px)

/** 지도 위 스피커 on/off 뷰. 방 클릭 → 해당 스피커 토글, 켜짐=초록.
 *  확대/축소 없음 — 지도 상자를 층 모양(aspect-ratio)에 맞춰 높이에 꽉 채우고,
 *  좌표 여백을 제거해 방을 최대한 크게(글자 잘림 최소화). */
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

  // 층별 실제 콘텐츠 경계(min~max) — 바깥 여백을 없애 지도를 꽉 채움
  const cb = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const e of elements) {
      minX = Math.min(minX, e.x);
      minY = Math.min(minY, e.y);
      maxX = Math.max(maxX, e.x + e.width);
      maxY = Math.max(maxY, e.y + e.height);
    }
    if (!Number.isFinite(minX)) return { minX: 0, minY: 0, w: 100, h: 100 };
    return { minX, minY, w: maxX - minX || 100, h: maxY - minY || 100 };
  }, [elements]);

  // 상자 크기는 CSS(aspect-ratio)로 결정 → 여기선 글자 크기용으로만 실제 px 측정
  const stageRef = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setPx({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    <div className="flex h-full flex-col gap-3">
      {/* 층 탭 */}
      <div className="flex shrink-0 gap-2">
        {FLOOR_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setFloor(k)}
            className={cn(
              "rounded-lg px-4 py-1 font-mbc text-sm transition-colors",
              floor === k
                ? "bg-white/20 text-white"
                : "bg-white/5 text-white/50 hover:bg-white/10",
            )}
          >
            {FLOORS[k].label}
          </button>
        ))}
      </div>

      {/* 지도 (확대/축소 없음) — 상자를 층 모양에 맞춰 높이에 꽉 채움.
          높이는 화면에 맞춰 반응형(작은 화면 최소치~큰 화면 최대치). */}
      <div
        className="flex min-h-0 items-center justify-center"
        style={{ height: "clamp(440px, calc(100vh - 330px), 760px)" }}
      >
        <div
          className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-black/30"
          style={{
            aspectRatio: `${cb.w} / ${cb.h}`,
            maxWidth: "100%",
            padding: PAD,
          }}
        >
          <div ref={stageRef} className="relative h-full w-full">
            {elements.map((el) => {
              const mapped = !!ROOM_TO_SPEAKER[el.name];
              const on = roomOn(el.name);
              // 정규화된 위치/크기 (콘텐츠 경계 기준 0~100%)
              const left = ((el.x - cb.minX) / cb.w) * 100;
              const top = ((el.y - cb.minY) / cb.h) * 100;
              const w = (el.width / cb.w) * 100;
              const h = (el.height / cb.h) * 100;
              // 실제 렌더 픽셀 크기 (글자 표시/크기 판단용)
              const pxW = (w / 100) * px.w;
              const pxH = (h / 100) * px.h;
              // 매핑된 방(제어 대상)은 항상 라벨, 미매핑 잡실(계단 등)은 작으면 숨김.
              const showLabel = mapped || px.w === 0 || (pxW >= 24 && pxH >= 15);
              const fontPx = Math.max(
                9,
                Math.min(15, Math.round((pxH || 40) * 0.32)),
              );
              // 매핑된 방은 (짧은) 스피커 이름 — 잘림↓, 같은 존은 같은 이름으로 묶임.
              const label = mapped ? ROOM_TO_SPEAKER[el.name] : el.name;
              return (
                <div
                  key={el.id}
                  onClick={() => clickRoom(el.name)}
                  title={el.name}
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${w}%`,
                    height: `${h}%`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: 1,
                    overflow: "hidden",
                    lineHeight: 1.12,
                    fontSize: fontPx,
                    borderRadius: 3,
                    border: "1px solid",
                    cursor: mapped ? "pointer" : "default",
                    borderColor: mapped
                      ? on
                        ? "#22c55e"
                        : "rgba(255,255,255,0.42)"
                      : "rgba(255,255,255,0.16)",
                    background: mapped
                      ? on
                        ? "rgba(34,197,94,0.45)"
                        : "rgba(255,255,255,0.07)"
                      : "rgba(255,255,255,0.035)",
                    color: mapped
                      ? on
                        ? "#eafff1"
                        : "#eef1f5"
                      : "rgba(255,255,255,0.42)",
                    fontWeight: mapped ? 600 : 400,
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                >
                  {showLabel && (
                    <span style={{ pointerEvents: "none" }}>{label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 기타 — 지도에 없는 스피커 (복도·SRC 등) */}
      {offZones.length > 0 && (
        <div className="shrink-0">
          <div className="mb-1 font-mbc text-[11px] text-white/40">
            기타 (지도 밖)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {offZones.map((z) => (
              <button
                key={z.id}
                onClick={() => onToggle(z.id)}
                className={cn(
                  "rounded-md border px-2.5 py-1 font-pretendard text-xs transition-colors",
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
