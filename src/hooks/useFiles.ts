import { useState, useCallback } from "react";
import { FileType, UploadedFile } from "@/types/file";
import { getApiBase } from "@/lib/apiBase";

export const useFiles = () => {
  const [files, setFiles] = useState<Record<FileType, UploadedFile[]>>({
    image: [],
    video: [],
    audio: [],
    presentation: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const BASE = getApiBase();
      const res = await fetch(`${BASE}/files`);
      if (!res.ok) throw new Error("파일 목록을 불러오는데 실패했습니다.");

      const data: UploadedFile[] = await res.json();
      const grouped: Record<FileType, UploadedFile[]> = {
        image: [],
        video: [],
        audio: [],
        presentation: [],
      };
      data.forEach((file) => {
        if (grouped[file.type]) grouped[file.type].push(file);
      });
      setFiles(grouped);
    } catch (err: unknown) {
      setError((err as Error).message ?? "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteFile = async (fileId: string, type: FileType) => {
    try {
      const BASE = getApiBase();
      const res = await fetch(`${BASE}/files/${fileId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("파일 삭제에 실패했습니다.");
      setFiles((prev) => ({
        ...prev,
        [type]: prev[type].filter((f) => f.id !== fileId),
      }));
    } catch (err: unknown) {
      setError((err as Error).message ?? "삭제 중 오류가 발생했습니다.");
      throw err;
    }
  };

  const renameFile = async (fileId: string, type: FileType, newName: string) => {
    try {
      const BASE = getApiBase();
      const res = await fetch(`${BASE}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fileId, type, newName }),
      });
      if (!res.ok) throw new Error("파일 이름 수정에 실패했습니다.");
      await fetchFiles();
    } catch (err: unknown) {
      setError((err as Error).message ?? "이름 수정 중 오류가 발생했습니다.");
      throw err;
    }
  };

  return { files, isLoading, error, fetchFiles, deleteFile, renameFile, refetch: fetchFiles };
};
