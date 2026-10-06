"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/common/Toast";
import NotebookPicker from "@/components/hall/setup/NotebookPicker";
import { ActionButton, Card, Field, inputCls, okBorder, OptionCard, Switch } from "@/components/hall/setup/ui";
import { recordingApi } from "@/lib/recordingApi";
import { cn } from "@/lib/utils";
import type { RecordingState } from "@/types/recording";

const parseChannels = (text: string): number[] =>
  Array.from(
    new Set(
      text
        .split(/[\s,]+/)
        .map((t) => Number(t))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 64),
    ),
  ).sort((a, b) => a - b);

/** 녹음 설정 (관리자) — 연결·입력 장치·통로 이름, 녹음 버스에 보낼 채널.
 * 공간을 바꾸면 화면이 key 로 새로 만들어 그 공간의 저장된 값으로 시작한다. */
export default function RecordingSettings({ hallId, state }: { hallId: string; state: RecordingState }) {
  const qc = useQueryClient();
  const conn = state.connection;
  const [driver, setDriver] = useState<"mock" | "bridge">(conn?.driver ?? "bridge");
  const [bridgeUrl, setBridgeUrl] = useState(conn?.bridgeUrl ?? "");
  const [input, setInput] = useState(conn?.input ?? "");
  const [lanes, setLanes] = useState<string[]>(state.lanes.map((l) => l.name).concat(["마이크", "음악"]).slice(0, 2));
  const [split, setSplit] = useState(!!state.splitLanes);
  const [sends, setSends] = useState<string[]>(state.lanes.map((l) => l.sends.join(", ")).concat(["", ""]).slice(0, 2));
  const [saving, setSaving] = useState(false);

  const devices = useQuery({
    queryKey: ["recordingDevices", hallId, conn?.driver, conn?.bridgeUrl],
    queryFn: () => recordingApi.devices(hallId),
    enabled: state.configured,
    retry: false,
  });

  const save = async () => {
    setSaving(true);
    try {
      await recordingApi.saveConfig(hallId, {
        driver,
        bridgeUrl: bridgeUrl.trim(),
        input: input.trim(),
        channels: 2,
        samplerate: 48000,
        lanes: lanes.map((l, i) => l.trim() || (i === 0 ? "마이크" : "음악")),
        splitLanes: split,
      });
      toast.success("녹음 설정을 저장했습니다.");
      qc.invalidateQueries({ queryKey: ["recording", hallId] });
      qc.invalidateQueries({ queryKey: ["recordingDevices", hallId] });
      qc.invalidateQueries({ queryKey: ["halls"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveSends = async () => {
    try {
      const res = await recordingApi.saveSends(hallId, sends.map(parseChannels));
      toast[res.applied ? "success" : "info"](res.applied ? "콘솔에 보냈습니다." : res.detail);
      qc.invalidateQueries({ queryKey: ["recording", hallId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const list = devices.data?.devices ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="연결 · 입력 장치" hint={`${state.hall.name} 노트북에 꽂은 USB 오디오 인터페이스 (입력 1·2 = 콘솔 녹음 버스)`}>
        <div className="grid grid-cols-2 gap-2.5">
          <OptionCard
            selected={driver === "bridge"}
            onClick={() => setDriver("bridge")}
            title={`${state.hall.name} 노트북`}
            hint="노트북의 USB 오디오 인터페이스로 녹음"
          />
          <OptionCard
            selected={driver === "mock"}
            onClick={() => setDriver("mock")}
            title="모의 장비"
            hint="장비 없이 화면 시험 (삑 소리 파일)"
          />
        </div>
        {driver === "bridge" && (
          <>
            <Field label="노트북 주소">
              <input
                value={bridgeUrl}
                onChange={(e) => setBridgeUrl(e.target.value)}
                placeholder="http://100.x.x.x:8765"
                className={cn(inputCls, okBorder)}
              />
            </Field>
            <NotebookPicker value={bridgeUrl} onPick={setBridgeUrl} need="audio" />
            <Field
              label="입력 장치"
              hint={
                devices.isError
                  ? (devices.error as Error).message
                  : state.configured
                    ? "이름 일부만 저장해서 USB 구멍을 바꿔 꽂아도 찾아요. 비우면 윈도우 기본 입력"
                    : "노트북 주소를 저장하면 꽂힌 장치 목록이 보여요"
              }
            >
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="예: M-Track"
                  className={cn(inputCls, okBorder, "flex-1")}
                />
                {list.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => e.target.value && setInput(e.target.value)}
                    className={cn(inputCls, okBorder, "w-48")}
                  >
                    <option value="">목록에서 고르기…</option>
                    {list.map((d) => (
                      <option key={`${d.index}-${d.name}`} value={d.name}>
                        {d.name} {d.hostapi ? `· ${d.hostapi}` : ""} · {d.channels}ch
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </Field>
          </>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {lanes.map((name, i) => (
            <Field key={i} label={`통로 ${i + 1} 이름 (입력 ${i + 1})`}>
              <input
                value={name}
                maxLength={12}
                onChange={(e) => setLanes(lanes.map((l, j) => (j === i ? e.target.value : l)))}
                className={cn(inputCls, okBorder)}
              />
            </Field>
          ))}
        </div>
        <Switch checked={split} onChange={setSplit} label="통로마다 따로 저장 (받은 뒤 모노 WAV 두 개도 만들기)" />
        <div className="flex justify-end">
          <ActionButton tone="primary" onClick={save} busy={saving} disabled={driver === "bridge" && !bridgeUrl.trim()}>
            저장
          </ActionButton>
        </div>
      </Card>

      <Card
        title="녹음 버스에 보낼 채널"
        hint="콘솔 입력 채널 번호 (예: 1, 2, 3). 지금은 저장만 해요 — 콘솔의 MIX 보내기 주소를 찾으면 ONAIR 가 직접 켭니다"
      >
        {state.configured ? (
          <>
            {sends.map((text, i) => (
              <Field key={i} label={`${state.lanes[i]?.name ?? `통로 ${i + 1}`} 버스로`}>
                <input
                  value={text}
                  onChange={(e) => setSends(sends.map((s, j) => (j === i ? e.target.value : s)))}
                  placeholder={i === 0 ? "예: 1, 2, 3, 4 (마이크)" : "예: 15, 16 (PC 음악)"}
                  className={cn(inputCls, okBorder)}
                />
              </Field>
            ))}
            <p className="font-pretendard text-xs leading-relaxed text-white/35">
              그 전까지는 콘솔에서 직접: 녹음용 MIX 두 개(예: MIX 13·14)를 모노·Post-fader 로 두고, 위 채널의 보내기를 0dB 로
              켠 뒤 MIX 출력을 인터페이스 입력 1·2 로 연결합니다. 자세한 순서는 서버의 docs/recording.md.
            </p>
            <div className="flex justify-end">
              <ActionButton onClick={saveSends}>저장</ActionButton>
            </div>
          </>
        ) : (
          <p className="font-pretendard text-sm text-white/40">먼저 왼쪽에서 녹음 연결을 저장해 주세요.</p>
        )}
      </Card>
    </div>
  );
}
