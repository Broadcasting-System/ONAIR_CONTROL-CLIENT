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
    <div className="flex flex-col w-full max-w-[600px] h-full gap-6">
      <TextInput
        value={label}
        onChange={setLabel}
        placeholder="라벨을 붙여주세요"
        width="100%"
      />

      <div className="grid grid-cols-3 gap-x-4 gap-y-3 px-2 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar">
        {speakers.map((speaker) => {
          const isSelected = selectedSpeakers.includes(speaker.id);
          return (
            <StatusCard
              key={speaker.id}
              label={speaker.name}
              status={isSelected ? "on" : "off"}
              variant="speaker"
              width="100%"
              onClick={() => toggleSpeaker(speaker.id)}
            />
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
