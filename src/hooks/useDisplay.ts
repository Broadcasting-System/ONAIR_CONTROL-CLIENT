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

  const showMedia = async (file: UploadedFile, channel: number = 1) => {
    setIsSending(true);
    setError(null);
    try {
      const BASE = getApiBase();
      const { url, hlsUrl } = await resolveMediaUrls(file, BASE);
      const qs = channel > 1 ? `?channel=${channel}` : "";
      const res = await fetch(`${BASE}/display/show${qs}`, {
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


  const showTimer = async (
    channel: number,
    opts: { label?: string; durationSec: number; mode: "down" | "up" },
  ) => {
    const BASE = getApiBase();
    const qs = channel > 1 ? `?channel=${channel}` : "";
    const res = await fetch(`${BASE}/display/timer${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error("타이머 송출 실패");
    return res.json();
  };

  return { showMedia, showTimer, isSending, error };
}
