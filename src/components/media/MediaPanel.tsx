"use client";

/* eslint-disable @next/next/no-img-element -- 유튜브 썸네일은 임의 주소 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cast, File as FileIcon, Image as ImageIcon, Monitor, Music, Presentation, Timer, Video, VolumeX, Youtube } from "lucide-react";
import NeonButton from "@/components/common/NeonButton";
import { toast } from "@/components/common/Toast";
import { DurationWheel } from "@/components/common/DateTimePicker";
import { DisplayMirror } from "@/components/display/DisplayMirror";
import ExternalSharePanel, { shareSource, useExternalShare } from "@/components/media/ExternalSharePanel";
import { LiveChatSwitch } from "@/components/media/LiveChatSwitch";
import {
  Chip,
  ChannelChips,
  FileThumb,
  ImageOverlayEditor,
  LAYOUT_LABEL,
  LayoutSelect,
  LocalStream,
  OffButton,
  OtherChannels,
  PlayBar,
  PresentationNav,
  SlotNo,
  SoundRow,
  SourceCard,
  TYPE_LABEL,
  fmt,
  fmtSize,
} from "@/components/media/parts";
import { SlotPreview, SwitchGrid } from "@/components/switcher/SlotPreview";
import { getApiBase } from "@/lib/apiBase";
import { cn } from "@/lib/utils";
import { parseYouTubeId } from "@/lib/youtube";
import { type ShareRequest } from "@/lib/shareApi";
import {
  SLOT_COUNT,
  sourceKey,
  switchApi,
  type SwitchLayout,
  type SwitchSlot,
  type SwitchSlotInput,
  type SwitchSource,
  type SwitchState,
} from "@/lib/switchApi";
import { useChannelStore } from "@/stores/channelStore";
import { useDisplay } from "@/hooks/useDisplay";
import { useDisplaySync, type Playback } from "@/hooks/useDisplaySync";
import { useFiles } from "@/hooks/useFiles";
import { useHealth } from "@/hooks/useHealth";
import { useMe } from "@/hooks/useMe";
import { usePlayer } from "@/hooks/usePlayer";
import { useScreenShare } from "@/hooks/useScreenShare";
import type { FileType, UploadedFile } from "@/types/file";
import { channelName } from "@/constants/channels";

/** 송출 (송출 › 송출 탭) — 옛 송출 화면과 스위처를 하나로.
 *  왼쪽 소스(파일·유튜브·타이머·내 화면·외부 화면)에서 고르고, 오른쪽 송출 화면에서 채널·배치(한 화면·2분할·4분할·PIP)를 정한다.
 *  한 화면은 고른 것을 그대로, 분할은 칸을 누르고 소스를 골라 채운 뒤 아래 송출 버튼으로 내보낸다 (그 전까진 송출되지 않는다).
 *  시안: Desktop/ONAIR-송출-시안/merge.html. lead = 페이지 제목·탭 */

type Src = "file" | "youtube" | "timer" | "screen" | "ext";

const SOURCES: { key: Src; label: string; icon: ReactNode; tour: string }[] = [
  { key: "file", label: "파일", icon: <FileIcon size={18} />, tour: "media.source.file" },
  { key: "youtube", label: "유튜브", icon: <Youtube size={18} />, tour: "media.youtube" },
  { key: "timer", label: "타이머", icon: <Timer size={18} />, tour: "media.timer" },
  { key: "screen", label: "내 화면", icon: <Monitor size={18} />, tour: "media.screen-share" },
  { key: "ext", label: "외부 화면", icon: <Cast size={18} />, tour: "media.share-tab" },
];

const FILE_TABS: { key: FileType; label: string; icon: ReactNode }[] = [
  { key: "video", label: "영상", icon: <Video size={16} /> },
  { key: "image", label: "사진", icon: <ImageIcon size={16} /> },
  { key: "presentation", label: "PPT", icon: <Presentation size={16} /> },
  { key: "audio", label: "음원", icon: <Music size={16} /> },
];

const LAYOUTS: SwitchLayout[] = ["one", "two", "four", "pip"];
const EMPTY_SLOT: SwitchSlot = { source: null, mute: false, volume: 100, startedAt: 0, fit: "contain", loop: true };
const EMPTY: SwitchState = { type: "switch", layout: "four", slots: [0, 1, 2, 3].map(() => ({ ...EMPTY_SLOT })), sources: [] };
const norm = (st: SwitchState): SwitchState => ({ ...st, slots: [0, 1, 2, 3].map((i) => ({ ...EMPTY_SLOT, ...st.slots[i] })) });

const PANEL_MD = "md:rounded-[20px] md:border md:border-white/[0.08] md:bg-[rgba(14,14,17,0.74)] md:backdrop-blur-[10px]";

