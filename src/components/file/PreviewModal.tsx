import { X } from "lucide-react";
import { FileType } from "@/types/file";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  type: FileType;
  fileName: string;
}

export default function PreviewModal({ isOpen, onClose, fileUrl, type, fileName }: PreviewModalProps) {
  if (!isOpen) return null;

  const renderContent = () => {
    switch (type) {
      case "image":
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
        return (
          // We limit presentations to PDF now, so use embedded iframe mapped to file URL
          <iframe
            src={fileUrl}
            className="w-full h-[80vh] bg-white rounded-lg"
            title={fileName}
          />
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
