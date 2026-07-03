import { useCallback, useRef, useState } from "react";
import { backendWs } from "@/lib/backend";
import { getApiBase } from "@/lib/apiBase";
import { toast } from "@/components/common/Toast";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/** 컨트롤(노트북) 측 화면 공유 송신기.
 *  getDisplayMedia로 화면+소리를 캡처해 WebRTC(sendonly)로 송출 화면에 보낸다.
 *  시그널링은 전용 /api/display/ws 로 offer/answer/ice 교환. */
export function useScreenShare(channel: number = 1) {
  const chQs = channel > 1 ? `?channel=${channel}` : "";
  const [isSharing, setIsSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setLocalStream(null);
    setIsSharing(false);
  }, []);

  const stop = useCallback(async () => {
    cleanup();
    try {
      await fetch(`${getApiBase()}/display/screen${chQs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
    } catch {}
  }, [cleanup, chQs]);

  const start = useCallback(async () => {
    if (pcRef.current) return; // 이미 공유 중

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
    }
    streamRef.current = stream;
    setLocalStream(stream);
    setIsSharing(true);
    // 브라우저 '공유 중지'를 누르면 자동 종료
    stream.getVideoTracks()[0]?.addEventListener("ended", () => {
      stop();
      toast.info("화면 공유를 종료했습니다.");
    });

    // 송출 화면을 screen 모드로 전환
    try {
      await fetch(`${getApiBase()}/display/screen${chQs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
    } catch {}

    const ws = new WebSocket(backendWs("/api/display/ws", channel, "signal"));
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

    toast.success("화면 공유를 시작했습니다.");
  }, [stop, chQs, channel]);

  return { isSharing, start, stop, localStream };
}
