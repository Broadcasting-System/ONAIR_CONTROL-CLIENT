/** 녹음·녹화 화면 공용 표시 */

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return [h, m, s % 60].map((v) => String(v).padStart(2, "0")).join(":");
}

/** 길이 — 목록용 0:48:02 */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function gb(bytes: number): string {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
}

/** 10.05 (토) 13:10 */
export function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} (${WEEKDAYS[d.getDay()]}) ${p(d.getHours())}:${p(d.getMinutes())}`;
}
