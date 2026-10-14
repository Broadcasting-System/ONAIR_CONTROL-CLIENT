import { useState, useEffect, useRef } from "react";
import { Bell, Speaker, AudioFile } from "@/types/time";
import { cn } from "@/lib/utils";
import TextInput from "@/components/common/TextInput";
import Button from "@/components/common/Button";
import Select from "@/components/common/Select";
import { TimePicker } from "@/components/common/DateTimePicker";
import { getApiBase } from "@/lib/apiBase";

const VOLUME_MIN = 10;
const VOLUME_MAX = 150;

/** 시보 음악을 기기 호스트와 무관하게 식별하기 위한 정규화.
 *  절대 URL(http://host:8000/api/files/stream/audio/x.mp3)이 기기마다 호스트가 달라
 *  드롭다운이 매칭에 실패("없음")하던 문제를 해결 → 경로(pathname)만 저장·비교. */
function audioKey(u: string): string {
  if (!u || u === "none") return u;
  try {
    return u.startsWith("http") ? new URL(u).pathname : u;
  } catch {
    return u;
  }
}

interface BellEditorProps {
  bell: Bell | null;
  speakers: Speaker[];
  audioFiles: AudioFile[];
  onSave: (bell: Bell) => void;
  onDelete?: () => void;
}

