import { useState } from "react";
import { FileType, UploadedFile } from "@/types/file";
import { getApiBase } from "@/lib/apiBase";

// 서버 POST /files/upload 응답
interface UploadResponse {
  id: string;
  type: FileType;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
}

/** 서버가 준 한국어 사유(detail) — 크기 초과(413)·형식 오류 등을 그대로 보여준다 */
function serverDetail(xhr: XMLHttpRequest): string | null {
  try {
    const detail = JSON.parse(xhr.responseText)?.detail;
    return typeof detail === "string" ? detail : null;
  } catch {
    return null;
  }
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
                    fileName: data.fileName,
                    fileUrl: data.fileUrl,
                    fileSize: data.fileSize ?? 0,
                    uploadedAt: "",
                  });
                } else {
                  const reason =
                    serverDetail(xhr) ??
                    (xhr.status === 413 ? "파일이 너무 큽니다." : `업로드 실패 (HTTP ${xhr.status})`);
                  reject(new Error(`${file.name}: ${reason}`));
                }
              };

              xhr.onerror = () =>
                reject(new Error(`네트워크 오류 — 백엔드(${endpoint})에 연결 실패`));
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
