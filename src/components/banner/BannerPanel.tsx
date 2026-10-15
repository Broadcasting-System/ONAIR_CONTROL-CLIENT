"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Pencil, Power, RotateCcw, Save, Send } from "lucide-react";
import Portal from "@/components/common/Portal";
import { toast } from "@/components/common/Toast";
import { TimeConfirm, ghostBtn, redBtn } from "@/components/time/TimeToolbar";
import { cn } from "@/lib/utils";
import { useFiles } from "@/hooks/useFiles";
import {
  type BannerScene,
  type DefaultBannerPayload,
  type GifPayload,
  type ImagePayload,
  type SavedBanner,
  type ScoreboardPayload,
  type TimerPayload,
  clearBanner,
  createSavedBanner,
  deleteSavedBanner,
  fetchBannerState,
  fetchBannerStatus,
  fetchSavedBanners,
  getDisplayPreviewUrl,
  updateBanner,
  updateSavedBanner,
} from "@/lib/bannerApi";
import { BannerDraftRender, LedStrip } from "./BannerRender";
import { BannerTimerEditor, DefaultBannerEditor, GifEditor, ImageEditor, ScoreboardEditor, inputCls, type ScoreOp } from "./BannerEditors";
import SavedBannerList, { EDIT_SCENES, OnAirTag, SCENE_META, sceneLabel, type EditScene } from "./SavedBannerList";

// ---------------------------------------------------------------- 초안 모양

const DEFAULT_BANNER: DefaultBannerPayload = { mainText: "", subText1: "", subText2: "" };
const DEFAULT_SCOREBOARD: ScoreboardPayload = {
  title: "",
  subtitle: "",
  titleSize: 160,
  subtitleSize: 76,
  showSet: true,
  targetScore: 25,
  scoreAnim: "slamshine",
  victory: null,
  courtChange: null,
  teamA: { name: "", score: 0, set: 0 },
  teamB: { name: "", score: 0, set: 0 },
};
const DEFAULT_IMAGE: ImagePayload = { url: "", fit: "cover" };
const DEFAULT_GIF: GifPayload = { url: "" };
const DEFAULT_TIMER: TimerPayload = { durationSec: 300, label: "", mode: "down" };

type Payloads = {
  default: DefaultBannerPayload;
  scoreboard: ScoreboardPayload;
  image: ImagePayload;
  gif: GifPayload;
  timer: TimerPayload;
};

type Draft = { savedId: string | null; name: string; scene: EditScene; p: Payloads };
type Live = { scene: BannerScene; payload: Record<string, unknown>; savedId: string | null; since: number | null };

const OFF: Live = { scene: "blank", payload: {}, savedId: null, since: null };

const isEdit = (s: BannerScene): s is EditScene => s !== "blank" && s in SCENE_META;

/** 옛·일부 데이터가 와도 빈 칸을 기본값으로 채운다 (비교할 때도 같은 모양으로) */
function normalize<S extends EditScene>(scene: S, raw: Record<string, unknown> | undefined): Payloads[S] {
  const p = (raw ?? {}) as Record<string, unknown>;
  switch (scene) {
    case "default":
      return { ...DEFAULT_BANNER, ...p } as Payloads[S];
    case "scoreboard": {
      const sp = p as Partial<ScoreboardPayload>;
      return {
        ...DEFAULT_SCOREBOARD,
        ...sp,
        teamA: { name: "", score: 0, set: 0, ...(sp.teamA ?? {}) },
        teamB: { name: "", score: 0, set: 0, ...(sp.teamB ?? {}) },
      } as Payloads[S];
    }
    case "image":
      return { ...DEFAULT_IMAGE, ...p } as Payloads[S];
    case "gif":
      return { ...DEFAULT_GIF, ...p } as Payloads[S];
    default:
      return { ...DEFAULT_TIMER, ...p } as Payloads[S];
  }
}

/** 키 순서와 상관없이 같은 내용이면 같은 글자 */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}
const contentKey = (scene: BannerScene, payload: Record<string, unknown>) =>
  isEdit(scene) ? stable({ scene, payload: normalize(scene, payload) }) : "";

