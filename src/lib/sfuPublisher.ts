import { backendBase } from "@/lib/backend";

/** 화면 공유를 학생 live 화면으로 — Cloudflare Realtime SFU 에 한 번 더 올린다 (서버 app/services/sfu_service.py).
 *  송출 화면(P2P, lib/screenSender)은 그대로 두고 연결을 하나 더 만든다. 학생 수백 명은 SFU 가 나눠 보낸다.
 *  영상은 3화질(f 원본·최대 1080p / h 절반 / q 4분의 1)을 같이 올려 학생 망에 맞춰 SFU 가 고른다(simulcast).
 *  서버에 설정이 없으면(/api/sfu/config enabled=false) 아무것도 안 한다 — 학생은 서버 PC 중계(HLS)로 본다. */

const log = (...a: unknown[]) => console.info("[화면 공유 SFU]", ...a);
const KEEPALIVE_MS = 10_000;
const MAX_RETRY = 5;

/** 화질별 최대 비트레이트 — 화면은 글자가 많아 움직임보다 선명함 */
const LAYERS: { rid: string; scale: number; maxBitrate: number }[] = [
  { rid: "f", scale: 1, maxBitrate: 2_500_000 },
  { rid: "h", scale: 2, maxBitrate: 800_000 },
  { rid: "q", scale: 4, maxBitrate: 250_000 },
];

/** 원본이 1080p 보다 크면(레티나 맥 2880×1800 등) f 를 1080p 로 줄인다 — 인코딩 부담·업로드를 줄이려고 */
export function sendEncodings(height: number | undefined): RTCRtpEncodingParameters[] {
  const base = height && height > 1080 ? height / 1080 : 1;
  return LAYERS.map((l) => ({ rid: l.rid, scaleResolutionDownBy: base * l.scale, maxBitrate: l.maxBitrate }));
}

export interface SfuPublisher {
  close: () => void;
}

export function startSfuPublisher(
  stream: MediaStream,
  channel: number,
  iceServers: RTCIceServer[],
  shareToken?: string | null,
): SfuPublisher {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (shareToken) headers["x-share-token"] = shareToken;
  let pc: RTCPeerConnection | null = null;
  let key: string | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let retries = 0;

  const teardown = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    try {
      pc?.close();
    } catch {}
    pc = null;
  };

  const unpublish = () => {
    if (!key) return;
    const body = JSON.stringify({ key });
    key = null;
    // 탭을 닫는 중에도 가게 keepalive
    void fetch(`${backendBase()}/api/sfu/unpublish`, { method: "POST", headers, body, keepalive: true }).catch(() => {});
  };

  const retry = (why: string) => {
    teardown();
    unpublish();
    if (closed || retries >= MAX_RETRY) {
      if (!closed) console.warn(`[화면 공유 SFU] ${why} — 그만둔다 (학생은 서버 PC 중계로 본다)`);
      return;
    }
    retries += 1;
    const wait = Math.min(15_000, 1_000 * 2 ** retries);
    log(`${why} — ${wait / 1000}초 뒤 다시 (${retries}/${MAX_RETRY})`);
    retryTimer = setTimeout(() => void start(), wait);
  };

  const start = async () => {
    try {
      const cfg = await fetch(`${backendBase()}/api/sfu/config`, { cache: "no-store", headers })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (closed || !cfg?.enabled) {
        if (!closed) log("서버에 SFU 설정이 없다 — P2P 만");
        return;
      }
      const conn = new RTCPeerConnection({ iceServers, bundlePolicy: "max-bundle" });
      pc = conn;
      const sent: { tr: RTCRtpTransceiver; kind: string; simulcast: boolean }[] = [];
      for (const track of stream.getTracks()) {
        let simulcast = !!cfg.simulcast && track.kind === "video";
        let tr: RTCRtpTransceiver;
        try {
          tr = conn.addTransceiver(track, {
            direction: "sendonly",
            streams: [stream],
            sendEncodings: simulcast ? sendEncodings(track.getSettings().height) : undefined,
          });
        } catch {
          // 3화질을 못 하는 브라우저 — 한 화질로
          simulcast = false;
          tr = conn.addTransceiver(track, { direction: "sendonly", streams: [stream] });
        }
        sent.push({ tr, kind: track.kind, simulcast });
      }
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      const r = await fetch(`${backendBase()}/api/sfu/publish?channel=${channel}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sdp: conn.localDescription?.sdp ?? offer.sdp,
          tracks: sent.map((s) => ({ mid: s.tr.mid, kind: s.kind, simulcast: s.simulcast })),
        }),
      });
      if (!r.ok) throw new Error(`올리기 ${r.status} ${(await r.text()).slice(0, 120)}`);
      const res = (await r.json()) as { key: string; sdp: string };
      if (closed || pc !== conn) return;
      key = res.key;
      await conn.setRemoteDescription({ type: "answer", sdp: res.sdp });
      log(`올림 — ${sent.map((s) => `${s.kind}${s.simulcast ? "×3" : ""}`).join(" · ")}`);
      conn.onconnectionstatechange = () => {
        log(`연결 ${conn.connectionState}`);
        if (conn.connectionState === "connected") retries = 0;
        if (conn.connectionState === "failed" && pc === conn) retry("연결 실패");
      };
      timer = setInterval(() => {
        if (!key) return;
        void fetch(`${backendBase()}/api/sfu/keepalive`, { method: "POST", headers, body: JSON.stringify({ key }) })
          .then((x) => {
            // 서버가 다시 켜져 올린 화면을 모른다 — 다시 올린다
            if (x.status === 404 && pc === conn) retry("서버가 올린 화면을 모름");
          })
          .catch(() => {});
      }, KEEPALIVE_MS);
    } catch (e) {
      retry(`올리기 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  void start();
  return {
    close: () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      teardown();
      unpublish();
    },
  };
}
