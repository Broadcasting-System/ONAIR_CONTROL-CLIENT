import { useState } from "react";
import { useSpeakerStore } from "@/stores/speakerStore";
import { getApiBase } from "@/lib/apiBase";
import { toast } from "@/components/common/Toast";

interface BroadcastResponse {
  success: boolean;
  message: string;
}

/** targets 를 주면 그 대상으로, 없으면 지금 켜진 스피커로. voice·rate 는 GET /api/tts/voices 의 값 */
export function useTts(opts?: { targets?: string[]; voice?: string; rate?: number }) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  // TTS 앞/뒤로 재생할 음원("none"=안 함)
  const [startSound, setStartSound] = useState("none");
  const [endSound, setEndSound] = useState("none");
  const { zones } = useSpeakerStore();

  const handleSend = async () => {
    if (!text.trim()) return;

    const targets = opts?.targets ?? zones.filter((z) => z.status === "on").map((z) => z.name);

    if (targets.length === 0) {
      toast.error("선택한 스피커가 없어요");
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
          ...(opts?.voice ? { voice: opts.voice } : {}),
          ...(opts?.voice && opts.rate !== undefined ? { rate: opts.rate } : {}),
        }),
      });
      const data: BroadcastResponse & { detail?: unknown } = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        // 서버는 실패 사유를 detail로 준다(예: 방송 중·스피커 매핑 중)
        const reason = typeof data.detail === "string" ? data.detail : data.message;
        throw new Error(reason || "방송 전송 실패");
      }
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
