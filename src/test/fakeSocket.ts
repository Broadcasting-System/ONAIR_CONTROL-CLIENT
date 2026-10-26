/** 테스트용 WebSocket — 만든 소켓을 모아 두고, 서버 쪽 동작(열기·메시지·끊기)을 테스트가 직접 일으킨다 */
export class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static all: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.all.push(this);
  }

  static reset() {
    FakeWebSocket.all = [];
  }

  static last() {
    return FakeWebSocket.all[FakeWebSocket.all.length - 1];
  }

  send(data: string) {
    this.sent.push(data);
  }

  /** 앱이 스스로 닫음 — 브라우저처럼 onclose 는 나중에(비동기) 온다 */
  close() {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSING;
    queueMicrotask(() => this.serverClose());
  }

  // ---- 서버 쪽 ----
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  message(data: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }

  serverClose() {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close"));
  }
}
