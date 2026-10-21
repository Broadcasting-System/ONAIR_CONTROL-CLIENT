/** 송출 채널 기본 이름 — 사람에게는 CH 번호 대신 나가는 곳 이름으로 보여 준다 (서버 DEFAULT_CHANNEL_NAMES 와 같게) */
export const CHANNEL_NAMES: Record<number, string> = {
  1: "방송 & 전광판",
  2: "다목적홀",
  3: "강당",
};

/** 채널 번호 → 보여 줄 이름 (이름 없는 채널은 CH4 처럼 번호 그대로, 없으면 빈 문자열) */
export const channelName = (n: number | string | null | undefined): string => {
  if (n === null || n === undefined || n === "") return "";
  return CHANNEL_NAMES[Number(n)] ?? `CH${n}`;
};
