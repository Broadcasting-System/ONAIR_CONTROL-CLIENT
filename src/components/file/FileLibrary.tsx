"use client";

/* eslint-disable @next/next/no-img-element -- 썸네일·슬라이드는 서버가 주는 임의 주소 */
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  Pause,
  Pencil,
  Play,
  Presentation,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import NeonButton from "@/components/common/NeonButton";
import SectionHeader from "@/components/common/SectionHeader";
import Select from "@/components/common/Select";
import InputModal from "@/components/common/InputModal";
import ConfirmModal from "@/components/common/ConfirmModal";
import { toast } from "@/components/common/Toast";
import { useFiles } from "@/hooks/useFiles";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useDisplay } from "@/hooks/useDisplay";
import { useMe } from "@/hooks/useMe";
import { useChannelStore, MAX_CHANNELS } from "@/stores/channelStore";
import { request } from "@/lib/http";
import { cn } from "@/lib/utils";
import type { FileType, UploadedFile } from "@/types/file";

/** 파일 — 종류마다 모양이 다른 카드(영상 ▶·사진 액자·PDF/PPT 겹친 종이·음원 파형) + 오른쪽 상세.
 *  카드를 누르면 상세(미리보기·쓰는 곳·송출·이름 바꾸기·지우기). 어디서든 끌어다 놓으면 올라간다. */

type Kind = "video" | "image" | "pdf" | "ppt" | "audio";
type LibFile = UploadedFile & { slideCount?: number; format?: string };

const KINDS: { key: Kind | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "video", label: "영상" },
  { key: "image", label: "사진" },
  { key: "pdf", label: "PDF" },
  { key: "ppt", label: "PPT" },
  { key: "audio", label: "음원" },
];
const KIND_LABEL: Record<Kind, string> = { video: "영상", image: "사진", pdf: "PDF", ppt: "PPT", audio: "음원" };

function KindIcon({ kind, size = 14, className }: { kind: Kind; size?: number; className?: string }) {
  const p = { size, className, strokeWidth: 2.2 };
  if (kind === "video") return <Film {...p} />;
  if (kind === "image") return <ImageIcon {...p} />;
  if (kind === "pdf") return <FileText {...p} />;
  if (kind === "ppt") return <Presentation {...p} />;
  return <Music {...p} />;
}

const kindOf = (f: LibFile): Kind => {
  if (f.type === "presentation") {
    if (f.format === "pdf") return "pdf";
    if (f.format === "ppt") return "ppt";
    return /\.pdf$/i.test(f.fileName) ? "pdf" : "ppt";
  }
  return f.type as Kind;
};

