"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RadioTower } from "lucide-react";
import ConfirmModal from "@/components/common/ConfirmModal";
import LearnWizard from "@/components/devices/LearnWizard";
import Select from "@/components/common/Select";
import { toast } from "@/components/common/Toast";
import { SPEAKER_MATRIX_KEY } from "@/hooks/useSpeakerMatrix";
import { speakerApi, type SpeakerMatrix } from "@/lib/speakerApi";
import { cn } from "@/lib/utils";
import { useSpeakerStore } from "@/stores/speakerStore";

const CAL_KEY = ["speakerCalibration"] as const;
const CONN_KEY = ["speakerConnection"] as const;
const BACKUP_KEY = ["speakerMatrixBackups"] as const;

type Coord = [number, number];
const key = ([r, c]: Coord) => `${r}-${c}`;

function copyCells(m: SpeakerMatrix): string[][] {
  return m.cells.map((row) => [...row]);
}

/** 스피커 매핑(캘리브레이션) — 매트릭스 좌표마다 실제 구역 이름을 붙인다. */
export default function SpeakerMappingPanel() {
  const qc = useQueryClient();
  const matrixQuery = useQuery({ queryKey: SPEAKER_MATRIX_KEY, queryFn: speakerApi.matrix });
  const calQuery = useQuery({ queryKey: CAL_KEY, queryFn: speakerApi.calibration, refetchInterval: 3000 });
  const matrix = matrixQuery.data;
  const cal = calQuery.data;

  const [draft, setDraft] = useState<string[][] | null>(null);
  const [selected, setSelected] = useState<Coord>([1, 1]);
  const [busy, setBusy] = useState(false);
  const [fillText, setFillText] = useState("");
  const [confirmStop, setConfirmStop] = useState(false);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (matrix && draft === null) setDraft(copyCells(matrix));
  }, [matrix, draft]);

  const rows = matrix?.rows ?? 0;
  const cols = matrix?.cols ?? 0;
  const active = !!cal?.active;
  const current = cal?.current ?? null;

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

  const focus = (coord: Coord) => requestAnimationFrame(() => inputs.current.get(key(coord))?.focus());

  const ping = async (coord: Coord) => {
    setSelected(coord);
    focus(coord);
    if (!active) return;
    const st = await run(() => speakerApi.ping(coord[0], coord[1]));
    if (st) qc.setQueryData(CAL_KEY, st);
  };

  const nextOf = ([r, c]: Coord): Coord => (c < cols ? [r, c + 1] : r < rows ? [r + 1, 1] : [1, 1]);

  const setName = ([r, c]: Coord, value: string) =>
    setDraft((d) => d && d.map((row, ri) => (ri === r - 1 ? row.map((v, ci) => (ci === c - 1 ? value : v)) : row)));

  const fillFromSelected = () => {
    const names = fillText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!names.length || !draft) return;
    let pos = selected;
    const next = draft.map((row) => [...row]);
    for (const name of names) {
      next[pos[0] - 1][pos[1] - 1] = name;
      pos = nextOf(pos);
    }
    setDraft(next);
    setFillText("");
    toast.success(`${names.length}칸을 채웠어요`);
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
    const st = await run(fn, action === "start" ? "매핑을 시작했어요" : undefined);
    if (st) qc.setQueryData(CAL_KEY, st);
    if (action === "start") focus(selected);
  };

  if (matrixQuery.isError) {
    return <p className="font-pretendard text-white/40">스피커 구역표를 불러오지 못했어요</p>;
  }
  if (!matrix || !draft) {
    return <p className="font-pretendard text-white/40">불러오는 중…</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto pb-4">
      <ConnectionCard />

      {/* 세션 */}
      <div
        data-tour="mapping.session"
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-xl border px-5 py-4",
          active ? "border-red-400/40 bg-red-400/10" : "border-white/10 bg-white/[0.03]",
        )}
      >
        {active ? (
          <>
            <span className="flex items-center gap-2 font-mbc text-sm text-white">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-400 shadow-[0_0_8px_#f87171]" />
              매핑 중
              <span className="text-white/45">· 시험음 {cal?.tone ? "재생 중" : "없음"}</span>
            </span>
            <span className="font-pretendard text-xs text-white/40">
              울리는 칸 {current ? `${current[0]}행 ${current[1]}열` : "없음"}
            </span>
            <div data-tour="mapping.session.controls" className="ml-auto flex gap-2">
              <PanelButton onClick={() => ping(nextOf(selected))} disabled={busy}>
                다음 칸 ▶
              </PanelButton>
              <PanelButton onClick={() => session("silence")} disabled={busy}>
                모두 끄기
              </PanelButton>
              <PanelButton tone="danger" onClick={() => (changed ? setConfirmStop(true) : session("stop"))} disabled={busy}>
                매핑 종료
              </PanelButton>
            </div>
          </>
        ) : (
          <div className="ml-auto">
            <PanelButton tour="mapping.start" tone="primary" onClick={() => session("start")} disabled={busy}>
              매핑 시작
            </PanelButton>
          </div>
        )}
      </div>

      {/* 좌표 표 */}
      <div data-tour="mapping.grid" className="rounded-2xl border border-white/5 bg-[#0a0a0a] p-4">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {draft.map((row, ri) =>
            row.map((name, ci) => {
              const coord: Coord = [ri + 1, ci + 1];
              const isCurrent = !!current && current[0] === coord[0] && current[1] === coord[1];
              const isSelected = selected[0] === coord[0] && selected[1] === coord[1];
              const dirty = name !== (matrix.cells[ri]?.[ci] ?? "");
              const dup = !!name.trim() && duplicates.has(name.trim());
              return (
                <div
                  key={key(coord)}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-lg border p-1 transition-colors",
                    isCurrent
                      ? "border-red-400/60 bg-red-400/15 shadow-[0_0_14px_-4px_#ff5a5a]"
                      : isSelected
                        ? "border-white/30 bg-white/[0.06]"
                        : "border-white/[0.07] bg-black/30",
                    dirty && !isCurrent && "border-amber-300/40",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => ping(coord)}
                    title={active ? "소리 확인" : undefined}
                    className="flex items-center justify-between px-0.5 font-orbitron text-[9px] tracking-wider text-white/30 hover:text-white/60"
                  >
                    {coord[0]}·{coord[1]}
                    {isCurrent && <span className="text-red-400">●</span>}
                    {dup && !isCurrent && <span className="text-amber-300" title="이름 중복">≡</span>}
                  </button>
                  <input
                    ref={(el) => {
                      if (el) inputs.current.set(key(coord), el);
                      else inputs.current.delete(key(coord));
                    }}
                    value={name}
                    maxLength={20}
                    onFocus={() => setSelected(coord)}
                    onChange={(e) => setName(coord, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        ping(nextOf(coord));
                      }
                    }}
                    className="h-7 w-full min-w-0 rounded bg-transparent px-1 text-center font-mbc text-[13px] text-white placeholder:text-white/15 focus:bg-white/10 focus:outline-none"
                  />
                </div>
              );
            }),
          )}
        </div>
      </div>

      {/* 도구 + 저장 */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
        <div data-tour="mapping.fill" className="flex min-w-[320px] flex-1 flex-col gap-1">
          <span className="font-mbc text-xs text-white/40">
            연속 채우기 ({selected[0]}·{selected[1]}부터)
          </span>
          <div className="flex gap-2">
            <input
              value={fillText}
              onChange={(e) => setFillText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fillFromSelected()}
              placeholder="예: 1-1, 1-2"
              className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#141414] px-3 font-pretendard text-sm text-white focus:border-white/30 focus:outline-none"
            />
            <PanelButton onClick={fillFromSelected} disabled={!fillText.trim()}>
              채우기
            </PanelButton>
          </div>
        </div>
        <BackupRestore onRestored={(m) => setDraft(copyCells(m))} />
        <div className="ml-auto flex items-center gap-3">
          {changed > 0 && <span className="font-pretendard text-sm text-amber-200/80">바뀐 칸 {changed}개</span>}
          <PanelButton tour="mapping.revert" onClick={() => setDraft(copyCells(matrix))} disabled={!changed || busy}>
            되돌리기
          </PanelButton>
          <PanelButton tour="mapping.save" tone="primary" onClick={save} disabled={!changed || busy}>
            저장
          </PanelButton>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmStop}
        onClose={() => setConfirmStop(false)}
        onConfirm={() => {
          setConfirmStop(false);
          session("stop");
        }}
        title="매핑 종료"
        message={`저장하지 않은 칸 ${changed}개`}
        confirmText="종료"
      />
    </div>
  );
}

