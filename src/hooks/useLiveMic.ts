import { useCallback, useEffect, useRef, useState } from "react";
import { backendWs } from "@/lib/backend";
import { micErrorMessage, openMic, startPcmCapture, stopStream, type PcmCapture } from "@/lib/micCapture";
import { toast } from "@/components/common/Toast";

/**
 * 실시간 마이크 방송 (WS /api/broadcast/live).
 * idle → connecting(마이크·연결·스피커 켜기·딩동댕) → live(소리 보냄) → stopping(끝음·스피커 되돌림) → idle
 */
export type LiveState = "idle" | "connecting" | "live" | "stopping";

const CLOSE_MESSAGES: Record<number, string> = {
  4403: "마이크 방송 권한이 없어요",
  4400: "마이크 방송 요청이 잘못됐어요",
  4409: "다른 방송이 진행 중이에요",
  4503: "서버 소리 장치를 쓸 수 없어요",
  4500: "마이크 방송을 시작하지 못했어요",
};
const STOP_WAIT_MS = 10_000;
/** 망이 막혀 소리가 이만큼 밀리면 새 조각은 버린다 (지연이 계속 늘지 않게) */
const MAX_BUFFERED_BYTES = 96_000;

function endedMessage(reason: string, maxSeconds: number, fallback: string): string {
  if (reason === "idle") return "소리가 오지 않아 끝났어요";
  if (reason === "max") return `${Math.round(maxSeconds / 60)}분이 지나 끝났어요`;
  if (reason === "stop") return "마이크 방송을 마쳤어요";
  return fallback || "마이크 방송이 끝났어요";
}

export function useLiveMic() {
  const [state, setState] = useState<LiveState>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const stateRef = useRef<LiveState>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureRef = useRef<PcmCapture | null>(null);
  const onairRef = useRef(false);
  const maxRef = useRef(600);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const framesRef = useRef(0);

  const set = (s: LiveState) => {
    stateRef.current = s;
    setState(s);
  };

  const cleanup = useCallback(() => {
    onairRef.current = false;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    captureRef.current?.close();
    captureRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close(1000);
    }
    setAnalyser(null);
    setStartedAt(null);
    set("idle");
  }, []);

  const start = useCallback(
    async (opts: { targets: string[]; effect: string; chime: boolean }) => {
      if (stateRef.current !== "idle") return;
      set("connecting");
      framesRef.current = 0;
      let stream: MediaStream;
      try {
        stream = await openMic();
      } catch (e) {
        toast.error(micErrorMessage(e));
        cleanup();
        return;
      }
      if ((stateRef.current as LiveState) !== "connecting") {
        stopStream(stream);
        return;
      }
      streamRef.current = stream;

      let capture: PcmCapture;
      try {
        capture = await startPcmCapture(stream, (buf) => {
          const ws = wsRef.current;
          // ON AIR 뒤 · 끝내기 전까지만 보낸다
          if (stateRef.current !== "live" || !onairRef.current || !ws || ws.readyState !== WebSocket.OPEN) return;
          if (ws.bufferedAmount > MAX_BUFFERED_BYTES) return;
          ws.send(buf);
          framesRef.current += 1;
        });
      } catch {
        toast.error("마이크 소리를 처리하지 못했어요");
        cleanup();
        return;
      }
      captureRef.current = capture;
      setAnalyser(capture.analyser);

      let errorShown = false;
      const ws = new WebSocket(backendWs("/api/broadcast/live"));
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "start",
            targets: opts.targets,
            sampleRate: capture.sampleRate,
            effect: opts.effect,
            chime: opts.chime,
          }),
        );
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data !== "string") return;
        let msg: { type?: string; message?: string; reason?: string; warning?: string; maxSeconds?: number };
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === "onair") {
          if (typeof msg.maxSeconds === "number") maxRef.current = msg.maxSeconds;
          onairRef.current = true;
          setStartedAt(Date.now());
          if (stateRef.current === "connecting") set("live");
          else if (stateRef.current === "stopping") ws.send(JSON.stringify({ type: "stop" }));
        } else if (msg.type === "ended") {
          const reason = msg.reason ?? "stop";
          const text = endedMessage(reason, maxRef.current, msg.message ?? "");
          if (reason === "stop") toast.success(text);
          else toast.info(text);
          if (msg.warning) toast.error(msg.warning);
          cleanup();
        } else if (msg.type === "error") {
          errorShown = true;
          toast.error(msg.message || "마이크 방송을 시작하지 못했어요");
        }
      };
      ws.onclose = (ev) => {
        if (wsRef.current !== ws) return;
        if (!errorShown) {
          const known = CLOSE_MESSAGES[ev.code];
          if (known) toast.error(known);
          else if (onairRef.current) toast.error("연결이 끊겨 마이크 방송이 끝났어요");
          else if (stateRef.current === "connecting") toast.error("서버에 연결하지 못했어요");
        }
        cleanup();
      };
    },
    [cleanup],
  );

  const stop = useCallback(() => {
    const ws = wsRef.current;
    const s = stateRef.current;
    if (s === "idle" || s === "stopping") return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      cleanup();
      return;
    }
    set("stopping");
    // 아직 ON AIR 전이면(스피커 켜는 중) onair 를 받자마자 stop 을 보낸다 — 지금 보내면 서버가 무시한다
    if (onairRef.current) ws.send(JSON.stringify({ type: "stop" }));
    stopTimer.current = setTimeout(() => {
      if (wsRef.current === ws) cleanup();
    }, STOP_WAIT_MS + (onairRef.current ? 0 : 15_000));
  }, [cleanup]);

  // 화면을 떠나면 정리 — 서버는 끊김을 멈춤으로 보고 스피커를 되돌린다
  useEffect(() => () => cleanup(), [cleanup]);

  return { state, startedAt, analyser, start, stop, frames: framesRef };
}
