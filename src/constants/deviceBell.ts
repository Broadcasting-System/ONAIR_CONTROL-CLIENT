/** L&B DMC-1000C 장비 시보 — 장비가 스스로 울리는 그룹·음원. 목록은 서버(config/lnb_timer.json)가 정한다 (GET /api/time/device) */

export interface DeviceGroup {
  /** 장비 GROUP SET 버튼 순서 */
  no: number;
  name: string;
}

export interface DeviceTrack {
  /** 장비 USB 파일 번호 '001' */
  no: string;
  name: string;
}

/** 적용하기·특별 모드 스위치 뒤 장비 전송 결과 (POST /api/time 응답의 device) */
export interface DeviceSyncResult {
  status: "sent" | "failed" | "disabled" | "deferred";
  ok: boolean;
  message: string;
  /** 서버 시각(ms) */
  at: number;
  kind?: "tables" | "link";
  rows?: number | null;
  deferAt?: number;
  error?: string;
}

export interface DeviceBellInfo {
  /** LNB_TIMER_ENABLED — 꺼져 있으면 장비 줄은 PC 로 울린다 */
  enabled: boolean;
  groups: DeviceGroup[];
  tracks: DeviceTrack[];
  last: DeviceSyncResult | null;
  /** 장비가 들고 있는 줄 수 (모르면 null) */
  rows: number | null;
  link: "on" | "special" | null;
  pending: { at: number } | null;
}

export const DEFAULT_DEVICE_GROUP = 7;
export const DEFAULT_DEVICE_TRACK = "001";

export const deviceGroupName = (groups: DeviceGroup[], no?: number) =>
  groups.find((g) => g.no === no)?.name ?? (no != null ? `그룹 ${no}` : "그룹 없음");

/** 장비에 못 보냈을 때 PC 로 대신 울릴 음원·스피커가 있나 */
export const hasPcBackup = (b: { audioFile?: string; speakers?: string[] }) =>
  !!b.audioFile && b.audioFile !== "none" && (b.speakers?.length ?? 0) > 0;
