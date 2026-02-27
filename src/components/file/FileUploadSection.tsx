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
}: FileUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onUpload) {
      onUpload(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <section>
      <SectionHeader>{title}</SectionHeader>
      <div className="flex flex-col gap-6 rounded-[24px] border border-sidebar-border bg-sidebar p-8 backdrop-blur-md shadow-2xl relative overflow-hidden h-full">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent opacity-50" />

        <div className="flex-1 w-full">
          {files.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[120px] text-white/40 text-sm">
              등록된 파일이 없습니다
            </div>
          ) : displayType === "grid" ? (
            <div className="grid grid-cols-4 gap-4">
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
            <div className="flex flex-wrap gap-3">
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
          <div className="mt-auto pt-4 flex justify-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={acceptedFormats}
              multiple
              className="hidden"
            />
            <div className="w-[300px]">
              <Button
                label={isUploading ? "업로드 중..." : `${title} 파일 추가`}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
