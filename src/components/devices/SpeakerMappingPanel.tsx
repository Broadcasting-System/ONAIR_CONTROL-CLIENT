"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover as P } from "radix-ui";
import { ChevronDown, History, MoreHorizontal, RadioTower, Settings2 } from "lucide-react";
import LearnWizard from "@/components/devices/LearnWizard";
import MappingBellNote from "@/components/devices/MappingBellNote";
import NeonButton from "@/components/common/NeonButton";
import Select from "@/components/common/Select";
import { toast } from "@/components/common/Toast";
import { TimeConfirm, ghostBtn } from "@/components/time/TimeToolbar";
import { StatusDot, adminField, adminPanel, chipCls } from "@/components/devices/adminUi";
import { CATEGORY_ORDER, DEAD_SPEAKERS, SPEAKER_CATEGORY } from "@/constants/speakerMap";
import { SPEAKER_MATRIX_KEY } from "@/hooks/useSpeakerMatrix";
import { SPEAKER_COVERAGE } from "@/lib/speakerCoverage";
import { speakerApi, type SpeakerMatrix } from "@/lib/speakerApi";
import { cn } from "@/lib/utils";
import { useSpeakerStore } from "@/stores/speakerStore";

/* 관리 › 스피커 매핑 (시안 스피커매핑)
   매트릭스 칸(행·열)마다 시험음을 울려 보고, 어디서 들리는지 듣고 이름을 붙인다.
   위: 매트릭스 연결 줄(연결 설정 펼침·새 장비 배우기·백업에서 되돌리기)
   가운데: 찾기 판(지금 울리는 칸 원 · 어디서 들려요? · 아직 안 붙인 곳) / 아래: 칸 표, 바뀐 칸·되돌리기·저장·찾기 끝내기 */

const CAL_KEY = ["speakerCalibration"] as const;
const CONN_KEY = ["speakerConnection"] as const;
const BACKUP_KEY = ["speakerMatrixBackups"] as const;

type Coord = [number, number];
const key = ([r, c]: Coord) => `${r}-${c}`;
const same = (a: Coord | null, b: Coord | null) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

function copyCells(m: SpeakerMatrix): string[][] {
  return m.cells.map((row) => [...row]);
}

/** 학교 지도에 이어진 스피커 이름 (분류 순서) — "아직 안 붙인 곳" 후보. 실제 스피커가 없는 이름은 뺀다 */
const PLACE_NAMES: string[] = (() => {
  const names = new Set<string>([...Object.keys(SPEAKER_CATEGORY), ...Object.keys(SPEAKER_COVERAGE)]);
  DEAD_SPEAKERS.forEach((n) => names.delete(n));
  const rank = (n: string) => {
    const i = CATEGORY_ORDER.indexOf(SPEAKER_CATEGORY[n] ?? "기타");
    return i < 0 ? CATEGORY_ORDER.length : i;
  };
  const base = [...names];
  return [...base].sort((a, b) => rank(a) - rank(b) || base.indexOf(a) - base.indexOf(b));
})();

/** 칩에 올렸을 때 보일 지도 방 이름 */
function roomsOf(name: string): string | undefined {
  const cells = SPEAKER_COVERAGE[name]?.cells;
  if (!cells?.length) return undefined;
  return [...new Set(cells)].join(" · ");
}