function PanelButton({
  children,
  onClick,
  disabled,
  tone = "default",
  tour,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
  /** CUE 튜토리얼 이름표 (data-tour) */
  tour?: string;
}) {
  return (
    <button
      type="button"
      data-tour={tour}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-10 shrink-0 rounded-lg border px-4 font-mbc text-sm text-white transition-colors disabled:opacity-40",
        tone === "primary" && "border-emerald-400/40 bg-emerald-500/20 hover:bg-emerald-500/30",
        tone === "danger" && "border-red-400/40 bg-red-500/20 hover:bg-red-500/30",
        tone === "default" && "border-white/15 bg-white/10 hover:bg-white/15",
      )}
    >
      {children}
    </button>
  );
}

/** 스피커 매트릭스 접속 정보 — 다른 학교에 설치할 때 .env를 고치지 않고 화면에서 바꾼다. */
function ConnectionCard() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: CONN_KEY, queryFn: speakerApi.connection, refetchInterval: 10_000 });
  const [form, setForm] = useState<{ driver: string; host: string; port: string } | null>(null);
  const [testResult, setTestResult] = useState<string>("");
  const [learning, setLearning] = useState(false);

  useEffect(() => {
    if (data && form === null) setForm({ driver: data.driver, host: data.host, port: String(data.port) });
  }, [data, form]);

  if (!data || !form) return null;
  const port = Number(form.port);
  const valid = form.host.trim() && Number.isInteger(port) && port > 0 && port < 65536;
  const dirty = form.driver !== data.driver || form.host !== data.host || port !== data.port;

  const test = async () => {
    setTestResult("확인 중…");
    try {
      const r = await speakerApi.testConnection(form.host.trim(), port);
      setTestResult(r.connected ? `연결됨 (${r.latency}ms)` : "연결할 수 없음");
    } catch (e) {
      setTestResult((e as Error).message);
    }
  };

  const save = async () => {
    try {
      await speakerApi.setConnection({ driver: form.driver, host: form.host.trim(), port });
      toast.success("저장했어요");
      qc.invalidateQueries({ queryKey: CONN_KEY });
      setTestResult("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const field = "h-10 rounded-lg border border-white/10 bg-[#141414] px-3 text-sm text-white focus:border-white/30 focus:outline-none";

  return (
    <div data-tour="mapping.connection" className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <div className="flex items-center gap-2 self-center pr-2">
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            data.connected ? "bg-[#00FF57] shadow-[0_0_8px_#00FF57]" : "bg-[#585858]",
          )}
        />
        <span className="font-mbc text-sm text-white/70">매트릭스 {data.connected ? "연결됨" : "연결 안 됨"}</span>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-mbc text-xs text-white/40">드라이버</span>
        <Select
          value={form.driver}
          onChange={(driver) => setForm({ ...form, driver })}
          options={data.drivers.map((d) => ({ value: d, label: d }))}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mbc text-xs text-white/40">주소</span>
        <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} className={cn(field, "w-44 font-orbitron")} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mbc text-xs text-white/40">포트</span>
        <input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} className={cn(field, "w-24 font-orbitron")} />
      </label>
      <PanelButton tour="mapping.connection.test" onClick={test} disabled={!valid}>
        연결 테스트
      </PanelButton>
      <PanelButton tone="primary" onClick={save} disabled={!valid || !dirty}>
        저장
      </PanelButton>
      {testResult && <span className="self-center font-pretendard text-sm text-white/55">{testResult}</span>}
      <div className="ml-auto flex items-center gap-3 self-center">
        <button
          type="button"
          data-tour="mapping.learn"
          onClick={() => setLearning(true)}
          className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2 font-mbc text-sm text-red-100 transition-colors hover:bg-red-500/20"
        >
          <RadioTower size={15} />
          새 장비 배우기
        </button>
        <span className="font-pretendard text-xs text-white/30">
          {data.source === "saved" ? "저장값" : "서버 .env"}
        </span>
      </div>
      {learning && <LearnWizard onClose={() => setLearning(false)} />}
    </div>
  );
}

