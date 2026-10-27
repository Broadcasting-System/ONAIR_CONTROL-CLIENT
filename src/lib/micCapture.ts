/**
 * 기기 마이크 → 실시간 방송용 PCM 조각.
 *
 * - getUserMedia (에코 제거·잡음 억제). 자동 크기(AGC)는 끈다 — 크기는 서버(app/services/mic_effects.py VoiceLeveler)가
 *   말할 때만 맞춘다. 브라우저 AGC 까지 켜면 말이 끊길 때 방 잡음을 끌어올려 "쉬익"이 커지고 서버 게이트가 열린 채로 남았다.
 *   에코 제거는 둔다 — 아이폰 사파리는 이걸 켜야 애플 음성 처리(잡음 억제 포함)가 켜진다
 * - AudioWorklet(인라인 모듈)로 모노 int16 LE 약 20ms 조각을 만든다. 워클릿이 안 되면 ScriptProcessor
 * - 장치 표본율이 48kHz 를 넘으면 정수배로 줄여 서버 범위(16~48kHz) 안에 넣는다
 * - 소리 크기 막대용 AnalyserNode
 * 아무 소리도 이 기기 스피커로 내보내지 않는다(처리 노드는 크기 0 으로 끝난다).
 */

export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
  video: false,
};

const FRAME_MS = 20;
const RATE_MAX = 48000;

/** 마이크를 열지 못한 까닭 → 짧은 안내 */
export function micErrorMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "마이크 권한을 허용해 주세요";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "마이크를 찾지 못했어요";
  if (name === "NotReadableError") return "다른 앱이 마이크를 쓰고 있어요";
  if (name === "Insecure") return "https 주소에서만 마이크를 쓸 수 있어요";
  return "마이크를 열지 못했어요";
}

export async function openMic(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error("insecure"), { name: "Insecure" });
  }
  return navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** 워클릿 — 입력 0번 채널을 factor 만큼 평균 내 줄이고 int16 조각(frame 표본)으로 보낸다 */
const WORKLET_SRC = `
class OnairPcm extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.factor = o.factor || 1;
    this.frame = o.frame || 960;
    this.buf = new Int16Array(this.frame);
    this.n = 0;
    this.acc = 0;
    this.k = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i];
      if (++this.k < this.factor) continue;
      let v = this.acc / this.factor;
      this.acc = 0; this.k = 0;
      v = v < -1 ? -1 : v > 1 ? 1 : v;
      this.buf[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
      if (this.n === this.frame) {
        const out = this.buf;
        this.port.postMessage(out.buffer, [out.buffer]);
        this.buf = new Int16Array(this.frame);
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor("onair-pcm", OnairPcm);
`;

export interface PcmCapture {
  context: AudioContext;
  analyser: AnalyserNode;
  /** 서버로 보내는 표본율 */
  sampleRate: number;
  close: () => void;
}

/**
 * 스트림을 PCM 조각으로. onFrame 은 약 20ms 마다 ArrayBuffer(int16 LE 모노)를 받는다.
 */
export async function startPcmCapture(stream: MediaStream, onFrame: (buf: ArrayBuffer) => void): Promise<PcmCapture> {
  const Ctx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new Ctx({ latencyHint: "interactive" });
  if (context.state === "suspended") await context.resume().catch(() => {});
  const factor = Math.max(1, Math.ceil(context.sampleRate / RATE_MAX));
  const sampleRate = Math.round(context.sampleRate / factor);
  const frame = Math.round((sampleRate * FRAME_MS) / 1000);

  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);

  // 처리 노드가 돌려면 출력까지 이어져야 한다 — 크기 0 이라 소리는 나지 않는다
  const sink = context.createGain();
  sink.gain.value = 0;
  sink.connect(context.destination);

  let node: AudioNode;
  let url: string | null = null;
  try {
    if (!context.audioWorklet) throw new Error("no worklet");
    url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: "application/javascript" }));
    await context.audioWorklet.addModule(url);
    const w = new AudioWorkletNode(context, "onair-pcm", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: "explicit",
      processorOptions: { factor, frame },
    });
    w.port.onmessage = (e: MessageEvent<ArrayBuffer>) => onFrame(e.data);
    node = w;
  } catch {
    node = scriptProcessor(context, factor, frame, onFrame);
  }
  source.connect(node);
  node.connect(sink);

  return {
    context,
    analyser,
    sampleRate,
    close: () => {
      try {
        source.disconnect();
        node.disconnect();
        if (node instanceof AudioWorkletNode) node.port.onmessage = null;
        if ("onaudioprocess" in node) (node as ScriptProcessorNode).onaudioprocess = null;
      } catch {
        /* 이미 끊김 */
      }
      if (url) URL.revokeObjectURL(url);
      context.close().catch(() => {});
    },
  };
}

