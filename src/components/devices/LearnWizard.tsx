"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Crosshair, RadioTower, Wifi, X } from "lucide-react";
import { toast } from "@/components/common/Toast";
import { SPEAKER_MATRIX_KEY } from "@/hooks/useSpeakerMatrix";
import {
  learnApi,
  type LearnMode,
  type LearnResult,
  type LearnStatus,
  type LearnTransport,
  type SerialPortInfo,
} from "@/lib/learnApi";
import { cn } from "@/lib/utils";

/** 장비 배우기 마법사 — 제조사 프로그램을 따라 누르며 신호를 캡처하고, 규칙을 찾아 연결한다.
 *  (docs/any-school.md: 캡처 → 문법 추론 → 템플릿 적용) */

type Phase = "intro" | "capture" | "review";

const input =
  "h-10 rounded-lg border border-white/10 bg-[#141414] px-3 font-pretendard text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none";

/** 신호를 보는 세 가지 길 — 학교 장비가 어떻게 붙어 있느냐에 따라 고른다 */
const MODES: { key: LearnMode; title: string; hint: string }[] = [
  { key: "tcp", title: "랜으로 중계", hint: "제조사 프로그램이 IP로 장비에 붙을 때 (가장 쉬움)" },
  { key: "serial", title: "시리얼로 중계", hint: "프로그램이 COM 포트로 붙을 때 (com0com 필요)" },
  { key: "manual", title: "직접 붙여넣기", hint: "중계를 못 끼울 때 — 딴 패킷을 단계마다 넣기" },
];

const MODE_NOTE: Record<LearnMode, string> = {
  tcp: "시작하면 이 PC가 제조사 프로그램과 장비 사이에 섭니다. 프로그램의 ‘장비 주소’를 화면에 뜨는 이 PC 주소로 바꾸면, 프로그램은 평소처럼 동작하고 ONAIR는 오가는 신호를 기록합니다.",
  serial:
    "com0com 으로 가상 COM 포트 쌍(예: COM10 ↔ COM11)을 만들고, 제조사 프로그램의 포트를 COM10으로 바꿉니다. ONAIR가 COM11을 잡아 장비의 진짜 COM 포트로 넘기면서 기록합니다.",
  manual:
    "중계를 못 끼울 때 쓰는 길입니다. 와이어샤크·스위치 미러링·제조사 프로그램 로그·장비 매뉴얼에서 얻은 패킷을 단계마다 16진수로 붙여넣으면, 규칙 찾기는 똑같이 동작합니다.",
};

function Shell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1C] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <RadioTower size={18} className="text-red-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">새 장비 배우기</h2>
              <p className="mt-0.5 font-pretendard text-xs text-white/40">
                제조사 프로그램을 따라 누르면 ONAIR가 스피커 선택기의 신호를 배웁니다
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function StepDots({ phase }: { phase: Phase }) {
  const steps: { key: Phase; label: string }[] = [
    { key: "intro", label: "연결" },
    { key: "capture", label: "캡처" },
    { key: "review", label: "확인·적용" },
  ];
  const idx = steps.findIndex((s) => s.key === phase);
  return (
    <div className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full font-orbitron text-[11px] transition-colors",
              i < idx
                ? "bg-emerald-500/80 text-black"
                : i === idx
                  ? "bg-red-500 text-white"
                  : "bg-white/10 text-white/40",
            )}
          >
            {i < idx ? <Check size={13} /> : i + 1}
          </span>
          <span className={cn("font-mbc text-sm", i === idx ? "text-white" : "text-white/40")}>{s.label}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-8 bg-white/10" />}
        </div>
      ))}
    </div>
  );
}

