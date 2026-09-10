import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { FileType } from "@/types/file";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  type: FileType;
  fileName: string;
  /** 프레젠테이션 슬라이드 이미지들 (없으면 fileUrl 한 장) */
  urls?: string[];
}

export default function PreviewModal({ isOpen, onClose, fileUrl, type, fileName, urls }: PreviewModalProps) {
  const [slide, setSlide] = useState(0);
  const slides = urls && urls.length ? urls : [fileUrl];

  // 방향키로 슬라이드 넘기기, Esc로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (type !== "presentation") return;
      if (e.key === "ArrowRight") setSlide((i) => Math.min(slides.length - 1, i + 1));
      if (e.key === "ArrowLeft") setSlide((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, type, slides.length]);

  if (!isOpen) return null;

  const idx = Math.min(slide, slides.length - 1);

  const renderContent = () => {
    switch (type) {
      case "image":
        // 학교마다 주소가 다른 ONAIR 서버의 이미지 — next/image 원격 도메인 설정을 둘 수 없어 <img> 사용
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={fileUrl} alt={fileName} className="max-w-full max-h-[80vh] object-contain rounded-lg" />;
      case "video":
        return <video src={fileUrl} controls autoPlay className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />;
      case "audio":
        return (
          <div className="bg-[#1C1C1C] p-8 rounded-2xl border border-white/10 flex flex-col items-center gap-6 min-w-[300px]">
            <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <p className="text-white/80 font-medium text-center truncate w-full px-4">{fileName}</p>
            <audio src={fileUrl} controls autoPlay className="w-full" />
          </div>
        );
      case "presentation":
        // 서버가 PDF·PPT를 슬라이드 이미지로 바꿔 둔다 — 한 장씩 넘겨 본다
        return (
          <div className="flex w-full flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slides[idx]}
              alt={`${fileName} ${idx + 1}쪽`}
              className="max-h-[72vh] max-w-full rounded-lg bg-white object-contain shadow-2xl"
            />
            {slides.length > 1 && (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  aria-label="이전 슬라이드"
                  disabled={idx === 0}
                  onClick={() => setSlide(idx - 1)}
                  className="rounded-full border border-white/10 bg-black/50 p-2 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronLeft size={22} />
                </button>
                <span className="min-w-[80px] text-center font-orbitron text-sm text-white">
                  {idx + 1} <span className="text-white/40">/ {slides.length}</span>
                </span>
                <button
                  type="button"
                  aria-label="다음 슬라이드"
                  disabled={idx >= slides.length - 1}
                  onClick={() => setSlide(idx + 1)}
                  className="rounded-full border border-white/10 bg-black/50 p-2 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronRight size={22} />
                </button>
              </div>
            )}
          </div>
        );
      default:
        return <div className="text-white/50">지원하지 않는 형식입니다.</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-10 bg-black/80 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center">
        <div className="w-full flex justify-end mb-4 relative z-20">
          <button
            onClick={onClose}
            aria-label="닫기"
            className="p-2 bg-black/50 text-white rounded-full hover:bg-white/20 transition-colors backdrop-blur-xl border border-white/10"
          >
            <X size={24} />
          </button>
        </div>

        <div className="w-full flex items-center justify-center">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
