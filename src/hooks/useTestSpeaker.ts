import { useCallback, useEffect, useRef, useState } from "react";
import { backendBase, backendWs } from "@/lib/backend";

/**
 * 시험 스피커 듣기 (WS /api/test-speaker/listen — 서버 docs/test-speaker.md).
 * 학교 스피커 대신 이 기기에서 방송 소리를 낸다: 켜짐·꺼짐, 방송 음원(받아서 틀기), 실시간 마이크 PCM.
 * 브라우저는 사용자가 한 번 눌러야 소리를 낼 수 있어서 enable() 을 버튼에서 부른다. 끊기면 저절로 다시 붙는다.
 */

export type TestSpeakerConn = "connecting" | "open" | "retry" | "denied";
export type TestSpeakerPlaying = "idle" | "clip" | "mic";

export interface TestSpeakerEvent {
  at: number;
  text: string;
}

type ServerMsg = {
  type?: string;
  on?: boolean;
  id?: string;
  url?: string;
  seconds?: number;
  rate?: number;
  message?: string;
};

const RETRY_MS = [1000, 2000, 4000, 8000];
const PING_MS = 20_000;
const PCM_LEAD_S = 0.12;
const PCM_MAX_AHEAD_S = 0.6;
const EVENTS_MAX = 8;

function dbOf(peak: number): number | null {
  return peak > 0.00003 ? 20 * Math.log10(peak) : null;
}

