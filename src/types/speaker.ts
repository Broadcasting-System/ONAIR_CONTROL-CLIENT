export interface SpeakerZone {
  id: string;
  name: string;
  active: boolean;
  volume?: number;
}

export interface SpeakerState {
  zones: SpeakerZone[];
  masterUnknown?: boolean;
}
