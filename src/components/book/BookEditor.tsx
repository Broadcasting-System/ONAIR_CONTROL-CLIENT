import { useState, useEffect } from "react";
import { Book, BookDayType } from "@/types/book";
import TextInput from "@/components/common/TextInput";
import Button from "@/components/common/Button";
import { cn } from "@/lib/utils";
import MediaSelectModal from "@/components/common/MediaSelectModal";
import { UploadedFile } from "@/types/file";

const DAY_OPTIONS: { label: string; value: BookDayType }[] = [
  { label: "M", value: "M" },
  { label: "T", value: "T" },
  { label: "W", value: "W" },
  { label: "TH", value: "TH" },
  { label: "F", value: "F" },
  { label: "P", value: "P" },
];

interface BookEditorProps {
  book: Book | null;
  onSave: (book: Book) => void;
  onDelete?: () => void;
}

export default function BookEditor({ book, onSave, onDelete }: BookEditorProps) {
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [selectedDays, setSelectedDays] = useState<BookDayType[]>([]);
  const [mediaUrl, setMediaUrl] = useState<string | undefined>(undefined);
  const [mediaType, setMediaType] = useState<string | undefined>(undefined);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    if (book) {
      setName(book.name || "");
      setTime(book.time || "");
      setDate(book.date || "");
      setSelectedDays(book.days || ["M"]);
      setMediaUrl(book.mediaUrl);
      setMediaType(book.mediaType);
    } else {
      setName("");
      setTime("");
      setDate("");
      setSelectedDays(["M"]);
      setMediaUrl(undefined);
      setMediaType(undefined);
    }
  }, [book]);

  const toggleDay = (day: BookDayType) => {
    if (day === "P") {
      setSelectedDays(["P"]);
      return;
    }

    if (selectedDays.includes("P")) {
      setSelectedDays([day]);
      return;
    }

    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError("예약 이름을 입력해주세요.");
      return;
    }
    if (selectedDays.length === 0) {
      setError("요일(또는 특수일)을 선택해주세요.");
      return;
    }
    if (selectedDays.includes("P") && !date) {
      setError("특수일은 예약 날짜를 선택해주세요.");
      return;
    }
    if (!time) {
      setError("예약 시간을 선택해주세요.");
      return;
    }
    if (!mediaUrl) {
      setError("송출할 미디어를 선택해주세요.");
      return;
    }
    setError("");

    onSave({
      id: book?.id || `book_${Date.now()}`,
      name,
      time,
      date: selectedDays.includes("P") ? date : undefined,
      days: selectedDays,
      mediaUrl,
      mediaType,
    });
  };

  const handleSelectMedia = (file: UploadedFile) => {
    setMediaUrl(file.fileUrl);
    setMediaType(file.type);
    setIsMediaModalOpen(false);
  };

  const isSpecial = selectedDays.includes("P");

  return (
    <div className="flex flex-col w-full max-w-[600px] h-full gap-6 mx-auto">
      <div className="w-full aspect-video bg-[#0a0a0a] rounded-2xl flex flex-col justify-center items-center border border-white/10 relative overflow-hidden shadow-inner">
        {mediaUrl ? (
          <div className="flex flex-col items-center gap-3">
            <div className="text-white/60 text-sm">선택된 미디어:</div>
            <div className="text-white text-lg font-bold px-4 py-2 bg-white/5 rounded-lg border border-white/10 max-w-[80%] truncate">
              {mediaUrl.split("/").pop()}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span className="text-[40px] font-black text-red-500 tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">OFF AIR</span>
            <span className="text-[#a0a0a0] text-sm mt-2">사용할 미디어를 선택해주세요.</span>
          </div>
        )}
      </div>

      <div className="flex gap-4 px-2 justify-center">
        <Button
          label="예약 미디어 변경"
          color="white"
          onClick={() => setIsMediaModalOpen(true)}
          className="h-[48px] px-8 text-base flex-1 max-w-[240px]"
        />
        <Button
          label="미디어 삭제"
          color="red"
          onClick={() => setMediaUrl(undefined)}
          className="h-[48px] px-8 text-base flex-1 max-w-[240px]"
          disabled={!mediaUrl}
        />
      </div>

      <div className="flex gap-4 justify-center mt-4">
        {DAY_OPTIONS.map(({ label, value }) => {
          const isActive = selectedDays.includes(value);
          return (
            <button
              key={value}
              onClick={() => toggleDay(value)}
              className={cn(
                "flex items-center justify-center w-[64px] h-[64px] rounded-[6px] transition-all",
                isActive
                  ? "bg-[#111] border-[1.5px] border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                  : "bg-[#111] border border-white/20 text-white/40 hover:border-white/40 hover:text-white/80"
              )}
            >
              <span className="font-pretendard font-medium text-[24px]">
                {label === "TH" ? "T" : label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 px-2 mb-auto">
        <div className="flex flex-col gap-2">
          <label className="text-white text-lg font-bold text-center">예약 이름</label>
          <TextInput
            value={name}
            onChange={setName}
            placeholder="방송 이름을 입력하세요"
            width="100%"
          />
        </div>

        <div className="flex gap-6 w-full mt-2">
          {isSpecial ? (
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-white text-lg font-bold text-center">예약 날짜</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-[64px] w-full rounded-xl border border-white/5 bg-[#1C1C1C] px-6 text-lg font-pretendard text-white focus:border-white/20 focus:outline-none transition-all [color-scheme:dark]"
              />
            </div>
          ) : null}

          <div className="flex-1 flex flex-col gap-2">
            <label className="text-white text-lg font-bold text-center">예약 시간</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-[64px] w-full rounded-xl border border-white/5 bg-[#1C1C1C] px-6 text-lg font-pretendard text-white focus:border-white/20 focus:outline-none transition-all [color-scheme:dark]"
            />
          </div>
        </div>
      </div>

      {error ? (
        <p className="px-2 text-center text-sm font-pretendard text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex gap-4 mt-auto px-2 pb-4">
        {book ? (
          onDelete ? (
            <div className="flex-1">
              <Button
                label="예약 삭제"
                onClick={onDelete}
                color="red"
                className="h-[64px]"
              />
            </div>
          ) : null
        ) : null}
        <div className="flex-1">
          <Button
            label={book ? "변경사항 저장" : "예약 추가하기"}
            onClick={handleSave}
            color="#4B7BFF"
            glowSize="15px"
            className="h-[64px]"
          />
        </div>
      </div>

      {isMediaModalOpen && (
        <MediaSelectModal
          onSelect={handleSelectMedia}
          onClose={() => setIsMediaModalOpen(false)}
        />
      )}
    </div>
  );
}
