export type BookDayType = "M" | "T" | "W" | "TH" | "F" | "P";

export interface Book {
  id: string;
  name: string;
  time: string;
  date?: string;
  days: BookDayType[];
  mediaUrl?: string;
  mediaType?: string;
}
