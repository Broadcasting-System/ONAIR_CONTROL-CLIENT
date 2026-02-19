export interface SpeakerZone {
  id: string;
  name: string;
  status: "on" | "off" | "error";
  volume?: number;
}

export interface SpeakerState {
  zones: SpeakerZone[];
  masterUnknown?: boolean;
}
