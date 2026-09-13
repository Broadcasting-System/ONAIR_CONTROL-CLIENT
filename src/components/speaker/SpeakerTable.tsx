"use client";

import { useMemo, useState } from "react";
import {
  SPEAKER_CATEGORY,
  CATEGORY_ORDER,
  DEAD_SPEAKERS,
} from "@/constants/speakerMap";
import { SPEAKER_COVERAGE, coverageTag } from "@/lib/speakerCoverage";
import { SpeakerZone } from "@/types/speaker";
import { cn } from "@/lib/utils";

const DEAD = new Set(DEAD_SPEAKERS);

/** 전체 스피커 표. 분류별로 묶고, 검색·"켜진 것만"으로 좁혀 본다.
 *  칩에 마우스를 올리면 지도에서 담당 구역이 노랗게 강조된다. */
export function SpeakerTable({
  zones,
  onToggle,
  canOperate,
  hovered,
  onHover,
  onJumpFloor,
}: {
  zones: SpeakerZone[];
  onToggle: (id: string) => void;
  canOperate: boolean;
  hovered: string | null;
  onHover: (speaker: string | null) => void;
  onJumpFloor: (floor: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [onlyOn, setOnlyOn] = useState(false);

  const onCount = zones.filter((z) => z.status === "on").length;

  // 분류별로 묶기 (검색·필터 적용 후)
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = zones.filter((z) => {
      if (onlyOn && z.status !== "on") return false;
      if (!q) return true;
      // 스피커 이름 + 담당 지명 둘 다로 찾을 수 있게
      const cells = SPEAKER_COVERAGE[z.name]?.cells ?? [];
      return (
        z.name.toLowerCase().includes(q) ||
        cells.some((c) => c.toLowerCase().includes(q))
      );
    });
    const byCat = new Map<string, SpeakerZone[]>();
    for (const z of visible) {
      const cat = DEAD.has(z.name) ? "미연결" : (SPEAKER_CATEGORY[z.name] ?? "기타");
      const list = byCat.get(cat) ?? [];
      list.push(z);
      byCat.set(cat, list);
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
      name: c,
      items: byCat.get(c)!,
    }));
  }, [zones, query, onlyOn]);

  const shown = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* 머리말 — 켜짐 수 */}
      <div className="flex shrink-0 items-baseline justify-between">
        <span className="font-mbc text-sm text-white/50">전체 스피커</span>
        <span className="font-orbitron text-[11px]">
          <span className={onCount ? "text-[#00FF57]" : "text-white/30"}>
            {onCount}
          </span>
          <span className="text-white/25"> / {zones.length}</span>
        </span>
      </div>

      {/* 검색 + 켜진 것만 */}
      <div className="flex shrink-0 gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·장소 검색"
          className="h-[36px] min-w-0 flex-1 rounded-xl border border-white/10 bg-[#1C1C1C] px-3 font-pretendard text-[13px] text-white placeholder:text-white/25 transition-colors focus:border-white/30 focus:outline-none"
        />
        <button
          onClick={() => setOnlyOn((v) => !v)}
          className={cn(
            "shrink-0 rounded-xl border px-3 font-mbc text-[13px] transition-colors",
            onlyOn
              ? "border-[#00FF57]/60 bg-[#00FF57]/15 text-[#b6ffd2]"
              : "border-white/10 bg-white/5 text-white/50 hover:text-white/80",
          )}
        >
          켜진 것만
        </button>
      </div>

      {/* 목록 */}
      <div
        className="min-h-0 flex-1 overflow-y-auto pr-1"
        style={{ maxHeight: "clamp(300px, calc(100vh - 560px), 620px)" }}
      >
        {shown === 0 ? (
          <p className="py-8 text-center font-pretendard text-[13px] text-white/30">
            {onlyOn ? "켜진 스피커가 없어요." : "찾는 스피커가 없어요."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((g) => {
              const live = g.items.filter((z) => z.status === "on").length;
              return (
                <div key={g.name}>
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className="font-orbitron text-[10px] uppercase tracking-[0.16em] text-white/30">
                      {g.name}
                    </span>
                    <span className="font-orbitron text-[10px] text-white/20">
                      {g.items.length}
                    </span>
                    {live > 0 && (
                      <span className="font-orbitron text-[10px] text-[#00FF57]">
                        {live} 켜짐
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {g.items.map((z) => {
                      const dead = DEAD.has(z.name);
                      const on = z.status === "on";
                      const err = z.status === "error";
                      const isHover = hovered === z.name;
                      const cov = SPEAKER_COVERAGE[z.name];
                      return (
                        <button
                          key={z.id}
                          disabled={dead || !canOperate}
                          onClick={() => {
                            if (dead || !canOperate) return;
                            onToggle(z.id);
                            const f = cov?.floors[0];
                            if (f) onJumpFloor(f);
                          }}
                          onMouseEnter={() => !dead && onHover(z.name)}
                          onMouseLeave={() => onHover(null)}
                          title={
                            dead
                              ? `${z.name} — 실제 연결된 스피커가 없어요`
                              : cov?.cells.length
                                ? `${z.name} → ${cov.cells.join(", ")}`
                                : z.name
                          }
                          className={cn(
                            "flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition-all",
                            dead
                              ? "cursor-not-allowed border-white/5 bg-black/20 opacity-45"
                              : "cursor-pointer",
                            !dead && on && "border-[#00FF57]/70 bg-[#00FF57]/15",
                            !dead && err && "border-[#FF3B3B]/70 bg-[#FF3B3B]/10",
                            !dead && !on && !err && "border-white/10 bg-black/40 hover:bg-white/10",
                            isHover && !dead && "border-[#FFD600] shadow-[0_0_0_1px_#FFD600]",
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "h-[7px] w-[7px] shrink-0 rounded-full",
                                on
                                  ? "bg-[#00FF57] shadow-[0_0_7px_#00FF57]"
                                  : err
                                    ? "bg-[#FF3B3B]"
                                    : "bg-[#585858]",
                              )}
                            />
                            <span className="font-orbitron text-[9px] tracking-wider text-white/45">
                              {dead ? "—" : on ? "ON" : err ? "ERR" : "OFF"}
                            </span>
                          </span>
                          <span className="mt-0.5 truncate font-mbc text-[13px] leading-tight text-white">
                            {z.name}
                          </span>
                          <span className="truncate font-pretendard text-[9px] text-white/30">
                            {dead ? "미연결" : coverageTag(z.name)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