function BackupRestore({ onRestored }: { onRestored: (m: SpeakerMatrix) => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: BACKUP_KEY, queryFn: speakerApi.backups });
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const backups = data?.backups ?? [];

  const restore = async () => {
    try {
      const res = await speakerApi.restore(name);
      qc.setQueryData(SPEAKER_MATRIX_KEY, res.matrix);
      onRestored(res.matrix);
      useSpeakerStore.getState().setZones([]);
      qc.invalidateQueries({ queryKey: BACKUP_KEY });
      toast.success("복원했어요");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!backups.length) return null;
  return (
    <div data-tour="mapping.backup" className="flex flex-col gap-1">
      <span className="font-mbc text-xs text-white/40">저장 이력</span>
      <div className="flex gap-2">
        <Select
          value={name}
          onChange={setName}
          placeholder="백업 선택"
          aria-label="백업 선택"
          options={backups.map((b) => ({ value: b.name, label: new Date(b.savedAt * 1000).toLocaleString("ko-KR") }))}
        />
        <PanelButton onClick={() => setConfirm(true)} disabled={!name}>
          복원
        </PanelButton>
      </div>
      <ConfirmModal
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          restore();
        }}
        title="매핑 복원"
        message="선택한 시점으로 되돌릴까요?"
        confirmText="복원"
      />
    </div>
  );
}
