"use client";

import { useState } from "react";
import Button from "@/components/common/Button";
import { SpeakerFloorMap } from "@/components/speaker/SpeakerFloorMap";
import { SpeakerTable } from "@/components/speaker/SpeakerTable";
import { FLOOR_KEYS } from "@/lib/speakerCoverage";
import { SpeakerZone } from "@/types/speaker";

/** 스피커 관리 — 지도와 표를 나란히. 층·강조 상태를 둘이 공유한다. */
export function SpeakerPanel({
  zones,
  onToggle,
  canOperate,
}: {
  zones: SpeakerZone[];
  onToggle: (id: string) => void;
  canOperate: boolean;
}) {
  const [floor, setFloor] = useState(FLOOR_KEYS[0]);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6">
      <SpeakerFloorMap
        zones={zones}
        onToggle={canOperate ? onToggle : () => {}}
        floor={floor}
        onFloorChange={setFloor}
        highlight={hovered}
        onHover={setHovered}
      />

      <div className="flex flex-col gap-4">
        <SpeakerTable
          zones={zones}
          onToggle={onToggle}
          canOperate={canOperate}
          hovered={hovered}
          onHover={setHovered}
          onJumpFloor={setFloor}
        />
        <div className="flex shrink-0 flex-col gap-2">
          <Button
            label="전체"
            onClick={() => onToggle("all")}
            disabled={!canOperate}
            className="h-[52px]"
          />
          <Button
            label="학년 전체"
            color="#1e3a8a"
            onClick={() => onToggle("grade")}
            disabled={!canOperate}
            className="h-[52px]"
          />
        </div>
      </div>
    </div>
  );
}