export default function LearnWizard({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>("intro");
  const [busy, setBusy] = useState(false);

  // intro 입력
  const [mode, setMode] = useState<LearnMode>("tcp");
  const [transport, setTransport] = useState<LearnTransport>("tcp");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22000);
  const [zones, setZones] = useState(16);
  const [cols, setCols] = useState(16);
  const [listenSerial, setListenSerial] = useState("");
  const [baud, setBaud] = useState(9600);
  const [ports, setPorts] = useState<SerialPortInfo[] | null>(null);
  const [paste, setPaste] = useState("");

  // 시리얼(장비가 COM 으로 붙는 학교) 이거나 manual 이면서 시리얼로 보낼 때
  const useSerial = mode === "serial" || (mode === "manual" && transport === "serial");

  const loadPorts = async () => {
    const r = await run(() => learnApi.serialPorts());
    if (r) {
      setPorts(r.ports);
      if (!host.trim() && r.ports[0]) setHost(r.ports[0].port);
    }
  };

  const [status, setStatus] = useState<LearnStatus | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [result, setResult] = useState<LearnResult | null>(null);
  const startedRef = useRef(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    setBusy(true);
    try {
      const r = await fn();
      if (ok) toast.success(ok);
      return r;
    } catch (e) {
      toast.error((e as Error).message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  // 캡처 단계에서 상태를 주기적으로 갱신 (연결·캡처 수 표시)
  useEffect(() => {
    if (phase !== "capture") return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await learnApi.status();
        if (alive && s.active) setStatus(s);
      } catch {
        /* 다음 주기 */
      }
    };
    const id = setInterval(tick, 1200);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [phase]);

  // 마법사를 닫으면 세션 정리
  useEffect(
    () => () => {
      if (startedRef.current) void learnApi.stop().catch(() => {});
    },
    [],
  );

  const begin = async () => {
    if (!host.trim()) {
      toast.error(useSerial ? "장비가 붙은 COM 포트를 입력하세요 (예: COM3)." : "스피커 선택기(장비) 주소를 입력하세요.");
      return;
    }
    if (mode === "serial" && !listenSerial.trim()) {
      toast.error("제조사 프로그램이 붙을 가상 COM 포트를 입력하세요 (예: COM11).");
      return;
    }
    const s = await run(
      () =>
        learnApi.start({
          mode,
          transport: mode === "manual" ? transport : undefined,
          host: host.trim(),
          port: useSerial ? undefined : port,
          zones,
          cols,
          listenSerial: mode === "serial" ? listenSerial.trim() : undefined,
          baud: useSerial ? baud : undefined,
        }),
      mode === "manual" ? "붙여넣기 모드로 시작했습니다." : "중계를 시작했습니다.",
    );
    if (!s) return;
    startedRef.current = true;
    setStatus(s);
    setStepIdx(0);
    await learnApi.mark(s.steps[0].label).catch(() => {});
    setPhase("capture");
  };

  const steps = status?.steps ?? [];
  const step = steps[stepIdx];
  const captured = status?.captured ?? {};
  const capturedHere = step ? (captured[step.label] ?? 0) > 0 : false;

  const goStep = async (i: number) => {
    const s = steps[i];
    if (!s) return;
    setStepIdx(i);
    await learnApi.mark(s.label).catch(() => {});
  };

  const addPacket = async () => {
    const s = steps[stepIdx];
    if (!s) return;
    const next = await run(() => learnApi.packet(s.label, paste), "이 단계에 넣었습니다.");
    if (!next) return;
    setStatus(next);
    setPaste("");
  };

  const finishCapture = async () => {
    const r = await run(() => learnApi.result());
    if (!r) return;
    setResult(r);
    setPhase("review");
  };

  const apply = async () => {
    const r = await run(() => learnApi.apply(), "이 장비로 연결했습니다.");
    if (!r) return;
    startedRef.current = false;
    qc.invalidateQueries({ queryKey: SPEAKER_MATRIX_KEY });
    qc.invalidateQueries({ queryKey: ["speakerConnection"] });
    onClose();
  };

  return (
    <Shell onClose={onClose}>
      <StepDots phase={phase} />

      {phase === "intro" && (
        <div className="flex flex-col gap-5">
          {/* 어떤 방법으로 신호를 볼 것인가 */}
          <div className="grid grid-cols-3 gap-3">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={mode === m.key}
                onClick={() => setMode(m.key)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors",
                  mode === m.key
                    ? "border-red-500/55 bg-red-500/10"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06]",
                )}
              >
                <span className="font-mbc text-[15px] text-white">{m.title}</span>
                <span className="font-pretendard text-xs leading-relaxed text-white/45">{m.hint}</span>
              </button>
            ))}
          </div>
          <p className="max-w-[70ch] font-pretendard text-sm leading-relaxed text-white/55">{MODE_NOTE[mode]}</p>

          <div className="grid grid-cols-2 gap-4">
            {mode === "manual" && (
              <label className="col-span-2 flex flex-col gap-1.5">
                <span className="font-mbc text-xs text-white/40">배운 뒤 ONAIR가 장비에 보낼 방법</span>
                <select
                  value={transport}
                  onChange={(e) => setTransport(e.target.value as LearnTransport)}
                  className={cn(input, "cursor-pointer")}
                >
                  <option value="tcp">랜 · TCP</option>
                  <option value="udp">랜 · UDP</option>
                  <option value="serial">시리얼 (COM 포트)</option>
                </select>
              </label>
            )}

            {useSerial ? (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mbc text-xs text-white/40">장비가 붙은 COM 포트</span>
                  <div className="flex gap-2">
                    <input
                      list="learn-com-ports"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="COM3"
                      className={cn(input, "min-w-0 flex-1 font-orbitron")}
                    />
                    <datalist id="learn-com-ports">
                      {(ports ?? []).map((p) => (
                        <option key={p.port} value={p.port}>
                          {p.chip || p.description}
                        </option>
                      ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={loadPorts}
                      disabled={busy}
                      className="h-10 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 font-mbc text-sm text-white/70 hover:bg-white/10 disabled:opacity-40"
                    >
                      목록
                    </button>
                  </div>
                  {ports && (
                    <span className="font-pretendard text-xs text-white/30">
                      {ports.length ? ports.map((p) => p.port).join(" · ") : "이 PC에 COM 포트가 없어요"}
                    </span>
                  )}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mbc text-xs text-white/40">통신 속도 (bps)</span>
                  <select
                    value={baud}
                    onChange={(e) => setBaud(Number(e.target.value))}
                    className={cn(input, "cursor-pointer font-orbitron")}
                  >
                    {[9600, 19200, 38400, 57600, 115200, 4800, 2400].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
                {mode === "serial" && (
                  <label className="col-span-2 flex flex-col gap-1.5">
                    <span className="font-mbc text-xs text-white/40">제조사 프로그램이 붙을 가상 COM 포트</span>
                    <input
                      value={listenSerial}
                      onChange={(e) => setListenSerial(e.target.value)}
                      placeholder="COM11"
                      className={cn(input, "font-orbitron")}
                    />
                    <span className="font-pretendard text-xs text-white/30">
                      com0com 으로 가상 포트 쌍(예: COM10 ↔ COM11)을 만든 뒤, 제조사 프로그램은 COM10, ONAIR는 COM11로.
                    </span>
                  </label>
                )}
              </>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mbc text-xs text-white/40">스피커 선택기 주소 (IP)</span>
                  <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.0.200" className={cn(input, "font-orbitron")} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mbc text-xs text-white/40">포트</span>
                  <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className={cn(input, "font-orbitron")} />
                </label>
              </>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="font-mbc text-xs text-white/40">구역(스피커) 개수</span>
              <input type="number" min={1} max={256} value={zones} onChange={(e) => setZones(Number(e.target.value))} className={cn(input, "font-orbitron")} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mbc text-xs text-white/40">한 줄에 놓을 개수(열)</span>
              <input type="number" min={1} max={64} value={cols} onChange={(e) => setCols(Number(e.target.value))} className={cn(input, "font-orbitron")} />
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="h-11 rounded-xl px-4 font-mbc text-sm text-white/50 hover:bg-white/5 hover:text-white">
              취소
            </button>
            <button
              type="button"
              onClick={begin}
              disabled={busy || !host.trim()}
              className="flex h-11 items-center gap-2 rounded-xl border border-red-500/50 bg-red-500/15 px-5 font-mbc text-red-100 transition-colors hover:bg-red-500/25 disabled:opacity-40"
            >
              <Wifi size={16} />
              {mode === "manual" ? "붙여넣기 시작" : "중계 시작"}
            </button>
          </div>
        </div>
      )}

      {phase === "capture" && status && (
        <div className="flex flex-col gap-5">
          {/* 제조사 프로그램에 적을 주소 (중계일 때만) */}
          {status.mode !== "manual" && (
            <div className="flex flex-col gap-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-5 py-4">
              <span className="font-mbc text-xs text-sky-200/70">
                {status.mode === "serial"
                  ? "제조사 프로그램의 ‘포트’를 아래 가상 COM 포트로 바꾸세요"
                  : "제조사 프로그램의 ‘장비 주소’를 아래로 바꾸세요"}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {status.mode === "serial" ? (
                  <code className="rounded-lg bg-black/50 px-3 py-1.5 font-orbitron text-sm text-white">
                    {status.serial?.listen} · {status.serial?.baud}bps
                  </code>
                ) : (
                  (status.localIps.length ? status.localIps : ["이 PC의 IP"]).map((ip) => (
                    <code key={ip} className="rounded-lg bg-black/50 px-3 py-1.5 font-orbitron text-sm text-white">
                      {ip}:{status.listenPort}
                    </code>
                  ))
                )}
                <span
                  className={cn(
                    "ml-1 flex items-center gap-1.5 font-pretendard text-xs",
                    status.connections > 0 ? "text-emerald-300" : "text-white/40",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", status.connections > 0 ? "bg-emerald-400 shadow-[0_0_8px_#00FF57]" : "bg-white/25")} />
                  {status.connections > 0
                    ? status.mode === "serial"
                      ? "포트 열림"
                      : "프로그램 연결됨"
                    : status.mode === "serial"
                      ? "포트 여는 중"
                      : "프로그램 연결 대기"}
                </span>
                {status.mode === "serial" && (
                  <span className="font-pretendard text-xs text-white/35">
                    장비 쪽: {status.serial?.target}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 직접 붙여넣기 */}
          {status.mode === "manual" && (
            <div className="flex flex-col gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-5 py-4">
              <span className="font-mbc text-xs text-amber-200/80">
                이 단계의 패킷을 16진수로 붙여넣으세요 (예: 02 2d 00 01 … )
              </span>
              <div className="flex gap-2">
                <input
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addPacket();
                  }}
                  placeholder="02 2d 00 …"
                  spellCheck={false}
                  className={cn(input, "min-w-0 flex-1 font-mono")}
                />
                <button
                  type="button"
                  onClick={addPacket}
                  disabled={busy || !paste.trim()}
                  className="h-10 shrink-0 rounded-lg border border-amber-400/40 bg-amber-400/15 px-4 font-mbc text-sm text-amber-100 hover:bg-amber-400/25 disabled:opacity-40"
                >
                  이 단계에 넣기
                </button>
              </div>
              <span className="font-pretendard text-xs text-white/35">
                띄어쓰기·줄바꿈·0x 는 알아서 걸러요. 단계를 옮기려면 아래 번호를 누르세요.
              </span>
            </div>
          )}

          {/* 현재 단계 */}
          <div className="flex items-center gap-4 rounded-xl border border-red-400/30 bg-red-400/10 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500 font-orbitron text-sm text-white">
              {stepIdx + 1}
            </span>
            <p className="flex-1 font-mbc text-[15px] text-white">{step?.title}</p>
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 font-pretendard text-xs",
                capturedHere ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-white/40",
              )}
            >
              {capturedHere ? <Check size={13} /> : <Crosshair size={13} className="animate-pulse" />}
              {capturedHere ? "잡힘" : "대기"}
            </span>
          </div>

          {/* on 단계면 교실 이름 */}
          {step?.zone != null && (
            <label className="flex items-center gap-3 pl-1">
              <span className="font-mbc text-sm text-white/50">이 구역 이름</span>
              <input
                defaultValue={status.names[String(step.zone)] ?? ""}
                key={step.zone}
                onBlur={(e) => learnApi.name(step.zone as number, e.target.value).catch(() => {})}
                placeholder="예: 1-3, 강당, 교무실"
                className={cn(input, "w-52")}
              />
              <span className="font-pretendard text-xs text-white/30">비워도 나중에 캘리브레이션으로 매길 수 있어요</span>
            </label>
          )}

          {/* 단계 진행 막대 */}
          <div className="flex flex-wrap gap-1.5">
            {steps.map((s, i) => {
              const done = (captured[s.label] ?? 0) > 0;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => goStep(i)}
                  title={s.title}
                  className={cn(
                    "h-7 min-w-7 rounded-md px-1.5 font-orbitron text-[11px] transition-colors",
                    i === stepIdx
                      ? "bg-red-500 text-white"
                      : done
                        ? "bg-emerald-500/25 text-emerald-200"
                        : "bg-white/[0.06] text-white/40 hover:bg-white/10",
                  )}
                >
                  {s.label === "all_off" ? "OFF" : s.label === "all_on" ? "ALL" : s.zone}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => goStep(Math.max(0, stepIdx - 1))}
              disabled={stepIdx === 0}
              className="h-11 rounded-xl px-4 font-mbc text-sm text-white/50 hover:bg-white/5 hover:text-white disabled:opacity-30"
            >
              이전
            </button>
            {stepIdx < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => goStep(stepIdx + 1)}
                className="h-11 rounded-xl border border-white/15 bg-white/10 px-6 font-mbc text-white hover:bg-white/15"
              >
                다음 단계
              </button>
            ) : (
              <button
                type="button"
                onClick={finishCapture}
                disabled={busy}
                className="h-11 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-6 font-mbc text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40"
              >
                규칙 찾기
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "review" && result && (
        <div className="flex flex-col gap-5">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border px-5 py-4",
              result.template.mode === "bitmap"
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-amber-500/30 bg-amber-500/10",
            )}
          >
            <span className={cn("h-2.5 w-2.5 rounded-full", result.template.mode === "bitmap" ? "bg-emerald-400" : "bg-amber-400")} />
            <p className="font-mbc text-[15px] text-white">
              {result.template.mode === "bitmap"
                ? "규칙을 찾았어요 — 어떤 조합이든 계산해서 켤 수 있습니다"
                : "규칙은 못 찾았지만 녹화 재생으로 켤 수 있습니다"}
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-[#0a0a0a] px-5 py-4">
            <span className="font-mbc text-xs text-white/40">찾은 내용</span>
            <ul className="mt-2 flex flex-col gap-1.5">
              {result.report.map((line, i) => (
                <li key={i} className="flex gap-2 font-pretendard text-sm text-white/70">
                  <span className="text-white/25">·</span>
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={cn("rounded-full px-2.5 py-0.5", result.checks.single ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-white/40")}>
                {result.checks.single ? "구역별 재현 확인" : "구역별 재현 미확인"}
              </span>
              {result.checks.combo !== null && (
                <span className={cn("rounded-full px-2.5 py-0.5", result.checks.combo ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300")}>
                  {result.checks.combo ? "조합 규칙 확인" : "조합은 별도 명령일 수 있음"}
                </span>
              )}
              {result.missingZones.length > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-amber-300">
                  캡처 안 된 구역 {result.missingZones.length}개
                </span>
              )}
            </div>
          </div>

          <p className="font-pretendard text-sm text-white/50">
            적용하면 스피커 연결이 이 장비로 바뀌고, 적어 둔 교실 이름이 매핑에 저장됩니다. 이름을 비워 둔 구역은
            <b className="text-white/70"> 스피커 매핑</b>에서 소리를 들으며 마저 매길 수 있어요.
          </p>

          <div className="flex justify-between">
            <button type="button" onClick={() => setPhase("capture")} className="h-11 rounded-xl px-4 font-mbc text-sm text-white/50 hover:bg-white/5 hover:text-white">
              캡처로 돌아가기
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={busy}
              className="h-11 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-6 font-mbc text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40"
            >
              이 장비로 연결
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
