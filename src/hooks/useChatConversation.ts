import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { chatApi } from "@/lib/chatApi";
import { useChatPanel } from "@/stores/chatStore";
import type { ChatAction, ChatStreamEvent, ChatUpload, DisplayMessage } from "@/types/chat";

/** 화면에 보이는 메시지 — 보내는 중·답 받는 중 상태가 붙는다 */
export interface LiveMessage extends DisplayMessage {
  /** 서버가 아직 저장했다고 알려 주지 않은 내 메시지 */
  pending?: boolean;
  /** 답이 오고 있다 */
  streaming?: boolean;
  /** 멈춤 버튼으로 멈췄다 */
  stopped?: boolean;
  error?: string;
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/** CUE 대화 — 대화 불러오기·보내기(SSE)·멈추기·확인 카드 갱신 */
export function useChatConversation(active: boolean) {
  const qc = useQueryClient();
  const sessionId = useChatPanel((s) => s.sessionId);
  const setSessionId = useChatPanel((s) => s.setSessionId);
  const hydrated = useChatPanel((s) => s.hydrated);

  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  /** 화면에 불러온 대화 — 같은 대화를 다시 불러오지 않게 */
  const loadedRef = useRef<string | null>(null);

  const load = useCallback(
    async (id: string) => {
      loadedRef.current = id;
      setLoading(true);
      setLoadError("");
      try {
        const detail = await chatApi.session(id);
        if (loadedRef.current === id) setMessages(detail.messages ?? []);
      } catch (e) {
        if (loadedRef.current !== id) return;
        // 지워졌거나 남의 대화 — 새 대화로
        loadedRef.current = null;
        setMessages([]);
        setSessionId(null);
        setLoadError(e instanceof Error ? e.message : "");
      } finally {
        if (loadedRef.current === id || loadedRef.current === null) setLoading(false);
      }
    },
    [setSessionId],
  );

  // 패널을 열었을 때 기억해 둔 대화 불러오기
  useEffect(() => {
    if (!active || !hydrated || !sessionId || loadedRef.current === sessionId) return;
    void load(sessionId);
  }, [active, hydrated, sessionId, load]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    loadedRef.current = null;
    setMessages([]);
    setLoadError("");
    setSessionId(null);
  }, [setSessionId]);

  const openSession = useCallback(
    (id: string) => {
      abortRef.current?.abort();
      setSessionId(id);
      void load(id);
    },
    [load, setSessionId],
  );

  const send = useCallback(
    async (text: string, uploads: ChatUpload[], page: string) => {
      if (abortRef.current) return;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setStreaming(true);

      const stamp = Date.now();
      const now = new Date(stamp).toISOString();
      let userId = `local-user-${stamp}`;
      let liveId = `local-live-${stamp}`;
      setMessages((ms) => [
        ...ms,
        { id: userId, role: "user", text, createdAt: now, uploads, pending: true },
        { id: liveId, role: "assistant", text: "", createdAt: now, tools: [], actions: [], links: [], streaming: true },
      ]);
      const patch = (id: string, fn: (m: LiveMessage) => LiveMessage) =>
        setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));

      let finished = false;
      const onEvent = (ev: ChatStreamEvent) => {
        switch (ev.type) {
          case "user": {
            const saved = ev.message;
            patch(userId, () => saved);
            userId = saved.id;
            break;
          }
          case "text":
            patch(liveId, (m) => ({ ...m, text: m.text + (ev.delta ?? "") }));
            break;
          case "tool": {
            const { type: _t, ...tool } = ev;
            void _t;
            patch(liveId, (m) => {
              const tools = m.tools ?? [];
              const at = tools.findIndex((t) => t.id === tool.id);
              return {
                ...m,
                tools: at < 0 ? [...tools, tool] : tools.map((t, i) => (i === at ? { ...t, ...tool } : t)),
              };
            });
            break;
          }
          case "action":
            patch(liveId, (m) => ({ ...m, actions: [...(m.actions ?? []), ev.action] }));
            break;
          case "link":
            patch(liveId, (m) => ({ ...m, links: [...(m.links ?? []), { label: ev.label, href: ev.href }] }));
            break;
          case "tour":
            patch(liveId, (m) => ({ ...m, tours: [...(m.tours ?? []), { title: ev.title, steps: ev.steps }] }));
            break;
          case "error":
            patch(liveId, (m) => ({ ...m, error: ev.message }));
            break;
          case "done": {
            finished = true;
            const final = ev.message;
            patch(liveId, (m) => ({ ...final, error: m.error }));
            liveId = final.id;
            break;
          }
        }
      };

      try {
        let id = sessionId;
        if (!id) {
          const created = await chatApi.createSession();
          id = created.id;
          loadedRef.current = id;
          setSessionId(id);
        }
        await chatApi.sendMessage(id, { text, uploadIds: uploads.map((u) => u.uploadId), page }, onEvent, ctrl.signal);
        if (!finished) patch(liveId, (m) => ({ ...m, streaming: false }));
      } catch (e) {
        if (isAbort(e)) patch(liveId, (m) => ({ ...m, streaming: false, stopped: true }));
        else
          patch(liveId, (m) => ({
            ...m,
            streaming: false,
            error: e instanceof Error ? e.message : "답을 받지 못했어요.",
          }));
      } finally {
        patch(userId, (m) => (m.pending ? { ...m, pending: false } : m));
        abortRef.current = null;
        setStreaming(false);
        qc.invalidateQueries({ queryKey: ["chat", "status"] });
        qc.invalidateQueries({ queryKey: ["chat", "sessions"] });
      }
    },
    [qc, sessionId, setSessionId],
  );

  /** 확인 카드 상태가 바뀌었다 (확인·취소 결과) */
  const updateAction = useCallback((action: ChatAction) => {
    setMessages((ms) =>
      ms.map((m) =>
        m.actions?.some((a) => a.id === action.id)
          ? { ...m, actions: m.actions.map((a) => (a.id === action.id ? action : a)) }
          : m,
      ),
    );
  }, []);

  // 화면을 떠나면(패널 닫힘 아님 — 앱을 떠날 때) 받던 답 멈추기
  useEffect(() => () => abortRef.current?.abort(), []);

  return { sessionId, messages, loading, loadError, streaming, send, stop, newChat, openSession, updateAction };
}
