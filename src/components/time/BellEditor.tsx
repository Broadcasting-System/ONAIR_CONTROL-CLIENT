"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Loader2, Music, Pencil, Play, Square } from "lucide-react";
import { Bell, AudioFile, DayType } from "@/types/time";
import NeonButton from "@/components/common/NeonButton";
import { cn } from "@/lib/utils";
import Select from "@/components/common/Select";
import { TimePicker } from "@/components/common/DateTimePicker";
import { toast } from "@/components/common/Toast";
import { getApiBase } from "@/lib/apiBase";
import { DAY_LABEL, WEEKDAYS } from "@/constants/days";
import { audioKey, type SpeakerSection } from "./bellUtils";
import SpeakerPicker from "./SpeakerPicker";

const VOLUME_MIN = 10;
const VOLUME_MAX = 150;

interface BellEditorProps {
  /** 고칠 시보 (새 시보면 null) */
  bell: Bell | null;
  sections: SpeakerSection[];
  /** 최고 관리자 — 장소에 시험 스피커 */
  testSpeaker?: boolean;
  audioFiles: AudioFile[];
  /** 울리는 요일 처음 값. null 이면 요일 줄을 숨긴다 (특별 P) */
  initialDays: DayType[] | null;
  onSave: (bell: Bell, days: DayType[] | null) => void;
  onDelete?: () => void;
  className?: string;
}

