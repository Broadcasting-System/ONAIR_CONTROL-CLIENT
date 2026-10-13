"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FLOORS,
  FLOOR_KEYS,
  isOutline,
  speakersOfCell,
} from "@/lib/speakerCoverage";
import { SpeakerZone } from "@/types/speaker";
import { cn } from "@/lib/utils";

const PAD = 12; // 지도 상자 안쪽 여백(px)

/** 지도 위 스피커 on/off 뷰.
 *  - 칸에 쓰는 글씨는 **지명**(교장실·보건실…), 그 아래 작은 글씨가 담당 **스피커 이름**.
 *  - 스피커 하나가 여러 방을 덮으면 그 방들이 함께 켜진다(그게 최소 단위).
 *  - highlight 로 넘어온 스피커의 칸은 노란 테두리로 잠깐 강조된다(표에서 마우스 올릴 때). */
export function SpeakerFloorMap({
  zones,
  onToggle,
  floor,
  onFloorChange,
  highlight,
  onHover,
  mapHeight: mapHeightProp,
  countLabel = "켜짐",
  portrait = false,
}: {
  zones: SpeakerZone[];
  onToggle: (id: string) => void;
  floor: string;
  onFloorChange: (floor: string) => void;
  highlight?: string | null;
  onHover?: (speaker: string | null) => void;
  /** 지도 높이 (CSS 값) — 방송 대상 고르기 창처럼 좁은 곳에서 줄인다 */
  mapHeight?: string;
  /** 층 탭 숫자 뒤 글자 (스피커 화면은 '켜짐', 대상 고르기는 '선택') */
  countLabel?: string;
  /** 폰 세로 화면용 — 층 지도를 시계 방향으로 90° 돌리고(글자는 똑바로) 화면 높이만큼 세로로 늘린다.
   *  가로로 길게 늘어선 교실 줄이 세로가 되어 좁은 폰에서도 이름이 보인다 */
  portrait?: boolean;
}) {
  const mapHeightSet = mapHeightProp !== undefined;
  const mapHeight = mapHeightProp ?? "clamp(480px, calc(100vh - 250px), 900px)";
  const elements = useMemo(() => {
    const base = FLOORS[floor]?.elements ?? [];
    if (!portrait) return base;
    const maxY = Math.max(...base.map((e) => e.y + e.height));
    return base.map((e) => ({ ...e, x: maxY - (e.y + e.height), y: e.x, width: e.height, height: e.width }));
  }, [floor, portrait]);
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

  // 상자 크기는 CSS로 결정 → 여기선 글자 크기 계산용으로만 실제 px 측정
  const stageRef = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    // 먼저 한 번 직접 측정해 둔다. 탭이 숨겨져 있거나 화면이 아직 안 그려진 동안에는
    // ResizeObserver 가 안 불려서, 이게 없으면 글자 크기가 기본값에 머물러 잘린다.
    const seed = el.getBoundingClientRect();
    if (seed.width > 0 && seed.height > 0) {
      setPx({ w: seed.width, h: seed.height });
    }
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      if (cr.width > 0 && cr.height > 0) setPx({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [floor]);

  // 층 탭에 붙일 켜짐 수
  const liveByFloor = useMemo(() => {
    const out: Record<string, number> = {};
    for (const k of FLOOR_KEYS) {
      const live = new Set<string>();
      for (const el of FLOORS[k].elements) {
        if (isOutline(el)) continue;
        for (const sp of speakersOfCell(k, el)) {
          if (zoneByName.get(sp)?.status === "on") live.add(sp);
        }
      }
      out[k] = live.size;
    }
    return out;
  }, [zoneByName]);

  return (
    <div className="flex h-full min-w-0 flex-col gap-3">
      {/* 층 탭 */}
      <div className={cn("shrink-0 gap-2", portrait ? "grid grid-cols-4" : "flex")} data-tour="speakers.floor-tabs">
        {FLOOR_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => onFloorChange(k)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-1 font-mbc text-sm transition-colors",
              portrait && "min-h-[44px] flex-col justify-center gap-0.5 px-1 py-1.5",
              floor === k
                ? "bg-white/20 text-white"
                : "bg-white/5 text-white/50 hover:bg-white/10",
            )}
          >
            {FLOORS[k].label}
            <span
              className={cn(
                "font-orbitron text-[10px]",
                liveByFloor[k] ? "text-[#00FF57]" : "text-white/30",
              )}
            >
              {liveByFloor[k] ? `${liveByFloor[k]} ${countLabel}` : "대기"}
            </span>
          </button>
        ))}
      </div>

      {/* 지도 (확대/축소 없음) */}
      <div
        className="min-h-0"
        data-tour="speakers.map"
        style={{ height: portrait && !mapHeightSet ? "max(440px, calc(100dvh - 300px))" : mapHeight }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30"
          style={{ padding: PAD }}
        >
          <div ref={stageRef} className="relative h-full w-full">
            {elements.map((el) => {
              const left = ((el.x - cb.minX) / cb.w) * 100;
              const top = ((el.y - cb.minY) / cb.h) * 100;
              const w = (el.width / cb.w) * 100;
              const h = (el.height / cb.h) * 100;
              const pxW = (w / 100) * px.w;
              const pxH = (h / 100) * px.h;
              const pos = {
                position: "absolute" as const,
                left: `${left}%`,
                top: `${top}%`,
                width: `${w}%`,
                height: `${h}%`,
                animationDelay: `${Math.min(220, Math.round((left + top) * 1.1))}ms`,
              };

              // 이름 없는 칸(건물 외곽선·미사용 구역)은 흐린 테두리만
              if (isOutline(el)) {
                return (
                  <div
                    key={`${floor}-${el.id}`}
                    className="floor-piece"
                    style={{
                      ...pos,
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.07)",
                      background: "rgba(255,255,255,0.012)",
                    }}
                  />
                );
              }

              const sps = speakersOfCell(floor, el);
              const spk = sps[0];
              const zone = spk ? zoneByName.get(spk) : undefined;
              const on = sps.some((s) => zoneByName.get(s)?.status === "on");
              const err = zone?.status === "error";
              const lit = !!highlight && sps.includes(highlight);

              // 담당 스피커 이름은 자리가 넉넉할 때만 아래 줄에 작게
              const showSpk = !!spk && spk !== el.name && pxH >= 34 && pxW >= 44;

              // 줄 수를 바꿔가며 상자에 딱 맞는 최대 폰트를 계산 → 어떤 상자든 글자 안 잘림
              const availW = Math.max(1, pxW - 5);
              const availH = Math.max(1, (showSpk ? pxH - 11 : pxH) - 4);
              const chars = Math.max(1, el.name.length);
              let fit = 0;
              for (let f = 13; f >= 7; f--) {
                const perLine = Math.floor(availW / f);
                if (perLine < 1) continue;
                const lines = Math.ceil(chars / perLine);
                if (lines * f * 1.16 <= availH) { fit = f; break; }
              }
              const fontPx = px.w === 0 ? 12 : fit;

              return (
                <div
                  key={`${floor}-${el.id}`}
                  className="floor-piece"
                  onClick={() => { if (zone) onToggle(zone.id); }}
                  onMouseEnter={() => spk && onHover?.(spk)}
                  onMouseLeave={() => onHover?.(null)}
                  title={
                    spk
                      ? `${el.name} → 스피커 ${sps.join(", ")}`
                      : `${el.name} · 스피커 없음`
                  }
                  style={{
                    ...pos,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: 1,
                    overflow: "hidden",
                    lineHeight: 1.14,
                    borderRadius: 5,
                    border: "1px solid",
                    cursor: spk ? "pointer" : "default",
                    borderColor: lit
                      ? "#FFD600"
                      : !spk
                        ? "rgba(255,255,255,0.10)"
                        : err
                          ? "#FF3B3B"
                          : on
                            ? "#22e06b"
                            : "rgba(255,255,255,0.42)",
                    background: !spk
                      ? "rgba(255,255,255,0.025)"
                      : on
                        ? "rgba(34,224,107,0.28)"
                        : "rgba(255,255,255,0.07)",
                    color: !spk
                      ? "rgba(255,255,255,0.34)"
                      : on
                        ? "#d9ffe8"
                        : "#e9e7ee",
                    fontWeight: spk ? 600 : 400,
                    boxShadow: lit
                      ? "0 0 0 2px #FFD600"
                      : on
                        ? "0 0 16px -4px #22e06b"
                        : undefined,
                    transition:
                      "background 0.15s, border-color 0.15s, box-shadow 0.15s",
                  }}
                >
                  {fontPx > 0 && (
                    <>
                      <span
                        style={{
                          pointerEvents: "none",
                          fontSize: fontPx,
                          wordBreak: "break-all",
                        }}
                      >
                        {el.name}
                      </span>
                      {showSpk && (
                        <span
                          className="font-orbitron"
                          style={{
                            pointerEvents: "none",
                            fontSize: 7,
                            marginTop: 2,
                            letterSpacing: "0.04em",
                            whiteSpace: "nowrap",
                            maxWidth: "100%",
                            overflow: "hidden",
                            color: on ? "#22e06b" : "rgba(255,255,255,0.45)",
                          }}
                        >
                          {spk}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
