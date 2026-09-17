"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, PlugZap, RefreshCw, RotateCcw, Save, Send } from "lucide-react";
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
  if (!q || !r) return "조회 명령과 해석 규칙은 둘 다 적어야 해요 (안 쓰려면 둘 다 비우세요)";
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

  const inputName = state.inputs.find((i) => i.no === tryIn)?.name ?? "";
  const outputName = state.outputs.find((o) => o.no === tryOut)?.name ?? "";

  return (
    <div className="flex flex-col gap-5">
      <Card title="어떻게 연결하나요?" hint="매트릭스 뒷면 RS-232 단자에 꽂은 선에 맞춰 고르세요.">
        <div className="grid grid-cols-2 gap-3">
          <OptionCard
            selected={serial}
            onClick={() => edit((c) => ({ ...c, driver: "serial-bridge" }))}
            title="RS-232 (다목적홀 노트북)"
            badge="추천"
            hint="매트릭스 RS-232 ↔ USB-RS232 케이블 ↔ 노트북. 화면 전환 명령을 노트북이 대신 보내요."
          />
          <OptionCard
            selected={!serial}
            onClick={() => edit((c) => ({ ...c, driver: "mock" }))}
            title="모의 장비"
            hint="실제 장비 없이 화면 연습용."
          />
        </div>
      </Card>

      {serial && (
        <Card
          title="다목적홀 노트북"
          hint="매트릭스 옆 노트북에 'ONAIR Bridge' 창이 켜져 있어야 해요. 켜진 노트북은 아래에 저절로 나타나요."
        >
          <Field label="노트북 주소" hint="Tailscale IP 와 포트 — 예: http://100.64.12.3:8765" className="max-w-[420px]">
            <input
              value={conn.bridge.url}
              onChange={(e) => setBridge({ url: e.target.value })}
              placeholder="http://100.x.x.x:8765"
              className={cn(inputCls, "font-orbitron", urlBad ? badBorder : okBorder)}
            />
          </Field>
          <NotebookPicker value={conn.bridge.url} onPick={(u) => setBridge({ url: u })} need="serial-ports" />
          {!saved.tokenConfigured && (
            <Notice>서버가 브릿지 토큰을 만들지 못했어요. 서버 data 폴더에 쓸 수 있는지 확인하고 서버를 다시 켜세요.</Notice>
          )}
        </Card>
      )}

      {serial && (
        <Card
          title="COM 포트"
          hint="USB-RS232 케이블을 노트북에 꽂으면 목록에 나타나요. 속도는 대부분 9600bps 예요."
          action={
            nowPort ? (
              <Badge tone="good">
                노트북 설정 {nowPort.port} · {nowPort.baud}bps
              </Badge>
            ) : (
              <Badge tone="off">아직 안 골랐어요</Badge>
            )
          }
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field label="포트 (노트북에 꽂힌 것)" className="min-w-[260px] flex-1">
              <select
                value={port}
                onChange={(e) => setPort(e.target.value)}
                disabled={!ports || ports.length === 0}
                className={cn(inputCls, okBorder, "cursor-pointer")}
              >
                <option value="">
                  {!ports ? "'불러오기'를 누르세요" : ports.length ? "포트 고르기" : "꽂힌 USB-RS232 가 없어요"}
                </option>
                {ports?.map((p) => (
                  <option key={p.port} value={p.port}>
                    {p.port} · {p.chip || p.description || "시리얼"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="속도 (bps)" className="w-[130px]">
              <select
                value={baud}
                onChange={(e) => setBaud(Number(e.target.value))}
                className={cn(inputCls, okBorder, "cursor-pointer font-orbitron")}
              >
                {BAUDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
            <ActionButton icon={<RefreshCw size={14} />} busy={portsBusy} onClick={loadPorts} disabled={urlBad}>
              불러오기
            </ActionButton>
            <ActionButton onClick={applyPort} disabled={!port || urlBad}>
              이 포트로
            </ActionButton>
          </div>
          <p className="-mt-1 font-pretendard text-xs text-white/30">
            속도를 모르면 9600 → 19200 → 38400 → 57600 → 115200 순으로 바꿔 가며 아래 &apos;보내 보기&apos;를 해 보세요.
          </p>
          <Notice tone="info">
            이 학교 매트릭스의 RS-232 는 <b>DB9 수(핀)</b> 예요. USB-RS232 케이블(수)과 사이에 <b>암-암 스트레이트(1:1)
            젠더</b>를 끼워야 해요. 같은 계열 매뉴얼 기준으로 스트레이트가 맞고, 안 되면 크로스(널모뎀) 젠더로 바꿔
            보세요.
          </Notice>
        </Card>
      )}

      {serial && (
        <Card
          title="명령 문법"
          hint="입력 → 출력 전환 명령이에요. 명령표가 있으면 그대로 적고, 없으면 '문법 찾기'로 하나씩 보내 보세요."
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field
              label="명령 틀"
              hint="{input} {output} 자리에 번호가 들어가요. 두 자리면 {input:02d}"
              className="min-w-[240px] flex-1"
            >
              <input
                value={conn.protocol.route}
                onChange={(e) => setProto({ route: e.target.value })}
                spellCheck={false}
                className={cn(inputCls, "font-mono", tplProblem ? badBorder : okBorder)}
              />
            </Field>
            <Field label="끝 문자" className="w-[170px]">
              <select
                value={conn.protocol.terminator}
                onChange={(e) => setProto({ terminator: e.target.value as Terminator })}
                className={cn(inputCls, okBorder, "cursor-pointer")}
              >
                {TERMINATORS.map((t) => (
                  <option key={t.label} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="응답 확인 (선택)" hint="예: OK — 비우면 응답을 기다리지 않아요" className="w-[210px]">
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
            <Field label="입력 (소스)" className="w-[190px]">
              <select
                value={tryIn}
                onChange={(e) => setTryIn(Number(e.target.value))}
                className={cn(inputCls, okBorder, "cursor-pointer")}
              >
                {state.inputs.map((i) => (
                  <option key={i.no} value={i.no}>
                    IN {i.no} · {i.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="출력 (화면)" className="w-[190px]">
              <select
                value={tryOut}
                onChange={(e) => setTryOut(Number(e.target.value))}
                className={cn(inputCls, okBorder, "cursor-pointer")}
              >
                {state.outputs.map((o) => (
                  <option key={o.no} value={o.no}>
                    OUT {o.no} · {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <span className="font-mbc text-[13px] text-white/55">보낼 명령</span>
              <code className="flex h-10 items-center overflow-x-auto whitespace-nowrap rounded-lg border border-white/10 bg-black/40 px-3 font-mono text-sm text-[#9dffc1]">
                {tplProblem ? "-" : visible(renderRoute(route, tryIn, tryOut) + conn.protocol.terminator)}
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
          <p className="-mt-2 font-pretendard text-xs text-amber-200/70">
            실제 화면이 바뀌어요 — 행사 중에는 하지 마세요. 매트릭스 앞면 LCD 나 &lsquo;{outputName}&rsquo; 화면이
            &lsquo;{inputName}&rsquo; 으로 바뀌는지 보세요.
          </p>
          {last && <SentResult last={last} />}

          {/* 문법 찾기 — 명령표가 없을 때 후보를 하나씩 */}
          <button
            type="button"
            onClick={() => setFinder((v) => !v)}
            className="self-start font-mbc text-sm text-white/55 transition-colors hover:text-white"
          >
            문법 찾기 (명령표가 없을 때) {finder ? "▲" : "▼"}
          </button>
          {finder && (
            <div className="flex flex-col gap-2.5">
              <p className="font-pretendard text-xs leading-relaxed text-white/45">
                위에서 고른 <b className="text-white/70">입력 {tryIn} → 출력 {tryOut}</b> 을 후보마다 보내요. 매트릭스
                LCD(또는 출력 {tryOut} 화면)가 입력 {tryIn} 으로 바뀌면 <b className="text-white/70">이걸로</b>를
                누르세요. 끝까지 안 되면 끝 문자나 속도를 바꿔서 다시 해 보세요.
              </p>
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
        <Card
          title="현재 상태 읽기 (선택)"
          hint="장비가 지금 라우팅을 알려 주면 화면에 '추정 상태' 대신 실제 상태가 나와요. 지원하지 않는 장비도 많아서 비워 둬도 괜찮아요."
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field label="조회 명령" hint="예: Status." className="w-[180px]">
              <input
                value={conn.protocol.query}
                onChange={(e) => setProto({ query: e.target.value })}
                placeholder="(안 씀)"
                spellCheck={false}
                className={cn(inputCls, "font-mono", qProblem ? badBorder : okBorder)}
              />
            </Field>
            <Field
              label="응답 해석 규칙"
              hint="(?P<input>…) 과 (?P<output>…) 이 있어야 해요"
              className="min-w-[280px] flex-1"
            >
              <input
                value={conn.protocol.queryRegex}
                onChange={(e) => setProto({ queryRegex: e.target.value })}
                placeholder="(안 씀)"
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
          <p className="font-pretendard text-xs text-white/30">
            넣고 <b>연결 시험</b>을 누르면 조회가 되는지 함께 확인해요. 해석에 실패하면 그대로 비우면 됩니다.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#161616]/90 px-5 py-3">
        <ActionButton icon={<PlugZap size={15} />} busy={testing} onClick={runTest} disabled={!canSubmit}>
          연결 시험
        </ActionButton>
        <span className="font-pretendard text-xs text-white/35">노트북·COM 포트까지 확인해요. 화면은 바꾸지 않아요.</span>
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
          <span className="font-pretendard text-white/40">
            없음 — 응답을 안 주는 장비도 많아요. 화면이 바뀌었는지로 판단하세요.
          </span>
        )}
      </p>
      {last.matched !== null && (
        <p className={cn("font-pretendard text-xs", last.matched ? "text-[#9dffc1]" : "text-amber-200")}>
          {last.matched ? "응답 확인 통과" : "응답이 '응답 확인' 패턴과 달라요"}
        </p>
      )}
    </div>
  );
}