/** 시보 하나 편집 — 저장·지우기는 화면 안에서만 바뀌고, 적용하기로 서버에 보낸다 */
export default function BellEditor({ bell, sections, testSpeaker, audioFiles, initialDays, onSave, onDelete, className }: BellEditorProps) {
  const [label, setLabel] = useState(bell?.label ?? "");
  const [time, setTime] = useState(bell?.time ?? "");
  // 레거시 절대 URL → 경로로 정규화
  const [audioFile, setAudioFile] = useState(bell ? audioKey(bell.audioFile) : "");
  const [speakers, setSpeakers] = useState<string[]>(bell?.speakers ?? []);
  const [volume, setVolume] = useState(bell?.volume ?? 100);
  const [days, setDays] = useState<DayType[]>(initialDays ?? []);
  const [previewing, setPreviewing] = useState<"idle" | "loading" | "playing">("idle");
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  const stopPreview = () => {
    const a = previewRef.current;
    previewRef.current = null;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    setPreviewing("idle");
  };

  // 서버가 방송과 똑같이 정규화·볼륨을 적용한 음원을 이 기기에서만 튼다 (스피커는 안 켠다)
  const togglePreview = () => {
    if (previewing !== "idle") return stopPreview();
    const a = new Audio(
      `${getApiBase()}/time/preview?audioFile=${encodeURIComponent(audioKey(audioFile))}&volume=${volume}`,
    );
    previewRef.current = a;
    setPreviewing("loading");
    a.onplaying = () => previewRef.current === a && setPreviewing("playing");
    a.onended = a.onerror = () => previewRef.current === a && stopPreview();
    a.play().catch(() => previewRef.current === a && stopPreview());
  };

  // 다른 시보로 바꾸거나 창을 닫으면 미리 듣기를 멈춘다
  useEffect(() => () => stopPreview(), []);

  // 새 시보는 이름부터
  useEffect(() => {
    if (!bell && window.matchMedia("(min-width: 768px)").matches) labelRef.current?.focus();
  }, [bell]);

  const handleSave = () => {
    // 시간이 비었거나 형식이 틀리면 서버가 거부한다 (재등록 중 기존 시보까지 사라지는 것 방지)
    if (!label.trim()) return toast.error("시보 이름을 넣어 주세요");
    if (!/^\d{1,2}:\d{2}$/.test(time)) return toast.error("울릴 시간을 골라 주세요");
    if (initialDays && !bell && days.length === 0) return toast.error("울리는 요일을 골라 주세요");
    onSave(
      {
        id: bell?.id || Date.now().toString(36),
        label: label.trim(),
        time,
        audioFile,
        speakers,
        volume,
      },
      initialDays ? WEEKDAYS.filter((d) => days.includes(d)) : null,
    );
  };

  const pct = ((volume - VOLUME_MIN) / (VOLUME_MAX - VOLUME_MIN)) * 100;

  return (
    <div data-tour="time.editor" className={cn("flex min-h-0 flex-col gap-3", className)}>
      <label className="flex min-w-0 items-center gap-2.5">
        <input
          ref={labelRef}
          data-tour="time.editor.label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="시보 이름"
          maxLength={40}
          className="min-w-[5ch] max-w-full bg-transparent font-mbc text-[22px] text-white outline-none placeholder:text-white/30 max-md:flex-1"
          style={{ fieldSizing: "content" } as CSSProperties}
        />
        <Pencil size={15} className="shrink-0 cursor-text text-white/40" aria-hidden />
      </label>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <TimePicker
          tour="time.editor.time"
          value={time}
          onChange={setTime}
          aria-label="울릴 시간"
          className="h-11 w-full border-white/10 bg-[#0c0d0f] font-orbitron text-[15px] font-semibold sm:w-[150px] md:h-10"
        />
        {initialDays && (
          <div data-tour="time.editor.days" className="flex flex-1 gap-[5px] sm:flex-none" role="group" aria-label="울리는 요일">
            {WEEKDAYS.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                  className={cn(
                    "flex h-11 min-w-0 flex-1 items-center justify-center rounded-[9px] border font-mbc text-[13.5px] transition-colors sm:w-9 sm:flex-none md:h-[34px]",
                    on ? "border-white bg-white text-[#0b0b0d]" : "border-white/[0.12] text-white/50 hover:text-white",
                  )}
                >
                  {DAY_LABEL[d]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 sm:w-auto sm:flex-1">
          <Music size={13} className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-white/40" />
          <Select
            tour="time.editor.audio"
            value={audioKey(audioFile)}
            onChange={setAudioFile}
            placeholder="음악 고르기"
            aria-label="시보 음악"
            options={[
              { value: "none", label: "없음" },
              // value·저장값 모두 호스트 없는 경로로 통일 → 기기 간 동기화
              ...audioFiles.map((file) => ({ value: audioKey(file.url), label: file.name })),
            ]}
            className="h-11 w-full rounded-xl border-white/10 bg-[#0c0d0f] pl-8 pr-3 text-[14px] md:h-10"
          />
        </div>
        <button
          type="button"
          data-tour="time.editor.preview"
          onClick={togglePreview}
          disabled={!audioFile || audioFile === "none"}
          aria-label={previewing === "idle" ? "미리 듣기" : "멈추기"}
          title={previewing === "idle" ? "미리 듣기" : "멈추기"}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border transition-colors disabled:cursor-not-allowed disabled:opacity-35 md:h-10 md:w-10",
            previewing !== "idle" ? "border-white bg-white text-[#0b0b0d]" : "border-white/[0.12] text-white/70 hover:text-white",
          )}
        >
          {previewing === "loading" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : previewing === "playing" ? (
            <Square size={11} fill="currentColor" />
          ) : (
            <Play size={12} fill="currentColor" />
          )}
        </button>
        <div data-tour="time.editor.volume" className="flex min-w-0 flex-1 items-center gap-2.5 sm:ml-1.5 sm:w-[160px] sm:flex-none">
          <input
            type="range"
            aria-label="송출 볼륨"
            min={VOLUME_MIN}
            max={VOLUME_MAX}
            step={5}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            onPointerDown={() => previewing !== "idle" && stopPreview()}
            onDoubleClick={() => setVolume(100)}
            style={{ "--p": `${pct}%` } as CSSProperties}
            className="h-11 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent md:h-6 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded [&::-moz-range-track]:bg-[linear-gradient(90deg,#fff_var(--p),rgba(255,255,255,0.1)_var(--p))] [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded [&::-webkit-slider-runnable-track]:bg-[linear-gradient(90deg,#fff_var(--p),rgba(255,255,255,0.1)_var(--p))] [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(0,0,0,0.45)]"
          />
          <span className="w-[42px] shrink-0 text-right font-orbitron text-[12px] tabular-nums text-white">{volume}%</span>
        </div>
      </div>

      <SpeakerPicker
        sections={sections}
        selected={speakers}
        onChange={setSpeakers}
        testSpeaker={testSpeaker}
        className="md:flex-1"
      />

      <div className="flex gap-2.5">
        {bell && onDelete && (
          <NeonButton tone="white" data-tour="time.editor.delete" onClick={onDelete} className="h-12 w-[110px] shrink-0 md:h-11">
            지우기
          </NeonButton>
        )}
        <NeonButton data-tour="time.editor.save" onClick={handleSave} className="h-12 flex-1 md:h-11">
          {bell ? "저장" : "추가"}
        </NeonButton>
      </div>
    </div>
  );
}
