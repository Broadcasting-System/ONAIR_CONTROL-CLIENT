"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Select from "@/components/common/Select";
import { toast } from "@/components/common/Toast";
import { HallSwitcher } from "@/components/hall/HallControls";
import { ActionButton, inputCls, okBorder } from "@/components/hall/setup/ui";
import RecordingSettings from "@/components/recording/RecordingSettings";
import { useHalls } from "@/hooks/useHalls";
import { useRecording } from "@/hooks/useRecording";
import { avApi } from "@/lib/avApi";
import { cn } from "@/lib/utils";
import type { AvChannel, AvHall, ScreenRecorderStatus } from "@/types/av";
import { CHANNEL_NAMES } from "@/constants/channels";

type Row = { channel: number; name: string; hall: string | null };

/** 채널마다 이름과 연결된 홀 — 채널을 고르면 그 홀 콘솔이 소리로 자동 선택된다 */
function ChannelTable({ channels, halls }: { channels: AvChannel[]; halls: AvHall[] }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() => channels.map((c) => ({ channel: c.channel, name: c.name, hall: c.hall })));
  const [saving, setSaving] = useState(false);
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    try {
      await avApi.saveChannels(rows.map((r) => ({ ...r, name: r.name.trim() })));
      toast.success("채널 설정을 저장했습니다.");
      qc.invalidateQueries({ queryKey: ["avState"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      {rows.map((r, i) => {
        const c = channels[i];
        return (
          <div
            key={r.channel}
            className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3 border-t border-white/[0.06] py-2.5 sm:grid-cols-[56px_minmax(0,1fr)_200px_120px]"
          >
            <span className="font-mono text-sm font-bold text-white">CH{r.channel}</span>
            <input
              value={r.name}
              maxLength={20}
              onChange={(e) => set(i, { name: e.target.value })}
              placeholder={CHANNEL_NAMES[r.channel] ?? "예: 강당 프로젝터"}
              className={cn(inputCls, okBorder)}
            />
            <Select
              value={r.hall ?? ""}
              onChange={(hall) => set(i, { hall: hall || null })}
              aria-label={`CH${r.channel} 연결된 홀`}
              options={[{ value: "", label: "연결된 홀 없음" }, ...halls.map((h) => ({ value: h.id, label: h.name }))]}
              className={cn(inputCls, okBorder, "col-span-2 sm:col-span-1")}
            />
            <span className="hidden font-pretendard text-xs text-white/45 sm:block">
              {c?.live ? `송출 화면 ${c.displays}대` : "연결된 화면 없음"}
            </span>
          </div>
        );
      })}
      <div className="flex justify-end border-t border-white/[0.06] pt-3">
        <ActionButton tone="primary" onClick={save} busy={saving}>
          채널 설정 저장
        </ActionButton>
      </div>
    </div>
  );
}

/** 홀 콘솔 녹음 연결 (노트북·USB 오디오 인터페이스) — 지금까지의 녹음 설정 그대로 */
function ConsoleRecording() {
  const { halls } = useHalls();
  const [hallId, setHallId] = useState<string | null>(null);
  const current = halls.find((h) => h.id === hallId) ?? halls[0];
  const { state } = useRecording(current?.id ?? null);
  if (!current) return null;
  return (
    <div className="flex flex-col gap-4">
      <HallSwitcher halls={halls} value={current.id} onChange={setHallId} />
      {state && <RecordingSettings key={`${current.id}-${state.configured}`} hallId={current.id} state={state} />}
    </div>
  );
}

function InfoRow({ k, v, ok }: { k: string; v: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] py-2 font-pretendard text-sm">
      <span className="text-white/50">{k}</span>
      <span className={cn("text-right", ok === false ? "text-[#ff9a9a]" : "text-white/85")}>{v}</span>
    </div>
  );
}

/** 서버 PC 화면 녹화기 — 드라이버·ffmpeg·크롬·인코더·fps */
export function RecorderInfo({ recorder, onRecheck }: { recorder: ScreenRecorderStatus; onRecheck: () => void }) {
  const enc = recorder.encoder
    ? `${recorder.encoder} · ${recorder.hardware ? "그래픽 카드" : "CPU"}`
    : "없음";
  return (
    <div className="flex flex-col">
      <InfoRow k="녹화 방식" v={recorder.driver === "window" ? "서버 PC 창 녹화" : "모의"} />
      <InfoRow k="ffmpeg" v={recorder.ffmpeg ? "있음" : "없음"} ok={recorder.ffmpeg} />
      {recorder.chrome !== null && (
        <InfoRow k="브라우저" v={recorder.chrome ? recorder.browser || "있음" : "없음"} ok={!!recorder.chrome} />
      )}
      <InfoRow k="인코더" v={enc} />
      {recorder.capture && <InfoRow k="화면 찍기" v={recorder.capture} />}
      <InfoRow k="기본 fps" v={`${recorder.fps}fps`} />
      {recorder.detail && <p className="pt-2 font-pretendard text-xs text-white/45">{recorder.detail}</p>}
      <div className="flex justify-end pt-2">
        <ActionButton tone="ghost" onClick={onRecheck}>
          다시 확인
        </ActionButton>
      </div>
    </div>
  );
}

/** 채널 설정 (관리자) — 채널 이름·연결된 홀, 홀 콘솔 녹음 연결 */
export default function ChannelSettings({ channels, halls }: { channels: AvChannel[]; halls: AvHall[] }) {
  return (
    <div className="flex flex-col gap-7">
      <div className="max-w-[860px]">
        <h4 className="mb-1 font-mbc text-lg text-white">채널</h4>
        <ChannelTable key={channels.map((c) => `${c.name}${c.hall}`).join("|")} channels={channels} halls={halls} />
      </div>
      <div className="border-t border-white/[0.07] pt-6">
        <h4 className="mb-1 font-mbc text-lg text-white">콘솔 녹음 연결</h4>
        <ConsoleRecording />
      </div>
    </div>
  );
}
