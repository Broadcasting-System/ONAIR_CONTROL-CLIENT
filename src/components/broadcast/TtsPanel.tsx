"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Square } from "lucide-react";
import Button from "@/components/common/Button";
import Select from "@/components/common/Select";
import CueRing from "@/components/common/CueRing";
import { toast } from "@/components/common/Toast";
import { useTts } from "@/hooks/useTts";
import { useFiles } from "@/hooks/useFiles";
import {
  broadcastApi, fmtRate, RATE_MAX, RATE_MIN, TTS_MAX_CHARS, voiceCardText, type TtsVoice,
} from "@/lib/broadcastApi";
import { cn } from "@/lib/utils";
import TargetPicker from "./TargetPicker";
import { Block, Label } from "./parts";

const GTTS_ONLY: TtsVoice[] = [{ id: "gtts", label: "기본", gender: null, tier: null, provider: "gtts" }];

/** 목소리 미리 듣기 — 한 번에 하나, 다른 걸 누르면 앞의 것은 멈춘다 */
function useVoicePreview() {
  const [current, setCurrent] = useState<{ voice: string; status: "loading" | "playing" } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    const a = audioRef.current;
    audioRef.current = null;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setCurrent(null);
  }, []);

  const toggle = useCallback(
    async (voice: string, rate: number) => {
      const same = current?.voice === voice;
      stop();
      if (same) return;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setCurrent({ voice, status: "loading" });
      try {
        const { blob, fallback } = await broadcastApi.preview(voice, rate, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (fallback) toast.info("기본 목소리로 들려줘요");
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const a = new Audio(url);
        audioRef.current = a;
        a.onplaying = () => audioRef.current === a && setCurrent({ voice, status: "playing" });
        a.onended = a.onerror = () => audioRef.current === a && stop();
        await a.play();
      } catch (e) {
        if (ctrl.signal.aborted) return;
        stop();
        toast.error(e instanceof Error && e.message ? e.message : "미리 듣기를 못 했어요");
      }
    },
    [current, stop],
  );

  useEffect(() => () => stop(), [stop]);
  return { current, toggle, stop };
}

