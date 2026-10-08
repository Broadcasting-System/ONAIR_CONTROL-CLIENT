"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowUp, FileAudio, FileText, FileVideo, File as FileIcon, Paperclip, Square, X } from "lucide-react";
import { chatApi, chatAssetUrl } from "@/lib/chatApi";
import { cn } from "@/lib/utils";
import type { ChatUpload, UploadKind } from "@/types/chat";

interface Attachment {
  key: string;
  file: File;
  /** 이미지면 바로 보이는 미리보기 (blob:) */
  preview?: string;
  progress: number;
  upload?: ChatUpload;
  error?: string;
  ctrl: AbortController;
}

export interface ComposerHandle {
  addFiles: (files: File[]) => void;
  /** 파일 고르기 창 — 고르면 입력 칸에 text 를 채워 둔다 */
  pickFiles: (accept: string, text?: string) => void;
  focus: () => void;
}

const MAX_HEIGHT = 200;

function kindOf(file: File): UploadKind {
  const t = file.type;
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  return "other";
}

export function KindIcon({ kind, size = 16 }: { kind: UploadKind; size?: number }) {
  if (kind === "video") return <FileVideo size={size} />;
  if (kind === "audio") return <FileAudio size={size} />;
  if (kind === "pdf") return <FileText size={size} />;
  return <FileIcon size={size} />;
}

const Composer = forwardRef<
  ComposerHandle,
  {
    disabled?: boolean;
    streaming: boolean;
    onSend: (text: string, uploads: ChatUpload[]) => void;
    onStop: () => void;
  }
>(function Composer({ disabled, streaming, onSend, onStop }, ref) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<Attachment[]>([]);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const pendingText = useRef<string | undefined>(undefined);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // 입력한 만큼 높이 늘리기
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(MAX_HEIGHT, el.scrollHeight)}px`;
  }, [text]);

  // 패널이 사라지면 올리던 것 멈추고 미리보기 정리
  useEffect(
    () => () => {
      for (const it of itemsRef.current) {
        it.ctrl.abort();
        if (it.preview) URL.revokeObjectURL(it.preview);
      }
    },
    [],
  );

  const patch = (key: string, p: Partial<Attachment>) =>
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const addFiles = useCallback((files: File[]) => {
    const fresh = files.map<Attachment>((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      file,
      preview: kindOf(file) === "image" ? URL.createObjectURL(file) : undefined,
      progress: 0,
      ctrl: new AbortController(),
    }));
    if (!fresh.length) return;
    setItems((xs) => [...xs, ...fresh]);
    for (const it of fresh) {
      chatApi
        .uploadFile(it.file, (r) => patch(it.key, { progress: r }), it.ctrl.signal)
        .then((upload) => patch(it.key, { upload, progress: 1 }))
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          patch(it.key, { error: e instanceof Error ? e.message : "올리지 못했어요." });
        });
    }
    area.current?.focus();
  }, []);

  const removeItem = (key: string) => {
    setItems((xs) => {
      const it = xs.find((x) => x.key === key);
      if (it) {
        it.ctrl.abort();
        if (it.preview) URL.revokeObjectURL(it.preview);
      }
      return xs.filter((x) => x.key !== key);
    });
  };

  useImperativeHandle(
    ref,
    () => ({
      addFiles,
      pickFiles: (accept, t) => {
        pendingText.current = t;
        if (picker.current) {
          picker.current.accept = accept;
          picker.current.click();
        }
      },
      focus: () => area.current?.focus(),
    }),
    [addFiles],
  );

  const uploading = items.some((x) => !x.upload && !x.error);
  const ready = items.filter((x) => x.upload).map((x) => x.upload as ChatUpload);
  const canSend = !disabled && !streaming && !uploading && (text.trim().length > 0 || ready.length > 0);

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim(), ready);
    for (const it of items) if (it.preview) URL.revokeObjectURL(it.preview);
    setItems([]);
    setText("");
  };

  return (
    <div className="shrink-0 border-t border-white/10 px-4 pb-4 pt-3">
      <input
        ref={picker}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!files.length) return;
          if (pendingText.current && !text.trim()) setText(pendingText.current);
          pendingText.current = undefined;
          addFiles(files);
        }}
      />

      {items.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {items.map((it) => {
            const thumb = it.preview ?? (it.upload?.thumbUrl ? chatAssetUrl(it.upload.thumbUrl) : "");
            const done = !!it.upload;
            return (
              <div
                key={it.key}
                title={it.error ?? it.file.name}
                className={cn(
                  "relative flex h-14 max-w-[180px] items-center gap-2 overflow-hidden rounded-lg border bg-white/[0.04] pr-7",
                  it.error ? "border-[#FF3B3B]/50" : "border-white/10",
                )}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-14 w-14 shrink-0 object-cover" />
                ) : (
                  <span className="flex h-14 w-11 shrink-0 items-center justify-center text-white/50">
                    <KindIcon kind={it.upload?.kind ?? kindOf(it.file)} size={18} />
                  </span>
                )}
                <div className="min-w-0 py-1">
                  <p className="truncate font-pretendard text-[12.5px] text-white/85">{it.file.name}</p>
                  <p className={cn("font-pretendard text-[11.5px]", it.error ? "text-[#FF6B6B]" : "text-white/40")}>
                    {it.error ? "실패" : done ? "올림" : `${Math.round(it.progress * 100)}%`}
                  </p>
                </div>
                {!done && !it.error && (
                  <span
                    className="absolute bottom-0 left-0 h-0.5 bg-white/70 transition-[width]"
                    style={{ width: `${Math.max(4, it.progress * 100)}%` }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeItem(it.key)}
                  aria-label={`${it.file.name} 빼기`}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/70 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div
        className={cn(
          "flex items-end gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] p-1.5 transition-colors focus-within:border-white/30",
          disabled && "opacity-50",
        )}
      >
        <button
          type="button"
          onClick={() => {
            pendingText.current = undefined;
            if (picker.current) {
              picker.current.accept = "image/*,video/*,audio/*,application/pdf";
              picker.current.click();
            }
          }}
          disabled={disabled}
          title="파일 붙이기 (사진·영상·PDF)"
          aria-label="파일 붙이기"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/55 transition-colors enabled:hover:bg-white/[0.08] enabled:hover:text-white"
        >
          <Paperclip size={18} />
        </button>
        <textarea
          ref={area}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // 한글 조합 중 Enter 는 글자 확정이라 보내지 않는다
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            submit();
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files ?? []);
            if (!files.length) return;
            e.preventDefault();
            addFiles(files);
          }}
          placeholder="무엇이든 말해 주세요"
          aria-label="CUE에게 보낼 말"
          className="max-h-[200px] min-h-9 flex-1 resize-none bg-transparent px-1 py-[7px] font-pretendard text-[15px] leading-[22px] text-white outline-none placeholder:text-white/35"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            title="멈추기"
            aria-label="답 멈추기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-black transition-colors hover:bg-white/85"
          >
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            title={uploading ? "파일을 올리는 중이에요" : "보내기 (Enter)"}
            aria-label="보내기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-black transition-colors enabled:hover:bg-white/85 disabled:bg-white/15 disabled:text-white/40"
          >
            <ArrowUp size={18} />
          </button>
        )}
      </div>
      <p className="mt-1.5 px-1 font-pretendard text-[11.5px] text-white/40">
        Enter 보내기 · Shift+Enter 줄바꿈 · 사진·영상은 끌어다 놓거나 붙여 넣어도 돼요
      </p>
    </div>
  );
});

export default Composer;
