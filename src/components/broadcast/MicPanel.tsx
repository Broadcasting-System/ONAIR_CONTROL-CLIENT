"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Chip } from "@/components/mobile/ui";
import { toast } from "@/components/common/Toast";
import { useLiveMic } from "@/hooks/useLiveMic";
import { useClipRecorder } from "@/hooks/useClipRecorder";
import { broadcastApi, type MicOptions } from "@/lib/broadcastApi";
import { cn } from "@/lib/utils";
import MicButton, { type MicButtonState } from "./MicButton";
import TargetPicker from "./TargetPicker";
import { Block, Label, Segmented, Switch, Waveform, fmtClock, useElapsed } from "./parts";

type Mode = "live" | "clip";

const FALLBACK: MicOptions = {
  effects: [
    { id: "none", label: "없음" },
    { id: "pa", label: "방송 마이크" },
    { id: "hall", label: "강당 울림" },
  ],
  effectDefault: "pa",
  chimeDefault: true,
  live: { maxSeconds: 600, idleSeconds: 15, sampleRateMin: 16000, sampleRateMax: 48000 },
  clip: { maxSeconds: 120, maxBytes: 10 * 1024 * 1024, types: [] },
};
const LIVE_KEY = ["broadcast", "live"] as const;

export default function MicPanel({
  names,
  targets,
  setTargets,
  canOperate,
  testSpeaker,
  onBusyChange,
}: {
  names: string[];
  targets: string[];
  setTargets: (t: string[]) => void;
  canOperate: boolean;
  /** 최고 관리자 — 대상에 시험 스피커 */
  testSpeaker?: boolean;
  /** 방송·녹음 중에는 바깥 탭을 잠근다 */
  onBusyChange: (busy: boolean) => void;
}) {
  const qc = useQueryClient();
  const optionsQ = useQuery({ queryKey: ["broadcast", "mic-options"], queryFn: broadcastApi.micOptions, staleTime: 60_000 });
  const opts = optionsQ.data ?? FALLBACK;
  const [mode, setMode] = useState<Mode>("live");
  const [effectPick, setEffect] = useState<string | null>(null);
  const [chimePick, setChime] = useState<boolean | null>(null);
  const effect = effectPick ?? opts.effectDefault;
  const chime = chimePick ?? opts.chimeDefault;

  const live = useLiveMic();
  const rec = useClipRecorder(opts.clip.maxSeconds);
  const [sending, setSending] = useState(false);

  const mine = live.state !== "idle";
  const recording = rec.state === "recording" || rec.state === "starting";
  const busy = mine || recording || sending;
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  // 누가 실시간 방송 중인지 (다른 기기·탭이면 버튼을 잠근다)
  const statusQ = useQuery({ queryKey: LIVE_KEY, queryFn: broadcastApi.liveStatus, refetchInterval: 3000 });
  const other = statusQ.data?.active && !mine ? statusQ.data : null;
  // 내 방송이 막 끝났을 때 남아 있는 '방송 중' 표시를 바로 지운다
  useEffect(() => {
    if (!mine) qc.invalidateQueries({ queryKey: LIVE_KEY });
  }, [mine, qc]);

  const liveElapsed = useElapsed(live.state === "live" ? live.startedAt : null);
  const recElapsed = useElapsed(rec.state === "recording" ? rec.startedAt : null);
  const noTarget = targets.length === 0;

  // 버튼 상태와 아래 글자
  const [btn, label] = ((): [MicButtonState, string] => {
    if (mode === "live") {
      if (live.state === "live") return ["active", "끝내기"];
      if (live.state === "connecting") return ["waiting", "준비 중"];
      if (live.state === "stopping") return ["waiting", "마치는 중"];
      if (other) return ["disabled", `${other.by ?? "다른 기기"} 방송 중`];
      if (!canOperate) return ["disabled", "부원 이상만 쓸 수 있어요"];
      if (noTarget) return ["disabled", "대상을 골라 주세요"];
      return ["idle", "마이크 켜기"];
    }
    if (rec.state === "recording") return ["active", "끝내기"];
    if (rec.state === "starting") return ["waiting", "준비 중"];
    if (!canOperate) return ["disabled", "부원 이상만 쓸 수 있어요"];
    return ["idle", "녹음 시작"];
  })();

  const press = () => {
    if (mode === "live") {
      if (live.state === "idle") live.start({ targets, effect, chime });
      else live.stop();
    } else if (rec.state === "idle") rec.start();
    else if (rec.state === "recording") rec.stop();
  };

  const sendClip = async () => {
    const clip = rec.clip;
    if (!clip || sending) return;
    rec.stopPlayback();
    setSending(true);
    try {
      await broadcastApi.clip(clip.blob, clip.filename, targets, effect, chime);
      toast.success("녹음 방송을 마쳤어요");
      rec.discard();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "녹음 방송을 못 했어요");
    } finally {
      setSending(false);
    }
  };

  const ready = mode === "clip" && rec.state === "ready" && rec.clip;

  return (
    <>
      <Block className="items-center gap-5 md:gap-6">
        <div data-tour="main.mic.mode">
          <Segmented<Mode>
            value={mode}
            onChange={(m) => {
              if (m === "live" && rec.state === "ready") rec.stopPlayback();
              setMode(m);
            }}
            disabled={busy}
            options={[
              { value: "live", label: "실시간" },
              { value: "clip", label: "녹음 후 방송" },
            ]}
          />
        </div>

        {ready ? (
          <div className="flex w-full flex-col items-center gap-3 py-2">
            <Waveform peaks={rec.clip!.peaks} className="w-full max-w-[340px]" />
            <p className="font-pretendard text-[13px] text-white/60">
              <span className="font-orbitron tabular-nums">{fmtClock(rec.clip!.seconds).replace(/^0/, "")}</span> 녹음됨
            </p>
            <div className="flex flex-wrap justify-center gap-2" data-tour="main.mic.button">
              <Chip disabled={sending} onClick={rec.discard}>
                다시
              </Chip>
              <Chip disabled={sending} active={rec.playing} onClick={rec.togglePlay}>
                {rec.playing ? "■ 멈추기" : "▶ 들어보기"}
              </Chip>
              <Chip active={!sending && !noTarget && canOperate} disabled={sending || noTarget || !canOperate || !!other} onClick={sendClip}>
                {sending ? "방송 중" : noTarget ? "대상을 골라 주세요" : "방송하기"}
              </Chip>
            </div>
          </div>
        ) : (
          <MicButton
            state={btn}
            label={label}
            elapsed={mode === "live" ? liveElapsed : recElapsed}
            analyser={mode === "live" ? live.analyser : rec.analyser}
            onPress={press}
          />
        )}

        {mode === "live" && live.state === "live" && (
          <p className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-center font-pretendard text-[12px] text-amber-100/85">
            켜진 스피커 가까이에서 말하면 삐 소리가 날 수 있어요
          </p>
        )}
      </Block>

      <Block>
        <div className="flex flex-col gap-2.5" data-tour="main.mic.effect">
          <Label>효과</Label>
          <div className="flex flex-wrap gap-2">
            {opts.effects.map((e) => (
              <Chip key={e.id} active={e.id === effect} disabled={busy} onClick={() => setEffect(e.id)}>
                {e.label}
              </Chip>
            ))}
          </div>
        </div>
        <div data-tour="main.mic.chime" className="flex items-center justify-between gap-3">
          <span className="font-pretendard text-[15px] font-semibold text-white">딩동댕 시작음·끝음</span>
          <Switch checked={chime} onChange={setChime} disabled={busy} label="딩동댕 시작음·끝음" />
        </div>
      </Block>

      <Block className={cn(mine && "pointer-events-none opacity-60")}>
        <TargetPicker names={names} selected={targets} onChange={setTargets} disabled={mine || sending} testSpeaker={testSpeaker} />
      </Block>
    </>
  );
}
