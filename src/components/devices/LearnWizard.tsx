"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Crosshair, RadioTower, Wifi, X } from "lucide-react";
import { toast } from "@/components/common/Toast";
import { SPEAKER_MATRIX_KEY } from "@/hooks/useSpeakerMatrix";
import { learnApi, type LearnResult, type LearnStatus } from "@/lib/learnApi";
import { cn } from "@/lib/utils";

/** 장비 배우기 마법사 — 제조사 프로그램을 따라 누르며 신호를 캡처하고, 규칙을 찾아 연결한다.
 *  (docs/any-school.md: 캡처 → 문법 추론 → 템플릿 적용) */

type Phase = "intro" | "capture" | "review";

const input =
  "h-10 rounded-lg border border-white/10 bg-[#141414] px-3 font-pretendard text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none";

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
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22000);
  const [zones, setZones] = useState(16);
  const [cols, setCols] = useState(16);

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
      toast.error("스피커 선택기(장비) 주소를 입력하세요.");
      return;
    }
    const s = await run(() => learnApi.start({ host: host.trim(), port, zones, cols }), "중계를 시작했습니다.");
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
        <div className="flex flex-col gap-6">
          <p className="max-w-[64ch] font-pretendard text-sm leading-relaxed text-white/60">
            방송실 스피커 선택기와 <b className="text-white/80">같은 네트워크</b>에 있어야 합니다. 시작하면 이 PC가
            제조사 프로그램과 장비 사이에 서서, 오가는 신호를 기록합니다. 제조사 프로그램은 평소처럼 동작합니다.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-mbc text-xs text-white/40">스피커 선택기 주소 (IP)</span>
              <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.0.200" className={cn(input, "font-orbitron")} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mbc text-xs text-white/40">포트</span>
              <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className={cn(input, "font-orbitron")} />
            </label>
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
              중계 시작
            </button>
          </div>
        </div>
      )}

      {phase === "capture" && status && (
        <div className="flex flex-col gap-5">
          {/* 제조사 프로그램에 적을 주소 */}
          <div className="flex flex-col gap-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-5 py-4">
            <span className="font-mbc text-xs text-sky-200/70">제조사 프로그램의 ‘장비 주소’를 아래로 바꾸세요</span>
            <div className="flex flex-wrap items-center gap-2">
              {(status.localIps.length ? status.localIps : ["이 PC의 IP"]).map((ip) => (
                <code key={ip} className="rounded-lg bg-black/50 px-3 py-1.5 font-orbitron text-sm text-white">
                  {ip}:{status.listenPort}
                </code>
              ))}
              <span
                className={cn(
                  "ml-1 flex items-center gap-1.5 font-pretendard text-xs",
                  status.connections > 0 ? "text-emerald-300" : "text-white/40",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", status.connections > 0 ? "bg-emerald-400 shadow-[0_0_8px_#00FF57]" : "bg-white/25")} />
                {status.connections > 0 ? "프로그램 연결됨" : "프로그램 연결 대기"}
              </span>
            </div>
          </div>

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
