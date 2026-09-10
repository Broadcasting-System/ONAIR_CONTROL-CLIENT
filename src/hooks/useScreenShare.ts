import { useCallback, useEffect, useRef, useState } from "react";
import { backendWs } from "@/lib/backend";
import { getApiBase } from "@/lib/apiBase";
import { toast } from "@/components/common/Toast";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

async function postScreen(channel: number, active: boolean) {
  const chQs = channel > 1 ? `?channel=${channel}` : "";
  await fetch(`${getApiBase()}/display/screen${chQs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active }),
  });
}

/** 컨트롤(노트북) 측 화면 공유 송신기.
 *  getDisplayMedia로 화면+소리를 캡처해 WebRTC(sendonly)로 송출 화면에 보낸다.
 *  시그널링은 전용 /api/display/ws 로 offer/answer/ice 교환.
 *
 *  공유는 '시작한 채널'에 묶인다. 공유 중에 컨트롤에서 다른 채널을 골라도
 *  중지·정리는 시작한 채널에 대해 이뤄진다(sharingChannel). */
export function useScreenShare(channel: number = 1) {
  const [sharingChannel, setSharingChannel] = useState<number | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shareChannelRef = useRef<number | null>(null);
  const startingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null; // onclose에서 '예상치 못한 끊김'으로 오인하지 않도록 먼저 비운다
      try { ws.close(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    shareChannelRef.current = null;
    setLocalStream(null);
    setSharingChannel(null);
  }, []);

  const stop = useCallback(async () => {
    const ch = shareChannelRef.current;
    cleanup();
    if (ch === null) return;
    try {
      await postScreen(ch, false);
    } catch {}
  }, [cleanup]);

  // 페이지를 떠나면 공유도 끝낸다 — 캡처·연결이 남아 송출 화면이 '연결 중'에 멈추지 않게.
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => () => { void stopRef.current(); }, []);

  const start = useCallback(async () => {
    if (pcRef.current || startingRef.current) return; // 이미 공유 중(또는 화면 선택 창이 떠 있음)

    // 화면 캡처 API는 보안 컨텍스트(HTTPS 또는 localhost)에서만 제공된다.
    // HTTP+IP로 접속하면 navigator.mediaDevices 자체가 없다 → 명확히 안내.
    if (
      typeof window !== "undefined" &&
      (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia)
    ) {
      toast.error(
        "이 주소(HTTP)에서는 화면 공유를 쓸 수 없습니다. HTTPS 또는 localhost로 접속해야 합니다.",
      );
      return;
    }

    const ch = channel; // 시작 시점의 채널에 고정
    startingRef.current = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
    } catch (e) {
      const name = (e as Error)?.name;
      if (name === "NotAllowedError") {
        toast.error("화면 공유가 취소되었거나 권한이 거부되었습니다.");
      } else {
        toast.error("화면 공유를 시작할 수 없습니다: " + (name || "알 수 없는 오류"));
      }
      return;
    } finally {
      startingRef.current = false;
    }
    streamRef.current = stream;
    shareChannelRef.current = ch;
    setLocalStream(stream);
    setSharingChannel(ch);
    // 브라우저 '공유 중지'를 누르면 자동 종료
    stream.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (streamRef.current !== stream) return;
      void stop();
      toast.info("화면 공유를 종료했습니다.");
    });

    // 송출 화면을 screen 모드로 전환
    try {
      await postScreen(ch, true);
    } catch {}

    const ws = new WebSocket(backendWs("/api/display/ws", ch, "signal"));
    wsRef.current = ws;
    const send = (m: object) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
    };

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream)); // sendonly
    pc.onicecandidate = (e) => {
      if (e.candidate)
        send({ command: "webrtc", from: "control", kind: "ice", candidate: e.candidate.toJSON() });
    };

    const pendingIce: RTCIceCandidateInit[] = [];
    const sendOffer = async (iceRestart = false) => {
      try {
        const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
        await pc.setLocalDescription(offer);
        send({ command: "webrtc", from: "control", kind: "offer", sdp: offer });
      } catch (e) { console.error("offer 생성 실패", e); }
    };
    ws.onmessage = async (ev) => {
      let m: { command?: string; from?: string; kind?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m?.command !== "webrtc" || m.from === "control") return;
      if (m.kind === "answer" && m.sdp) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
          for (const c of pendingIce) { try { await pc.addIceCandidate(c); } catch {} }
          pendingIce.length = 0;
        } catch (e) { console.error("answer 처리 실패", e); }
      } else if (m.kind === "ice" && m.candidate) {
        if (pc.remoteDescription) { try { await pc.addIceCandidate(m.candidate); } catch {} }
        else pendingIce.push(m.candidate);
      } else if (m.kind === "hello") {
        // 송출이 (재)연결됨 → offer를 ICE 재시작과 함께 재전송해 재협상
        await sendOffer(true);
      }
    };
    ws.onopen = () => { void sendOffer(false); };
    ws.onclose = () => {
      // 우리가 닫은 게 아니라 서버 재시작 등으로 끊겼다 → '공유 중'으로 남지 않게 정리
      if (wsRef.current !== ws) return;
      void stop();
      toast.error("송출 서버와 연결이 끊겨 화면 공유를 종료했습니다. 다시 시작해주세요.");
    };

    toast.success(`CH${ch}에 화면 공유를 시작했습니다.`);
  }, [stop, channel]);

  return {
    /** 이 컨트롤에서 화면 공유 중인지 (어느 채널이든) */
    isSharing: sharingChannel !== null,
    /** 공유를 시작한 채널 — 선택 채널과 다를 수 있다 */
    sharingChannel,
    start,
    stop,
    localStream,
  };
}
