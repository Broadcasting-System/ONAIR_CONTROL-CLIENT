"use client";

import { useEffect, useState } from "react";
import BellLine from "@/components/broadcast/BellLine";
import { mmss } from "@/hooks/useBellGuard";
import type { CalibrationStatus } from "@/lib/speakerApi";

/** 멈춘 뒤 이만큼 지나면 까닭을 그만 보인다 */
const SHOW_ENDED_MS = 15 * 60_000;
/** 멈추기 이만큼 전부터 남은 시간을 보인다 */
const SHOW_PAUSE_MS = 60_000;

/** 스피커 매핑과 종 — 종 20초 전에 서버가 스피커를 되돌리고 멈춘다 (서버 docs/bell.md '종이 최우선').
 *  찾는 중이면 멈추기 1분 전부터 남은 시간, 멈췄으면 그 까닭 한 줄 */
export default function MappingBellNote({ cal }: { cal: CalibrationStatus | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  const soon = !!cal?.active && !!cal.pauseAt;
  useEffect(() => {
    if (!soon) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [soon]);

  if (!cal) return null;
  if (cal.active && cal.pauseAt && cal.pauseAt - now <= SHOW_PAUSE_MS) {
    const left = (cal.pauseAt - now) / 1000;
    return <BellLine text={`${cal.bell?.time ?? ""} 종이 울려서 잠깐 멈춰요`.trim()} countdown={mmss(left)} />;
  }
  const ended = cal.ended;
  if (!cal.active && ended?.reason === "bell" && now - ended.at * 1000 < SHOW_ENDED_MS) {
    return <BellLine text={ended.message || "종이 울려서 잠깐 멈췄어요"} />;
  }
  return null;
}
