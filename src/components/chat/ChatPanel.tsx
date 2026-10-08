"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, History, ImagePlus, Loader2, Settings, SquarePen, Trash2, X } from "lucide-react";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatSettingsForm from "@/components/chat/ChatSettingsForm";
import Composer, { type ComposerHandle } from "@/components/chat/Composer";
import { suggestionsFor, type Suggestion } from "@/components/chat/suggestions";
import { useChatConversation } from "@/hooks/useChatConversation";
import { useMe } from "@/hooks/useMe";
import { chatApi } from "@/lib/chatApi";
import { cn } from "@/lib/utils";
import { useChatPanel } from "@/stores/chatStore";
import type { ChatStatus } from "@/types/chat";

type View = "chat" | "history" | "settings";

/** Cmd/Ctrl + K — CUE 열고 닫기 */
export function useChatShortcutLabel() {
  const [label, setLabel] = useState("Ctrl K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setLabel("⌘K");
  }, []);
  return label;
}

function ago(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  return iso.slice(5, 10).replace("-", ".");
}

function IconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
        active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/[0.06] hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

/** 꺼져 있을 때 — 이유를 쉽게, 최고 관리자에게는 설정을 바로 */
function DisabledState({ status }: { status: ChatStatus }) {
  const reason = status.reason ?? "";
  const title =
    reason === "no_key" || (!status.keySet && !reason)
      ? "API 키가 없어요"
      : reason === "disabled"
        ? "CUE가 꺼져 있어요"
        : reason.includes("limit")
          ? "오늘 한도를 다 썼어요"
          : "지금은 CUE를 쓸 수 없어요";

  return (
    <div className="flex flex-col gap-5 px-5 py-6">
      <div>
        <p className="font-pretendard text-[17px] font-semibold text-white">{title}</p>
        {reason && !["no_key", "disabled"].includes(reason) && !reason.includes("limit") && (
          <p className="mt-1 font-mono text-[12px] text-white/30">{reason}</p>
        )}
      </div>
      {status.canConfigure && <ChatSettingsForm status={status} />}
    </div>
  );
}