/** 워클릿이 없는 옛 브라우저 — 같은 일을 메인 스레드에서 */
function scriptProcessor(
  context: AudioContext,
  factor: number,
  frame: number,
  onFrame: (buf: ArrayBuffer) => void,
): ScriptProcessorNode {
  const sp = context.createScriptProcessor(1024, 1, 1);
  let buf = new Int16Array(frame);
  let n = 0;
  let acc = 0;
  let k = 0;
  sp.onaudioprocess = (e) => {
    const ch = e.inputBuffer.getChannelData(0);
    for (let i = 0; i < ch.length; i++) {
      acc += ch[i];
      if (++k < factor) continue;
      let v = acc / factor;
      acc = 0;
      k = 0;
      v = v < -1 ? -1 : v > 1 ? 1 : v;
      buf[n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
      if (n === frame) {
        onFrame(buf.buffer);
        buf = new Int16Array(frame);
        n = 0;
      }
    }
  };
  return sp;
}

/** 녹음 기록용 분석기만 (녹음 후 방송) */
export function startAnalyser(stream: MediaStream): { context: AudioContext; analyser: AnalyserNode; close: () => void } {
  const Ctx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new Ctx();
  if (context.state === "suspended") context.resume().catch(() => {});
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);
  return {
    context,
    analyser,
    close: () => {
      try {
        source.disconnect();
      } catch {
        /* 이미 끊김 */
      }
      context.close().catch(() => {});
    },
  };
}

/** 녹음 파일 → 막대 높이(0~1) n 개와 길이(초) */
export async function clipPeaks(blob: Blob, n = 56): Promise<{ peaks: number[]; seconds: number }> {
  const Ctx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / n));
    const peaks: number[] = [];
    for (let i = 0; i < n; i++) {
      let max = 0;
      const end = Math.min(data.length, (i + 1) * step);
      for (let j = i * step; j < end; j++) {
        const v = Math.abs(data[j]);
        if (v > max) max = v;
      }
      peaks.push(max);
    }
    const top = Math.max(...peaks, 0.02);
    return { peaks: peaks.map((p) => Math.min(1, p / top)), seconds: audio.duration };
  } finally {
    ctx.close().catch(() => {});
  }
}

/** MediaRecorder 형식 — 크롬·파이어폭스 webm/opus, 사파리 mp4 */
export function pickRecorderType(): { mimeType: string; ext: string } {
  const MR = typeof MediaRecorder !== "undefined" ? MediaRecorder : null;
  const ok = (t: string) => !!MR && typeof MR.isTypeSupported === "function" && MR.isTypeSupported(t);
  if (ok("audio/webm;codecs=opus")) return { mimeType: "audio/webm;codecs=opus", ext: "webm" };
  if (ok("audio/mp4")) return { mimeType: "audio/mp4", ext: "m4a" };
  if (ok("audio/webm")) return { mimeType: "audio/webm", ext: "webm" };
  if (ok("audio/ogg;codecs=opus")) return { mimeType: "audio/ogg;codecs=opus", ext: "ogg" };
  return { mimeType: "", ext: "webm" };
}
