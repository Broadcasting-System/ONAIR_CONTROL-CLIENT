import { useCallback, useEffect, useRef, useState } from "react";
import { backendWs } from "@/lib/backend";
import { getIceServers, startScreenSender, type ScreenSender } from "@/lib/screenSender";
import { getApiBase } from "@/lib/apiBase";
import { toast } from "@/components/common/Toast";

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
 *  보내는 연결은 lib/screenSender (외부 발표자 share 와 같이 쓴다).
 *
 *  공유는 '시작한 채널'에 묶인다. 공유 중에 컨트롤에서 다른 채널을 골라도
 *  중지·정리는 시작한 채널에 대해 이뤄진다(sharingChannel). */
export function useScreenShare(channel: number = 1) {
  const [sharingChannel, setSharingChannel] = useState<number | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const senderRef = useRef<ScreenSender | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shareChannelRef = useRef<number | null>(null);
  const startingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (senderRef.current) {
      const sender = senderRef.current;
      senderRef.current = null; // 닫는 동안의 onclose 를 '예상치 못한 끊김'으로 오인하지 않도록 먼저 비운다
      sender.close();
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
    if (senderRef.current || startingRef.current) return; // 이미 공유 중(또는 화면 선택 창이 떠 있음)

    // 화면 캡처 API는 보안 컨텍스트(HTTPS 또는 localhost)에서만 제공된다.
    // HTTP+IP로 접속하면 navigator.mediaDevices 자체가 없다 → 명확히 안내.
    if (
      typeof window !== "undefined" &&
      (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia)
    ) {
      toast.error("HTTP 주소에서는 화면 공유를 쓸 수 없어요");
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

    const iceServers = await getIceServers();
    if (streamRef.current !== stream) return; // 그 사이 멈췄다
    const sender = startScreenSender(stream, backendWs("/api/display/ws", ch, "signal"), iceServers, () => {
      // 우리가 닫은 게 아니라 서버 재시작 등으로 끊겼다 → '공유 중'으로 남지 않게 정리
      if (senderRef.current !== sender) return;
      void stop();
      toast.error("송출 서버 연결이 끊겨 화면 공유를 종료했습니다.");
    });
    senderRef.current = sender;

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