const freshPayloads = (): Payloads => ({
  default: { ...DEFAULT_BANNER },
  scoreboard: { ...DEFAULT_SCOREBOARD, teamA: { ...DEFAULT_SCOREBOARD.teamA }, teamB: { ...DEFAULT_SCOREBOARD.teamB } },
  image: { ...DEFAULT_IMAGE },
  gif: { ...DEFAULT_GIF },
  timer: { ...DEFAULT_TIMER },
});

function draftFrom(scene: BannerScene, payload: Record<string, unknown>, savedId: string | null, name: string, base?: Draft): Draft {
  const p = base ? { ...base.p } : freshPayloads();
  if (!isEdit(scene)) return { savedId, name, scene: base?.scene ?? "default", p };
  return { savedId, name, scene, p: { ...p, [scene]: normalize(scene, payload) } };
}

const asRecord = (v: unknown) => v as Record<string, unknown>;
const draftPayload = (d: Draft) => asRecord(d.p[d.scene]);
const draftKey = (d: Draft) => `${contentKey(d.scene, draftPayload(d))}|${d.name.trim()}`;
const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? null) === (b ?? null);

const hhmm = (ms: number | null) => {
  if (!ms) return "";
  const d = new Date(ms < 1e12 ? ms * 1000 : ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** 띄울 수 있는 초안인지 (사진이 없거나 시간이 0이면 막는다) */
function canSend(d: Draft): boolean {
  if (d.scene === "image") return !!d.p.image.url;
  if (d.scene === "gif") return !!d.p.gif.url;
  if (d.scene === "timer") return (d.p.timer.mode ?? "down") === "up" || (d.p.timer.durationSec ?? 0) > 0;
  return true;
}

// ---------------------------------------------------------------- 이름 묻기

function NameDialog({
  open,
  title,
  initial,
  confirmText,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: string;
  confirmText: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);
  if (!open) return null;
  const submit = async () => {
    const name = value.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await onSubmit(name);
      onClose();
    } catch {
      /* 알림은 부른 쪽에서 */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Portal>
      <div className="fixed inset-0 z-[950] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal>
        <div className="absolute inset-0" onClick={onClose} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="relative w-full max-w-[400px] rounded-[20px] border border-white/10 bg-[#141416] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
        >
          <h2 className="font-mbc text-[19px] text-white">{title}</h2>
          <input
            autoFocus
            value={value}
            maxLength={40}
            onChange={(e) => setValue(e.target.value)}
            placeholder="현수막 이름"
            aria-label="현수막 이름"
            className={cn(inputCls, "mt-3.5 h-11 md:h-11")}
          />
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={onClose} className={cn(ghostBtn, "h-11 flex-1 md:h-11")}>
              취소
            </button>
            <button type="submit" disabled={busy || !value.trim()} className="h-11 flex-1 rounded-[11px] bg-white font-mbc text-[14px] text-[#0b0b0d] disabled:opacity-40">
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  );
}

// ---------------------------------------------------------------- 화면

/** 현수막 (송출 › 현수막 탭). lead = 페이지 제목·탭. 편집은 초안이고 띄우기를 눌러야 나간다. */
export default function BannerPanel({ lead }: { lead: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(() => ({ savedId: null, name: "", scene: "default", p: freshPayloads() }));
  const [baseKey, setBaseKey] = useState("");
  const [live, setLiveState] = useState<Live>(OFF);
  const liveRef = useRef<Live>(OFF);
  const setLive = (l: Live) => {
    liveRef.current = l;
    setLiveState(l);
  };
  const [saved, setSaved] = useState<SavedBanner[] | null>(null);
  const [displays, setDisplays] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  // 내가 보낸 직후의 폴링 응답은 옛 상태일 수 있어 무시한다
  const localAt = useRef(0);

  // 이름 묻기·확인 창
  const [naming, setNaming] = useState<{ mode: "save" } | { mode: "rename"; item: SavedBanner } | null>(null);
  const [deleting, setDeleting] = useState<SavedBanner | null>(null);
  const [leaving, setLeaving] = useState<(() => void) | null>(null);

  const { files, fetchFiles } = useFiles();
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // window.location 기반이라 서버 렌더와 달라질 수 있어 마운트 후에만
  useEffect(() => {
    setPreviewUrl(getDisplayPreviewUrl());
  }, []);

  const toLive = (s: Awaited<ReturnType<typeof fetchBannerState>>): Live =>
    s
      ? {
          scene: s.scene,
          payload: s.payload ?? {},
          savedId: s.savedId !== undefined && s.savedId !== null ? String(s.savedId) : null,
          since: s.since ?? s.serverTimestamp ?? null,
        }
      : OFF;

  // ---- 처음: 지금 현수막을 초안으로 불러온다 ----
  useEffect(() => {
    let alive = true;
    Promise.all([fetchBannerState(), fetchSavedBanners()]).then(([s, list]) => {
      if (!alive) return;
      const l = toLive(s);
      setLive(l);
      setSaved(list);
      const name = (l.savedId && list?.find((x) => x.id === l.savedId)?.name) || "";
      const d = l.scene !== "blank" ? draftFrom(l.scene, l.payload, l.savedId, name) : draftFrom("default", {}, null, "");
      setDraft(d);
      setBaseKey(draftKey(d));
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // ---- 연결 상태·지금 현수막 따라가기 (다른 기기에서 바꿔도 보이게) ----
  useEffect(() => {
    let alive = true;
    let n = 0;
    const tick = async () => {
      const startedAt = Date.now();
      const [st, s] = await Promise.all([fetchBannerStatus(), fetchBannerState()]);
      if (!alive) return;
      setDisplays(st ? st.displays : null);
      if (s && startedAt > localAt.current + 300) setLive(toLive(s));
      if (++n % 6 === 0) {
        const list = await fetchSavedBanners();
        if (alive && list) setSaved(list);
      }
    };
    const id = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // ---- 계산 ----
  const dPayload = draftPayload(draft);
  const dContent = contentKey(draft.scene, dPayload);
  const liveContent = contentKey(live.scene, live.payload);
  const isOn = live.scene !== "blank";
  // 꺼져 있을 때는 비교할 게 없으니 표시하지 않는다
  const unsent = loaded && isOn && dContent !== liveContent;
  const savedItem = draft.savedId ? (saved?.find((x) => x.id === draft.savedId) ?? null) : null;
  const unsaved = !savedItem || draftKey(draft) !== `${contentKey(savedItem.scene, savedItem.payload)}|${savedItem.name.trim()}`;
  // 버리면 사라지는 편집 (불러온 뒤 고쳤고, 지금 떠 있는 것과도 다름)
  const dirty = loaded && draftKey(draft) !== baseKey && dContent !== liveContent;
  const scoreLive = live.scene === "scoreboard" && draft.scene === "scoreboard" && same(live.savedId, draft.savedId);
  const liveName = (live.savedId && saved?.find((x) => x.id === live.savedId)?.name) || sceneLabel(live.scene);

  // ---- 보내기 ----
  const send = async (scene: BannerScene, payload: Record<string, unknown>, savedId: string | null, keepSince = false) => {
    const prev = liveRef.current;
    localAt.current = Date.now();
    setLive({ scene, payload, savedId, since: keepSince ? prev.since : Date.now() });
    try {
      await updateBanner(scene, payload, savedId);
      localAt.current = Date.now();
    } catch (e) {
      console.error("현수막 송출 실패", e);
      toast.error("현수막에 띄우지 못했어요");
      setLive(prev);
    }
  };

  const onSend = () => {
    if (!canSend(draft)) return;
    void send(draft.scene, dPayload, draft.savedId);
  };

  const onClear = async () => {
    const prev = liveRef.current;
    localAt.current = Date.now();
    setLive(OFF);
    try {
      await clearBanner();
      localAt.current = Date.now();
    } catch (e) {
      console.error("현수막 끄기 실패", e);
      toast.error("현수막을 끄지 못했어요");
      setLive(prev);
    }
  };

  const onScore = (op: ScoreOp) => {
    setDraft((d) => ({ ...d, p: { ...d.p, scoreboard: op(d.p.scoreboard) } }));
    if (!scoreLive) return;
    const l = liveRef.current;
    const next = op(normalize("scoreboard", l.payload));
    void send("scoreboard", asRecord(next), l.savedId, true);
  };

  const load = (d: Draft) => {
    setDraft(d);
    setBaseKey(draftKey(d));
  };
  const guard = (fn: () => void) => (dirty ? setLeaving(() => fn) : fn());

  const onRevert = () => {
    if (!isOn) return;
    const name = (live.savedId && saved?.find((x) => x.id === live.savedId)?.name) || (same(live.savedId, draft.savedId) ? draft.name : "");
    load(draftFrom(live.scene, live.payload, live.savedId, name, draft));
  };

  // ---- 저장한 현수막 ----
  // 서버도 고친 순서로 돌려주니 맨 위로
  const upsert = (item: SavedBanner) => setSaved((list) => [item, ...(list ?? []).filter((x) => x.id !== item.id)]);

  const onSave = async () => {
    if (!savedItem) return setNaming({ mode: "save" });
    try {
      const item = await updateSavedBanner(savedItem.id, { name: draft.name.trim() || savedItem.name, scene: draft.scene, payload: dPayload });
      upsert(item);
      const d = { ...draft, name: item.name };
      load(d);
      toast.info("저장했어요");
    } catch (e) {
      console.error(e);
      toast.error("저장하지 못했어요");
    }
  };

  const saveNew = async (name: string) => {
    try {
      const item = await createSavedBanner({ name, scene: draft.scene, payload: dPayload });
      upsert(item);
      load({ ...draft, savedId: item.id, name: item.name });
      toast.info("저장했어요");
    } catch (e) {
      toast.error("저장하지 못했어요");
      throw e;
    }
  };

  const rename = async (item: SavedBanner, name: string) => {
    try {
      const next = await updateSavedBanner(item.id, { name });
      upsert(next);
      if (draft.savedId === item.id) {
        const d = { ...draft, name: next.name };
        setDraft(d);
        if (!dirty) setBaseKey(draftKey(d));
      }
    } catch (e) {
      toast.error("이름을 바꾸지 못했어요");
      throw e;
    }
  };

  const duplicate = async (item: SavedBanner) => {
    try {
      const copy = await createSavedBanner({ name: `${(item.name || "현수막").slice(0, 37)} 사본`, scene: item.scene, payload: item.payload });
      upsert(copy);
    } catch (e) {
      console.error(e);
      toast.error("복제하지 못했어요");
    }
  };

  const remove = async (item: SavedBanner) => {
    try {
      await deleteSavedBanner(item.id);
      setSaved((list) => (list ?? []).filter((x) => x.id !== item.id));
      if (draft.savedId === item.id) setDraft((d) => ({ ...d, savedId: null }));
    } catch (e) {
      console.error(e);
      toast.error("지우지 못했어요");
    }
  };

  const pick = (item: SavedBanner) => {
    if (item.id === draft.savedId && !unsaved) return;
    guard(() => load(draftFrom(item.scene, item.payload, item.id, item.name, draft)));
  };
  const onNew = () => guard(() => load({ savedId: null, name: "", scene: draft.scene, p: freshPayloads() }));

  const setP =
    <S extends EditScene>(scene: S) =>
    (v: Payloads[S]) =>
      setDraft((d) => ({ ...d, p: { ...d.p, [scene]: v } }));

  const images = useMemo(() => files.image ?? [], [files.image]);
  const hasSaved = saved !== null;

  // ---- 아래 막대 ----
  const bar = (compact: boolean) => (
    <>
      {hasSaved && (
        <button type="button" data-tour="banner.save" disabled={!loaded || !unsaved} onClick={() => void onSave()} className={cn(ghostBtn, compact && "px-3")}>
          <Save size={15} />
          저장
        </button>
      )}
      {unsent && (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-pretendard text-[12px] font-semibold text-[#ff8080] before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#FF3B3B]">
          아직 안 띄움
        </span>
      )}
      <span className="ml-auto" />
      {unsent && isOn && (
        <button type="button" onClick={onRevert} aria-label="지금 것으로 되돌리기" title="지금 것으로 되돌리기" className={cn(ghostBtn, compact && "w-11 px-0")}>
          <RotateCcw size={15} />
          {!compact && "지금 것으로 되돌리기"}
        </button>
      )}
      <button type="button" data-tour="banner.send" disabled={!loaded || !canSend(draft)} onClick={onSend} className={cn(redBtn, compact && "px-3.5")}>
        <Send size={15} />
        {compact ? "띄우기" : "현수막에 띄우기"}
      </button>
    </>
  );

  return (
    <div className="flex w-full flex-col max-md:pb-[68px] lg:h-[calc(100dvh-80px)] lg:min-h-[640px]">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {lead}
        <span data-tour="banner.live" className="ml-auto flex items-center gap-2 font-pretendard text-[13px] font-medium text-white/70">
          <i className={cn("h-2 w-2 rounded-full", displays ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "bg-white/25")} />
          {displays ? "강당 현수막 연결됨" : "현수막 화면 연결 안 됨"}
        </span>
      </header>

      <div
        className={cn(
          "mt-4 grid min-h-0 flex-1 gap-4 [grid-template-areas:'live'_'saved'_'edit'] md:mt-5",
          hasSaved
            ? "lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:[grid-template-areas:'saved_live'_'saved_edit'] xl:grid-cols-[300px_minmax(0,1fr)]"
            : "lg:grid-rows-[auto_minmax(0,1fr)] lg:[grid-template-areas:'live'_'edit']",
        )}
      >
        {/* 지금 현수막 */}
        <section className="min-w-0 [grid-area:live]">
          <div className="flex min-h-10 items-center gap-2.5 md:gap-3">
            {isOn ? (
              <OnAirTag />
            ) : (
              <span className="shrink-0 rounded-md border border-white/15 px-2 py-[3px] font-orbitron text-[10.5px] font-bold tracking-[0.14em] text-white/40">OFF</span>
            )}
            <span className="shrink-0 font-mbc text-[16px] text-white">지금 현수막</span>
            <span className="min-w-0 truncate font-pretendard text-[12.5px] font-medium text-white/40">
              {isOn ? [liveName, live.since ? `${hhmm(live.since)}부터` : ""].filter(Boolean).join(" · ") : "꺼짐"}
            </span>
            <button
              type="button"
              data-tour="banner.off"
              disabled={!isOn}
              onClick={() => void onClear()}
              className="ml-auto flex h-10 shrink-0 items-center gap-[7px] rounded-[11px] border border-[#FF3B3B]/45 px-3.5 font-mbc text-[13.5px] text-[#ff8a8a] transition-colors hover:bg-[#FF3B3B]/10 disabled:border-white/10 disabled:text-white/30 disabled:hover:bg-transparent md:h-9"
            >
              <Power size={14} />
              <span className="max-sm:hidden">현수막 </span>끄기
            </button>
          </div>
          <div
            data-tour="banner.preview"
            className={cn(
              "mt-2.5 rounded-[18px] border bg-[#050506] p-1.5 md:p-2",
              isOn ? "border-[#FF3B3B]/35 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_0_40px_-14px_rgba(255,59,59,0.5)]" : "border-white/10",
            )}
          >
            <LedStrip>
              {previewUrl && (
                <iframe
                  src={previewUrl}
                  title="지금 현수막"
                  tabIndex={-1}
                  className={cn("pointer-events-none absolute inset-0 h-full w-full border-0", !isOn && "invisible")}
                />
              )}
              {!isOn && <span className="absolute inset-0 flex items-center justify-center font-mbc text-[13px] text-white/35 md:text-[15px]">현수막 꺼짐</span>}
            </LedStrip>
          </div>
        </section>

        {/* 저장한 현수막 */}
        {hasSaved && (
          <SavedBannerList
            className="min-w-0 [grid-area:saved]"
            items={saved}
            selectedId={draft.savedId}
            liveId={isOn ? live.savedId : null}
            onPick={pick}
            onNew={onNew}
            onRename={(item) => setNaming({ mode: "rename", item })}
            onDuplicate={(item) => void duplicate(item)}
            onDelete={setDeleting}
          />
        )}

        {/* 편집 */}
        <section className="flex min-h-0 min-w-0 flex-col rounded-[20px] border border-white/[0.08] bg-[rgba(14,14,17,0.74)] p-3.5 backdrop-blur-md [grid-area:edit] md:px-5 md:py-[18px]">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2.5">
            {hasSaved ? (
              <label className="flex min-w-0 max-w-full items-center gap-2 max-lg:w-full">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="새 현수막"
                  aria-label="현수막 이름"
                  maxLength={40}
                  className="min-w-[5ch] max-w-full truncate bg-transparent font-mbc text-[18px] text-white outline-none placeholder:text-white/35 max-lg:flex-1"
                  style={{ fieldSizing: "content" } as CSSProperties}
                />
                <Pencil size={14} className="shrink-0 cursor-text text-white/40" aria-hidden />
              </label>
            ) : (
              <span className="font-mbc text-[18px] text-white">{SCENE_META[draft.scene].label}</span>
            )}
            <div
              data-tour="banner.scenes"
              role="tablist"
              aria-label="종류"
              className="no-scrollbar -mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 max-lg:w-[calc(100%+28px)] md:-mx-5 md:px-5 lg:mx-0 lg:ml-auto lg:px-0"
            >
              {EDIT_SCENES.map((k) => {
                const { Icon, label } = SCENE_META[k];
                const on = draft.scene === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    data-tour={`banner.scene-${k}`}
                    onClick={() => setDraft((d) => ({ ...d, scene: k }))}
                    className={cn(
                      "flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3 font-mbc text-[13px] transition-colors md:h-[34px]",
                      on ? "border-white bg-white text-[#0b0b0d]" : "border-white/10 text-white/55 hover:text-white",
                    )}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[14px] border border-dashed border-white/[0.22] p-1.5">
            <LedStrip className="rounded-md">
              <BannerDraftRender scene={draft.scene} payload={dPayload} />
            </LedStrip>
          </div>

          <div data-tour="banner.editor" className="mt-3.5 min-h-0 flex-1 lg:-mr-2 lg:overflow-y-auto lg:pr-2">
            {draft.scene === "default" && <DefaultBannerEditor value={draft.p.default} onChange={setP("default")} />}
            {draft.scene === "scoreboard" && <ScoreboardEditor value={draft.p.scoreboard} onChange={setP("scoreboard")} onScore={onScore} />}
            {draft.scene === "image" && <ImageEditor value={draft.p.image} onChange={setP("image")} images={images} />}
            {draft.scene === "gif" && <GifEditor value={draft.p.gif} onChange={setP("gif")} gifs={images} />}
            {draft.scene === "timer" && <BannerTimerEditor value={draft.p.timer} onChange={setP("timer")} />}
          </div>

          <div className="mt-3 hidden items-center gap-2.5 border-t border-white/[0.06] pt-3.5 md:flex">{bar(false)}</div>
        </section>
      </div>

      {/* 폰: 띄우기 막대는 하단 탭 위에 붙는다 */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 border-t border-white/[0.08] bg-[rgba(12,12,14,0.9)] px-4 py-2.5 backdrop-blur-xl md:hidden">
        {bar(true)}
      </div>

      <NameDialog
        open={naming !== null}
        title={naming?.mode === "rename" ? "이름 바꾸기" : "현수막 저장"}
        initial={naming?.mode === "rename" ? naming.item.name : draft.name.trim()}
        confirmText={naming?.mode === "rename" ? "바꾸기" : "저장"}
        onClose={() => setNaming(null)}
        onSubmit={(name) => (naming?.mode === "rename" ? rename(naming.item, name) : saveNew(name))}
      />
      <TimeConfirm
        open={deleting !== null}
        title="현수막 지우기"
        message={`${deleting?.name || "이름 없음"}\n되돌릴 수 없어요`}
        confirmText="지우기"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && void remove(deleting)}
      />
      <TimeConfirm
        open={leaving !== null}
        title="고친 내용을 버릴까요?"
        message="저장하지 않은 편집이 사라져요."
        confirmText="버리기"
        danger
        onClose={() => setLeaving(null)}
        onConfirm={() => leaving?.()}
      />
    </div>
  );
}
