import { useState, useEffect } from "react";
import { Bell, Speaker, AudioFile } from "@/types/time";
import TextInput from "@/components/common/TextInput";
import StatusCard from "@/components/StatusCard";
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
    <div className="flex flex-col w-[864px] h-full gap-8">
      {/* Title Input */}
      <TextInput
        value={label}
        onChange={setLabel}
        placeholder="라벨을 붙여주세요"
        width="100%"
      />

      {/* Speakers Grid */}
      <div className="grid grid-cols-3 gap-x-[68px] gap-y-4 px-10 max-h-[460px] overflow-y-auto pr-4 custom-scrollbar">
        {speakers.map((speaker) => {
          const isSelected = selectedSpeakers.includes(speaker.id);
          return (
            <StatusCard
              key={speaker.id}
              label={speaker.name}
              status={isSelected ? "on" : "off"}
              variant="speaker"
              width="217px"
              onClick={() => toggleSpeaker(speaker.id)}
            />
          );
        })}
      </div>

      {/* Time & Audio Settings */}
      <div className="flex gap-[40px] px-10 mt-auto pb-4">
        <div className="flex-1 flex flex-col gap-3">
          <label className="text-white text-[16px] font-bold">시보 시간</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-[59px] w-full rounded-xl border border-white/5 bg-[#1C1C1C] px-6 text-lg font-pretendard text-white focus:border-white/20 focus:outline-none transition-all [color-scheme:dark]"
          />
        </div>
        <div className="flex-1 flex flex-col gap-3">
          <label className="text-white text-[16px] font-bold">
            시보 음악 (클릭하여 변경)
          </label>
          <select
            value={audioFile}
            onChange={(e) => setAudioFile(e.target.value)}
            className="h-[59px] w-full rounded-xl border border-white/5 bg-[#1C1C1C] px-6 text-lg font-pretendard text-white focus:border-white/20 focus:outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="" disabled>
              음악을 선택해주세요
            </option>
            <option value="none">없음</option>
            {audioFiles.map((file) => (
              <option key={file.id} value={file.name}>
                {file.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Editor Local Actions */}
      <div className="flex gap-4 mt-2 self-end w-[495px]">
        {bell && onDelete && (
          <div className="flex-1">
            <Button
              label="삭제"
              onClick={onDelete}
              color="red"
              className="h-[58px]"
            />
          </div>
        )}
        <div className="flex-1">
          <Button
            label="저장"
            onClick={handleSave}
            color="white"
            className="h-[58px]"
          />
        </div>
      </div>
    </div>
  );
}
