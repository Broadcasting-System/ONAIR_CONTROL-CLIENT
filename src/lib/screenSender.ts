import { backendBase } from "@/lib/backend";

/** 화면 공유 보내는 쪽 — 컨트롤 화면 공유(useScreenShare)와 외부 발표자(share) 가 같이 쓴다.
 *  시그널링은 /api/display/ws (role=signal) 로 hello/offer/answer/ice.
 *  같은 채널의 받는 쪽(송출 화면 + 서버 PC 녹화 창 등) 여럿에게 각자 WebRTC 연결을 만든다. */

const FALLBACK: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
let iceCache: { at: number; key: string; servers: RTCIceServer[] } | null = null;

/** STUN(+ 학교 밖까지 잇는 Cloudflare TURN) — 서버가 20분 단위로 준다. 못 받으면 STUN 만.
 *  TURN 은 쓴 만큼 돈이 들어 서버가 부원 기기·허용된 발표자에게만 준다 — 발표자는 shareToken 을 같이 보낸다 */
export async function getIceServers(shareToken?: string | null): Promise<RTCIceServer[]> {
  const key = shareToken ?? "";
  if (iceCache && iceCache.key === key && Date.now() - iceCache.at < 20 * 60_000) return iceCache.servers;
  try {
    const r = await fetch(`${backendBase()}/api/share/ice`, {
      cache: "no-store",
      headers: shareToken ? { "x-share-token": shareToken } : undefined,
    });
    if (r.ok) {
      const servers = ((await r.json()) as { iceServers: RTCIceServer[] }).iceServers;
      if (Array.isArray(servers) && servers.length) {
        iceCache = { at: Date.now(), key, servers };
        return servers;
      }
    }
  } catch {
    /* 예전 서버 — STUN 만 */
  }
  return FALLBACK;
}

type Signal = {
  command?: string;
  from?: string;
  kind?: string;
  fromPeer?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

/** 화면 공유가 송출 화면에 안 나올 때 원인을 보려고 — 개발자 도구 콘솔에 [화면 공유] 로 남긴다 */
const log = (...a: unknown[]) => console.info("[화면 공유]", ...a);
const hasTurn = (s: RTCIceServer) =>
  (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => /^turns?:/.test(u));

export interface ScreenSender {
  /** 연결·소켓을 닫는다 (스트림 트랙은 부른 쪽이 멈춘다) */
  close: () => void;
}

/** stream 을 wsUrl 의 채널로 보낸다. onLost — 우리가 닫지 않았는데 소켓이 끊겼을 때 */
export function startScreenSender(
  stream: MediaStream,
  wsUrl: string,
  iceServers: RTCIceServer[],
  onLost: () => void,
): ScreenSender {
  const ws = new WebSocket(wsUrl);
  let closed = false;
  const send = (m: object) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  };

  // 받는 쪽마다 연결을 따로 — 서버가 붙여 주는 fromPeer 로 구분하고 offer·ice 는 그 받는 쪽에게만(to).
  // fromPeer 를 모르는 예전 서버면 "" 하나로 1:1 처럼 동작.
  type Peer = { pc: RTCPeerConnection; pendingIce: RTCIceCandidateInit[] };
  const peers = new Map<string, Peer>();
  const target = (peer: string) => (peer ? { to: peer } : {});

  const closePeer = (peer: string) => {
    const p = peers.get(peer);
    if (!p) return;
    peers.delete(peer);
    try {
      p.pc.close();
    } catch {}
  };

  const offerTo = async (peer: string) => {
    closePeer(peer); // (다시) 붙은 받는 쪽 — 새 연결로
    const pc = new RTCPeerConnection({ iceServers });
    const entry: Peer = { pc, pendingIce: [] };
    peers.set(peer, entry);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream)); // sendonly
    pc.onicecandidate = (e) => {
      if (e.candidate)
        send({
          command: "webrtc",
          from: "control",
          kind: "ice",
          candidate: e.candidate.toJSON(),
          ...target(peer),
        });
    };
    pc.onicecandidateerror = (e) => {
      const ev = e as RTCPeerConnectionIceErrorEvent;
      console.warn("[화면 공유] ICE 서버 오류", ev.url, ev.errorCode, ev.errorText);
    };
    pc.oniceconnectionstatechange = () => log(`ICE ${pc.iceConnectionState} (받는 쪽 ${peer || "-"})`);
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "failed") console.warn(`[화면 공유] 연결 실패 (받는 쪽 ${peer || "-"}) — 방화벽·TURN 확인`);
      else log(`연결 ${state} (받는 쪽 ${peer || "-"})`);
      if (state === "failed" && peers.get(peer)?.pc === pc) closePeer(peer); // 받는 쪽이 hello 로 다시 부른다
    };
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ command: "webrtc", from: "control", kind: "offer", sdp: offer, ...target(peer) });
      log(`offer 보냄 (받는 쪽 ${peer || "-"})`);
    } catch (e) {
      console.error("offer 생성 실패", e);
    }
  };

  ws.onmessage = async (ev) => {
    let m: Signal;
    try {
      m = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (m?.command !== "webrtc" || m.from === "control") return;
    const peer = m.fromPeer ?? "";
    if (m.kind === "hello") {
      log(`받는 쪽 hello (${peer || "-"})`);
      await offerTo(peer); // 받는 쪽이 (다시) 붙었다 → 그 화면 몫의 offer
      return;
    }
    if (m.kind === "bye") {
      if (peers.has(peer)) log(`받는 쪽 떠남 (${peer || "-"})`);
      closePeer(peer);
      return;
    }
    const p = peers.get(peer);
    if (!p) return;
    if (m.kind === "answer" && m.sdp) {
      try {
        log(`answer 받음 (받는 쪽 ${peer || "-"})`);
        await p.pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
        for (const c of p.pendingIce) {
          try {
            await p.pc.addIceCandidate(c);
          } catch {}
        }
        p.pendingIce.length = 0;
      } catch (e) {
        console.error("answer 처리 실패", e);
      }
    } else if (m.kind === "ice" && m.candidate) {
      if (p.pc.remoteDescription) {
        try {
          await p.pc.addIceCandidate(m.candidate);
        } catch {}
      } else p.pendingIce.push(m.candidate);
    }
  };
  // 이미 떠 있는 받는 쪽들에게 "보낼 게 있다" — 각자 hello 로 답하면 그 화면마다 offer 를 보낸다
  ws.onopen = () => {
    log(`신호 연결됨 — TURN ${iceServers.some(hasTurn) ? "있음" : "없음(STUN 만)"}`);
    send({ command: "webrtc", from: "control", kind: "hello" });
  };
  ws.onclose = (ev) => {
    if (closed) return;
    // 4403 = 서버가 막음 (허용이 끝났거나 다른 채널)
    console.warn(`[화면 공유] 신호 연결 끊김 (code ${ev.code})`);
    onLost();
  };

  return {
    close: () => {
      closed = true;
      peers.forEach((_, k) => closePeer(k));
      try {
        ws.close();
      } catch {}
    },
  };
}
