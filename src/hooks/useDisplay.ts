import { useState } from "react";
import { getApiBase } from "@/lib/apiBase";
import { FileType, UploadedFile } from "@/types/file";


export function useDisplay() {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showMedia = async (file: UploadedFile) => {
    setIsSending(true);
    setError(null);
    try {
      const BASE = getApiBase();
      const res = await fetch(`${BASE}/display/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: file.type,
          fileId: file.id,
          url: file.fileUrl,
          urls: file.urls,
          duration: file.duration,
        }),
      });
      if (!res.ok) throw new Error("송출 미디어 변경 실패");
      return await res.json();
    } catch (err: unknown) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsSending(false);
    }
  };


  return { showMedia, isSending, error };
}
