import { del, download, post, put, request, seg } from "@/lib/http";
import type {
  BridgeDevice, BridgeKitInfo, BridgesStatus, ConnectionTestResult, DiscoverResult, HallSummary, HallsStatus,
  LearnedParam, MatrixConnection, MatrixTryResult, MidiPorts, MixerConfig, MixerConnection, MixerState,
  ProcessingRole, SerialPortInfo, VideoMatrixState,
} from "@/types/hall";

/** 서버로 보낼 매트릭스 연결 값 (후보 목록 같은 화면용 값은 뺀다) */
const matrixBody = (c: MatrixConnection) => ({ driver: c.driver, bridge: c.bridge, protocol: c.protocol });

export const hallApi = {
  list: () => request<{ halls: HallSummary[] }>("/halls"),
  status: () => request<HallsStatus>("/halls/status"),
  bridges: () => request<BridgesStatus>("/halls/bridges"),

  mixer: (hall: string) => request<MixerState>(`/halls/${seg(hall)}/mixer`),
  recallScene: (hall: string, pc: number) =>
    post<{ success: boolean; scene: string }>(`/halls/${seg(hall)}/mixer/scene`, { pc }),
  setChannel: (hall: string, channel: string, body: { level?: number; mute?: boolean }) =>
    post<{ success: boolean }>(`/halls/${seg(hall)}/mixer/channels/${seg(channel)}`, body),
  // 게인·이펙트 보내기는 운영, EQ·컴프레서는 관리자 (서버가 경로로 막는다)
  setParam: (hall: string, channel: string, role: ProcessingRole, value: number | boolean) =>
    post<{ success: boolean }>(`/halls/${seg(hall)}/mixer/channels/${seg(channel)}/param/${seg(role)}`, { value }),
  // 처리 화면에서 '찾기'로 얻은 콘솔 주소 한 칸 저장 (관리자) — 빈 문자열이면 지운다
  setParamAddress: (hall: string, channel: string, role: string, param: string, invert = false) =>
    put<{ success: boolean }>(`/halls/${seg(hall)}/mixer/channels/${seg(channel)}/address/${seg(role)}`, {
      param,
      invert,
    }),
  renameFx: (hall: string, fxId: string, name: string) =>
    put<{ success: boolean }>(`/halls/${seg(hall)}/mixer/fx/${seg(fxId)}`, { name }),

  matrix: (hall: string) => request<VideoMatrixState>(`/halls/${seg(hall)}/matrix`),
  route: (hall: string, output: number, input: number) =>
    post<{ success: boolean }>(`/halls/${seg(hall)}/matrix/route`, { output, input }),
  routeAll: (hall: string, input: number) =>
    post<{ success: boolean }>(`/halls/${seg(hall)}/matrix/route-all`, { input }),
  applyPreset: (hall: string, presetId: string) =>
    post<{ success: boolean; preset: string }>(`/halls/${seg(hall)}/matrix/presets/${seg(presetId)}/apply`),
  savePreset: (hall: string, name: string) =>
    post<{ id: string; name: string }>(`/halls/${seg(hall)}/matrix/presets`, { name }),
  deletePreset: (hall: string, presetId: string) =>
    del<{ success: boolean }>(`/halls/${seg(hall)}/matrix/presets/${seg(presetId)}`),

  // 관리자 설정 편집 — 이름·씬 목록·채널 구성 (믹서 연결 방식은 아래 '현장 세팅')
  updateMixerConfig: (hall: string, config: MixerConfig) =>
    put<{ success: boolean }>(`/halls/${seg(hall)}/mixer/config`, config),
  updateMatrixConfig: (hall: string, inputs: string[], outputs: string[]) =>
    put<{ success: boolean }>(`/halls/${seg(hall)}/matrix/config`, { inputs, outputs }),

  // 믹서 주소 찾기 — 콘솔에서 움직인 파라미터를 기록
  learnStart: (hall: string) => post<{ watching: number }>(`/halls/${seg(hall)}/mixer/learn/start`),
  learnResults: (hall: string) =>
    request<{ active: boolean; moved: LearnedParam[] }>(`/halls/${seg(hall)}/mixer/learn`),
  learnStop: (hall: string) => post<{ success: boolean }>(`/halls/${seg(hall)}/mixer/learn/stop`),

  // 현장 세팅 (관리자) — 연결 방식, 저장 전 시험, 콘솔 찾기, 노트북 MIDI 포트
  updateMixerConnection: (hall: string, conn: MixerConnection) =>
    put<{ success: boolean }>(`/halls/${seg(hall)}/mixer/connection`, conn),
  testMixerConnection: (hall: string, conn: MixerConnection) =>
    post<ConnectionTestResult>(`/halls/${seg(hall)}/mixer/connection/test`, conn),
  discoverConsoles: (body: { via: "server" | "bridge"; bridgeUrl?: string; seconds?: number }) =>
    post<DiscoverResult>("/halls/discover", body),
  bridgeMidiPorts: (url: string) => post<MidiPorts>("/halls/bridge/midi-ports", { url }),
  bridgeConfigureMidi: (url: string, device: string, out: string, inPort?: string | null) =>
    put<{ out: string; in: string | null; open: boolean }>("/halls/bridge/midi", {
      url,
      device,
      out,
      in: inPort ?? null,
    }),
  // 세팅 확인용 — 조작 범위·숨김과 상관없이 움직여 보고, 씬은 방송부 알림 없이 부른다
  tryChannel: (hall: string, channel: string, body: { level?: number; mute?: boolean }) =>
    post<{ success: boolean }>(`/halls/${seg(hall)}/mixer/test/channels/${seg(channel)}`, body),
  tryScene: (hall: string, pc: number) =>
    post<{ success: boolean; scene: string }>(`/halls/${seg(hall)}/mixer/test/scene`, { pc }),

  // 영상 매트릭스 현장 세팅 (관리자) — 노트북 COM 포트, 명령 문법, 저장 전 시험
  bridgeSerialPorts: (url: string) => post<{ ports: SerialPortInfo[] }>("/halls/bridge/serial-ports", { url }),
  bridgeConfigureSerial: (url: string, device: string, port: string, baud: number) =>
    put<BridgeDevice>("/halls/bridge/serial", { url, device, port, baud }),
  updateMatrixConnection: (hall: string, conn: MatrixConnection) =>
    put<{ success: boolean }>(`/halls/${seg(hall)}/matrix/connection`, matrixBody(conn)),
  testMatrixConnection: (hall: string, conn: MatrixConnection) =>
    post<ConnectionTestResult>(`/halls/${seg(hall)}/matrix/connection/test`, matrixBody(conn)),
  tryMatrixRoute: (hall: string, conn: MatrixConnection, output: number, input: number) =>
    post<MatrixTryResult>(`/halls/${seg(hall)}/matrix/test/route`, { ...matrixBody(conn), output, input }),

  // 노트북(브릿지) 설치 파일 (관리자) — 이 컴퓨터로 받기, 또는 노트북 브라우저로 받을 30분짜리 주소
  bridgeKitInfo: () => request<BridgeKitInfo>("/halls/bridge/kit-info"),
  downloadBridgeKit: (name: string, server: string) =>
    download("/halls/bridge/kit", { name, server }, `ONAIR-bridge-${name}.zip`),
  bridgeKitLink: (name: string, server: string) =>
    post<{ url: string; expiresAt: number }>("/halls/bridge/kit-link", { name, server }),
};
