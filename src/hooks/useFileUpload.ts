import { useState } from "react";
import { FileType, UploadedFile } from "@/types/file";
import { getApiBase } from "@/lib/apiBase";

interface UploadResponse {
  id: string;
  type: FileType;
  originalName: string;
  url: string;
}

export const useFileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (
    files: FileList | File[],
    type: FileType,
  ): Promise<UploadedFile[]> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    const BASE = getApiBase();
    const endpoint = `${BASE}/files/upload`;

    try {
      const results = await Promise.all(
        Array.from(files).map(
          (file) =>
            new Promise<UploadedFile>((resolve, reject) => {
              const formData = new FormData();
              formData.append("file", file);
              formData.append("type", type);

              const xhr = new XMLHttpRequest();

              xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                  setProgress(Math.round((event.loaded / event.total) * 100));
                }
              };

              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  const data: UploadResponse = JSON.parse(xhr.responseText);
                  resolve({
                    id: data.id,
                    type: data.type,
                    fileName: data.originalName,
                    fileUrl: data.url,
                    fileSize: 0,
                    uploadedAt: "",
                  });
                } else {
                  reject(new Error("업로드 실패"));
                }
              };

              xhr.onerror = () => reject(new Error("네트워크 오류"));
              xhr.open("POST", endpoint, true);
              xhr.send(formData);
            }),
        ),
      );

      setProgress(100);
      return results;
    } catch (err: unknown) {
      setError((err as Error).message ?? "알 수 없는 오류가 발생했습니다.");
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading, progress, error };
};
