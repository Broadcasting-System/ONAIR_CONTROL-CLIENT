"use client";

import { UploadedFile } from "@/types/file";
import { useFiles } from "@/hooks/useFiles";
import FileUploadSection from "@/components/file/FileUploadSection";
import { useEffect } from "react";

interface MediaSelectModalProps {
  onSelect: (file: UploadedFile) => void;
  onClose: () => void;
}

export default function MediaSelectModal({ onSelect, onClose }: MediaSelectModalProps) {
  const { files, fetchFiles } = useFiles();

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-10">
      <div className="bg-[#121212] border border-white/10 rounded-[32px] w-full max-w-5xl max-h-[80vh] overflow-y-auto p-12 custom-scrollbar">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-bold text-white font-wooju">송출 미디어 선택</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors text-xl font-bold"
          >
            닫기
          </button>
        </div>

        <div className="flex flex-col gap-12 text-left">
          <FileUploadSection
            title="이미지"
            files={files.image}
            displayType="grid"
            onSelectFile={(_, file) => onSelect(file)}
            readonly
          />
          <FileUploadSection
            title="동영상"
            files={files.video}
            displayType="grid"
            onSelectFile={(_, file) => onSelect(file)}
            readonly
          />
          <FileUploadSection
            title="프리젠테이션"
            files={files.presentation}
            displayType="grid"
            onSelectFile={(_, file) => onSelect(file)}
            readonly
          />
          <FileUploadSection
            title="오디오"
            files={files.audio}
            displayType="grid"
            onSelectFile={(_, file) => onSelect(file)}
            readonly
          />
        </div>
      </div>
    </div>
  );
}