export default function BellEditor({
  bell,
  speakers,
  audioFiles,
  onSave,
  onDelete,
}: BellEditorProps) {
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("");
  const [audioFile, setAudioFile] = useState("");
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>([]);
  const [volume, setVolume] = useState(100);
  const [previewing, setPreviewing] = useState<"idle" | "loading" | "playing">("idle");
  const previewRef = useRef<HTMLAudioElement | null>(null);

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
  useEffect(() => () => stopPreview(), [bell]);

  useEffect(() => {
    if (bell) {
      setLabel(bell.label);
      setTime(bell.time);
      setAudioFile(audioKey(bell.audioFile)); // 레거시 절대 URL → 경로로 정규화
      setSelectedSpeakers(bell.speakers);
      setVolume(bell.volume ?? 100);
    } else {
      setLabel("");
      setTime("");
      setAudioFile("");
      setSelectedSpeakers([]);
      setVolume(100);
    }
  }, [bell]);

  const toggleSpeaker = (id: string) => {
    setSelectedSpeakers((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // 빠른 선택: 스피커 이름('학년-반')에서 학년을 뽑아 버튼을 만든다 — 학교마다 학년 수가 달라도 맞게
  const grades = Array.from(
    new Set(speakers.map((s) => /^(\d+)-\d+/.exec(s.id)?.[1]).filter((g): g is string => !!g)),
  ).sort((a, b) => Number(a) - Number(b));
  const QUICK_GROUPS: { label: string; test: RegExp | null }[] = [
    ...grades.map((g) => ({ label: `${g}학년`, test: new RegExp(`^${g}-\\d`) })),
    ...(grades.length > 1 ? [{ label: "전 학년", test: /^\d+-\d/ }] : []),
    { label: "학교 전체", test: null },
  ];

  // 스피커 매핑이 바뀌어 지금 목록에 없는 대상 — 보이지 않으면 뺄 수도 없어 소리 없는 시보가 된다
  const knownIds = new Set(speakers.map((s) => s.id));
  const staleSpeakers = selectedSpeakers.filter((id) => !knownIds.has(id));

  const groupIds = (test: RegExp | null) =>
    speakers.filter((s) => (test ? test.test(s.id) : true)).map((s) => s.id);

  const toggleGroup = (ids: string[]) => {
    setSelectedSpeakers((prev) => {
      const allOn = ids.length > 0 && ids.every((id) => prev.includes(id));
      if (allOn) return prev.filter((id) => !ids.includes(id));
      const set = new Set(prev);
      ids.forEach((id) => set.add(id));
      return Array.from(set);
    });
  };

  const handleSave = () => {
    // 시간이 비었거나 형식이 틀리면 서버가 거부한다 (재등록 중 기존 시보까지 사라지는 것 방지)
    if (!label.trim() || !/^\d{1,2}:\d{2}$/.test(time)) return;
    onSave({
      id: bell?.id || Date.now().toString(),
      label,
      time,
      audioFile,
      speakers: selectedSpeakers,
      volume,
    });
  };

  return (
    <div data-tour="time.editor" className="flex w-full max-w-[600px] flex-col gap-5 md:h-full md:gap-6">
      <TextInput
        tour="time.editor.label"
        value={label}
        onChange={setLabel}
        placeholder="라벨"
        width="100%"
      />

      {/* 빠른 선택 버튼 (학년/전체 일괄 토글) */}
      <div data-tour="time.editor.quick" className="flex flex-col gap-2 md:px-2">
        <span className="font-mbc text-sm text-white/50">빠른 선택</span>
        <div className="flex flex-wrap gap-2">
          {QUICK_GROUPS.map((g) => {
            const ids = groupIds(g.test);
            const active =
              ids.length > 0 && ids.every((id) => selectedSpeakers.includes(id));
            return (
              <button
                key={g.label}
                type="button"
                onClick={() => toggleGroup(ids)}
                className={cn(
                  "min-h-[44px] rounded-lg border px-4 py-2 font-mbc text-sm transition-colors md:min-h-0",
                  active
                    ? "border-[#c4b5fd] bg-[#a78bfa]/20 text-white"
                    : "border-white/15 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white",
                )}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {staleSpeakers.length > 0 && (
        <div className="flex flex-col gap-2 md:px-2">
          <span className="font-mbc text-sm text-amber-200/80">
            목록에 없는 대상
          </span>
          <div className="flex flex-wrap gap-2">
            {staleSpeakers.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleSpeaker(id)}
                className="min-h-[44px] rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 md:min-h-0 font-mbc text-sm text-amber-100 transition-colors hover:bg-amber-500/20"
              >
                {id} ×
              </button>
            ))}
          </div>
        </div>
      )}

      <div data-tour="time.editor.speakers" className="custom-scrollbar grid grid-cols-3 gap-x-2.5 gap-y-2.5 md:max-h-[350px] md:gap-x-4 md:gap-y-3 md:overflow-y-auto md:px-2 md:pr-4">
        {speakers.map((speaker) => {
          const isSelected = selectedSpeakers.includes(speaker.id);
          return (
            <button
              key={speaker.id}
              type="button"
              onClick={() => toggleSpeaker(speaker.id)}
              className={cn(
                "flex h-[44px] w-full items-center justify-center rounded-[10px] border px-2 text-center font-pretendard text-[15px] transition-all",
                isSelected
                  ? "border-[#c4b5fd] bg-[#a78bfa]/15 text-white shadow-[0_0_14px_-3px_#a78bfa]"
                  : "border-[#7c6db0]/35 bg-white/[0.02] text-white/70 hover:border-[#7c6db0]/70 hover:text-white"
              )}
            >
              {speaker.name}
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col gap-4 md:flex-row md:gap-6 md:px-2">
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-white text-[15px] font-bold">시보 시간</label>
          <TimePicker
            tour="time.editor.time"
            value={time}
            onChange={setTime}
            className="h-[48px] border-white/5 bg-[#1C1C1C] text-base"
          />
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-white text-[15px] font-bold">
            시보 음악
          </label>
          <Select
            tour="time.editor.audio"
            value={audioKey(audioFile)}
            onChange={setAudioFile}
            placeholder="음악 선택"
            options={[
              { value: "none", label: "없음" },
              // value·저장값 모두 호스트 없는 경로로 통일 → 기기 간 동기화
              ...audioFiles.map((file) => ({ value: audioKey(file.url), label: file.name })),
            ]}
            className="h-[48px] w-full rounded-xl border-white/5 bg-[#1C1C1C] px-4 text-md focus:border-white/20 max-md:text-base"
          />
        </div>
      </div>

      <div data-tour="time.editor.volume" className="flex flex-col gap-3 md:px-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="bell-volume" className="text-white text-[15px] font-bold">
            송출 볼륨
          </label>
          <span className="font-orbitron text-[15px] tabular-nums text-white">{volume}%</span>
        </div>
        <div className="flex items-center gap-4">
          <input
            id="bell-volume"
            type="range"
            min={VOLUME_MIN}
            max={VOLUME_MAX}
            step={5}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            onPointerDown={() => previewing !== "idle" && stopPreview()}
            onDoubleClick={() => setVolume(100)}
            className="h-11 flex-1 cursor-pointer accent-[#a78bfa] max-md:min-w-0 md:h-2"
          />
          <button
            type="button"
            data-tour="time.editor.preview"
            onClick={togglePreview}
            disabled={!audioFile || audioFile === "none"}
            className={cn(
              "h-11 shrink-0 rounded-lg border px-4 font-mbc md:h-[40px] text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35",
              previewing !== "idle"
                ? "border-[#c4b5fd] bg-[#a78bfa]/20 text-white"
                : "border-white/15 bg-white/[0.03] text-white/70 hover:border-white/30 hover:text-white",
            )}
          >
            {previewing === "loading" ? "준비 중" : previewing === "playing" ? "정지" : "미리 듣기"}
          </button>
        </div>
      </div>

      <div className="mt-2 flex gap-3 pb-4 md:gap-4 md:px-2">
        {bell && onDelete && (
          <div className="flex-1">
            <Button
              tour="time.editor.delete"
              label="삭제"
              onClick={onDelete}
              color="red"
              className="h-[64px]"
            />
          </div>
        )}
        <div className="flex-1">
          <Button
            tour="time.editor.save"
            label="저장"
            onClick={handleSave}
            color="white"
            className="h-[64px]"
          />
        </div>
      </div>
    </div>
  );
}
