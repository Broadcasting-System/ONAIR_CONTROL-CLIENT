import { useRef } from "react";
import Button from "@/components/common/Button";
import SectionHeader from "@/components/common/SectionHeader";
import FileCard from "./FileCard";
import AudioChip from "./AudioChip";
import { UploadedFile } from "@/types/file";

interface FileUploadSectionProps {
  title: string;
  files: UploadedFile[];
  displayType: "grid" | "chips";
  onUpload?: (files: FileList) => void;
  onSelectFile: (e: React.MouseEvent, file: UploadedFile) => void;
  acceptedFormats?: string;
  isUploading?: boolean;
  readonly?: boolean;
  /** CUE 튜토리얼 이름표 — 칸은 {tour}, 추가 버튼은 {tour}.upload */
  tour?: string;
}

export default function FileUploadSection({
  title,
  files,
  displayType,
  onUpload,
  onSelectFile,
  acceptedFormats = "",
  isUploading = false,
  readonly = false,
  tour,
}: FileUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onUpload) {
      onUpload(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <section data-tour={tour}>
      <SectionHeader>{title}</SectionHeader>
      <div className="flex flex-col gap-5 rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-4 backdrop-blur-md shadow-2xl relative overflow-hidden h-full md:gap-6 md:rounded-[24px] md:border-sidebar-border md:bg-sidebar md:p-8">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent opacity-50" />

        <div className="flex-1 w-full">
          {files.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[72px] text-white/40 text-sm md:min-h-[120px]">
              파일이 없어요
            </div>
          ) : displayType === "grid" ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  fileUrl={file.fileUrl}
                  thumbnailUrl={file.thumbnailUrl || ""}
                  fileName={file.fileName}
                  onSelect={(e) => onSelectFile(e, file)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 md:gap-3">
              {files.map((file) => (
                <AudioChip
                  key={file.id}
                  fileUrl={file.fileUrl}
                  fileName={file.fileName}
                  onSelect={(e) => onSelectFile(e, file)}
                />
              ))}
            </div>
          )}
        </div>

        {!readonly && (
          <div className="mt-auto flex justify-center md:pt-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={acceptedFormats}
              multiple
              className="hidden"
            />
            <div className="w-full md:w-[340px]">
              <Button
                tour={tour ? `${tour}.upload` : undefined}
                label={isUploading ? "업로드 중..." : `${title} 파일 추가`}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-[60px]"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
