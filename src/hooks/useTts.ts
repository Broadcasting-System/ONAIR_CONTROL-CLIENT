import { useState } from "react";
import { useSpeakerStore } from "@/stores/speakerStore";
import { getApiBase } from "@/lib/apiBase";
import { toast } from "@/components/common/Toast";

interface BroadcastResponse {
  success: boolean;
  message: string;
}

export function useTts() {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  // TTS 앞/뒤로 재생할 음원("none"=안 함)
  const [startSound, setStartSound] = useState("none");
  const [endSound, setEndSound] = useState("none");
  const { zones } = useSpeakerStore();

  const handleSend = async () => {
    if (!text.trim()) return;

    const targets = zones
      .filter((z) => z.status === "on")
      .map((z) => z.name);

    if (targets.length === 0) {
      toast.error("방송할 스피커(존)를 먼저 선택해주세요.");
      return;
    }

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
          startSound,
          endSound,
        }),
      });
      const data: BroadcastResponse = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "방송 전송 실패");
      setText("");
      toast.success("TTS 방송이 송출되었습니다.");
    } catch (e) {
      toast.error("TTS 송출 실패: " + (e instanceof Error ? e.message : String(e)));
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
    startSound,
    setStartSound,
    endSound,
    setEndSound,
  };
}
