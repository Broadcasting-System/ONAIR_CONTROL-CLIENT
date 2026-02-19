import { useState } from "react";

export function useTts() {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim()) return;

    setIsSending(true);
    try {
      // Mock API call
      console.log("Sending TTS:", text);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setText("");
    } catch (error) {
      console.error("TTS Error:", error);
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
