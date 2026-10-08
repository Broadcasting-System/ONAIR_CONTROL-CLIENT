"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, PlugZap, RefreshCw, RotateCcw, Save, Send } from "lucide-react";
import Select from "@/components/common/Select";
import { toast } from "@/components/common/Toast";
import { Notice } from "@/components/hall/HallControls";
import NotebookPicker from "@/components/hall/setup/NotebookPicker";
import {
  ActionButton,
  Badge,
  Card,
  Field,
  OptionCard,
  TestResults,
  badBorder,
  inputCls,
  okBorder,
} from "@/components/hall/setup/ui";
import { hallApi } from "@/lib/hallApi";
import { cn } from "@/lib/utils";
import type {
  ConnectionTestResult,
  MatrixConnection,
  MatrixTryResult,
  SerialPortInfo,
  VideoMatrixState,
} from "@/types/hall";

type Terminator = MatrixConnection["protocol"]["terminator"];
type Sent = MatrixTryResult & { route: string };

const URL_RE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?\/?$/;
const BAUDS = [9600, 19200, 38400, 57600, 115200, 4800, 2400];
const TERMINATORS: { value: Terminator; label: string }[] = [
  { value: "\r\n", label: "CR+LF  (\\r\\n)" },
  { value: "\r", label: "CR  (\\r)" },
  { value: "\n", label: "LF  (\\n)" },
  { value: "", label: "없음" },
];
// 서버와 같은 규칙 — {input} {output} {input:02d} 처럼 숫자 서식만
const FIELD = /\{(input|output)(?::(0?)(\d?)d)?\}/g;

const clone = (c: MatrixConnection): MatrixConnection => ({
  driver: c.driver,
  bridge: { ...c.bridge },
  protocol: { ...c.protocol },
});
const same = (a: MatrixConnection, b: MatrixConnection) => JSON.stringify(clone(a)) === JSON.stringify(clone(b));

/** 명령 틀에 번호를 넣은 실제 명령 ({input:02d} 는 두 자리) */
function renderRoute(tpl: string, input: number, output: number): string {
  return tpl.replace(FIELD, (_m, name: string, zero?: string, width?: string) => {
    const s = String(name === "input" ? input : output);
    const w = Number(width || 0);
    return w ? s.padStart(w, zero ? "0" : " ") : s;
  });
}

/** 명령 틀이 틀렸으면 이유 (서버 검사와 같다) */
function routeProblem(tpl: string): string | null {
  const t = tpl.trim();
  if (!t) return "명령 틀을 적어 주세요";
  if (t.length > 60) return "60자 이하로 적어 주세요";
  if (/[^\x20-\x7e]/.test(t)) return "영문·숫자·기호만 쓸 수 있어요";
  const names = new Set(Array.from(t.matchAll(FIELD), (m) => m[1]));
  if (!names.has("input") || !names.has("output")) return "{input} 과 {output} 이 둘 다 있어야 해요";
  if (/[{}]/.test(t.replace(FIELD, ""))) return "{ } 안에는 input 또는 output 만 쓸 수 있어요";
  return null;
}

/** 줄바꿈 같은 보이지 않는 글자를 \r \n \xHH 로 */
function visible(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (ch === "\r") out += "\\r";
    else if (ch === "\n") out += "\\n";
    else if (code < 32 || (code >= 127 && code <= 255)) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return out;
}

function badRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return false;
  } catch {
    return true;
  }
}

