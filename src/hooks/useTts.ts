import { useState } from "react";
import { useSpeakerStore } from "@/stores/speakerStore";
import { getApiBase } from "@/lib/apiBase";

interface BroadcastResponse {
  success: boolean;
  message: string;
}

export function useTts() {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { zones } = useSpeakerStore();

  const handleSend = async () => {
    if (!text.trim()) return;

    const targets = zones
      .filter((z) => z.status === "on")
      .map((z) => z.name);

    setIsSending(true);
    try {
      const BASE = getApiBase();
      const res = await fetch(`${BASE}/broadcast/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "tts",
          sourceId: text.trim(),
          targets,
          restoreState: true,
        }),
      });
      const data: BroadcastResponse = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "방송 전송 실패");
      setText("");
    } finally {
      setIsSending(false);
    }
  };

  return {
    text,
    setText,
    handleSend,
    isSending,
    isValid: text.trim().length > 0,
  };
}
