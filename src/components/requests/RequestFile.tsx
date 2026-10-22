"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Download, FileText, Play, Presentation, X } from "lucide-react";
import Portal from "@/components/common/Portal";
import { cn } from "@/lib/utils";
import { requestsApi, type TeacherRequest } from "@/lib/teacherRequests";

/** 선생님이 올린 파일 — 작은 미리보기를 누르면 앱 안에서 크게 (사진·영상·PDF), PPT 는 내려받기.
 *  맥 앱(웹뷰)은 새 탭 링크를 열지 않아서 새 탭 대신 이 창으로 본다. */

type Kind = "image" | "video" | "pdf" | "ppt";

function kindOf(name: string): Kind {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "m4v", "mkv"].includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return "ppt";
}

export function sizeText(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}MB`;
  return `${Math.max(1, Math.round(n / 1000))}KB`;
}

/** 미리보기 그림 (사진은 그대로, 영상은 첫 장면, PDF·PPT 는 종류 표시) */
function Thumb({ r, kind, className }: { r: TeacherRequest; kind: Kind; className?: string }) {
  const url = requestsApi.fileUrl(r.id);
  const box = cn("relative flex shrink-0 items-center justify-center overflow-hidden border border-white/[0.12] bg-white/[0.06]", className);
  if (kind === "image")
    // eslint-disable-next-line @next/next/no-img-element
    return <span className={box}><img src={url} alt="" className="h-full w-full object-cover" /></span>;
  if (kind === "video")
    return (
      <span className={box}>
        <video src={`${url}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
          <span className="flex h-[30%] max-h-9 min-h-5 aspect-square items-center justify-center rounded-full bg-black/55">
            <Play className="h-1/2 w-1/2 fill-white text-white" />
          </span>
        </span>
      </span>
    );
  const Icon = kind === "pdf" ? FileText : Presentation;
  return (
    <span className={cn(box, "flex-col gap-0.5 text-white/70")}>
      <Icon className="h-[34%] max-h-6 w-auto" />
      <span className="font-orbitron text-[10px] tracking-wider">{kind === "pdf" ? "PDF" : "PPT"}</span>
    </span>
  );
}

/** 요청함 목록 줄 오른쪽 작은 그림 */
export function RowThumb({ r }: { r: TeacherRequest }) {
  if (r.kind !== "media") return null;
  if (r.payload.source === "youtube")
    return r.payload.videoId ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`https://i.ytimg.com/vi/${r.payload.videoId}/default.jpg`} alt="" className="h-11 w-11 shrink-0 rounded-[10px] border border-white/[0.12] object-cover" />
    ) : null;
  if (!r.upload) return null;
  return <Thumb r={r} kind={kindOf(r.upload.name)} className="h-11 w-11 rounded-[10px]" />;
}

/** 요청 상세의 파일 — 누르면 크게 */
export default function RequestFile({ r }: { r: TeacherRequest }) {
  const [open, setOpen] = useState(false);
  const up = r.upload;
  if (!up) return <>-</>;
  const kind = kindOf(up.name);
  const url = requestsApi.fileUrl(r.id);
  const download = (
    <a href={`${url}?download=1`} download={up.name} className="inline-flex items-center gap-1.5 font-pretendard text-[13.5px] font-bold text-white/70 hover:text-white">
      <Download size={15} />
      내려받기
    </a>
  );
  const viewable = kind !== "ppt";
  return (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => (viewable ? setOpen(true) : undefined)}
          className={cn("shrink-0 text-left", viewable ? "cursor-zoom-in" : "cursor-default")}
          aria-label={viewable ? `${up.name} 크게 보기` : up.name}
        >
          <Thumb r={r} kind={kind} className="h-[68px] w-[120px] rounded-[10px]" />
        </button>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate">{up.name}</span>
          <span className="flex items-center gap-3 font-pretendard text-[13px] font-normal text-white/45">
            {sizeText(up.size)}
            {!viewable && download}
          </span>
        </span>
      </span>
      {open && <Viewer name={up.name} size={up.size} kind={kind} url={url} download={download} onClose={() => setOpen(false)} />}
    </>
  );
}

function Viewer({ name, size, kind, url, download, onClose }: { name: string; size: number; kind: Kind; url: string; download: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <Portal>
      <div className="fixed inset-0 z-[1000] flex flex-col bg-black/85 backdrop-blur-md">
        <div className="absolute inset-0" onClick={onClose} />
        <div className="relative z-10 flex items-center gap-4 px-5 py-4 md:px-8">
          <div className="min-w-0 flex-1">
            <b className="block truncate font-pretendard text-[16px] text-white">{name}</b>
            <span className="font-pretendard text-[13px] text-white/45">{sizeText(size)}</span>
          </div>
          {download}
          <button type="button" onClick={onClose} aria-label="닫기" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white hover:bg-white/15">
            <X size={22} />
          </button>
        </div>
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 pb-6 md:px-10 md:pb-10" onClick={(e) => e.target === e.currentTarget && onClose()}>
          {kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={name} className="max-h-full max-w-full rounded-lg object-contain" />
          )}
          {kind === "video" && <video src={url} controls autoPlay playsInline className="max-h-full max-w-full rounded-lg bg-black" />}
          {kind === "pdf" && <iframe src={url} title={name} className="h-full w-full max-w-5xl rounded-lg bg-white" />}
        </div>
      </div>
    </Portal>
  );
}
