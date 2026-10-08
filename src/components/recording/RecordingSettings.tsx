"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Select from "@/components/common/Select";
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
      <Card title="연결 · 입력 장치">
        <div className="grid grid-cols-2 gap-2.5">
          <OptionCard
            selected={driver === "bridge"}
            onClick={() => setDriver("bridge")}
            title={`${state.hall.name} 노트북`}
          />
          <OptionCard
            selected={driver === "mock"}
            onClick={() => setDriver("mock")}
            title="모의 장비"
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
            <Field label="입력 장치" hint={devices.isError ? (devices.error as Error).message : undefined}>
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="예: M-Track"
                  className={cn(inputCls, okBorder, "flex-1")}
                />
                {list.length > 0 && (
                  <Select
                    value=""
                    onChange={(name) => name && setInput(name)}
                    placeholder="목록"
                    options={list.map((d) => ({
                      value: d.name,
                      label: `${d.name} ${d.hostapi ? `· ${d.hostapi}` : ""} · ${d.channels}ch`,
                    }))}
                    className={cn(inputCls, okBorder, "w-48")}
                  />
                )}
              </div>
            </Field>
          </>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {lanes.map((name, i) => (
            <Field key={i} label={`통로 ${i + 1} 이름`}>
              <input
                value={name}
                maxLength={12}
                onChange={(e) => setLanes(lanes.map((l, j) => (j === i ? e.target.value : l)))}
                className={cn(inputCls, okBorder)}
              />
            </Field>
          ))}
        </div>
        <Switch checked={split} onChange={setSplit} label="통로마다 따로 저장" />
        <div className="flex justify-end">
          <ActionButton tone="primary" onClick={save} busy={saving} disabled={driver === "bridge" && !bridgeUrl.trim()}>
            저장
          </ActionButton>
        </div>
      </Card>

      <Card title="녹음 버스에 보낼 채널">
        {state.configured ? (
          <>
            {sends.map((text, i) => (
              <Field key={i} label={`${state.lanes[i]?.name ?? `통로 ${i + 1}`} 버스로`}>
                <input
                  value={text}
                  onChange={(e) => setSends(sends.map((s, j) => (j === i ? e.target.value : s)))}
                  placeholder={i === 0 ? "예: 1, 2, 3, 4" : "예: 15, 16"}
                  className={cn(inputCls, okBorder)}
                />
              </Field>
            ))}
            <div className="flex justify-end">
              <ActionButton onClick={saveSends}>저장</ActionButton>
            </div>
          </>
        ) : (
          <p className="font-pretendard text-sm text-white/40">녹음 연결 저장 안 됨</p>
        )}
      </Card>
    </div>
  );
}
