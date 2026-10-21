export type DayType = "M" | "T" | "W" | "TH" | "F" | "P";

export interface Group {
  id: number;
  name: string;
  days: DaySchedule[];
}

export interface DaySchedule {
  dayType: DayType;
  bells: Bell[];
}

export interface Bell {
  id: string;
  label: string;
  time: string;
  audioFile: string;
  speakers: string[];
  /** 송출 볼륨(%) — 100 이 기본 크기. 예전 시보에는 없다 */
  volume?: number;
  /** 울리는 곳 — pc: ONAIR 가 음원을 스피커로, device: 장비(DMC-1000C)가 스스로. 없으면 pc.
   *  device 여도 audioFile·speakers·volume 은 남긴다 — 장비에 못 보냈을 때 PC 가 대신 울리는 백업 */
  ringBy?: "pc" | "device";
  /** ringBy=device: 장비 그룹 번호 (1~16) */
  deviceGroup?: number;
  /** ringBy=device: 장비 음원 번호 '002' */
  deviceTrack?: string;
}

export interface Speaker {
  id: string;
  name: string;
}

export interface AudioFile {
  id: string;
  name: string;
  url: string;
}
