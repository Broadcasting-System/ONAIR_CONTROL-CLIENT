import { create } from "zustand";

/** CUE 패널 — 열림 여부와 마지막 대화는 이 기기에 기억한다 */
const OPEN_KEY = "onair.chat.open";
const SESSION_KEY = "onair.chat.session";

function save(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* 저장소 사용 불가 — 무시 */
  }
}

interface ChatPanelStore {
  /** 저장소에서 읽어 왔는지 (서버 렌더와 어긋나지 않게 처음엔 닫힌 상태) */
  hydrated: boolean;
  open: boolean;
  sessionId: string | null;
  hydrate: () => void;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setSessionId: (id: string | null) => void;
}

export const useChatPanel = create<ChatPanelStore>((set, get) => ({
  hydrated: false,
  open: false,
  sessionId: null,
  hydrate: () => {
    if (get().hydrated) return;
    let open = false;
    let sessionId: string | null = null;
    try {
      open = window.localStorage.getItem(OPEN_KEY) === "1";
      sessionId = window.localStorage.getItem(SESSION_KEY);
    } catch {
      /* 기본값 */
    }
    set({ hydrated: true, open, sessionId });
  },
  setOpen: (open) => {
    save(OPEN_KEY, open ? "1" : "0");
    set({ open });
  },
  toggle: () => get().setOpen(!get().open),
  setSessionId: (sessionId) => {
    save(SESSION_KEY, sessionId);
    set({ sessionId });
  },
}));
