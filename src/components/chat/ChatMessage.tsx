"use client";

import { ArrowUpRight, Check, Minus, Play, X } from "lucide-react";
import ActionCard from "@/components/chat/ActionCard";
import CueRing from "@/components/common/CueRing";
import ChatMarkdown from "@/components/chat/ChatMarkdown";
import { KindIcon } from "@/components/chat/Composer";
import type { LiveMessage } from "@/hooks/useChatConversation";
import { chatAssetUrl } from "@/lib/chatApi";
import { cn } from "@/lib/utils";
import type { ChatAction, ChatUpload } from "@/types/chat";
import { useTour } from "@/stores/tourStore";

function sizeText(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(n / 1024))}KB`;
}

function UploadThumbs({ uploads }: { uploads: ChatUpload[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {uploads.map((u) => {
        const thumb = u.thumbUrl ? chatAssetUrl(u.thumbUrl) : u.kind === "image" ? chatAssetUrl(u.url) : "";
        return (
          <a
            key={u.uploadId}
            href={chatAssetUrl(u.url)}
            target="_blank"
            rel="noreferrer"
            title={u.name}
            className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] hover:border-white/30"
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt={u.name} className="h-20 max-w-[160px] object-cover" />
            ) : (
              <span className="flex h-12 max-w-[200px] items-center gap-2 px-3 font-pretendard text-[12.5px] text-white/75">
                <KindIcon kind={u.kind} />
                <span className="truncate">{u.name}</span>
                <span className="shrink-0 text-white/40">{sizeText(u.size)}</span>
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}

/** 답 아래 [화면에서 보기] — 누르면 CUE 창을 접고 그 화면에서 단계별로 강조해 보여 준다 */
function TourButton({ tour }: { tour: import("@/types/chat").ChatTour }) {
  const start = useTour((s) => s.start);
  return (
    <button
      type="button"
      onClick={() => start(tour)}
      className="flex h-10 w-fit items-center gap-2 rounded-lg border border-white/20 bg-white/[0.07] px-3.5 font-pretendard text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.12]"
    >
      <Play size={14} className="fill-current" />
      화면에서 보기
      <span className="font-normal text-white/50">{tour.steps.length}단계</span>
    </button>
  );
}

export default function ChatMessage({
  message: m,
  onLink,
  onActionUpdate,
  onActionDone,
}: {
  message: LiveMessage;
  onLink: (href: string) => void;
  onActionUpdate: (a: ChatAction) => void;
  onActionDone: () => void;
}) {
  if (m.role === "user") {
    return (
      <div className={cn("flex flex-col items-end gap-1.5", m.pending && "opacity-70")}>
        {!!m.uploads?.length && <UploadThumbs uploads={m.uploads} />}
        {m.text && (
          <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-white/10 bg-white/[0.09] px-4 py-2.5 font-pretendard text-[15px] leading-relaxed text-white">
            {m.text}
          </div>
        )}
      </div>
    );
  }

  const tools = m.tools ?? [];
  const thinking = m.streaming && !m.text && !tools.some((t) => t.status === "running");

  return (
    <div className="flex flex-col gap-2.5">
      {tools.length > 0 && (
        <ul className="flex flex-col gap-1">
          {tools.map((t) => {
            const running = t.status === "running" && m.streaming;
            return (
              <li key={t.id} className="flex items-start gap-2 font-pretendard text-[13px] leading-5 text-white/55">
                <span className="flex h-5 w-4 shrink-0 items-center justify-center">
                  {running ? (
                    <CueRing size={15} className="text-[#e5484d]" />
                  ) : t.status === "error" ? (
                    <X size={13} />
                  ) : t.status === "running" ? (
                    <Minus size={13} />
                  ) : (
                    <Check size={13} />
                  )}
                </span>
                <span className="min-w-0">
                  {t.label}
                  {running ? "…" : ""}
                  {t.summary && !running && <span className="text-white/35"> · {t.summary}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {thinking && (
        <p className="flex items-center gap-2 font-pretendard text-[13px] text-white/55">
          <CueRing size={18} className="text-[#e5484d]" /> 생각하는 중…
        </p>
      )}

      {m.text && (
        <div className="font-pretendard text-[15px] leading-relaxed text-white/90">
          <ChatMarkdown text={m.text} onLink={onLink} />
        </div>
      )}

      {!!m.links?.length && (
        <div className="flex flex-wrap gap-2">
          {m.links.map((l, i) => (
            <button
              key={`${l.href}-${i}`}
              type="button"
              onClick={() => onLink(l.href)}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 font-pretendard text-[14px] text-white/85 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              {l.label}
              <ArrowUpRight size={15} className="text-white/50" />
            </button>
          ))}
        </div>
      )}

      {(m.tours ?? []).map((t, i) => (
        <TourButton key={`tour-${i}`} tour={t} />
      ))}

      {(m.actions ?? []).map((a) => (
        <ActionCard key={a.id} action={a} onUpdate={onActionUpdate} onDone={onActionDone} />
      ))}

      {m.error && <p className="font-pretendard text-[13.5px] text-[#FF6B6B]">{m.error}</p>}
      {m.stopped && <p className="font-pretendard text-[13px] text-white/40">여기서 멈췄어요</p>}
    </div>
  );
}
