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