export function useTestSpeaker() {
  const [conn, setConn] = useState<TestSpeakerConn>("connecting");
  const [on, setOn] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState<TestSpeakerPlaying>("idle");
  const [level, setLevel] = useState<number | null>(null);
  const [events, setEvents] = useState<TestSpeakerEvent[]>([]);

  const ctxRef = useRef<AudioContext | null>(null);
  const outRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const clipsRef = useRef(new Map<string, Promise<ArrayBuffer | null>>());
  const decodedRef = useRef(new Map<string, AudioBuffer>());
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const pcmRef = useRef<{ rate: number; next: number }>({ rate: 48000, next: 0 });

  const note = useCallback((text: string) => {
    setEvents((prev) => [{ at: Date.now(), text }, ...prev].slice(0, EVENTS_MAX));
  }, []);

  // ---------------- 소리 ----------------
  const fetchClip = useCallback((id: string, url: string) => {
    const have = clipsRef.current.get(id);
    if (have) return have;
    const p = fetch(`${backendBase()}${url}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
    clipsRef.current.set(id, p);
    // 오래된 음원은 버린다
    if (clipsRef.current.size > 6) {
      const first = clipsRef.current.keys().next().value;
      if (first) {
        clipsRef.current.delete(first);
        decodedRef.current.delete(first);
      }
    }
    return p;
  }, []);

  const stopClip = useCallback(() => {
    const s = sourceRef.current;
    sourceRef.current = null;
    if (s) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* 이미 멈춤 */
      }
    }
  }, []);

  const playClip = useCallback(
    async (id: string, url: string, receivedAt: number) => {
      const ctx = ctxRef.current;
      const out = outRef.current;
      if (!ctx || !out) return;
      let buf = decodedRef.current.get(id);
      if (!buf) {
        const raw = await fetchClip(id, url);
        if (!raw) return;
        try {
          buf = await ctx.decodeAudioData(raw.slice(0));
        } catch {
          return;
        }
        decodedRef.current.set(id, buf);
      }
      stopClip();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(out);
      // 받아 오느라 늦었으면 그만큼 앞을 건너뛰어 서버 시간과 맞춘다
      const late = Math.max(0, (performance.now() - receivedAt) / 1000);
      if (late >= buf.duration) return;
      src.onended = () => {
        if (sourceRef.current === src) {
          sourceRef.current = null;
          setPlaying((p) => (p === "clip" ? "idle" : p));
        }
      };
      sourceRef.current = src;
      src.start(0, late > 0.05 ? late : 0);
      setPlaying("clip");
    },
    [fetchClip, stopClip],
  );

  const playPcm = useCallback((data: ArrayBuffer) => {
    const ctx = ctxRef.current;
    const out = outRef.current;
    if (!ctx || !out || data.byteLength < 2) return;
    const pcm = new Int16Array(data, 0, Math.floor(data.byteLength / 2));
    const { rate } = pcmRef.current;
    const buf = ctx.createBuffer(1, pcm.length, rate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const now = ctx.currentTime;
    let at = pcmRef.current.next;
    // 처음이거나 끊겼다 다시 오면 조금 모아서, 너무 밀리면 따라잡는다
    if (at < now + 0.01 || at > now + PCM_MAX_AHEAD_S) at = now + PCM_LEAD_S;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(out);
    src.start(at);
    pcmRef.current.next = at + buf.duration;
  }, []);

  const enable = useCallback(async () => {
    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = new AudioContext();
      const out = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      out.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      outRef.current = out;
      analyserRef.current = analyser;
    }
    await ctx.resume();
    setEnabled(true);
  }, []);

  const disable = useCallback(async () => {
    stopClip();
    await ctxRef.current?.suspend();
    setEnabled(false);
    setLevel(null);
  }, [stopClip]);

  // 미터 — 나가는 소리의 최고점(dBFS)
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let last = 0;
    const data = new Float32Array(1024);
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 50) return;
      last = t;
      const a = analyserRef.current;
      if (!a) return;
      a.getFloatTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
      setLevel(dbOf(peak));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  useEffect(
    () => () => {
      stopClip();
      void ctxRef.current?.close();
      ctxRef.current = null;
    },
    [stopClip],
  );

  // ---------------- 연결 ----------------
  const handlers = useRef({ playClip, playPcm, fetchClip, stopClip, note });
  useEffect(() => {
    handlers.current = { playClip, playPcm, fetchClip, stopClip, note };
  });

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let tries = 0;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;

    const onText = (msg: ServerMsg) => {
      const h = handlers.current;
      switch (msg.type) {
        case "hello":
          setOn(!!msg.on);
          break;
        case "state":
          setOn(!!msg.on);
          h.note(msg.on ? "켜짐" : "꺼짐");
          break;
        case "load":
          if (msg.id && msg.url) void h.fetchClip(msg.id, msg.url);
          break;
        case "play":
          if (msg.id && msg.url) {
            h.note(`재생 ${Math.round((msg.seconds ?? 0) * 10) / 10}초`);
            void h.playClip(msg.id, msg.url, performance.now());
          }
          break;
        case "play-end":
          h.stopClip();
          setPlaying((p) => (p === "clip" ? "idle" : p));
          break;
        case "pcm":
          pcmRef.current = { rate: msg.rate || 48000, next: 0 };
          setPlaying("mic");
          h.note("마이크 시작");
          break;
        case "pcm-end":
          pcmRef.current.next = 0;
          setPlaying((p) => (p === "mic" ? "idle" : p));
          h.note("마이크 끝");
          break;
        case "error":
          setConn("denied");
          break;
      }
    };

    const connect = () => {
      if (closed) return;
      setConn(tries === 0 ? "connecting" : "retry");
      const sock = new WebSocket(backendWs("/api/test-speaker/listen"));
      sock.binaryType = "arraybuffer";
      ws = sock;
      sock.onopen = () => {
        tries = 0;
        setConn("open");
        ping = setInterval(() => {
          if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ type: "ping" }));
        }, PING_MS);
      };
      sock.onmessage = (e) => {
        if (typeof e.data === "string") {
          try {
            onText(JSON.parse(e.data) as ServerMsg);
          } catch {
            /* 모르는 메시지 */
          }
        } else if (e.data instanceof ArrayBuffer) {
          handlers.current.playPcm(e.data);
        }
      };
      sock.onclose = (e) => {
        if (ping) clearInterval(ping);
        ping = null;
        if (closed) return;
        if (e.code === 4403) {
          setConn("denied");
          return;
        }
        setConn("retry");
        retry = setTimeout(connect, RETRY_MS[Math.min(tries, RETRY_MS.length - 1)]);
        tries += 1;
      };
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      if (ping) clearInterval(ping);
      if (ws) {
        ws.onopen = ws.onmessage = ws.onclose = null;
        ws.close(1000);
      }
    };
  }, []);

  return { conn, on, enabled, playing, level: enabled ? level : null, events, enable, disable };
}