function HistoryView({
  currentId,
  onOpen,
  onDeleted,
}: {
  currentId: string | null;
  onOpen: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["chat", "sessions"], queryFn: chatApi.sessions });
  const [armed, setArmed] = useState<string | null>(null);
  const del = useMutation({
    mutationFn: chatApi.deleteSession,
    onSuccess: (_, id) => {
      setArmed(null);
      onDeleted(id);
      qc.invalidateQueries({ queryKey: ["chat", "sessions"] });
    },
  });

  if (list.isLoading) return <p className="px-5 py-6 font-pretendard text-[14px] text-white/50">불러오는 중…</p>;
  if (list.isError)
    return (
      <p className="px-5 py-6 font-pretendard text-[14px] text-white/60">
        대화 목록을 불러오지 못했어요 {list.error instanceof Error ? list.error.message : ""}
      </p>
    );
  const items = list.data ?? [];
  if (!items.length)
    return <p className="px-5 py-6 font-pretendard text-[14px] text-white/50">대화가 없어요</p>;

  return (
    <ul className="flex flex-col gap-1 px-3 py-3">
      {items.map((s) => {
        const current = s.id === currentId;
        return (
          <li
            key={s.id}
            className={cn(
              "group flex items-center gap-1 rounded-lg border",
              current ? "border-sidebar-border bg-white/5" : "border-transparent hover:bg-white/[0.04]",
            )}
          >
            <button type="button" onClick={() => onOpen(s.id)} className="min-w-0 flex-1 px-3 py-2.5 text-left">
              <p className={cn("truncate font-pretendard text-[14.5px]", current ? "text-white" : "text-white/80")}>
                {s.title || "제목 없는 대화"}
              </p>
              <p className="font-pretendard text-[12px] text-white/35">{ago(s.updatedAt)}</p>
            </button>
            <button
              type="button"
              onClick={() => (armed === s.id ? del.mutate(s.id) : setArmed(s.id))}
              onBlur={() => armed === s.id && setArmed(null)}
              disabled={del.isPending && del.variables === s.id}
              aria-label={`${s.title || "대화"} 지우기`}
              className={cn(
                "mr-1.5 flex h-8 shrink-0 items-center justify-center gap-1 rounded-md px-2 font-pretendard text-[12.5px] transition-colors",
                armed === s.id
                  ? "bg-[#FF3B3B] text-white"
                  : "text-white/35 opacity-0 hover:bg-white/10 hover:text-white focus:opacity-100 group-hover:opacity-100",
              )}
            >
              {armed === s.id ? "지우기" : <Trash2 size={15} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState({ suggestions, onPick }: { suggestions: Suggestion[]; onPick: (s: Suggestion) => void }) {
  return (
    <div className="flex flex-col gap-5 px-5 py-6">
      <p className="font-mbc text-2xl text-white">무엇을 도와드릴까요?</p>
      <div className="flex flex-col gap-2">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onPick(s)}
            className="flex min-h-11 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-left font-pretendard text-[14.5px] text-white/85 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          >
            {s.upload && <ImagePlus size={16} className="shrink-0 text-white/50" />}
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** CUE — 모든 대시보드 화면 오른쪽에 붙는 채팅 패널 */
export default function ChatPanel() {
  const open = useChatPanel((s) => s.open);
  const setOpen = useChatPanel((s) => s.setOpen);
  const toggle = useChatPanel((s) => s.toggle);
  const hydrate = useChatPanel((s) => s.hydrate);
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { role, canOperate } = useMe();

  useEffect(() => hydrate(), [hydrate]);

  const [view, setView] = useState<View>("chat");
  const status = useQuery({
    queryKey: ["chat", "status"],
    queryFn: chatApi.status,
    enabled: open && canOperate,
    refetchInterval: open ? 60_000 : false,
    retry: 1,
  });
  const convo = useChatConversation(open && canOperate && !!status.data?.enabled);
  const composer = useRef<ComposerHandle>(null);
  const panel = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [dragging, setDragging] = useState(false);

  // Cmd/Ctrl + K 로 열고 닫기
  useEffect(() => {
    if (!canOperate) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canOperate, toggle]);

  // 열리면 입력 칸으로
  useEffect(() => {
    if (open && view === "chat") window.setTimeout(() => composer.current?.focus(), 30);
  }, [open, view]);

  // 아래에 붙어 있으면 새 글이 올 때 따라 내려간다
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [convo.messages, view, open]);

  const suggestions = useMemo(() => suggestionsFor(pathname, role), [pathname, role]);

  const onLink = useCallback(
    (href: string) => {
      if (/^https?:\/\//.test(href)) {
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }
      router.push(href);
      // 좁은 화면에선 패널이 화면을 다 덮으니 닫아서 화면을 보여 준다
      if (window.innerWidth < 768) setOpen(false);
    },
    [router, setOpen],
  );

  const send = useCallback(
    (text: string, uploads: Parameters<typeof convo.send>[1]) => {
      stick.current = true;
      void convo.send(text, uploads, pathname);
    },
    [convo, pathname],
  );

  const pick = (s: Suggestion) => {
    if (s.upload) composer.current?.pickFiles(s.upload, s.text);
    else send(s.text, []);
  };

  const onActionDone = useCallback(() => {
    // 실행 결과가 지금 보는 화면에 바로 보이게
    qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "chat" });
    // react-query 를 안 쓰는 화면(시보 설정 등)은 이 신호를 듣고 서버 값을 다시 읽는다
    window.dispatchEvent(new Event("onair:refresh"));
  }, [qc]);

  if (!canOperate) return null;

  const st = status.data;
  const enabled = !!st?.enabled;
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return (
    <aside
      ref={panel}
      aria-label="CUE"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) setOpen(false);
      }}
      onDragEnter={(e) => {
        if (enabled && view === "chat" && hasFiles(e)) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragOver={(e) => {
        if (enabled && view === "chat" && hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!panel.current?.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(false);
        if (enabled && view === "chat") composer.current?.addFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        open ? "flex" : "hidden",
        // 좁은 화면(<768): 전체 화면 · 보통: 오른쪽에 겹쳐 붙음 · 아주 넓은 화면(≥1800): 본문을 밀어냄
        "fixed inset-0 z-40 flex-col bg-[#0d0d10] md:left-auto md:w-[420px] md:border-l md:border-white/10 md:shadow-[-24px_0_60px_-20px_rgba(0,0,0,0.9)]",
        "min-[1800px]:relative min-[1800px]:inset-auto min-[1800px]:z-20 min-[1800px]:h-full min-[1800px]:shrink-0 min-[1800px]:bg-[#0d0d10]/90 min-[1800px]:shadow-none min-[1800px]:backdrop-blur-md",
      )}
    >
      <header className="flex h-16 shrink-0 items-center gap-1 border-b border-white/10 pl-5 pr-3">
        {view !== "chat" ? (
          <button
            type="button"
            onClick={() => setView("chat")}
            className="-ml-2 flex h-9 items-center gap-1 rounded-lg pl-1 pr-2.5 font-pretendard text-[14px] text-white/70 hover:bg-white/[0.06] hover:text-white"
          >
            <ChevronLeft size={18} /> 대화로
          </button>
        ) : (
          <p className="min-w-0 font-mbc text-lg leading-none text-white">CUE</p>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {enabled && (
            <>
              <IconButton
                label="새 대화"
                onClick={() => {
                  convo.newChat();
                  setView("chat");
                  stick.current = true;
                }}
              >
                <SquarePen size={17} />
              </IconButton>
              <IconButton
                label="지난 대화"
                active={view === "history"}
                onClick={() => setView(view === "history" ? "chat" : "history")}
              >
                <History size={18} />
              </IconButton>
            </>
          )}
          {st?.canConfigure && (
            <IconButton
              label="CUE 설정"
              active={view === "settings"}
              onClick={() => setView(view === "settings" ? "chat" : "settings")}
            >
              <Settings size={18} />
            </IconButton>
          )}
          <IconButton label="닫기" onClick={() => setOpen(false)}>
            <X size={19} />
          </IconButton>
        </div>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
        {view === "settings" && st?.canConfigure ? (
          <div className="px-5 py-6">
            <p className="mb-5 font-pretendard text-[17px] font-semibold text-white">CUE 설정</p>
            <ChatSettingsForm status={st} />
          </div>
        ) : view === "history" && enabled ? (
          <HistoryView
            currentId={convo.sessionId}
            onOpen={(id) => {
              convo.openSession(id);
              setView("chat");
              stick.current = true;
            }}
            onDeleted={(id) => id === convo.sessionId && convo.newChat()}
          />
        ) : status.isLoading ? (
          <p className="flex items-center gap-2 px-5 py-6 font-pretendard text-[14px] text-white/50">
            <Loader2 size={15} className="animate-spin" /> 불러오는 중…
          </p>
        ) : !st ? (
          <div className="flex flex-col items-start gap-3 px-5 py-6">
            <p className="font-pretendard text-[16px] font-semibold text-white">CUE에 연결하지 못했어요</p>
            <button
              type="button"
              onClick={() => status.refetch()}
              className="h-9 rounded-lg border border-white/15 px-4 font-pretendard text-[14px] text-white/80 hover:bg-white/[0.06] hover:text-white"
            >
              다시 시도
            </button>
          </div>
        ) : !enabled ? (
          <DisabledState status={st} />
        ) : convo.loading && !convo.messages.length ? (
          <p className="flex items-center gap-2 px-5 py-6 font-pretendard text-[14px] text-white/50">
            <Loader2 size={15} className="animate-spin" /> 대화 불러오는 중…
          </p>
        ) : !convo.messages.length ? (
          <EmptyState suggestions={suggestions} onPick={pick} />
        ) : (
          <div className="flex flex-col gap-5 px-5 py-5">
            {convo.messages.map((m) => (
              <ChatMessage
                key={m.id}
                message={m}
                onLink={onLink}
                onActionUpdate={convo.updateAction}
                onActionDone={onActionDone}
              />
            ))}
          </div>
        )}
      </div>

      {view === "chat" && enabled && (
        <Composer ref={composer} streaming={convo.streaming} onSend={send} onStop={convo.stop} />
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-white/40 bg-black/70">
          <p className="font-pretendard text-[16px] text-white">여기에 놓기</p>
        </div>
      )}
    </aside>
  );
}
