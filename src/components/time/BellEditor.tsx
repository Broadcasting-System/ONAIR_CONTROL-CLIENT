import { useState, useEffect } from "react";
import { Bell, Speaker, AudioFile } from "@/types/time";
import { cn } from "@/lib/utils";
import TextInput from "@/components/common/TextInput";
import Button from "@/components/common/Button";

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

  useEffect(() => {
    if (bell) {
      setLabel(bell.label);
      setTime(bell.time);
      setAudioFile(bell.audioFile);
      setSelectedSpeakers(bell.speakers);
    } else {
      setLabel("");
      setTime("");
      setAudioFile("");
      setSelectedSpeakers([]);
    }
  }, [bell]);

  const toggleSpeaker = (id: string) => {
    setSelectedSpeakers((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // 빠른 선택: 학년(1~3학년 반)·전 학년·학교 전체 일괄 토글
  const QUICK_GROUPS: { label: string; test: RegExp | null }[] = [
    { label: "1학년", test: /^1-\d/ },
    { label: "2학년", test: /^2-\d/ },
    { label: "3학년", test: /^3-\d/ },
    { label: "전 학년", test: /^\d-\d/ },
    { label: "학교 전체", test: null },
  ];

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
    if (!label.trim()) return;
    onSave({
      id: bell?.id || Date.now().toString(),
      label,
      time,
      audioFile,
      speakers: selectedSpeakers,
    });
  };

  return (
    <div className="flex flex-col w-full max-w-[600px] h-full gap-6">
      <TextInput
        value={label}
        onChange={setLabel}
        placeholder="라벨을 붙여주세요"
        width="100%"
      />

      {/* 빠른 선택 버튼 (학년/전체 일괄 토글) */}
      <div className="flex flex-col gap-2 px-2">
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
                  "rounded-lg border px-4 py-2 font-mbc text-sm transition-colors",
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

      <div className="grid grid-cols-3 gap-x-4 gap-y-3 px-2 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar">
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

      <div className="flex gap-6 px-2 mt-auto pb-4">
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-white text-[15px] font-bold">시보 시간</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-[48px] w-full rounded-xl border border-white/5 bg-[#1C1C1C] px-4 text-md font-pretendard text-white focus:border-white/20 focus:outline-none transition-all [color-scheme:dark]"
          />
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-white text-[15px] font-bold">
            시보 음악
          </label>
          <select
            value={audioFile}
            onChange={(e) => setAudioFile(e.target.value)}
            className="h-[48px] w-full rounded-xl border border-white/5 bg-[#1C1C1C] px-4 text-md font-pretendard text-white focus:border-white/20 focus:outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="" disabled>
              음악을 선택해주세요
            </option>
            <option value="none">없음</option>
            {audioFiles.map((file) => (
              // value는 URL(서버가 실제 파일을 찾는 경로), 표시는 이름
              <option key={file.id} value={file.url}>
                {file.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-4 mt-2 px-2 pb-4">
        {bell && onDelete && (
          <div className="flex-1">
            <Button
              label="삭제"
              onClick={onDelete}
              color="red"
              className="h-[64px]"
            />
          </div>
        )}
        <div className="flex-1">
          <Button
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