export default function SpeakerMappingPanel() {
  const qc = useQueryClient();
  const matrixQuery = useQuery({ queryKey: SPEAKER_MATRIX_KEY, queryFn: speakerApi.matrix });
  const calQuery = useQuery({ queryKey: CAL_KEY, queryFn: speakerApi.calibration, refetchInterval: 3000 });
  const matrix = matrixQuery.data;
  const cal = calQuery.data;

  const [draft, setDraft] = useState<string[][] | null>(null);
  const [selected, setSelected] = useState<Coord>([1, 1]);
  const [busy, setBusy] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const answerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (matrix && draft === null) setDraft(copyCells(matrix));
  }, [matrix, draft]);

  // 찾는 중에는 고른 칸이 울리는 칸을 따라간다 (연속 채우기 시작점)
  const curKey = cal?.active && cal.current ? key(cal.current) : "";
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!cal?.active || !cal.current) return;
    setSelected(cal.current);
    // 폰에서 칸 표가 옆으로 넘치면 울리는 칸이 보이게 민다
    const box = gridRef.current;
    const cell = inputs.current.get(curKey)?.parentElement;
    if (box && cell && box.scrollWidth > box.clientWidth) {
      box.scrollTo({ left: cell.offsetLeft - (box.clientWidth - cell.offsetWidth) / 2, behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curKey, draft === null]);

  const rows = matrix?.rows ?? 0;
  const cols = matrix?.cols ?? 0;
  const active = !!cal?.active;
  const current: Coord | null = cal?.current ?? null;
  /** 지금 이름을 붙이는 칸 — 매핑 중이면 울리는 칸, 아니면 고른 칸 */
  const cur: Coord = active && current ? current : selected;

  const changed = useMemo(() => {
    if (!matrix || !draft) return 0;
    let n = 0;
    matrix.cells.forEach((row, r) => row.forEach((name, c) => (name !== (draft[r]?.[c] ?? "") ? n++ : 0)));
    return n;
  }, [matrix, draft]);

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    (draft ?? []).flat().filter(Boolean).forEach((n) => seen.set(n.trim(), (seen.get(n.trim()) ?? 0) + 1));
    return new Set(Array.from(seen).filter(([, count]) => count > 1).map(([n]) => n));
  }, [draft]);

  const filled = useMemo(() => (draft ?? []).flat().filter((n) => n.trim()).length, [draft]);
  const missing = useMemo(() => {
    const used = new Set((draft ?? []).flat().map((n) => n.trim()).filter(Boolean));
    return PLACE_NAMES.filter((n) => !used.has(n));
  }, [draft]);

  async function run<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await fn();
      if (ok) toast.success(ok);
      return result;
    } catch (e) {
      toast.error((e as Error).message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  const focusCell = (coord: Coord) => requestAnimationFrame(() => inputs.current.get(key(coord))?.focus());
  const focusAnswer = () => requestAnimationFrame(() => answerRef.current?.focus());

  /** 그 칸으로 옮긴다 — 매핑 중이면 그 칸을 울린다. from: 다음에 글자를 넣을 곳 */
  const ping = async (coord: Coord, from: "grid" | "answer" = active ? "answer" : "grid") => {
    setSelected(coord);
    if (from === "grid") focusCell(coord);
    else focusAnswer();
    if (!active) return;
    const st = await run(() => speakerApi.ping(coord[0], coord[1]));
    if (st) qc.setQueryData(CAL_KEY, st);
  };

  const nextOf = ([r, c]: Coord): Coord => (c < cols ? [r, c + 1] : r < rows ? [r + 1, 1] : [1, 1]);
  const prevOf = ([r, c]: Coord): Coord => (c > 1 ? [r, c - 1] : r > 1 ? [r - 1, cols] : [rows, cols]);

  const setName = ([r, c]: Coord, value: string) =>
    setDraft((d) => d && d.map((row, ri) => (ri === r - 1 ? row.map((v, ci) => (ci === c - 1 ? value : v)) : row)));

  const nameAt = ([r, c]: Coord) => draft?.[r - 1]?.[c - 1] ?? "";

  /** 저장하고 다음 — 이름은 칸 표와 같은 고친 내용(draft)에 남고, 서버 저장은 아래 [저장] */
  const answerNext = () => ping(nextOf(cur), "answer");

  const fill = (text: string) => {
    const names = text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!names.length || !draft) return false;
    let pos = selected;
    const next = draft.map((row) => [...row]);
    for (const name of names) {
      next[pos[0] - 1][pos[1] - 1] = name;
      pos = nextOf(pos);
    }
    setDraft(next);
    toast.success(`${names.length}칸을 채웠어요`);
    return true;
  };

  const save = async () => {
    if (!draft) return;
    const res = await run(() => speakerApi.saveMatrix(draft), "저장했어요");
    if (!res) return;
    qc.setQueryData(SPEAKER_MATRIX_KEY, res.matrix);
    setDraft(copyCells(res.matrix));
    useSpeakerStore.getState().setZones([]); // 메인 화면 구역 목록을 새 이름으로 다시 읽게
    qc.invalidateQueries({ queryKey: BACKUP_KEY });
  };

  const session = async (action: "start" | "stop" | "silence") => {
    const fn = action === "start" ? speakerApi.start : action === "stop" ? speakerApi.stop : speakerApi.silence;
    // 종 때문에 멈췄던 찾기는 그 칸부터 이어서
    const resume = action === "start" && cal?.ended?.reason === "bell" ? cal.ended.resume : null;
    const st = await run(fn, action === "start" ? (resume ? "이어서 찾아요" : "찾기를 시작했어요") : undefined);
    if (st) qc.setQueryData(CAL_KEY, st);
    if (st && resume) {
      const again = await run(() => speakerApi.ping(resume[0], resume[1]));
      if (again) qc.setQueryData(CAL_KEY, again);
    }
    if (action === "start") focusAnswer();
  };
  const resumable = !cal?.active && cal?.ended?.reason === "bell" && !!cal.ended.resume;

  if (matrixQuery.isError) {
    return <p className="font-pretendard text-white/40">스피커 구역표를 불러오지 못했어요</p>;
  }
  if (!matrix || !draft) {
    return <p className="font-pretendard text-white/40">불러오는 중…</p>;
  }

  const total = rows * cols;
  const ringing = active && !!current;
  const answer = nameAt(cur);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pb-4 md:overflow-auto">
      <ConnectionBar onRestored={(m) => setDraft(copyCells(m))} />

      {/* 찾기 판 */}
      <section data-tour="mapping.session" className={cn(adminPanel, "flex flex-col gap-4 p-4 md:px-5 md:py-[18px]")}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="font-mbc text-[17px] text-white">찾기</h3>
          {active && (
            <NeonButton tone="white" data-tour="mapping.silence" onClick={() => session("silence")} disabled={busy} className="h-9 md:h-8">
              모두 끄기
            </NeonButton>
          )}
          <div className="ml-auto flex min-w-0 items-center gap-3 max-md:order-last max-md:w-full">
            <span className="shrink-0 font-pretendard text-[12.5px] font-medium text-white/45">
              이름 붙은 칸 <span className="font-orbitron text-white/70">{filled}</span> / <span className="font-orbitron">{total}</span>
            </span>
            <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-white/[0.08] md:w-[180px] md:flex-none">
              <i
                className="block h-full bg-[#ff3b3b] shadow-[0_0_8px_#ff3b3b] transition-[width] duration-300"
                style={{ width: `${total ? (filled / total) * 100 : 0}%` }}
              />
            </div>
          </div>
          {!active && (
            <NeonButton data-tour="mapping.start" className="min-w-[132px] max-md:ml-auto" disabled={busy} onClick={() => session("start")}>
              {resumable ? "이어서 찾기" : "찾기 시작"}
            </NeonButton>
          )}
        </div>
        <MappingBellNote cal={cal} />

        {active && (
          <div className="grid gap-5 md:grid-cols-[280px_minmax(0,1fr)] md:gap-6">
            {/* 지금 울리는 칸 */}
            <div className="flex flex-col items-center gap-3.5">
              <div
                className={cn(
                  "flex h-[124px] w-[124px] flex-col items-center justify-center gap-1 rounded-full border-2 transition-shadow md:h-[150px] md:w-[150px]",
                  ringing
                    ? "border-[rgba(255,59,59,0.6)] shadow-[0_0_30px_-6px_#ff3b3b,inset_0_0_24px_-8px_#ff3b3b]"
                    : "border-white/15",
                )}
              >
                <small className="font-mbc text-[12px] text-white/60 md:text-[13px]">{cal?.tone === false ? "시험음 없이 켠 칸" : "지금 울리는 칸"}</small>
                <b className={cn("font-orbitron text-[28px] font-extrabold md:text-[34px]", ringing ? "text-white" : "text-white/45")}>
                  {cur[0]}·{cur[1]}
                </b>
              </div>
              <div data-tour="mapping.session.controls" className="flex gap-2">
                <button type="button" onClick={() => ping(prevOf(cur))} disabled={busy} className={cn(ghostBtn, "md:h-9")}>
                  ◀ 이전
                </button>
                <button type="button" onClick={() => ping(cur)} disabled={busy} className={cn(ghostBtn, "md:h-9")}>
                  {ringing ? "다시 울리기" : "울리기"}
                </button>
                <button type="button" onClick={() => ping(nextOf(cur))} disabled={busy} className={cn(ghostBtn, "md:h-9")}>
                  다음 ▶
                </button>
              </div>
            </div>

            {/* 어디서 들려요? */}
            <div className="flex min-w-0 flex-col">
              <label htmlFor="mapping-answer" className="mb-2 font-mbc text-[14px] text-white/55">
                어디서 들려요?
              </label>
              <div data-tour="mapping.answer" className="flex gap-2 max-md:flex-col">
                <input
                  id="mapping-answer"
                  ref={answerRef}
                  value={answer}
                  maxLength={20}
                  onChange={(e) => setName(cur, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      answerNext();
                    }
                  }}
                  placeholder={`${cur[0]}·${cur[1]} 칸 이름`}
                  autoComplete="off"
                  className={cn(adminField, "h-12 md:h-11 md:flex-1")}
                />
                <NeonButton data-tour="mapping.answer.next" className="min-w-[180px] md:h-11" disabled={busy} onClick={answerNext}>
                  저장하고 다음
                </NeonButton>
              </div>
              <span className="mb-[7px] mt-3 font-mbc text-[14px] text-white/55">아직 안 붙인 곳</span>
              <div data-tour="mapping.places" className="flex flex-wrap gap-[5px]">
                {missing.map((n) => (
                  <button
                    key={n}
                    type="button"
                    title={roomsOf(n)}
                    onClick={() => {
                      setName(cur, n);
                      focusAnswer();
                    }}
                    className={chipCls(answer.trim() === n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setName(cur, "");
                    answerNext();
                  }}
                  disabled={busy}
                  className={chipCls(false, "border-dashed")}
                >
                  안 들림 · 빈 칸
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 칸 표 */}
      <div ref={gridRef} data-tour="mapping.grid" className={cn(adminPanel, "no-scrollbar relative overflow-x-auto p-2.5 md:overflow-visible md:p-3.5")}>
        <div
          className="grid gap-1 max-md:min-w-[calc(var(--cols)*86px)]"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, ["--cols" as string]: cols }}
        >
          {draft.map((row, ri) =>
            row.map((name, ci) => {
              const coord: Coord = [ri + 1, ci + 1];
              const isCurrent = active ? same(current, coord) : false;
              const isSelected = !active && same(selected, coord);
              const dirty = name !== (matrix.cells[ri]?.[ci] ?? "");
              const dup = !!name.trim() && duplicates.has(name.trim());
              const empty = !name.trim();
              return (
                <div
                  key={key(coord)}
                  onClick={() => {
                    if (active && !isCurrent) ping(coord, "grid");
                    else setSelected(coord);
                  }}
                  className={cn(
                    "flex h-[54px] cursor-pointer flex-col justify-between overflow-hidden rounded-[8px] border px-[5px] py-[3px] transition-colors md:h-[46px]",
                    empty ? "border-dashed" : "border-solid",
                    isCurrent
                      ? "border-solid border-[#ff4a43] bg-[rgba(255,59,59,0.15)] shadow-[0_0_14px_-3px_#ff3b3b]"
                      : isSelected
                        ? "border-white/35 bg-white/[0.06]"
                        : dirty
                          ? "border-white/25 bg-black/30"
                          : "border-white/[0.07] bg-black/30",
                  )}
                >
                  <small className="flex items-center gap-1 font-orbitron text-[9px] font-semibold leading-none text-white/30 md:text-[8.5px]">
                    <span className={cn(dirty && "text-white/70")}>
                      {coord[0]}·{coord[1]}
                    </span>
                    {isCurrent && <span className="text-[#ff4a43]">●</span>}
                    {dup && (
                      <span className="ml-auto font-pretendard text-[10px] text-[#ff8a8a]" title="이름 중복">
                        ≡
                      </span>
                    )}
                  </small>
                  <input
                    ref={(el) => {
                      if (el) inputs.current.set(key(coord), el);
                      else inputs.current.delete(key(coord));
                    }}
                    value={name}
                    title={name || undefined}
                    maxLength={20}
                    aria-label={`${coord[0]}행 ${coord[1]}열 이름`}
                    placeholder={isCurrent ? "?" : "·"}
                    onFocus={() => {
                      if (!active) setSelected(coord);
                    }}
                    onChange={(e) => setName(coord, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        ping(nextOf(coord), "grid");
                      }
                    }}
                    className={cn(
                      "h-7 w-full min-w-0 truncate rounded bg-transparent px-0.5 text-center font-mbc text-base text-white outline-none focus:bg-white/10 md:h-[22px] md:text-[12px]",
                      isCurrent ? "placeholder:text-white" : "placeholder:text-white/20",
                    )}
                  />
                </div>
              );
            }),
          )}
        </div>
      </div>

      {/* 바뀐 칸 · 되돌리기 · 저장 · 찾기 끝내기 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto font-pretendard text-[12.5px] font-medium text-white/45 max-md:w-full">
          {changed > 0 ? `바뀐 칸 ${changed}개` : "바뀐 칸 없음"}
        </span>
        <FillMenu from={selected} onFill={fill} />
        <NeonButton tone="white" data-tour="mapping.revert" onClick={() => setDraft(copyCells(matrix))} disabled={!changed || busy}>
          되돌리기
        </NeonButton>
        <NeonButton data-tour="mapping.save" className="min-w-[130px] max-md:flex-1" onClick={save} disabled={!changed || busy}>
          저장
        </NeonButton>
        {active && (
          <NeonButton
            tone="white"
            data-tour="mapping.stop"
            onClick={() => (changed ? setConfirmStop(true) : session("stop"))}
            disabled={busy}
            className="shrink-0 max-md:w-full"
          >
            찾기 끝내기
          </NeonButton>
        )}
      </div>

      <TimeConfirm
        open={confirmStop}
        title="찾기 끝내기"
        message={`저장하지 않은 칸 ${changed}개`}
        confirmText="끝내기"
        danger
        onClose={() => setConfirmStop(false)}
        onConfirm={() => session("stop")}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- 연속 채우기 (⋯) */

function FillMenu({ from, onFill }: { from: Coord; onFill: (text: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const submit = () => {
    if (onFill(text)) {
      setText("");
      setOpen(false);
    }
  };
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger data-tour="mapping.more" aria-label="더 보기" className={cn(ghostBtn, "w-11 px-0 md:h-[42px] md:w-[42px]")}>
        <MoreHorizontal size={18} />
      </P.Trigger>
      <P.Portal>
        <P.Content
          side="top"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-[900] w-[min(360px,calc(100vw-24px))] rounded-[18px] border border-white/[0.12] bg-[#141416] p-3 text-white shadow-[0_24px_60px_rgba(0,0,0,0.65)] outline-none"
        >
          <div data-tour="mapping.fill" className="flex flex-col gap-2">
            <span className="font-mbc text-[13.5px] text-white/60">
              연속 채우기 <span className="font-orbitron text-[12px] text-white/80">{from[0]}·{from[1]}</span>부터
            </span>
            <div className="flex gap-2">
              <input
                value={text}
                autoFocus
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
                }}
                placeholder="1-1, 1-2, 1-3"
                className={cn(adminField, "h-11 flex-1 md:h-10 md:text-[14px]")}
              />
              <NeonButton onClick={submit} disabled={!text.trim()} className="h-11 shrink-0 md:h-10">
                채우기
              </NeonButton>
            </div>
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

/* ---------------------------------------------------------------- 매트릭스 연결 줄 */

const barBtn = cn(ghostBtn, "max-md:px-2 max-md:text-[12.5px] md:h-[34px] [&>svg]:max-md:hidden");

/** 스피커 매트릭스 연결 — 상태 한 줄. 연결 설정은 펼쳐서(다른 학교에 설치할 때 .env 대신 화면에서) */
function ConnectionBar({ onRestored }: { onRestored: (m: SpeakerMatrix) => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: CONN_KEY, queryFn: speakerApi.connection, refetchInterval: 10_000 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ driver: string; host: string; port: string } | null>(null);
  const [testResult, setTestResult] = useState("");
  const [learning, setLearning] = useState(false);

  useEffect(() => {
    if (data && form === null) setForm({ driver: data.driver, host: data.host, port: String(data.port) });
  }, [data, form]);

  const port = Number(form?.port);
  const valid = !!form && !!form.host.trim() && Number.isInteger(port) && port > 0 && port < 65536;
  const dirty = !!data && !!form && (form.driver !== data.driver || form.host !== data.host || port !== data.port);

  const test = async () => {
    if (!form) return;
    setTestResult("확인 중…");
    try {
      const r = await speakerApi.testConnection(form.host.trim(), port);
      setTestResult(r.connected ? `연결됨 ${r.latency}ms` : "연결할 수 없어요");
    } catch (e) {
      setTestResult((e as Error).message);
    }
  };

  const save = async () => {
    if (!form) return;
    try {
      await speakerApi.setConnection({ driver: form.driver, host: form.host.trim(), port });
      toast.success("저장했어요");
      qc.invalidateQueries({ queryKey: CONN_KEY });
      setTestResult("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div data-tour="mapping.connection" className={cn(adminPanel, "flex flex-col px-4 py-3 md:px-[18px]")}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-[7px] font-pretendard text-[13px] font-medium",
            data?.connected ? "text-white/75" : "text-[#ff8a8a]",
          )}
        >
          <StatusDot ok={data ? data.connected : null} />
          {!data ? "매트릭스 확인 중" : data.connected ? "매트릭스 연결됨" : "매트릭스 연결 안 됨"}
        </span>
        {data && (
          <span className="min-w-0 truncate font-pretendard text-[12.5px] font-medium text-white/40">
            {data.driver} · {data.host}:{data.port}
            {data.connected && data.latency ? ` · ${data.latency}ms` : ""}
          </span>
        )}
        <div className="grid grid-cols-3 gap-2 max-md:w-full md:ml-auto md:flex">
          <button
            type="button"
            data-tour="mapping.connection.open"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={cn(barBtn, open && "border-white/30 text-white")}
          >
            <Settings2 size={14} />
            연결 설정
            <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
          </button>
          <button type="button" data-tour="mapping.learn" onClick={() => setLearning(true)} className={barBtn}>
            <RadioTower size={14} />
            <span className="md:hidden">장비 배우기</span>
            <span className="max-md:hidden">새 장비 배우기</span>
          </button>
          <BackupMenu onRestored={onRestored} />
        </div>
      </div>

      {open && data && form && (
        <div className="mt-3 flex flex-wrap items-end gap-2.5 border-t border-white/[0.06] pt-3">
          <label className="flex w-full flex-col gap-1 md:w-auto">
            <span className="font-mbc text-[12.5px] text-white/45">드라이버</span>
            <Select
              value={form.driver}
              onChange={(driver) => setForm({ ...form, driver })}
              options={data.drivers.map((d) => ({ value: d, label: d }))}
              aria-label="드라이버"
              className="h-11 rounded-[12px] border-white/10 bg-[#0c0d0f] max-md:w-full md:h-10 md:min-w-[140px]"
            />
          </label>
          <label className="flex w-full min-w-0 flex-col gap-1 md:w-48">
            <span className="font-mbc text-[12.5px] text-white/45">주소</span>
            <input
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              className={cn(adminField, "font-orbitron md:h-10 md:text-[13px]")}
            />
          </label>
          <label className="flex w-24 flex-col gap-1">
            <span className="font-mbc text-[12.5px] text-white/45">포트</span>
            <input
              value={form.port}
              inputMode="numeric"
              onChange={(e) => setForm({ ...form, port: e.target.value })}
              className={cn(adminField, "font-orbitron md:h-10 md:text-[13px]")}
            />
          </label>
          <NeonButton tone="white" data-tour="mapping.connection.test" onClick={test} disabled={!valid} className="h-11 shrink-0 md:h-10">
            연결 테스트
          </NeonButton>
          <NeonButton data-tour="mapping.connection.save" onClick={save} disabled={!valid || !dirty} className="h-11 shrink-0 md:h-10">
            저장
          </NeonButton>
          <span className="self-center font-pretendard text-[13px] text-white/55">{testResult}</span>
          <span className="ml-auto self-center font-pretendard text-[12px] text-white/30">{data.source === "saved" ? "저장값" : "서버 .env"}</span>
        </div>
      )}
      {learning && <LearnWizard onClose={() => setLearning(false)} />}
    </div>
  );
}

/* ---------------------------------------------------------------- 백업에서 되돌리기 */

function BackupMenu({ onRestored }: { onRestored: (m: SpeakerMatrix) => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: BACKUP_KEY, queryFn: speakerApi.backups });
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<{ name: string; label: string } | null>(null);
  const backups = data?.backups ?? [];
  const when = (t: number) => new Date(t * 1000).toLocaleString("ko-KR");

  const restore = async (name: string) => {
    try {
      const res = await speakerApi.restore(name);
      qc.setQueryData(SPEAKER_MATRIX_KEY, res.matrix);
      onRestored(res.matrix);
      useSpeakerStore.getState().setZones([]);
      qc.invalidateQueries({ queryKey: BACKUP_KEY });
      toast.success("되돌렸어요");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <P.Root open={open} onOpenChange={setOpen}>
        <P.Trigger data-tour="mapping.backup" disabled={!backups.length} className={barBtn}>
          <History size={14} />
          <span className="md:hidden">백업 되돌리기</span>
          <span className="max-md:hidden">백업에서 되돌리기</span>
        </P.Trigger>
        <P.Portal>
          <P.Content
            side="bottom"
            align="end"
            sideOffset={8}
            collisionPadding={12}
            className="z-[900] flex max-h-[min(360px,60dvh)] w-[min(300px,calc(100vw-24px))] flex-col overflow-y-auto rounded-[16px] border border-white/[0.12] bg-[#141416] p-1.5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.65)] outline-none"
          >
            <span className="px-3 pb-1 pt-1.5 font-mbc text-[12.5px] text-white/40">저장 이력</span>
            {backups.map((b) => (
              <button
                key={b.name}
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPick({ name: b.name, label: when(b.savedAt) });
                }}
                className="flex h-11 items-center rounded-[10px] px-3 text-left font-pretendard text-[14px] font-medium text-white/80 transition-colors hover:bg-white/[0.07] hover:text-white md:h-9 md:text-[13.5px]"
              >
                {when(b.savedAt)}
              </button>
            ))}
          </P.Content>
        </P.Portal>
      </P.Root>
      <TimeConfirm
        open={!!pick}
        title="매핑 되돌리기"
        message={pick ? `${pick.label} 저장본으로 되돌릴까요?` : ""}
        confirmText="되돌리기"
        onClose={() => setPick(null)}
        onConfirm={() => pick && restore(pick.name)}
      />
    </>
  );
}
