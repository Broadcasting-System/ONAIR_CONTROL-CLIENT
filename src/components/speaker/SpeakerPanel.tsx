"use client";

import { useCallback, useState } from "react";
import Button from "@/components/common/Button";
import MinSizeGuard from "@/components/common/MinSizeGuard";
import { SpeakerFloorMap } from "@/components/speaker/SpeakerFloorMap";
import { SpeakerTable } from "@/components/speaker/SpeakerTable";
import { FLOOR_KEYS, SPEAKER_COVERAGE } from "@/lib/speakerCoverage";
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

  // 스피커가 지금 보는 층에 없으면 그 스피커가 있는 층으로 지도를 넘긴다.
  // 여러 층에 걸친 스피커(프로그12 등)는 지금 층에 하나라도 있으면 그대로 둔다.
  const reveal = useCallback((speaker: string) => {
    const floors = SPEAKER_COVERAGE[speaker]?.floors ?? [];
    if (floors.length === 0) return;
    setFloor((cur) => (floors.includes(cur) ? cur : floors[0]));
  }, []);

  // 표에서 마우스를 올리면 강조 + 층 이동. 떼도 층은 되돌리지 않는다 —
  // 되돌리면 표에서 지도로 마우스를 옮기는 순간 원래 층으로 튕겨 버린다.
  const hoverFromTable = useCallback(
    (speaker: string | null) => {
      setHovered(speaker);
      if (speaker) reveal(speaker);
    },
    [reveal],
  );

  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
      {/* 지도 칸이 이보다 좁으면 방 이름이 사라지고 글자가 7px 로 줄어든다 (창 너비 약 1260px) */}
      <MinSizeGuard minWidth={520} className="hidden md:block" fallbackClassName="h-[clamp(480px,calc(100vh_-_206px),944px)]">
        <SpeakerFloorMap
          zones={zones}
          onToggle={canOperate ? onToggle : () => {}}
          floor={floor}
          onFloorChange={setFloor}
          highlight={hovered}
          onHover={setHovered}
        />
      </MinSizeGuard>

      <div className="flex flex-col gap-4">
        <SpeakerTable
          zones={zones}
          onToggle={onToggle}
          canOperate={canOperate}
          hovered={hovered}
          onHover={hoverFromTable}
          onReveal={reveal}
        />
        <div className="flex shrink-0 flex-col gap-2">
          <Button
            label="전체"
            onClick={() => onToggle("all")}
            disabled={!canOperate}
            className="h-[52px]"
            tour="speakers.all"
          />
          <Button
            label="학년 전체"
            color="#1e3a8a"
            onClick={() => onToggle("grade")}
            disabled={!canOperate}
            className="h-[52px]"
            tour="speakers.grade"
          />
        </div>
      </div>
    </div>
  );
}
