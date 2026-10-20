"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import NeonButton from "@/components/common/NeonButton";
import { chatApi } from "@/lib/chatApi";
import { cn } from "@/lib/utils";
import type { ChatAction, TablePreview } from "@/types/chat";

const STATUS_LABEL: Record<ChatAction["status"], string> = {
  pending: "확인 대기",
  running: "실행 중",
  done: "완료",
  error: "실패",
  cancelled: "취소함",
  expired: "시간 지남",
};

/** 만든 지 10분이 지났으면 서버를 묻지 않아도 시간 지남으로 본다 */
function effectiveStatus(a: ChatAction, now: number): ChatAction["status"] {
  if (a.status === "pending" && a.expiresAt && new Date(a.expiresAt).getTime() <= now) return "expired";
  return a.status;
}

function minutesLeft(iso: string, now: number): string {
  const s = Math.max(0, (new Date(iso).getTime() - now) / 1000);
  if (s < 60) return "1분 안에";
  return `${Math.ceil(s / 60)}분 안에`;
}

const cellText = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

function TableView({
  preview,
  rows,
  editing,
  onChange,
}: {
  preview: TablePreview;
  rows: Record<string, unknown>[];
  editing: boolean;
  onChange: (rows: Record<string, unknown>[]) => void;
}) {
  const cols = preview.columns;
  const setCell = (r: number, key: string, value: string) =>
    onChange(rows.map((row, i) => (i === r ? { ...row, [key]: value } : row)));
  const addRow = () => onChange([...rows, Object.fromEntries(cols.map((c) => [c.key, ""]))]);
  const removeRow = (r: number) => onChange(rows.filter((_, i) => i !== r));
  // 칸 너비는 그 열에서 가장 긴 글자에 맞춘다 (한글은 2칸) — 이름 칸이 잘리지 않게
  const colWidth = (key: string) =>
    Math.max(5, ...rows.map((row) => [...cellText(row[key])].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0))) + 3;

  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-[320px] overflow-auto rounded-lg border border-white/10">
        <table className="w-full border-collapse text-left text-[13.5px]">
          <thead className="sticky top-0 bg-[#1a1a1d]">
            <tr>
              {cols.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-2.5 py-1.5 font-semibold text-white/60">
                  {c.label}
                </th>
              ))}
              {editing && <th className="w-8" aria-label="지우기" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-t border-white/[0.06]">
                {cols.map((c) => (
                  <td key={c.key} className={cn(editing ? "p-1" : "px-2.5 py-1.5", "text-white/90")}>
                    {editing ? (
                      <input
                        value={cellText(row[c.key])}
                        onChange={(e) => setCell(r, c.key, e.target.value)}
                        aria-label={`${r + 1}번째 줄 ${c.label}`}
                        style={{ width: `${colWidth(c.key)}ch` }}
                        className="h-8 min-w-[64px] max-w-[240px] rounded-md border border-transparent bg-white/[0.04] px-2 text-[13.5px] text-white outline-none focus:border-white/30 focus:bg-white/[0.08]"
                      />
                    ) : (
                      cellText(row[c.key])
                    )}
                  </td>
                ))}
                {editing && (
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(r)}
                      title="이 줄 지우기"
                      aria-label={`${r + 1}번째 줄 지우기`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                    >
                      <X size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={cols.length + (editing ? 1 : 0)}>
                  <EmptyState size="sm" className="py-3">줄이 없어요</EmptyState>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <button
          type="button"
          onClick={addRow}
          className="flex h-8 items-center justify-center gap-1 self-start rounded-md px-2 text-[13px] text-white/60 hover:bg-white/[0.06] hover:text-white"
        >
          <Plus size={14} /> 줄 추가
        </button>
      )}
    </div>
  );
}