const timerText = (sec: number) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(sec / 3600) ? `${Math.floor(sec / 3600)}:` : ""}${p(Math.floor((sec % 3600) / 60))}:${p(sec % 60)}`;
};

/** 주기적으로 다시 그리기 (진행바) */
function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** 한 화면 영상·유튜브 진행바 (서버 시계 기준) */
function LivePlayBar({
  pb,
  fallbackDuration = 0,
  onToggle,
  onSeek,
  disabled,
}: {
  pb: Playback;
  fallbackDuration?: number;
  onToggle: () => void;
  onSeek?: (s: number) => void;
  disabled?: boolean;
}) {
  const now = useNow(250);
  const duration = pb.duration || fallbackDuration;
  const raw = pb.playing ? pb.offset + (now - pb.anchorTs) / 1000 : pb.offset;
  // 반복 중엔 서버 시계가 계속 늘어나므로 길이로 나눈 나머지
  const pos = duration > 0 ? (pb.loop ? raw % duration : Math.min(raw, duration)) : raw;
  return <PlayBar pos={pos} duration={duration} playing={pb.playing} onToggle={onToggle} onSeek={onSeek} disabled={disabled} />;
}

/** 분할 칸 영상 진행바 — 칸은 startedAt 부터 재생 (멈춤은 없다) */
function SlotPlayBar({ startedAt, duration, loop, onSeek, disabled }: { startedAt: number; duration: number; loop: boolean; onSeek: (s: number) => void; disabled?: boolean }) {
  const now = useNow(250);
  const el = Math.max(0, (now - startedAt) / 1000);
  return <PlayBar pos={loop ? el % duration : Math.min(el, duration)} duration={duration} onSeek={onSeek} disabled={disabled} />;
}

export default function MediaPanel({ lead, fromSwitcher }: { lead: ReactNode; fromSwitcher?: boolean }) {
  const qc = useQueryClient();
  const channel = useChannelStore((s) => s.channel);
  const setChannel = useChannelStore((s) => s.setChannel);
  const { canOperate } = useMe();
  const disabled = !canOperate;
  const { files, fetchFiles, isLoading } = useFiles();
  const { showMedia, showTimer, showYouTube, isSending } = useDisplay();
  const { content } = useDisplaySync(channel);
  const player = usePlayer(channel);
  const { isSharing, sharingChannel, start: startShare, stop: stopShare, localStream } = useScreenShare(channel);
  const sharingHere = isSharing && sharingChannel === channel;
  const { health } = useHealth();

  // 새로고침 전에 고르던 채널 복원 (SSR과 어긋나지 않게 마운트 후)
  useEffect(() => {
    void useChannelStore.persist.rehydrate();
  }, []);
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const [src, setSrc] = useState<Src>("file");
  const [ftype, setFtype] = useState<FileType>("video");
  const [layout, setLayoutState] = useState<SwitchLayout>("one");
  const [draft, setDraft] = useState<SwitchState | null>(null);
  const [local, setLocal] = useState<SwitchState | null>(null);
  const [sel, setSel] = useState(0);
  const [pickFile, setPickFile] = useState<string | null>(null);
  const [pickShare, setPickShare] = useState<string | null>(null);
  const [ytUrl, setYtUrl] = useState("");
  const [ytLoop, setYtLoop] = useState(false);
  const [tMode, setTMode] = useState<"down" | "up">("down");
  const [tLabel, setTLabel] = useState("");
  const [tSec, setTSec] = useState(300);
  const [sending, setSending] = useState(false);

  // 외부 화면 요청 (기다리는 수는 소스 줄에 빨간 숫자)
  const ext = useExternalShare(src === "ext", canOperate);
  const requests = useMemo(() => ext.data?.requests ?? [], [ext.data]);
  const extWaiting = requests.filter((r) => r.status === "waiting").length;
  const shareById = useMemo(() => new Map<string, ShareRequest>(requests.map((r) => [r.id, r])), [requests]);

  /* ---------- 지금 송출 · 분할 배치 ---------- */
  const liveSwitch = content?.type === "switch" && !!content.slots;
  const saved = useQuery({ queryKey: ["switch", channel], queryFn: () => switchApi.get(channel), enabled: !liveSwitch, staleTime: 5000, retry: false });
  const base: SwitchState = useMemo(
    () =>
      liveSwitch
        ? { type: "switch", layout: content!.layout ?? "four", slots: content!.slots!, sources: content!.sources ?? [] }
        : (saved.data ?? EMPTY),
    [liveSwitch, content, saved.data],
  );
  const split = layout !== "one";
  const view: SwitchState = norm(draft ?? local ?? { ...base, layout });
  const count = SLOT_COUNT[layout];
  const selected = Math.min(sel, count - 1);
  // 지금 송출 중인 배치를 그대로 보고 있으면 소리·맞춤·반복·진행바는 바로 나간다 (바꾼 배치는 송출 버튼으로)
  const liveSame = liveSwitch && content?.layout === layout && !draft;

  // 채널을 바꾸면 그 채널의 지금 배치로 (주소의 ?layout= · 옛 스위처 주소가 먼저)
  const initLayout = useRef<SwitchLayout | "split" | null>(null);
  const needSync = useRef(true);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("layout");
    if (q && (LAYOUTS as string[]).includes(q)) initLayout.current = q as SwitchLayout;
    else if (fromSwitcher || new URLSearchParams(window.location.search).get("tab") === "switch") initLayout.current = "split";
  }, [fromSwitcher]);
  useEffect(() => {
    needSync.current = true;
    setDraft(null);
    setLocal(null);
    setPickFile(null);
    setPickShare(null);
    setSel(0);
  }, [channel]);
  const liveLayout: SwitchLayout = content?.type === "switch" && content.layout ? content.layout : "one";
  useEffect(() => {
    if (!needSync.current || !content) return;
    needSync.current = false;
    const want = initLayout.current;
    initLayout.current = null;
    if (want && want !== "split") setLayoutState(want);
    else setLayoutState(want === "split" && liveLayout === "one" ? "four" : liveLayout);
  }, [content, liveLayout]);

  const setLayout = (l: SwitchLayout) => {
    setLayoutState(l);
    // 지금 송출 중인 배치로 돌아왔는데 칸이 그대로면 고치던 것을 놓는다 (소리·맞춤이 다시 바로 나가게)
    if (draft && liveSwitch && l === liveLayout) {
      const same = (a: SwitchSlot, b?: SwitchSlot) => sourceKey(a.source) === sourceKey(b?.source) && a.mute === !!b?.mute && a.volume === (b?.volume ?? 100);
      if (draft.slots.every((x, i) => same(x, content?.slots?.[i]))) setDraft(null);
    }
    if (l !== "one" && src === "screen") setSrc("file");
    const url = new URL(window.location.href);
    if (l === "one") url.searchParams.delete("layout");
    else url.searchParams.set("layout", l);
    if (url.searchParams.get("tab") === "switch") url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  };

  /* ---------- 분할 고치기 ---------- */
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const body = (st: SwitchState, seek?: { i: number; sec: number }) => ({
    layout: st.layout,
    slots: st.slots.map(({ source, mute, volume, fit, loop }, i): SwitchSlotInput => ({
      source,
      mute,
      volume,
      fit,
      loop,
      ...(seek && seek.i === i ? { seek: seek.sec } : {}),
    })),
    sources: st.sources,
  });
  /** 지금 송출에 바로 — 소리 막대는 손을 뗄 때까지 모아서 */
  const pushLive = (next: SwitchState, delay = 0, seek?: { i: number; sec: number }) => {
    setLocal(next);
    clearTimeout(timer.current);
    const my = ++seq.current;
    const ch = channel;
    timer.current = setTimeout(async () => {
      try {
        const res = await switchApi.set(ch, body(next, seek));
        qc.setQueryData(["switch", ch], res);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        // 웹소켓으로 진짜 상태가 오기 전에 깜빡이지 않게 조금 뒤에 놓는다
        setTimeout(() => my === seq.current && setLocal(null), 600);
      }
    }, delay);
  };
  const editSlot = (i: number, patch: Partial<SwitchSlot>, delay = 0) => {
    const next = { ...view, slots: view.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) };
    if (liveSame) pushLive(next, delay);
    else setDraft(next);
  };
  const place = (s: SwitchSource) => {
    const keep = (s.kind === "youtube" || s.kind === "timer") && !view.sources.some((x) => sourceKey(x) === sourceKey(s));
    setDraft({
      ...view,
      layout,
      sources: keep ? [...view.sources, s].slice(-20) : view.sources,
      slots: view.slots.map((x, j) => (j === selected ? { ...x, source: s } : x)),
    });
  };
  const swap = () => setDraft({ ...view, layout, slots: [view.slots[1], view.slots[0], view.slots[2], view.slots[3]] });
  const slotOf = (s: SwitchSource) => (split ? view.slots.findIndex((x, j) => j < count && sourceKey(x.source) === sourceKey(s)) : -1);

  /* ---------- 한 화면 ---------- */
  const allFiles = useMemo(() => [...files.video, ...files.image, ...files.presentation, ...files.audio], [files]);
  const fileById = useCallback((id?: string | null) => (id ? allFiles.find((f) => f.id === id) : undefined), [allFiles]);
  const liveFile = fileById(content?.fileId);
  const pickedFile = fileById(pickFile) ?? liveFile;
  const ytId = parseYouTubeId(ytUrl);
  const pickedShare = pickShare ? shareById.get(pickShare) : undefined;
  const sharePickable = (r?: ShareRequest) => !!r && r.status === "approved" && r.channel === channel;

  const clearDisplay = async () => {
    try {
      const qs = channel > 1 ? `?channel=${channel}` : "";
      await fetch(`${getApiBase()}/display/clear${qs}`, { method: "POST" });
    } catch {
      /* ignore */
    }
  };

  const fileSource = (f: UploadedFile): SwitchSource | null =>
    f.type === "video" || f.type === "image" ? { kind: f.type, url: f.fileUrl, fileId: f.id, name: f.fileName } : null;
  const timerSource = (): SwitchSource => {
    const sec = Math.max(1, tSec);
    return { kind: "timer", durationSec: sec, mode: tMode, label: tLabel.trim(), name: tLabel.trim() || (tMode === "up" ? "카운트업" : `${timerText(sec)} 타이머`) };
  };

  const sendFile = (f: UploadedFile) => showMedia(f, channel).catch(() => toast.error("송출에 실패했어요"));

  const ready = split
    ? view.slots.slice(0, count).some((x) => x.source)
    : src === "file"
      ? !!pickedFile
      : src === "youtube"
        ? !!ytId
        : src === "timer"
          ? tMode === "up" || tSec > 0
          : src === "screen"
            ? !sharingHere
            : sharePickable(pickedShare);

  const send = async () => {
    if (disabled || sending) return;
    setSending(true);
    try {
      if (split) {
        const st = { ...view, layout };
        const res = await switchApi.set(channel, body(st));
        qc.setQueryData(["switch", channel], res);
        setLocal(res);
        setDraft(null);
        setTimeout(() => setLocal(null), 800);
      } else if (src === "file" && pickedFile) {
        await sendFile(pickedFile);
      } else if (src === "youtube" && ytId) {
        await showYouTube(channel, ytId, ytLoop);
      } else if (src === "timer") {
        await showTimer(channel, { label: tLabel.trim() || undefined, durationSec: tSec, mode: tMode });
      } else if (src === "screen") {
        await startShare();
      } else if (src === "ext" && pickedShare) {
        // 외부 화면 하나 = 한 화면 배치 (분할에 넣어 둔 칸은 그대로 남긴다)
        const st = norm({ ...base, layout: "one" });
        st.slots[0] = { ...EMPTY_SLOT, source: shareSource(pickedShare) };
        await switchApi.set(channel, body(st));
      }
    } catch (e) {
      toast.error((e as Error).message || "송출에 실패했어요");
    } finally {
      setSending(false);
    }
  };

  const sendLabel = `${channelName(channel)}에 ${split ? `${LAYOUT_LABEL[layout]} ` : ""}송출`;
  const slot = view.slots[selected];
  const note: ReactNode = split ? (
    <span className="flex min-w-0 items-center gap-2">
      <SlotNo n={selected + 1} />
      <span className="truncate font-pretendard text-[12.5px] text-white/45">{slot.source?.name ?? "비어 있음"}</span>
    </span>
  ) : (
    <span className="truncate font-pretendard text-[12.5px] text-white/45">
      {src === "file"
        ? (pickedFile?.fileName ?? "")
        : src === "youtube"
          ? ytId
            ? `youtu.be/${ytId}`
            : ""
          : src === "timer"
            ? tLabel.trim() || (tMode === "up" ? "카운트업" : `${timerText(tSec)} 카운트다운`)
            : src === "ext"
              ? (pickedShare?.name ?? "")
              : "내 화면"}
    </span>
  );
  const sendBtn = (cls: string) => (
    <NeonButton data-tour="media.send" className={cls} disabled={disabled || !ready || sending || isSending} onClick={send}>
      {sendLabel}
    </NeonButton>
  );

  /* ---------- 가운데: 고른 소스 ---------- */
  const tabCls = (on: boolean) =>
    cn(
      "flex h-10 min-w-0 items-center justify-center gap-[7px] rounded-[11px] border px-[13px] font-mbc text-[13.5px] transition-colors max-md:flex-1 max-md:px-1.5 md:h-9",
      on ? "border-white bg-white text-[#0b0b0d]" : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white",
    );

  const recent = (kind: "youtube" | "timer") => {
    const list = view.sources.filter((s) => s.kind === kind);
    if (!split || list.length === 0) return null;
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {list.map((s) => (
          <SourceCard
            key={sourceKey(s)}
            thumb={<SlotPreview source={s} live={false} />}
            name={s.name}
            on={slotOf(s) === selected}
            slot={slotOf(s)}
            disabled={disabled}
            onClick={() => place(s)}
          />
        ))}
      </div>
    );
  };

  const center = (() => {
    if (src === "ext")
      return (
        <ExternalSharePanel
          channel={channel}
          disabled={disabled}
          slotOf={slotOf}
          isOn={(s) => (split ? slotOf(s) === selected : s.kind === "share" && s.id === pickShare)}
          onPick={(s) => (split ? place(s) : s.kind === "share" && setPickShare(s.id))}
        />
      );
    if (src === "youtube")
      return (
        <div className="flex min-h-0 flex-col gap-3 overflow-auto" data-tour="media.youtube-panel">
          <p className="hidden font-mbc text-[17px] text-white md:block">유튜브</p>
          <input
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            disabled={disabled}
            placeholder="유튜브 링크"
            className="h-11 rounded-xl border border-white/10 bg-[#0c0d0f] px-3.5 font-pretendard text-[16px] text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none md:text-[15px]"
          />
          {ytUrl.trim() && !ytId && <span className="font-pretendard text-[12.5px] text-[#ff8a8a]">유튜브 주소가 아니에요</span>}
          {ytId && (
            <div className="relative aspect-video w-full max-w-[360px] overflow-hidden rounded-lg bg-[#0d0e11]">
              <img src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          )}
          <div className="flex gap-2">
            {split ? (
              <Chip disabled={disabled || !ytId} onClick={() => ytId && place({ kind: "youtube", videoId: ytId, name: `youtu.be/${ytId}` })}>
                {selected + 1}번 칸에 넣기
              </Chip>
            ) : (
              <Chip on={ytLoop} disabled={disabled} onClick={() => setYtLoop(!ytLoop)}>
                반복
              </Chip>
            )}
          </div>
          {recent("youtube")}
        </div>
      );
    if (src === "timer")
      return (
        <div className="flex min-h-0 flex-col gap-3 overflow-auto" data-tour="media.timer-panel">
          <p className="hidden font-mbc text-[17px] text-white md:block">타이머</p>
          <div className="flex gap-2">
            <Chip on={tMode === "down"} disabled={disabled} onClick={() => setTMode("down")}>
              카운트다운
            </Chip>
            <Chip on={tMode === "up"} disabled={disabled} onClick={() => setTMode("up")}>
              카운트업
            </Chip>
          </div>
          <input
            value={tLabel}
            onChange={(e) => setTLabel(e.target.value.slice(0, 40))}
            disabled={disabled}
            placeholder="이름 (예: 시험 끝까지)"
            className="h-11 rounded-xl border border-white/10 bg-[#0c0d0f] px-3.5 font-pretendard text-[16px] text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none md:text-[15px]"
          />
          {tMode === "down" && <DurationWheel value={tSec} onChange={setTSec} maxHours={6} className="self-start" />}
          {split && (
            <div className="flex">
              <Chip disabled={disabled || (tMode === "down" && tSec <= 0)} onClick={() => place(timerSource())}>
                {selected + 1}번 칸에 넣기
              </Chip>
            </div>
          )}
          {recent("timer")}
        </div>
      );
    if (src === "screen")
      return (
        <div className="flex min-h-0 flex-col gap-3">
          <p className="hidden font-mbc text-[17px] text-white md:block">내 화면</p>
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-[#0d0e11] text-white/25">
            {sharingHere ? <LocalStream stream={localStream} /> : <Monitor size={34} />}
          </div>
          {isSharing && (
            <div className="flex items-center gap-3">
              <span className="font-pretendard text-[13px] text-white/50">{channelName(sharingChannel)}에 내 화면을 보내는 중</span>
              <Chip className="ml-auto" onClick={stopShare}>
                공유 끝내기
              </Chip>
            </div>
          )}
        </div>
      );
    const list = files[ftype] ?? [];
    return (
      <>
        <div className="flex gap-1.5" data-tour="media.type-tabs">
          {FILE_TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setFtype(t.key)} aria-pressed={ftype === t.key} className={tabCls(ftype === t.key)}>
              <span className="max-md:hidden">{t.icon}</span>
              {t.label}
              <small className={cn("font-orbitron text-[10.5px] font-semibold", ftype === t.key ? "text-black/45" : "text-white/35")}>{files[t.key].length}</small>
            </button>
          ))}
        </div>
        <div className="mt-3 grid min-h-0 grid-cols-2 content-start gap-2.5 md:flex-1 md:overflow-auto" data-tour="media.file-list">
          {list.map((f) => {
            const s = fileSource(f);
            const at = s ? slotOf(s) : -1;
            return (
              <SourceCard
                key={f.id}
                thumb={<FileThumb file={f} />}
                name={f.fileName}
                sub={[TYPE_LABEL[f.type], fmtSize(f.fileSize)].filter(Boolean).join(" · ")}
                badge={f.type === "video" || f.type === "audio" ? (f.duration ? fmt(f.duration) : undefined) : undefined}
                on={split ? at >= 0 && at === selected : pickedFile?.id === f.id}
                slot={at}
                disabled={disabled || isSending}
                onClick={() => {
                  if (!split) return setPickFile(f.id);
                  if (!s) return toast.error("분할에는 영상·사진만 넣을 수 있어요");
                  place(s);
                }}
                onDoubleClick={split ? undefined : () => sendFile(f)}
              />
            );
          })}
          {list.length === 0 && (
            <p className="col-span-2 py-10 text-center font-pretendard text-[13.5px] text-white/35">{isLoading ? "불러오는 중" : "파일이 없어요"}</p>
          )}
        </div>
      </>
    );
  })();

  /* ---------- 오른쪽: 고른 칸 다루기 ---------- */
  const pb = content?.type === "video" || content?.type === "youtube" ? content.playback : undefined;
  const controls = (() => {
    if (split || (liveSwitch && content?.layout === "one")) {
      // 분할 칸 (한 화면인데 외부 화면 하나를 송출 중이면 그 칸)
      const i = split ? selected : 0;
      const s = view.slots[i];
      const kind = s.source?.kind;
      const live = (split ? liveSame : true) && sourceKey(content?.slots?.[i]?.source) === sourceKey(s.source);
      const file = s.source && (kind === "video" || kind === "image") ? fileById(s.source.fileId) : undefined;
      const edit = (patch: Partial<SwitchSlot>, delay = 0) =>
        split ? editSlot(i, patch, delay) : pushLive({ ...view, layout: "one", slots: view.slots.map((x, j) => (j === 0 ? { ...x, ...patch } : x)) }, delay);
      return (
        <>
          {split && (
            <div className="flex min-w-0 items-center gap-2.5 md:hidden">
              <SlotNo n={i + 1} />
              <span className="truncate font-pretendard text-[14px] font-bold text-white">{s.source?.name ?? "비어 있음"}</span>
            </div>
          )}
          {kind === "video" && live && !!file?.duration && (
            <SlotPlayBar
              startedAt={s.startedAt}
              duration={file.duration}
              loop={s.loop !== false}
              disabled={disabled}
              onSeek={(sec) => pushLive(split ? view : { ...view, layout: "one" }, 0, { i, sec })}
            />
          )}
          {s.source && kind !== "image" && kind !== "timer" && (
            <SoundRow
              n={split ? i + 1 : undefined}
              name={split ? s.source.name : undefined}
              mute={s.mute}
              volume={s.volume}
              disabled={disabled}
              onMute={() => edit({ mute: !s.mute })}
              onVolume={(v) => edit({ volume: v, mute: v > 0 ? false : s.mute }, 250)}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {layout !== "pip" && (kind === "video" || kind === "youtube") && (
              <Chip on={s.loop !== false} disabled={disabled} onClick={() => edit({ loop: s.loop === false })}>
                반복
              </Chip>
            )}
            {(kind === "video" || kind === "image" || kind === "share") && (
              <>
                <Chip on={s.fit !== "cover"} disabled={disabled} onClick={() => edit({ fit: "contain" })}>
                  화면 맞춤
                </Chip>
                <Chip on={s.fit === "cover"} disabled={disabled} onClick={() => edit({ fit: "cover" })}>
                  꽉 채움
                </Chip>
              </>
            )}
            {layout === "pip" && (
              <Chip disabled={disabled} onClick={swap}>
                서로 바꾸기
              </Chip>
            )}
            <OffButton onClick={clearDisplay} disabled={disabled || !content || content.type === "standby"} />
          </div>
        </>
      );
    }
    if (!content || content.type === "standby") return null;
    if (content.type === "video" && pb)
      return (
        <>
          <LivePlayBar
            pb={pb}
            fallbackDuration={content.duration || liveFile?.duration}
            onToggle={() => player.toggle()}
            onSeek={(s) => player.seek(s)}
            disabled={disabled}
          />
          <SoundRow
            mute={pb.muted}
            volume={Math.round((pb.muted ? 0 : pb.volume) * 100)}
            disabled={disabled}
            onMute={() => player.setMuted(!pb.muted)}
            onVolume={(v) => {
              player.setVolume(v / 100);
              if (v > 0 && pb.muted) player.setMuted(false);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Chip on={!!pb.loop} disabled={disabled} onClick={() => player.setLoop(!pb.loop)}>
              반복
            </Chip>
            <Chip on={(pb.fit ?? "contain") === "contain"} disabled={disabled} onClick={() => player.setFit("contain")}>
              화면 맞춤
            </Chip>
            <Chip on={pb.fit === "cover"} disabled={disabled} onClick={() => player.setFit("cover")}>
              꽉 채움
            </Chip>
            <OffButton onClick={clearDisplay} disabled={disabled} />
          </div>
        </>
      );
    if (content.type === "youtube" && pb)
      return (
        <>
          <LivePlayBar pb={pb} onToggle={() => player.toggle()} disabled={disabled} />
          <SoundRow
            mute={pb.muted}
            volume={Math.round((pb.muted ? 0 : pb.volume) * 100)}
            disabled={disabled}
            onMute={() => player.setMuted(!pb.muted)}
            onVolume={(v) => {
              player.setVolume(v / 100);
              if (v > 0 && pb.muted) player.setMuted(false);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Chip on={!!pb.loop} disabled={disabled} onClick={() => player.setLoop(!pb.loop)}>
              반복
            </Chip>
            <OffButton onClick={clearDisplay} disabled={disabled} />
          </div>
        </>
      );
    if (content.type === "presentation" && content.urls?.length)
      return (
        <>
          <PresentationNav
            total={content.urls.length}
            current={typeof content.slideIndex === "number" ? content.slideIndex : 0}
            onGo={(i) => player.setSlide(i)}
            disabled={disabled}
          />
          <div className="flex">
            <OffButton onClick={clearDisplay} disabled={disabled} />
          </div>
        </>
      );
    if (content.type === "image")
      return (
        <>
          <ImageOverlayEditor key={`${channel}:${content.url}`} overlay={content.overlay} onChange={player.setOverlay} disabled={disabled} />
          <div className="flex">
            <OffButton onClick={clearDisplay} disabled={disabled} />
          </div>
        </>
      );
    return (
      <div className="flex items-center gap-3">
        <span className="truncate font-pretendard text-[13.5px] text-white/50">
          {content.type === "audio"
            ? (liveFile?.fileName ?? "음원")
            : content.type === "switch"
              ? LAYOUT_LABEL[content.layout ?? "four"]
              : (TYPE_LABEL[content.type] ?? content.type)}
        </span>
        <OffButton onClick={clearDisplay} disabled={disabled} />
      </div>
    );
  })();

  const warn = health && !health.matrix.connected;

  return (
    <div className="flex w-full flex-col gap-4 pb-24 md:h-[calc(100dvh-80px)] md:min-h-[640px] md:px-[20px] md:pb-0">
      <header className="flex flex-wrap items-center gap-3 md:gap-5">{lead}</header>
      <div className="flex min-h-0 flex-col gap-3 md:grid md:flex-1 md:grid-cols-[170px_minmax(0,1fr)_minmax(0,1fr)] md:gap-4">
        {/* 소스 줄 — PC 왼쪽 세로, 폰은 송출 화면 아래 가로 */}
        <div className="order-3 flex gap-1.5 md:order-none md:flex-col" data-tour="media.sources">
          {SOURCES.map((s, i) => {
            const off = s.key === "screen" && split;
            const on = src === s.key;
            return (
              <div key={s.key} className="contents">
                <button
                  type="button"
                  data-tour={s.tour}
                  disabled={off}
                  aria-pressed={on}
                  onClick={() => setSrc(s.key)}
                  className={cn(
                    "relative flex h-10 min-w-0 flex-1 items-center justify-center gap-2.5 whitespace-nowrap rounded-[11px] border px-1.5 font-mbc text-[13.5px] transition-colors disabled:opacity-35",
                    "md:h-14 md:flex-none md:justify-start md:rounded-[13px] md:px-3 md:text-[14px]",
                    on
                      ? "border-white bg-white text-[#0b0b0d] md:border-white/75 md:bg-white/[0.08] md:text-white"
                      : "border-white/[0.08] text-white/65 hover:text-white max-md:border-white/10 max-md:bg-white/[0.03]",
                  )}
                >
                  <span className="max-md:hidden">{s.icon}</span>
                  {s.label}
                  {s.key === "ext" && extWaiting > 0 && (
                    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF3B3B] px-[5px] font-orbitron text-[10.5px] font-bold text-white max-md:absolute max-md:-right-1 max-md:-top-1.5 md:ml-auto">
                      {extWaiting}
                    </span>
                  )}
                </button>
                {i === 0 && <div className="mx-1 my-1.5 hidden h-px bg-white/[0.08] md:block" />}
              </div>
            );
          })}
        </div>

        {/* 가운데 — 고른 소스 + 아래 송출 버튼 */}
        <div className={cn("order-4 flex min-h-0 min-w-0 flex-col md:order-none md:overflow-hidden md:px-4 md:py-3.5", PANEL_MD)} data-tour="media.select">
          {center}
          <div className="mt-auto hidden items-center gap-3 pt-3 md:flex">
            {note}
            <span className="ml-auto" />
            {sendBtn("shrink-0")}
          </div>
        </div>

        {/* 오른쪽 — 송출 화면 */}
        <div className={cn("contents md:flex md:min-h-0 md:min-w-0 md:flex-col md:gap-3 md:overflow-auto md:px-4 md:py-3.5", PANEL_MD)}>
          {(warn || disabled) && (
            <div className="order-1 flex items-center gap-3 md:order-none">
              <span className="hidden font-mbc text-[17px] text-white md:inline">송출 화면</span>
              <span className="ml-auto flex items-center gap-3">
                {disabled && <span className="font-pretendard text-[12.5px] text-white/45">보기 전용</span>}
                {warn && (
                  <span className="inline-flex items-center gap-[7px] font-pretendard text-[12.5px] text-[#ff8a8a]" title={`스피커 매트릭스(${health.matrix.host})`}>
                    <i className="h-[7px] w-[7px] rounded-full bg-[#FF3B3B] shadow-[0_0_7px_#FF3B3B]" />
                    스피커 연결 안 됨
                  </span>
                )}
              </span>
            </div>
          )}
          {!(warn || disabled) && <span className="hidden font-mbc text-[17px] text-white md:block">송출 화면</span>}
          <div className="order-1 md:order-none">
            <ChannelChips channel={channel} health={health} onPick={setChannel} />
          </div>
          <div className="order-1 md:order-none">
            <LiveChatSwitch channel={channel} disabled={disabled} />
          </div>
          <div className="order-1 md:order-none">
            <LayoutSelect value={layout} onChange={setLayout} disabled={disabled} />
          </div>
          <div className="relative order-1 aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-black md:order-none" data-tour="media.preview">
            {split ? (
              <Program layout={layout} slots={view.slots} byId={shareById} selected={selected} onPick={setSel} />
            ) : sharingHere ? (
              <LocalStream stream={localStream} />
            ) : (
              <DisplayMirror channel={channel} badge={false} />
            )}
          </div>
          <div className="order-1 flex flex-col gap-3 md:order-none" data-tour="media.controls">
            {controls}
          </div>
          <div className="order-2 my-1 h-px bg-white/[0.08] md:hidden" />
          <OtherChannels channel={channel} health={health} files={allFiles} onPick={setChannel} />
        </div>
      </div>

      {/* 폰 — 송출 버튼은 아래에 붙여 둔다 */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 flex bg-gradient-to-b from-transparent via-[rgba(8,8,10,0.92)] via-35% to-[rgba(8,8,10,0.92)] px-4 pb-3 pt-6 md:hidden">
        {sendBtn("h-12 w-full")}
      </div>
    </div>
  );
}

/** 송출 화면 — 배치대로 칸을 그리고, 누르면 그 칸을 고른다 (고른 칸 = 흰 테두리) */
function Program({
  layout,
  slots,
  byId,
  selected,
  onPick,
}: {
  layout: SwitchLayout;
  slots: SwitchSlot[];
  byId: Map<string, ShareRequest>;
  selected: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="absolute inset-0 bg-black">
      <SwitchGrid
        layout={layout}
        cell={(i, cls, style) => {
          const s = slots[i];
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(i)}
              aria-pressed={selected === i}
              aria-label={`${i + 1}번 칸`}
              className={cn("overflow-hidden bg-[#0b0b0d] text-left", cls)}
              style={style}
            >
              <SlotPreview
                source={s.source}
                startedAt={s.startedAt}
                fit={s.fit}
                loop={s.loop !== false}
                share={s.source?.kind === "share" ? byId.get(s.source.id) : undefined}
              />
              {!s.source && <span className="absolute inset-0 flex items-center justify-center font-pretendard text-[12.5px] text-white/30">비어 있음</span>}
              <span className="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-12px)] items-center gap-[5px] overflow-hidden whitespace-nowrap rounded-[5px] bg-black/72 px-1.5 py-0.5 font-pretendard text-[11px] font-semibold text-white">
                <b className="font-orbitron text-[10px] text-white/60">{i + 1}</b>
                {s.source && <em className="truncate not-italic">{s.source.name}</em>}
                {s.source && s.mute && <VolumeX size={11} className="shrink-0 text-white/70" />}
              </span>
              {selected === i && <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_2.5px_#fff]" />}
            </button>
          );
        }}
      />
    </div>
  );
}
