import { useEffect, useRef, useState } from "react";

/**
 * 끊기면 스스로 다시 붙는 WebSocket 훅 — 송출 미리보기(useDisplaySync)·송출 화면(useWebSocket)이 함께 쓴다.
 * (송출 화면 저장소 onair-display 의 lib/reconnectingSocket.ts 와 같은 코드. 고치면 둘 다)
 *
 * - 다시 붙는 간격: 지수 백오프 + 지터. 서버를 재시작하면 live 시청 학생(최대 수백 명) 화면이
 *   한꺼번에 끊긴다 — 모두 3초마다 같이 두드리면 막 켜진 서버에 몰린다. 간격을 늘리고 흩어 놓는다.
 *   기본 1초부터 두 배씩, 최대 10초. 300명이 동시에 끊기는 모의 실험에서 100ms 당 최대 접속 시도가
 *   300 → 약 70 (대신 서버가 돌아온 뒤 화면이 돌아오기까지 3초 이내 → 중앙 약 4초·최대 10초)
 * - 상태 맞추기는 서버가 한다: 붙자마자 서버가 그 채널의 지금 상태(대기 중이면 standby)를 보낸다.
 *   그래서 이 훅은 다시 붙기만 하고, 끊긴 동안 놓친 메시지를 따로 받지 않는다.
 * - 첫 메시지를 받아야 '붙었다'로 보고 백오프를 처음으로 돌린다 — 열리자마자 닫히는 서버(권한 거절 등)에
 *   매번 가장 짧은 간격으로 두드리지 않게.
 * - url 이 바뀌거나(채널 변경) 화면이 사라지면 옛 소켓은 닫고 다시 붙지 않는다. 늦게 온 옛 메시지도 버린다.
 */

export type SocketStatus = "connecting" | "open" | "reconnecting";

export interface ReconnectOptions {
  /** 첫 다시 붙기 간격의 상한 (ms) */
  baseMs?: number;
  /** 간격 상한 (ms) — 서버가 돌아온 뒤 화면이 늦게 돌아오는 최대 시간 */
  maxMs?: number;
  /** 붙어 있는 동안 이 간격으로 message 를 보낸다 (서버가 화면 생존을 센다) */
  heartbeat?: { everyMs: number; message: unknown };
  /** 테스트용 */
  random?: () => number;
}

export const DEFAULT_BASE_MS = 1000;
export const DEFAULT_MAX_MS = 10_000;

/** attempt 번째(0부터) 다시 붙기까지 기다릴 시간 — 상한의 절반 ~ 상한 사이 아무 값 ("equal jitter") */
export function backoffDelay(
  attempt: number,
  {
    baseMs = DEFAULT_BASE_MS,
    maxMs = DEFAULT_MAX_MS,
  }: Pick<ReconnectOptions, "baseMs" | "maxMs"> = {},
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

export interface SocketHandlers {
  /** JSON 으로 읽은 메시지 (JSON 이 아니면 부르지 않는다) */
  onMessage: (message: unknown) => void;
}

export function useReconnectingSocket(
  url: string | null,
  handlers: SocketHandlers,
  options: ReconnectOptions = {},
) {
  // 끊긴 시각(staleSince) — 이때부터 화면의 내용은 서버와 다를 수 있다. 다시 붙으면 null.
  // 어느 주소의 상태인지 같이 둔다 — 주소가 바뀌면(채널 변경) 새 주소는 처음부터 connecting
  const [conn, setConn] = useState<{
    url: string | null;
    status: SocketStatus;
    staleSince: number | null;
  }>({
    url,
    status: "connecting",
    staleSince: null,
  });
  // 핸들러·옵션은 매 렌더 새로 만들어져도 다시 붙지 않게 ref 로 — 소켓 이벤트는 늘 최신 것을 부른다
  const handlersRef = useRef(handlers);
  const optionsRef = useRef(options);
  useEffect(() => {
    handlersRef.current = handlers;
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let beatTimer: ReturnType<typeof setInterval> | undefined;

    const connect = () => {
      if (cancelled) return;
      clearTimeout(retryTimer);
      const sock = new WebSocket(url);
      ws = sock;
      let confirmed = false;

      sock.onopen = () => {
        if (cancelled) return;
        const beat = optionsRef.current.heartbeat;
        if (beat) {
          clearInterval(beatTimer);
          beatTimer = setInterval(() => {
            if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify(beat.message));
          }, beat.everyMs);
        }
      };

      sock.onmessage = (event) => {
        if (cancelled || sock !== ws) return;
        if (!confirmed) {
          confirmed = true;
          attempt = 0;
          setConn({ url, status: "open", staleSince: null });
        }
        let message: unknown;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        handlersRef.current.onMessage(message);
      };

      sock.onerror = () => sock.close(); // 다시 붙기는 onclose 에서

      sock.onclose = () => {
        clearInterval(beatTimer);
        if (cancelled || sock !== ws) return;
        setConn((prev) => ({
          url,
          status: "reconnecting",
          staleSince: (prev.url === url ? prev.staleSince : null) ?? Date.now(),
        }));
        const { baseMs, maxMs, random } = optionsRef.current;
        retryTimer = setTimeout(connect, backoffDelay(attempt, { baseMs, maxMs }, random));
        attempt += 1;
      };
    };

    // 기기 네트워크가 돌아오면 기다리지 않고 바로
    const onOnline = () => {
      if (cancelled || ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING)
        return;
      attempt = 0;
      connect();
    };
    window.addEventListener("online", onOnline);

    connect();

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      clearTimeout(retryTimer);
      clearInterval(beatTimer);
      ws?.close();
    };
  }, [url]);

  // 채널을 바꾸면 화면 내용도 비우므로 '오래된 내용'도 없다
  if (conn.url !== url) return { status: "connecting" as SocketStatus, staleSince: null };
  return { status: conn.status, staleSince: conn.staleSince };
}