export default function ActionCard({
  action,
  onUpdate,
  onDone,
}: {
  action: ChatAction;
  onUpdate: (a: ChatAction) => void;
  /** 실행이 끝나면 (화면 데이터 새로고침) */
  onDone?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const status = effectiveStatus(action, now);
  const pending = status === "pending";
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [pending]);

  const table = action.preview?.kind === "table" ? action.preview : null;
  const original = useMemo(() => table?.rows ?? [], [table]);
  const [rows, setRows] = useState<Record<string, unknown>[]>(original);
  useEffect(() => setRows(original), [original]);
  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(original), [rows, original]);

  const [armed, setArmed] = useState(false); // 위험한 작업 — 한 번 더 눌러야 실행
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 5000);
    return () => window.clearTimeout(id);
  }, [armed]);
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const [err, setErr] = useState("");

  const danger = action.risk === "danger";
  const editing = pending && !!table?.editable;

  const confirm = async () => {
    if (danger && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setErr("");
    setBusy("confirm");
    onUpdate({ ...action, status: "running" });
    try {
      const next = await chatApi.confirmAction(action.id, table?.editable && dirty ? rows : undefined);
      onUpdate(next);
      onDone?.();
    } catch (e) {
      onUpdate({ ...action, status: "pending" });
      setErr(e instanceof Error ? e.message : "실행하지 못했어요");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setErr("");
    setBusy("cancel");
    try {
      onUpdate(await chatApi.cancelAction(action.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "취소하지 못했어요");
    } finally {
      setBusy(null);
    }
  };

  const closed = status === "cancelled" || status === "expired";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-white/[0.035] p-4",
        danger && pending ? "border-[#FF3B3B]/40" : "border-white/12",
        closed && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-pretendard text-[15px] font-semibold leading-snug text-white">{action.title}</p>
          {action.summary && (
            <p className="mt-1 font-pretendard text-[13.5px] leading-relaxed text-white/65">{action.summary}</p>
          )}
        </div>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 pt-0.5 font-pretendard text-[12px]",
            status === "error" ? "text-[#FF6B6B]" : "text-white/45",
          )}
        >
          {status === "running" && <Loader2 size={12} className="animate-spin" />}
          {status === "done" && <Check size={12} />}
          {STATUS_LABEL[status]}
        </span>
      </div>

      {action.preview?.kind === "table" && (
        <TableView preview={action.preview} rows={pending || status === "running" ? rows : original} editing={editing} onChange={setRows} />
      )}
      {action.preview?.kind === "list" && (
        <ul className="list-disc space-y-1 pl-5 font-pretendard text-[13.5px] text-white/85 marker:text-white/35">
          {action.preview.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
      {action.preview?.kind === "kv" && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 font-pretendard text-[13.5px]">
          {action.preview.items.map(([k, v], i) => (
            <div key={i} className="contents">
              <dt className="text-white/50">{k}</dt>
              <dd className="break-words text-white/90">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {action.result && status !== "pending" && (
        <p
          className={cn(
            "border-t border-white/[0.08] pt-2.5 font-pretendard text-[13.5px]",
            status === "error" ? "text-[#FF6B6B]" : "text-white/75",
          )}
        >
          {action.result}
        </p>
      )}
      {err && <p className="font-pretendard text-[13px] text-[#FF6B6B]">{err}</p>}

      {(pending || status === "running") && (
        <div className="flex flex-wrap items-center gap-2">
          <NeonButton
            onClick={confirm}
            disabled={!!busy || status === "running"}
            icon={busy === "confirm" ? <Loader2 className="animate-spin" /> : undefined}
            className="h-9 md:h-9"
          >
            {danger ? (armed ? "정말 실행" : "실행") : dirty ? "고친 대로 확인" : "확인"}
          </NeonButton>
          <NeonButton tone="white" onClick={cancel} disabled={!!busy || status === "running"} className="h-9 md:h-9">
            취소
          </NeonButton>
          {pending && action.expiresAt && (
            <span className="ml-auto font-pretendard text-[12px] text-white/35">
              {minutesLeft(action.expiresAt, now)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
