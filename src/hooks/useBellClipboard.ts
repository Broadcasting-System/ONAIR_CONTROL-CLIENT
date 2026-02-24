import { useState, useCallback } from "react";
import { Bell } from "@/types/time";

export const useBellClipboard = () => {
  const [clipboard, setClipboard] = useState<Bell[] | null>(null);

  const copy = useCallback((bells: Bell[]) => {
    setClipboard(JSON.parse(JSON.stringify(bells)));
  }, []);

  const paste = useCallback((): Bell[] | null => {
    return clipboard ? JSON.parse(JSON.stringify(clipboard)) : null;
  }, [clipboard]);

  const clear = useCallback(() => {
    setClipboard(null);
  }, []);

  return { clipboard, copy, paste, clear };
};
