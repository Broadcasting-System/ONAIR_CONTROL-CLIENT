import { useState } from "react";
import { getApiBase } from "@/lib/apiBase";
import { UploadedFile } from "@/types/file";

interface HlsStatusResponse {
  ready: boolean;
  hlsUrl?: string | null;
}


export function useDisplay() {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveMediaUrls = async (file: UploadedFile, base: string) => {
    let hlsUrl = file.hlsUrl;

    if (file.type === "video" && !hlsUrl) {
      try {
        const statusRes = await fetch(`${base}/files/${encodeURIComponent(file.id)}/hls-status`);
        if (statusRes.ok) {
          const statusData: HlsStatusResponse = await statusRes.json();
          if (statusData.ready && statusData.hlsUrl) {
            hlsUrl = statusData.hlsUrl;
          }
        }
      } catch {
        // fallback to original URL
      }
    }

    return {
      url: file.type === "video" && hlsUrl ? hlsUrl : file.fileUrl,
      hlsUrl,
    };
  };

  const showMedia = async (file: UploadedFile) => {
    setIsSending(true);
    setError(null);
    try {
      const BASE = getApiBase();
      const { url, hlsUrl } = await resolveMediaUrls(file, BASE);
      const res = await fetch(`${BASE}/display/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: file.type,
          fileId: file.id,
          url,
          hlsUrl,
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