// 올릴 파일 종류 — 서버 ALLOWED_EXTENSIONS 와 같게
const EXT: Record<FileType, string[]> = {
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"],
  video: [".mp4", ".webm", ".mov", ".m4v", ".mkv"],
  audio: [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"],
  presentation: [".pdf", ".ppt", ".pptx"],
};
const ACCEPT = Object.values(EXT).flat().join(",");
const typeOfUpload = (name: string): FileType | null => {
  const n = name.toLowerCase();
  return (Object.keys(EXT) as FileType[]).find((t) => EXT[t].some((e) => n.endsWith(e))) ?? null;
};

const fmtSize = (b: number) =>
  !b ? "" : b >= 1e9 ? `${(b / 1e9).toFixed(1)}GB` : b >= 1e6 ? `${Math.round(b / 1e6)}MB` : b >= 1e3 ? `${Math.round(b / 1e3)}KB` : `${b}B`;
const fmtDur = (s?: number) => {
  if (!s || !isFinite(s)) return "";
  const t = Math.round(s);
  const p = (n: number) => String(n).padStart(2, "0");
  return t >= 3600 ? `${Math.floor(t / 3600)}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}` : `${Math.floor(t / 60)}:${p(t % 60)}`;
};
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()}`;
};
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** 주소 끝 파일 이름 (프레젠테이션은 슬라이드 폴더) — 다른 기기가 만든 절대 주소여도 같게 비교 */
const keyOf = (url?: string, folder = false) => {
  if (!url) return "";
  try {
    const parts = new URL(url, "http://x").pathname.split("/").filter(Boolean);
    return decodeURIComponent(folder ? parts[parts.length - 2] ?? "" : parts[parts.length - 1] ?? "");
  } catch {
    return "";
  }
};

// ---------------------------------------------------------------- 쓰는 곳

type Use = { kind: "live" | "reserve" | "bell"; label: string; short: string };

type Status = {
  type?: string;
  fileId?: string;
  url?: string;
  urls?: string[];
  slots?: { source?: { fileId?: string; url?: string } | null }[];
} | null;
type Sched = { fileId?: string; content?: string; channel?: number; schedule?: { date?: string; time?: string }; type?: string };
type Bell = { audioFile?: string };

function useUsage() {
  return useQuery({
    queryKey: ["file-usage"],
    queryFn: async () => {
      const [sch, tt, ...st] = await Promise.all([
        request<{ schedules: Sched[] }>("/broadcast/schedules").catch(() => ({ schedules: [] as Sched[] })),
        request<{ data: Record<string, { schedules?: { bells?: Bell[] }[] }> }>("/time").catch(() => ({ data: {} })),
        ...Array.from({ length: MAX_CHANNELS }, (_, i) =>
          request<Status>(`/display/status${i ? `?channel=${i + 1}` : ""}`).catch(() => null),
        ),
      ]);
      const bells: Bell[] = Object.values(tt.data ?? {}).flatMap((g) => (g?.schedules ?? []).flatMap((d) => d?.bells ?? []));
      return { schedules: sch.schedules ?? [], bells, status: st as Status[] };
    },
    refetchInterval: 10_000,
  });
}

function usesOf(f: LibFile, u?: ReturnType<typeof useUsage>["data"]): Use[] {
  if (!u) return [];
  const pres = f.type === "presentation";
  const mine = keyOf(f.fileUrl, pres);
  const same = (id?: string, url?: string) => (!!id && id === f.id) || (!!mine && keyOf(url, pres) === mine);
  const out: Use[] = [];
  u.status.forEach((s, i) => {
    if (!s || !s.type || s.type === "standby") return;
    const inSwitch = s.type === "switch" && (s.slots ?? []).some((sl) => sl?.source && same(sl.source.fileId, sl.source.url));
    if (inSwitch || same(s.fileId, pres ? s.urls?.[0] ?? s.url : s.url))
      out.push({ kind: "live", label: `CH${i + 1} ${inSwitch ? "스위처 " : ""}송출 중`, short: `송출 중 CH${i + 1}` });
  });
  for (const s of u.schedules) {
    if (!same(s.fileId, s.content)) continue;
    const d = s.schedule?.date ? new Date(`${s.schedule.date}T00:00:00`) : null;
    const day = d ? `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})` : "";
    out.push({ kind: "reserve", label: `예약 송출 · ${day} ${s.schedule?.time ?? ""} CH${s.channel ?? 1}`, short: `예약 ${d ? `${d.getMonth() + 1}/${d.getDate()}` : ""}` });
  }
  if (f.type === "audio") {
    const n = u.bells.filter((b) => b?.audioFile && keyOf(b.audioFile) === mine).length;
    if (n) out.push({ kind: "bell", label: `시보 ${n}개`, short: `시보 ${n}개` });
  }
  return out;
}

function UseBadge({ use }: { use?: Use }) {
  if (!use) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 font-pretendard text-[11.5px] font-semibold",
        use.kind === "live" ? "border border-[#FF3B3B]/45 bg-[#FF3B3B]/15 text-[#ff8a8a]" : "border border-white/20 text-white/75",
      )}
    >
      {use.kind === "live" && <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B3B]" />}
      {use.short}
    </span>
  );
}

// ---------------------------------------------------------------- 음원 한 번에 하나

let playing: HTMLAudioElement | null = null;
function useAudio(url: string) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);
  const [dur, setDur] = useState(0);
  const [pos, setPos] = useState(0);
  useEffect(() => {
    const a = new Audio();
    a.preload = "metadata";
    a.src = url;
    ref.current = a;
    a.onloadedmetadata = () => setDur(a.duration);
    a.ontimeupdate = () => setPos(a.currentTime);
    a.onpause = () => setOn(false);
    a.onplay = () => setOn(true);
    a.onended = () => setPos(0);
    return () => {
      a.pause();
      if (playing === a) playing = null;
      a.src = "";
    };
  }, [url]);
  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      if (playing && playing !== a) playing.pause();
      playing = a;
      void a.play().catch(() => toast.error("재생하지 못했어요"));
    } else a.pause();
  };
  const seek = (t: number) => {
    if (ref.current) ref.current.currentTime = t;
  };
  return { on, dur, pos, toggle, seek };
}

/** 영상 길이 — 첫 화면 정보만 읽는다 */
function useVideoDuration(url: string, enabled: boolean) {
  const [d, setD] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => setD(v.duration);
    v.src = url;
    return () => {
      v.removeAttribute("src");
      v.load();
    };
  }, [url, enabled]);
  return d;
}

// ---------------------------------------------------------------- 카드

function Waveform({ seed, played, bars = 34, className }: { seed: string; played: number; bars?: number; className?: string }) {
  const hs = useMemo(() => {
    let h = 0;
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: bars }, (_, i) => {
      h = (h * 1103515245 + 12345 + i) >>> 0;
      return 22 + (h % 78);
    });
  }, [seed, bars]);
  return (
    <div className={cn("flex h-[30px] items-center gap-[2px]", className)}>
      {hs.map((v, i) => (
        <i key={i} className="w-[3px] rounded-sm" style={{ height: `${v}%`, background: i / bars < played ? "#fff" : "rgba(255,255,255,0.3)" }} />
      ))}
    </div>
  );
}

function Visual({ f, kind, live, dur }: { f: LibFile; kind: Kind; live: boolean; dur: number }) {
  if (kind === "video")
    return (
      <div className="relative aspect-video overflow-hidden rounded-[10px] bg-[#111]">
        {f.thumbnailUrl ? <img src={f.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : null}
        <span className="absolute left-1/2 top-1/2 flex h-[38px] w-[38px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-white/70 bg-black/55">
          <Play size={13} fill="#fff" className="ml-0.5 text-white" />
        </span>
        {dur ? <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 font-orbitron text-[11px] font-semibold">{fmtDur(dur)}</span> : null}
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/18">
          <i className={cn("block h-full bg-[#FF3B3B]", live ? "w-[38%]" : "w-0")} />
        </span>
      </div>
    );
  if (kind === "image")
    return (
      <div className="aspect-video rounded-[10px] bg-[#e9e9e7] p-[6px] shadow-[0_4px_14px_rgba(0,0,0,0.5)]">
        <div className="relative h-full w-full overflow-hidden rounded-[3px] bg-[#ddd]">
          <img src={f.thumbnailUrl || f.fileUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        </div>
      </div>
    );
  if (kind === "pdf" || kind === "ppt")
    return (
      <div className="relative aspect-video">
        <div className="absolute inset-x-[7%] top-0 h-[86%] rotate-[2.5deg] rounded-md bg-[#bdbdbb]" />
        <div className="absolute inset-x-[5%] top-[3%] h-[86%] -rotate-[1.5deg] rounded-md bg-[#d6d6d4]" />
        <div className="absolute inset-x-[6%] bottom-0 top-[8%] overflow-hidden rounded-md bg-[#f4f4f2] shadow-[0_4px_14px_rgba(0,0,0,0.5)]">
          <img src={f.thumbnailUrl || f.fileUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          <span className="absolute left-1.5 top-1.5 rounded bg-[#1a1a1d] px-1.5 py-px font-orbitron text-[10px] font-extrabold tracking-wider text-white">
            {KIND_LABEL[kind]}
          </span>
          {f.slideCount ? (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 font-orbitron text-[11px] font-semibold text-white">
              {f.slideCount}
              {kind === "pdf" ? "쪽" : "장"}
            </span>
          ) : null}
        </div>
      </div>
    );
  return null;
}

function AudioVisual({ f }: { f: LibFile }) {
  const a = useAudio(f.fileUrl);
  return (
    <div className="flex aspect-video flex-col justify-center gap-3 rounded-[10px] bg-[#0d0e11] px-3.5">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            a.toggle();
          }}
          aria-label={a.on ? "멈춤" : "들어 보기"}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white text-[#0a0a0c]"
        >
          {a.on ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ml-0.5" />}
        </button>
        <span className="font-orbitron text-[13px] font-semibold tabular-nums">{a.on || a.pos ? fmtDur(a.pos) || "0:00" : fmtDur(a.dur)}</span>
      </div>
      <Waveform seed={f.id} played={a.dur ? a.pos / a.dur : 0} />
    </div>
  );
}

function FileCard({ f, selected, onSelect, use }: { f: LibFile; selected: boolean; onSelect: () => void; use?: Use }) {
  const kind = kindOf(f);
  const dur = useVideoDuration(f.fileUrl, kind === "video");
  return (
    <div
      role="button"
      tabIndex={0}
      data-tour="files.item"
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "flex min-w-0 cursor-pointer flex-col gap-2.5 rounded-[15px] p-2.5 transition-colors",
        selected ? "bg-[#FF3B3B]/[0.09] outline outline-[1.5px] outline-[#FF3B3B]/55" : "bg-white/[0.035] hover:bg-white/[0.06]",
      )}
    >
      {kind === "audio" ? <AudioVisual f={f} /> : <Visual f={f} kind={kind} live={use?.kind === "live"} dur={dur} />}
      <div className="min-w-0 px-0.5">
        <div className="flex min-w-0 items-center gap-1.5 font-pretendard text-[14px] font-bold">
          <KindIcon kind={kind} className="shrink-0 text-white/55" />
          <span className="truncate">{f.fileName}</span>
        </div>
        <div className="mt-1.5 flex min-h-[22px] items-center gap-1.5">
          <span className="truncate font-pretendard text-[12.5px] text-white/45">
            {[KIND_LABEL[kind], fmtSize(Number(f.fileSize))].filter(Boolean).join(" · ")}
          </span>
          <span className="ml-auto" />
          <UseBadge use={use} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 상세

function Slides({ urls }: { urls: string[] }) {
  const [i, setI] = useState(0);
  const n = urls.length;
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-[#f4f4f2]">
      <img src={urls[Math.min(i, n - 1)]} alt="" className="absolute inset-0 h-full w-full object-contain" />
      {n > 1 && (
        <div className="absolute inset-x-0 bottom-1.5 flex items-center justify-center gap-2">
          <button type="button" aria-label="이전 장" onClick={() => setI((x) => Math.max(0, x - 1))} className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-40" disabled={i === 0}>
            <ChevronLeft size={15} />
          </button>
          <span className="rounded-md bg-black/70 px-2 font-orbitron text-[11px] font-semibold text-white">
            {i + 1} / {n}
          </span>
          <button type="button" aria-label="다음 장" onClick={() => setI((x) => Math.min(n - 1, x + 1))} className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-40" disabled={i >= n - 1}>
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function AudioDetail({ f }: { f: LibFile }) {
  const a = useAudio(f.fileUrl);
  return (
    <div className="flex aspect-video flex-col justify-center gap-4 rounded-xl bg-[#0d0e11] px-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={a.toggle} aria-label={a.on ? "멈춤" : "들어 보기"} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#0a0a0c]">
          {a.on ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
        </button>
        <span className="font-orbitron text-[14px] font-semibold tabular-nums">
          {fmtDur(a.pos) || "0:00"} <span className="text-white/40">/ {fmtDur(a.dur) || "-"}</span>
        </span>
      </div>
      <div
        className="cursor-pointer"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          if (a.dur) a.seek(((e.clientX - r.left) / r.width) * a.dur);
        }}
      >
        <Waveform seed={f.id} played={a.dur ? a.pos / a.dur : 0} bars={48} className="h-10" />
      </div>
    </div>
  );
}

function Detail({
  f,
  uses,
  canOperate,
  canDelete,
  onClose,
  onRename,
  onDelete,
}: {
  f: LibFile;
  uses: Use[];
  canOperate: boolean;
  canDelete: boolean;
  onClose?: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const kind = kindOf(f);
  const channel = useChannelStore((s) => s.channel);
  const [ch, setCh] = useState(channel);
  const { showMedia, isSending } = useDisplay();
  const dur = useVideoDuration(f.fileUrl, kind === "video");
  const meta = [KIND_LABEL[kind], kind === "video" ? fmtDur(dur) : "", f.slideCount ? `${f.slideCount}${kind === "pdf" ? "쪽" : "장"}` : "", fmtSize(Number(f.fileSize)), fmtDate(f.uploadedAt)]
    .filter(Boolean)
    .join(" · ");
  const send = async () => {
    try {
      await showMedia(f, ch);
      toast.success(`CH${ch}에 송출했어요`);
    } catch (e) {
      toast.error((e as Error).message || "송출하지 못했어요");
    }
  };
  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-white/[0.08] bg-[rgba(14,14,17,0.82)] p-4 backdrop-blur-md" data-tour="files.detail">
      {onClose && (
        <button type="button" onClick={onClose} aria-label="닫기" className="-mb-1 ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10">
          <X size={18} />
        </button>
      )}
      {kind === "video" ? (
        <video key={f.id} src={f.fileUrl} poster={f.thumbnailUrl ?? undefined} controls playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-black object-contain" />
      ) : kind === "image" ? (
        <img src={f.fileUrl} alt="" className="aspect-video w-full rounded-xl bg-black object-contain" />
      ) : kind === "audio" ? (
        <AudioDetail key={f.id} f={f} />
      ) : (
        <Slides key={f.id} urls={f.urls?.length ? f.urls : [f.fileUrl]} />
      )}
      <div className="min-w-0">
        <div className="break-all font-pretendard text-[17px] font-bold">{f.fileName}</div>
        <div className="mt-1 font-pretendard text-[13px] text-white/45">{meta}</div>
      </div>
      {uses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mbc text-[13px] text-white/55">쓰는 곳</span>
          {uses.map((u, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 rounded-[10px] px-3 py-2 font-pretendard text-[13px] font-semibold",
                u.kind === "live" ? "border border-[#FF3B3B]/35 bg-[#FF3B3B]/10" : "bg-white/[0.04]",
              )}
            >
              {u.kind === "live" && <span className="h-[7px] w-[7px] rounded-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B]" />}
              {u.label}
            </div>
          ))}
        </div>
      )}
      {canOperate && (
        <div className="flex flex-col gap-2" data-tour="files.detail.send">
          <div className="flex gap-1">
            {Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={ch === n}
                onClick={() => setCh(n)}
                className={cn(
                  "h-9 flex-1 rounded-lg border font-orbitron text-[13px]",
                  ch === n ? "border-red-400/50 bg-red-400/15 text-white" : "border-white/10 text-white/45 hover:bg-white/5",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <NeonButton disabled={isSending} onClick={send} icon={<Send />} className="w-full">
            CH{ch}에 송출
          </NeonButton>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <NeonButton tone="white" disabled={!canOperate} onClick={onRename} data-tour="files.menu.rename" icon={<Pencil />} className="h-10 md:h-10">
          이름 바꾸기
        </NeonButton>
        {canDelete && (
          <NeonButton tone="white" onClick={onDelete} data-tour="files.menu.delete" icon={<Trash2 />} className="h-10 md:h-10">
            지우기
          </NeonButton>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 화면

export default function FileLibrary() {
  const { files, fetchFiles, deleteFile, renameFile } = useFiles();
  const { upload, isUploading, progress } = useFileUpload();
  const { canOperate, isAdmin } = useMe();
  const usage = useUsage();
  const [kind, setKind] = useState<Kind | "all">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "name">("new");
  const [selId, setSelId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<LibFile | null>(null);
  const [deleting, setDeleting] = useState<LibFile | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  const all: LibFile[] = useMemo(
    () => [...files.video, ...files.image, ...files.presentation, ...files.audio] as LibFile[],
    [files],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const f of all) c[kindOf(f)] = (c[kindOf(f)] ?? 0) + 1;
    return c;
  }, [all]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = all.filter((f) => (kind === "all" || kindOf(f) === kind) && (!needle || f.fileName.toLowerCase().includes(needle)));
    return list.sort((a, b) => (sort === "name" ? a.fileName.localeCompare(b.fileName, "ko") : b.uploadedAt.localeCompare(a.uploadedAt)));
  }, [all, kind, q, sort]);
  const selected = all.find((f) => f.id === selId) ?? null;

  const doUpload = async (list: FileList | File[]) => {
    const arr = Array.from(list);
    const groups = new Map<FileType, File[]>();
    const bad: string[] = [];
    for (const f of arr) {
      const t = typeOfUpload(f.name);
      if (!t) bad.push(f.name);
      else groups.set(t, [...(groups.get(t) ?? []), f]);
    }
    if (bad.length) toast.error(`올릴 수 없는 형식이에요: ${bad.slice(0, 3).join(", ")}`);
    for (const [t, fs] of groups) {
      try {
        await upload(fs, t);
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
    if (groups.size) {
      await fetchFiles();
      toast.success(`${arr.length - bad.length}개 올렸어요`);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!canOperate) return;
    if (e.dataTransfer.files?.length) void doUpload(e.dataTransfer.files);
  };

  const detail = (onClose?: () => void): ReactNode =>
    selected ? (
      <Detail
        key={selected.id}
        f={selected}
        uses={usesOf(selected, usage.data)}
        canOperate={canOperate}
        canDelete={isAdmin}
        onClose={onClose}
        onRename={() => setRenaming(selected)}
        onDelete={() => setDeleting(selected)}
      />
    ) : null;

  return (
    <div
      className="relative flex w-full flex-col gap-5 md:h-full md:px-[20px]"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <header className="flex flex-wrap items-center gap-3">
        <SectionHeader className="mb-0 mr-2">파일</SectionHeader>
        <div className="flex flex-wrap gap-1.5" data-tour="files.tabs">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              aria-pressed={kind === k.key}
              onClick={() => setKind(k.key)}
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-[11px] border px-3 font-mbc text-sm transition-colors md:h-9",
                kind === k.key ? "border-[#FF3B3B]/70 bg-[#FF3B3B]/13 text-white" : "border-white/10 bg-white/[0.04] text-white/70 hover:text-white",
              )}
            >
              {k.key !== "all" && <KindIcon kind={k.key} />}
              {k.label}
              <small className="font-orbitron text-[11px] text-white/45">{counts[k.key] ?? 0}</small>
            </button>
          ))}
        </div>
        <div className="ml-auto flex w-full items-center gap-2 md:w-auto">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[11px] border border-white/10 bg-[#0c0d0f] px-3 md:h-9 md:w-[220px] md:flex-none" data-tour="files.search">
            <Search size={15} className="shrink-0 text-white/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름으로 찾기" className="min-w-0 flex-1 bg-transparent font-pretendard text-[14px] text-white outline-none placeholder:text-white/35" />
          </label>
          <Select
            value={sort}
            onChange={setSort}
            aria-label="정렬"
            className="h-10 rounded-[11px] md:h-9"
            options={[
              { value: "new", label: "최근 올린 순" },
              { value: "name", label: "이름 순" },
            ]}
          />
          <NeonButton
            disabled={!canOperate || isUploading}
            onClick={() => inputRef.current?.click()}
            data-tour="files.upload"
            icon={<Upload />}
            className="shrink-0"
          >
            {isUploading ? `올리는 중 ${Math.round(progress)}%` : "올리기"}
          </NeonButton>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void doUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-0 overflow-auto pb-6 [scrollbar-width:thin]">
          {shown.length === 0 ? (
            <EmptyState className="py-20">{all.length ? "찾는 파일이 없어요" : "파일이 없어요"}</EmptyState>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
              {shown.map((f) => (
                <FileCard
                  key={f.id}
                  f={f}
                  selected={selId === f.id}
                  onSelect={() => setSelId(selId === f.id ? null : f.id)}
                  use={usesOf(f, usage.data)[0]}
                />
              ))}
            </div>
          )}
        </div>
        <div className="hidden min-h-0 overflow-auto md:block">{detail()}</div>
      </div>

      {/* 폰 — 상세는 아래에서 올라오는 판 */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-auto rounded-t-[22px] border-t border-white/10 bg-[#121214] p-3 shadow-[0_-20px_40px_rgba(0,0,0,0.6)] md:hidden">
          {detail(() => setSelId(null))}
        </div>
      )}

      {dragging && canOperate && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[22px] border-2 border-dashed border-[#FF3B3B]/60 bg-black/60 backdrop-blur-sm">
          <span className="flex items-center gap-2 font-mbc text-xl text-white">
            <Upload size={22} />
            여기에 놓으면 올라가요
          </span>
        </div>
      )}

      {renaming && (
        <InputModal
          isOpen
          onClose={() => setRenaming(null)}
          title="이름 바꾸기"
          icon={<Pencil size={18} className="text-red-500" />}
          initialValue={renaming.fileName}
          confirmText="바꾸기"
          onConfirm={async (name) => {
            await renameFile(renaming.id, renaming.type, name);
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          isOpen
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteFile(deleting.id, deleting.type);
            if (selId === deleting.id) setSelId(null);
            setDeleting(null);
          }}
          title="파일 지우기"
          message={`'${deleting.fileName}'\n되돌릴 수 없어요`}
          confirmText="지우기"
          cancelText="취소"
          isDestructive
        />
      )}
    </div>
  );
}
