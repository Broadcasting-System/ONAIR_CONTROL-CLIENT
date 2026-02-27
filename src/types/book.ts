export type BookDayType = "M" | "T" | "W" | "TH" | "F" | "P";

export interface Book {
  id: string;
  name: string;
  time: string; // HH:mm format
  date?: string; // YYYY.MM.DD format, only used if days includes "P"
  days: BookDayType[]; // e.g., ["M", "W", "F"] or ["P"]
  mediaUrl?: string; // TBD later, just to hold the preview
}
