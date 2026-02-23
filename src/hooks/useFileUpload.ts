import { useState } from "react";
import { FileType } from "@/types/file";

export const useFileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | File[], type: FileType) => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });
      formData.append("type", type);

      const xhr = new XMLHttpRequest();

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error("업로드 실패"));
          }
        };

        xhr.onerror = () => {
          reject(new Error("네트워크 오류"));
        };
      });

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
      const endpoint = baseUrl.endsWith("/api") ? `${baseUrl}/files` : `${baseUrl}/api/files`;
      xhr.open("POST", endpoint, true);
      xhr.send(formData);

      await uploadPromise;
      setProgress(100);
    } catch (err: unknown) {
      setError((err as Error).message || "알 수 없는 오류가 발생했습니다.");
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading, progress, error };
};