export default function TtsPanel({
  names,
  targets,
  setTargets,
  canOperate,
}: {
  names: string[];
  targets: string[];
  setTargets: (t: string[]) => void;
  canOperate: boolean;
}) {
  const voicesQ = useQuery({ queryKey: ["tts", "voices"], queryFn: broadcastApi.voices, staleTime: 60_000 });
  const voices = voicesQ.data?.voices?.length ? voicesQ.data.voices : GTTS_ONLY;
  const [voice, setVoice] = useState<string | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const selectedVoice = voice ?? voicesQ.data?.defaultVoice ?? "gtts";
  const speakingRate = rate ?? voicesQ.data?.speakingRate ?? 1;
  const isGoogle = voices.find((v) => v.id === selectedVoice)?.provider === "google";
  const preview = useVoicePreview();

  const { text, setText, handleSend, isSending, startSound, setStartSound, endSound, setEndSound } = useTts({
    targets,
    voice: selectedVoice,
    rate: speakingRate,
  });
  const { files, fetchFiles } = useFiles();
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);
  const audioFiles = files.audio ?? [];

  // 접힌 목록: 2줄 (칸이 좁으면 2개씩 · 넓으면 4개씩). 고른 목소리는 늘 보이게
  const fold = 4;
  let shown = voices;
  if (!more && voices.length > fold) {
    shown = voices.slice(0, fold);
    const sel = voices.find((v) => v.id === selectedVoice);
    if (sel && !shown.includes(sel)) shown = [...shown.slice(0, fold - 1), sel];
  }

  const noTarget = targets.length === 0;
  const sendLabel = isSending ? "송출 중..." : noTarget ? "대상을 골라 주세요" : "TTS 송출하기";

  return (
    <>
      <Block>
        <div className="relative">
          <textarea
            data-tour="main.tts-input"
            value={text}
            maxLength={TTS_MAX_CHARS}
            onChange={(e) => setText(e.target.value.slice(0, TTS_MAX_CHARS))}
            placeholder="방송할 텍스트"
            rows={3}
            className="block min-h-[96px] w-full resize-none rounded-xl border border-white/5 bg-[#1C1C1C] px-5 py-4 pb-7 font-pretendard text-[16px] leading-relaxed text-white placeholder:text-white/20 transition-all focus:border-white/20 focus:outline-none md:text-lg"
          />
          <span
            className={cn(
              "pointer-events-none absolute bottom-2 right-3 font-orbitron text-[10px] tabular-nums",
              text.length >= TTS_MAX_CHARS ? "text-[#FF6B6B]" : "text-white/25",
            )}
          >
            {text.length}/{TTS_MAX_CHARS}
          </span>
        </div>
      </Block>

      <Block>
        <div className="flex flex-col gap-2.5" data-tour="main.tts-voices">
          <Label
            right={
              voices.length > fold ? (
                <button
                  type="button"
                  onClick={() => setMore((m) => !m)}
                  className="font-pretendard text-[13px] text-white/50 hover:text-white"
                >
                  {more ? "접기" : `더 보기 ${voices.length - fold}`}
                </button>
              ) : null
            }
          >
            목소리
          </Label>
          <div
            role="radiogroup"
            aria-label="목소리"
            className={cn(
              "grid grid-cols-2 gap-2 md:grid-cols-[repeat(auto-fill,minmax(136px,1fr))]",
              more && "custom-scrollbar max-h-[236px] overflow-y-auto pr-1",
            )}
          >
            {shown.map((v) => {
              const { title, tier } = voiceCardText(v);
              const on = v.id === selectedVoice;
              const pv = preview.current?.voice === v.id ? preview.current.status : null;
              return (
                <div
                  key={v.id}
                  role="radio"
                  aria-checked={on}
                  tabIndex={0}
                  onClick={() => setVoice(v.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setVoice(v.id))}
                  className={cn(
                    "flex h-[54px] cursor-pointer items-center gap-2 rounded-xl border pl-3 pr-2 transition-colors",
                    on ? "border-white bg-white/[0.09]" : "border-white/10 bg-white/[0.04] hover:border-white/25",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-pretendard text-[14px] font-semibold text-white">{title}</p>
                    <p className="truncate font-pretendard text-[11px] text-white/45">{tier}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`${title} 미리 듣기`}
                    onClick={(e) => {
                      e.stopPropagation();
                      preview.toggle(v.id, speakingRate);
                    }}
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                      pv ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20",
                    )}
                  >
                    {pv === "loading" ? (
                      <CueRing size={18} className="text-black" />
                    ) : pv === "playing" ? (
                      <Square size={11} fill="currentColor" />
                    ) : (
                      <Play size={12} fill="currentColor" className="ml-0.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div data-tour="main.tts-rate" className={cn("flex flex-col gap-1.5", !isGoogle && "opacity-40")}>
          <Label right={<span className="font-orbitron text-[13px] tabular-nums text-white">{fmtRate(speakingRate)}×</span>}>
            빠르기
          </Label>
          <input
            type="range"
            aria-label="빠르기"
            min={RATE_MIN}
            max={RATE_MAX}
            step={0.05}
            value={speakingRate}
            disabled={!isGoogle}
            onChange={(e) => setRate(Number(e.target.value))}
            onDoubleClick={() => setRate(voicesQ.data?.speakingRate ?? 1)}
            className="h-8 w-full cursor-pointer accent-white disabled:cursor-not-allowed md:h-5"
          />
        </div>

        <div className="flex gap-3 md:gap-4">
          <SoundSelect label="시작 음원" tour="main.tts-start-sound" value={startSound} onChange={setStartSound} options={audioFiles} />
          <SoundSelect label="끝 음원" tour="main.tts-end-sound" value={endSound} onChange={setEndSound} options={audioFiles} />
        </div>
      </Block>

      <Block>
        <TargetPicker names={names} selected={targets} onChange={setTargets} />
      </Block>

      <Button
        label={sendLabel}
        onClick={handleSend}
        disabled={!text.trim() || isSending || !canOperate || noTarget}
        className="h-[64px]"
        tour="main.tts-send"
      />
    </>
  );
}

function SoundSelect({
  label,
  value,
  onChange,
  options,
  tour,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; fileName: string; fileUrl: string }[];
  tour?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="font-mbc text-sm text-white/50">{label}</span>
      <Select
        value={value}
        onChange={onChange}
        options={[
          { value: "none", label: "미사용" },
          ...options.map((f) => ({ value: f.fileUrl, label: f.fileName })),
        ]}
        className="h-[48px] w-full rounded-xl bg-[#1C1C1C] px-4 text-[15px]"
        tour={tour}
      />
    </div>
  );
}