/** 조회 명령·해석 규칙이 틀렸으면 이유 (서버 검사와 같다) */
function queryProblem(query: string, regex: string): string | null {
  const q = query.trim();
  const r = regex.trim();
  if (!q && !r) return null;
  if (!q || !r) return "조회 명령과 해석 규칙은 둘 다 적어야 해요";
  if (q.length > 40 || /[^\x20-\x7e]/.test(q)) return "조회 명령은 영문·숫자·기호 40자 이하로 적어 주세요";
  if (r.length > 120) return "해석 규칙은 120자 이하로 적어 주세요";
  if (!/\(\?P?<input>/.test(r) || !/\(\?P?<output>/.test(r))
    return "해석 규칙에 (?P<input>…) 과 (?P<output>…) 이 둘 다 있어야 해요";
  // 파이썬 표기 (?P<이름>) 을 브라우저 표기로 바꿔 형식만 확인한다
  if (badRegex(r.replace(/\(\?P</g, "(?<"))) return "해석 규칙 형식이 올바르지 않아요";
  return null;
}

/** 영상 매트릭스 현장 세팅 — 노트북·COM 포트·명령 문법을 정하고, 저장 전에 한 번씩 보내 본다 */
export default function MatrixConnectionForm({
  hallId,
  state,
  onSaved,
  onDirty,
}: {
  hallId: string;
  state: VideoMatrixState;
  onSaved: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const qc = useQueryClient();
  const saved = state.connection;
  const candidates = saved.candidates ?? [];
  const queryCandidates = saved.queryCandidates ?? [];
  const [conn, setConn] = useState<MatrixConnection>(() => clone(saved));
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ports, setPorts] = useState<SerialPortInfo[] | null>(null);
  const [portsBusy, setPortsBusy] = useState(false);
  const [port, setPort] = useState("");
  const [baud, setBaud] = useState(9600);
  const [applied, setApplied] = useState<{ port: string; baud: number } | null>(null);
  const [tryIn, setTryIn] = useState(Math.min(2, state.inputs.length || 1));
  const [tryOut, setTryOut] = useState(1);
  const [sending, setSending] = useState<string | null>(null);
  const [last, setLast] = useState<Sent | null>(null);
  const [finder, setFinder] = useState(false);

  const serial = conn.driver === "serial-bridge";
  const url = conn.bridge.url.trim().replace(/\/$/, "");
  const urlBad = serial && !URL_RE.test(url);
  const route = conn.protocol.route.trim();
  const tplProblem = routeProblem(route);
  const replyBad = badRegex(conn.protocol.replyOk.trim());
  const qProblem = queryProblem(conn.protocol.query, conn.protocol.queryRegex);
  const canSubmit = !urlBad && !tplProblem && !replyBad && !qProblem;
  const dirty = !same(conn, saved);

  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  // 노트북에 지금 설정된 COM 포트 — 방금 고른 값, 아니면 노트북 상태·알림에서
  const { data: bridges } = useQuery({ queryKey: ["bridges"], queryFn: hallApi.bridges, refetchInterval: 5000 });
  const seen =
    bridges?.bridges.find((b) => b.url === url)?.devices[conn.bridge.device] ??
    bridges?.announced?.find((a) => a.url === url)?.devices[conn.bridge.device];
  const nowPort = applied ?? (seen?.kind === "serial" && seen.port ? { port: seen.port, baud: seen.baud ?? 9600 } : null);

  // 값을 바꾸면 예전 시험 결과는 더 이상 맞지 않는다
  const edit = (fn: (c: MatrixConnection) => MatrixConnection) => {
    setConn(fn);
    setResult(null);
  };
  const setBridge = (p: Partial<MatrixConnection["bridge"]>) => edit((c) => ({ ...c, bridge: { ...c.bridge, ...p } }));
  const setProto = (p: Partial<MatrixConnection["protocol"]>) =>
    edit((c) => ({ ...c, protocol: { ...c.protocol, ...p } }));

  const payload = (tpl?: string): MatrixConnection => ({
    driver: conn.driver,
    bridge: { ...conn.bridge, url },
    protocol: {
      ...conn.protocol,
      route: (tpl ?? route).trim(),
      replyOk: conn.protocol.replyOk.trim(),
      query: conn.protocol.query.trim(),
      queryRegex: conn.protocol.queryRegex.trim(),
    },
  });

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await hallApi.testMatrixConnection(hallId, payload()));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await hallApi.updateMatrixConnection(hallId, payload());
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["videoMatrix", hallId] }),
        qc.invalidateQueries({ queryKey: ["hallsStatus"] }),
        qc.invalidateQueries({ queryKey: ["bridges"] }),
      ]);
      toast.success("영상 매트릭스 연결 방식을 저장했습니다.");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const loadPorts = async () => {
    setPortsBusy(true);
    try {
      const { ports: list } = await hallApi.bridgeSerialPorts(url);
      setPorts(list);
      const has = (p?: string) => !!p && list.some((x) => x.port === p);
      setPort((p) => (has(p) ? p : has(nowPort?.port) ? nowPort!.port : (list[0]?.port ?? "")));
      if (nowPort) setBaud(nowPort.baud);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPortsBusy(false);
    }
  };

  const applyPort = async () => {
    if (!port) return;
    try {
      await hallApi.bridgeConfigureSerial(url, conn.bridge.device, port, baud);
      setApplied({ port, baud });
      setResult(null);
      toast.success(`노트북 RS-232 를 ${port} · ${baud}bps 로 설정했습니다.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const send = async (tpl?: string) => {
    const key = (tpl ?? route).trim();
    setSending(key);
    try {
      const res = await hallApi.tryMatrixRoute(hallId, payload(tpl), tryOut, tryIn);
      setLast({ ...res, route: key });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(null);
    }
  };


  return (
    <div className="flex flex-col gap-5">
      <Card title="연결 방식">
        <div className="grid grid-cols-2 gap-3">
          <OptionCard
            selected={serial}
            onClick={() => edit((c) => ({ ...c, driver: "serial-bridge" }))}
            title="RS-232"
            badge="추천"
          />
          <OptionCard
            selected={!serial}
            onClick={() => edit((c) => ({ ...c, driver: "mock" }))}
            title="모의 장비"
          />
        </div>
      </Card>

      {serial && (
        <Card title="다목적홀 노트북">
          <Field label="노트북 주소" className="max-w-[420px]">
            <input
              value={conn.bridge.url}
              onChange={(e) => setBridge({ url: e.target.value })}
              placeholder="http://100.x.x.x:8765"
              className={cn(inputCls, "font-orbitron", urlBad ? badBorder : okBorder)}
            />
          </Field>
          <NotebookPicker value={conn.bridge.url} onPick={(u) => setBridge({ url: u })} need="serial-ports" />
          {!saved.tokenConfigured && (
            <Notice>브릿지 토큰을 만들지 못했어요</Notice>
          )}
        </Card>
      )}

      {serial && (
        <Card
          title="COM 포트"
          action={
            nowPort ? (
              <Badge tone="good">
                노트북 설정 {nowPort.port} · {nowPort.baud}bps
              </Badge>
            ) : (
              <Badge tone="off">포트 없음</Badge>
            )
          }
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field label="포트" className="min-w-[260px] flex-1">
              <Select
                value={port}
                onChange={setPort}
                disabled={!ports || ports.length === 0}
                placeholder={ports && ports.length === 0 ? "USB-RS232 없음" : "포트 고르기"}
                options={(ports ?? []).map((p) => ({ value: p.port, label: `${p.port} · ${p.chip || p.description || "시리얼"}` }))}
                className={cn(inputCls, okBorder)}
              />
            </Field>
            <Field label="속도 (bps)" className="w-[130px]">
              <Select
                value={baud}
                onChange={setBaud}
                options={BAUDS.map((b) => ({ value: b, label: String(b) }))}
                className={cn(inputCls, okBorder, "font-orbitron")}
              />
            </Field>
            <ActionButton icon={<RefreshCw size={14} />} busy={portsBusy} onClick={loadPorts} disabled={urlBad}>
              불러오기
            </ActionButton>
            <ActionButton onClick={applyPort} disabled={!port || urlBad}>
              이 포트로
            </ActionButton>
          </div>
        </Card>
      )}

      {serial && (
        <Card title="명령 문법">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="명령 틀" className="min-w-[240px] flex-1">
              <input
                value={conn.protocol.route}
                onChange={(e) => setProto({ route: e.target.value })}
                spellCheck={false}
                className={cn(inputCls, "font-mono", tplProblem ? badBorder : okBorder)}
              />
            </Field>
            <Field label="끝 문자" className="w-[170px]">
              <Select
                value={conn.protocol.terminator}
                onChange={(terminator) => setProto({ terminator })}
                options={TERMINATORS.map((t) => ({ value: t.value, label: t.label }))}
                className={cn(inputCls, okBorder)}
              />
            </Field>
            <Field label="응답 확인" className="w-[210px]">
              <input
                value={conn.protocol.replyOk}
                onChange={(e) => setProto({ replyOk: e.target.value })}
                placeholder="OK"
                spellCheck={false}
                className={cn(inputCls, "font-mono", replyBad ? badBorder : okBorder)}
              />
            </Field>
          </div>
          {tplProblem && <p className="-mt-2 font-pretendard text-xs text-red-300/85">{tplProblem}</p>}

          {/* 보내 보기 — 저장 전의 값으로 한 번 */}
          <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white/[0.025] p-3">
            <Field label="입력" className="w-[190px]">
              <Select
                value={tryIn}
                onChange={setTryIn}
                options={state.inputs.map((i) => ({ value: i.no, label: `IN ${i.no} · ${i.name}` }))}
                className={cn(inputCls, okBorder)}
              />
            </Field>
            <Field label="출력" className="w-[190px]">
              <Select
                value={tryOut}
                onChange={setTryOut}
                options={state.outputs.map((o) => ({ value: o.no, label: `OUT ${o.no} · ${o.name}` }))}
                className={cn(inputCls, okBorder)}
              />
            </Field>
            <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <span className="font-mbc text-[13px] text-white/55">보낼 명령</span>
              <code className="flex h-10 items-center overflow-x-auto whitespace-nowrap rounded-lg border border-white/10 bg-black/40 px-3 font-mono text-sm text-[#9dffc1]">
                {tplProblem ? "" : visible(renderRoute(route, tryIn, tryOut) + conn.protocol.terminator)}
              </code>
            </div>
            <ActionButton
              tone="primary"
              icon={<Send size={14} />}
              busy={sending === route}
              disabled={!!tplProblem || urlBad || replyBad || (!!sending && sending !== route)}
              onClick={() => send()}
            >
              보내 보기
            </ActionButton>
          </div>
          {last && <SentResult last={last} />}

          {/* 문법 찾기 — 명령표가 없을 때 후보를 하나씩 */}
          <button
            type="button"
            onClick={() => setFinder((v) => !v)}
            className="self-start font-mbc text-sm text-white/55 transition-colors hover:text-white"
          >
            문법 찾기 {finder ? "▲" : "▼"}
          </button>
          {finder && (
            <div className="flex flex-col gap-2.5">
              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                {candidates.map((c) => {
                  const inUse = c.route === route;
                  const wasSent = last?.route === c.route;
                  return (
                    <div
                      key={c.route}
                      className={cn(
                        "flex min-w-[720px] items-center gap-3 border-t border-white/[0.05] px-4 py-2 first:border-t-0",
                        inUse && "bg-[#00FF57]/[0.05]",
                      )}
                    >
                      <code className="w-[220px] shrink-0 font-mono text-sm text-white/85">{c.route}</code>
                      <code className="w-[150px] shrink-0 truncate font-mono text-xs text-white/40">
                        {visible(renderRoute(c.route, tryIn, tryOut) + conn.protocol.terminator)}
                      </code>
                      <span className="min-w-0 flex-1 truncate font-pretendard text-xs text-white/35">{c.note}</span>
                      {wasSent && (
                        <Badge tone={last?.reply ? "good" : "off"}>
                          {last?.reply ? `응답 ${visible(last.reply).slice(0, 14)}` : "응답 없음"}
                        </Badge>
                      )}
                      <ActionButton
                        tone="ghost"
                        icon={<Send size={13} />}
                        busy={sending === c.route}
                        disabled={urlBad || (!!sending && sending !== c.route)}
                        onClick={() => send(c.route)}
                      >
                        보내기
                      </ActionButton>
                      <ActionButton
                        onClick={() => setProto({ route: c.route })}
                        disabled={inUse}
                        icon={inUse ? <Check size={13} /> : undefined}
                      >
                        {inUse ? "사용 중" : "이걸로"}
                      </ActionButton>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {serial && (
        <Card title="현재 상태 읽기">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="조회 명령" className="w-[180px]">
              <input
                value={conn.protocol.query}
                onChange={(e) => setProto({ query: e.target.value })}
                placeholder="안 씀"
                spellCheck={false}
                className={cn(inputCls, "font-mono", qProblem ? badBorder : okBorder)}
              />
            </Field>
            <Field label="응답 해석 규칙" className="min-w-[280px] flex-1">
              <input
                value={conn.protocol.queryRegex}
                onChange={(e) => setProto({ queryRegex: e.target.value })}
                placeholder="안 씀"
                spellCheck={false}
                className={cn(inputCls, "font-mono", qProblem ? badBorder : okBorder)}
              />
            </Field>
            <ActionButton
              tone="ghost"
              onClick={() => setProto({ query: "", queryRegex: "" })}
              disabled={!conn.protocol.query && !conn.protocol.queryRegex}
            >
              비우기
            </ActionButton>
          </div>
          {qProblem && <p className="-mt-2 font-pretendard text-xs text-red-300/85">{qProblem}</p>}
          {queryCandidates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-pretendard text-xs text-white/40">후보</span>
              {queryCandidates.map((q) => {
                const inUse = q.query === conn.protocol.query.trim() && q.regex === conn.protocol.queryRegex.trim();
                return (
                  <button
                    key={q.note}
                    type="button"
                    onClick={() => setProto({ query: q.query, queryRegex: q.regex })}
                    disabled={inUse}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-left font-pretendard text-xs transition-colors",
                      inUse
                        ? "border-[#00FF57]/40 bg-[#00FF57]/[0.08] text-[#9dffc1]"
                        : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10",
                    )}
                  >
                    <code className="font-mono text-[11px] text-white/85">{q.query}</code> · {q.note}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#161616]/90 px-5 py-3">
        <ActionButton icon={<PlugZap size={15} />} busy={testing} onClick={runTest} disabled={!canSubmit}>
          연결 시험
        </ActionButton>
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="font-pretendard text-xs text-amber-200/75">저장 안 한 변경이 있어요</span>}
          {dirty && (
            <ActionButton
              tone="ghost"
              icon={<RotateCcw size={14} />}
              onClick={() => {
                setConn(clone(saved));
                setResult(null);
              }}
            >
              되돌리기
            </ActionButton>
          )}
          <ActionButton tone="primary" icon={<Save size={15} />} busy={saving} onClick={save} disabled={!dirty || !canSubmit}>
            저장
          </ActionButton>
        </div>
      </div>
      {result && <TestResults result={result} />}
    </div>
  );
}

function SentResult({ last }: { last: Sent }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
      <p className="flex gap-3 text-xs">
        <span className="w-8 shrink-0 font-mbc text-white/40">보냄</span>
        <code className="break-all font-mono text-white/85">{visible(last.sent)}</code>
      </p>
      <p className="flex gap-3 text-xs">
        <span className="w-8 shrink-0 font-mbc text-white/40">응답</span>
        {last.reply ? (
          <code className="break-all font-mono text-[#9dffc1]">{visible(last.reply)}</code>
        ) : (
          <span className="font-pretendard text-white/40">없음</span>
        )}
      </p>
      {last.matched !== null && (
        <p className={cn("font-pretendard text-xs", last.matched ? "text-[#9dffc1]" : "text-amber-200")}>
          {last.matched ? "응답 확인 통과" : "응답 확인 불일치"}
        </p>
      )}
    </div>
  );
}
