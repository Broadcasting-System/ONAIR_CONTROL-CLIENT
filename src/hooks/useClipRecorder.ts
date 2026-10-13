import { useCallback, useEffect, useRef, useState } from "react";
import { clipPeaks, micErrorMessage, openMic, pickRecorderType, startAnalyser, stopStream } from "@/lib/micCapture";
import { toast } from "@/components/common/Toast";

/** 녹음 후 방송 — idle → recording → ready(파형·들어보기·방송하기) */
export type ClipState = "idle" | "starting" | "recording" | "ready";

export interface Clip {
  blob: Blob;
  filename: string;
  url: string;
  seconds: number;
  peaks: number[];
}

function extFor(type: string): string {
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  return "webm";
}

export function useClipRecorder(maxSeconds = 120) {
  const [state, setState] = useState<ClipState>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [playing, setPlaying] = useState(false);
  const stateRef = useRef<ClipState>("idle");
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<{ close: () => void } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipRef = useRef<Clip | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const set = (s: ClipState) => {
    stateRef.current = s;
    setState(s);
  };

  const release = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    meterRef.current?.close();
    meterRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    setAnalyser(null);
  }, []);

  const stopPlayback = useCallback(() => {
    const a = audioRef.current;
    audioRef.current = null;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    setPlaying(false);
  }, []);

  const discard = useCallback(() => {
    stopPlayback();
    if (clipRef.current) URL.revokeObjectURL(clipRef.current.url);
    clipRef.current = null;
    setClip(null);
    setStartedAt(null);
    set("idle");
  }, [stopPlayback]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else release();
  }, [release]);

  const start = useCallback(async () => {
    if (stateRef.current !== "idle") return;
    if (typeof MediaRecorder === "undefined") {
      toast.error("이 브라우저는 녹음을 못 해요");
      return;
    }
    set("starting");
    let stream: MediaStream;
    try {
      stream = await openMic();
    } catch (e) {
      toast.error(micErrorMessage(e));
      set("idle");
      return;
    }
    streamRef.current = stream;
    const { mimeType } = pickRecorderType();
    let rec: MediaRecorder;
    try {
      rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      release();
      toast.error("녹음을 시작하지 못했어요");
      set("idle");
      return;
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = async () => {
      recRef.current = null;
      release();
      const type = rec.mimeType || mimeType || chunks[0]?.type || "audio/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size === 0) {
        toast.error("녹음된 소리가 없어요");
        discard();
        return;
      }
      let peaks: number[] = [];
      let seconds = 0;
      try {
        ({ peaks, seconds } = await clipPeaks(blob));
      } catch {
        seconds = startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : 0;
      }
      if (seconds < 0.3) {
        toast.error("녹음이 너무 짧아요");
        discard();
        return;
      }
      const next: Clip = { blob, filename: `mic.${extFor(type)}`, url: URL.createObjectURL(blob), seconds, peaks };
      clipRef.current = next;
      setClip(next);
      set("ready");
    };
    const meter = startAnalyser(stream);
    meterRef.current = meter;
    setAnalyser(meter.analyser);
    recRef.current = rec;
    rec.start(250);
    const now = Date.now();
    startedAtRef.current = now;
    setStartedAt(now);
    set("recording");
    timerRef.current = setTimeout(() => {
      if (recRef.current === rec && rec.state !== "inactive") {
        toast.info(maxSeconds % 60 === 0 ? `${maxSeconds / 60}분까지 녹음돼요` : `${maxSeconds}초까지 녹음돼요`);
        rec.stop();
      }
    }, maxSeconds * 1000);
  }, [maxSeconds, release, discard]);

  const togglePlay = useCallback(() => {
    if (audioRef.current) return stopPlayback();
    const c = clipRef.current;
    if (!c) return;
    const a = new Audio(c.url);
    audioRef.current = a;
    setPlaying(true);
    a.onended = a.onerror = () => audioRef.current === a && stopPlayback();
    a.play().catch(() => audioRef.current === a && stopPlayback());
  }, [stopPlayback]);

  useEffect(
    () => () => {
      const rec = recRef.current;
      if (rec) {
        rec.onstop = null;
        if (rec.state !== "inactive") rec.stop();
      }
      release();
      audioRef.current?.pause();
      if (clipRef.current) URL.revokeObjectURL(clipRef.current.url);
    },
    [release],
  );

  return { state, startedAt, analyser, clip, playing, start, stop, discard, togglePlay, stopPlayback };
}
