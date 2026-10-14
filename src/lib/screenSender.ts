import { backendBase } from "@/lib/backend";

/** 화면 공유 보내는 쪽 — 컨트롤 화면 공유(useScreenShare)와 외부 발표자(share) 가 같이 쓴다.
 *  시그널링은 /api/display/ws (role=signal) 로 hello/offer/answer/ice.
 *  같은 채널의 받는 쪽(송출 화면 + 서버 PC 녹화 창 등) 여럿에게 각자 WebRTC 연결을 만든다. */

const FALLBACK: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
let iceCache: { at: number; servers: RTCIceServer[] } | null = null;

/** STUN(+ 학교 밖까지 잇는 Cloudflare TURN) — 서버가 30분 단위로 준다. 못 받으면 STUN 만 */
export async function getIceServers(): Promise<RTCIceServer[]> {
  if (iceCache && Date.now() - iceCache.at < 30 * 60_000) return iceCache.servers;
  try {
    const r = await fetch(`${backendBase()}/api/share/ice`, { cache: "no-store" });
    if (r.ok) {
      const servers = ((await r.json()) as { iceServers: RTCIceServer[] }).iceServers;
      if (Array.isArray(servers) && servers.length) {
        iceCache = { at: Date.now(), servers };
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
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" && peers.get(peer)?.pc === pc) closePeer(peer);
    };
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ command: "webrtc", from: "control", kind: "offer", sdp: offer, ...target(peer) });
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
      await offerTo(peer); // 받는 쪽이 (다시) 붙었다 → 그 화면 몫의 offer
      return;
    }
    if (m.kind === "bye") {
      closePeer(peer);
      return;
    }
    const p = peers.get(peer);
    if (!p) return;
    if (m.kind === "answer" && m.sdp) {
      try {
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
  ws.onopen = () => send({ command: "webrtc", from: "control", kind: "hello" });
  ws.onclose = () => {
    if (!closed) onLost();
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
