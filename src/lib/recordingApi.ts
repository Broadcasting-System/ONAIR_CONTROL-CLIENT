import { getApiBase } from "@/lib/apiBase";
import { del, post, put, request, seg } from "@/lib/http";
import type {
  AmbientMode, InputDevice, LaneMode, MergeJob, RecordingConnection, RecordingItem, RecordingLane, RecordingState,
  UploadedVideo,
} from "@/types/recording";

const hallBase = (hall: string) => `/halls/${seg(hall)}/recording`;

export interface RecordingConfigBody extends Omit<RecordingConnection, "device"> {
  device?: string;
  lanes: string[];
  splitLanes: boolean;
}

export const recordingApi = {
  state: (hall: string) => request<RecordingState>(hallBase(hall)),
  start: (hall: string, label: string) => post<RecordingState>(`${hallBase(hall)}/start`, { label }),
  stop: (hall: string) => post<RecordingItem>(`${hallBase(hall)}/stop`),
  // 연결·입력 장치·통로, 녹음 버스 채널은 관리자 (서버가 경로로 막는다)
  devices: (hall: string) => request<{ devices: InputDevice[] }>(`${hallBase(hall)}/devices`),
  saveConfig: (hall: string, body: RecordingConfigBody) =>
    put<{ lanes: RecordingLane[] }>(`${hallBase(hall)}/config`, body),
  saveSends: (hall: string, lanes: number[][]) =>
    put<{ lanes: RecordingLane[]; applied: boolean; detail: string }>(`${hallBase(hall)}/sends`, { lanes }),

  library: (hall?: string) =>
    request<{ recordings: RecordingItem[] }>(`/recordings${hall ? `?hall=${seg(hall)}` : ""}`),
  rename: (id: string, label: string) => request<RecordingItem>(`/recordings/${seg(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ label }),
  }),
  retryImport: (id: string) => post<RecordingItem>(`/recordings/${seg(id)}/import`),
  remove: (id: string) => del<{ success: boolean }>(`/recordings/${seg(id)}`),
  /** 듣기(바로 재생) · 받기(download) 주소. lane 0 = 2채널 원본, 1·2 = 통로 하나 */
  audioUrl: (id: string, lane = 0, download = false) =>
    `${getApiBase()}/recordings/${seg(id)}/audio?lane=${lane}${download ? "&download=1" : ""}`,

  videos: () => request<{ videos: UploadedVideo[] }>("/recordings/videos"),
  removeVideo: (id: string) => del<{ success: boolean }>(`/recordings/videos/${seg(id)}`),
  jobs: () => request<{ jobs: MergeJob[] }>("/recordings/merge"),
  merge: (body: { videoId: string; recordingId: string; lanes: LaneMode; ambient: AmbientMode; nudgeMs: number }) =>
    post<MergeJob>("/recordings/merge", body),
  removeJob: (id: string) => del<{ success: boolean }>(`/recordings/merge/${seg(id)}`),
  jobFileUrl: (id: string, download = false) =>
    `${getApiBase()}/recordings/merge/${seg(id)}/file${download ? "?download=1" : ""}`,

  /** 영상 올리기 — 수 GB 라 진행률을 보여 준다. abort 로 멈출 수 있다 */
  uploadVideo: (file: File, onProgress: (ratio: number) => void) => {
    const xhr = new XMLHttpRequest();
    const done = new Promise<UploadedVideo>((resolve, reject) => {
      const form = new FormData();
      form.append("file", file);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText) as UploadedVideo);
          return;
        }
        let message = xhr.status === 403 ? "이 작업을 수행할 권한이 없습니다." : `올리지 못했습니다 (HTTP ${xhr.status})`;
        try {
          const detail = JSON.parse(xhr.responseText)?.detail;
          if (typeof detail === "string") message = detail;
        } catch {
          /* 본문 없음 */
        }
        reject(new Error(message));
      };
      xhr.onerror = () => reject(new Error("네트워크 오류로 영상을 올리지 못했습니다."));
      xhr.onabort = () => reject(new Error("올리기를 멈췄습니다."));
      xhr.open("POST", `${getApiBase()}/recordings/videos`, true);
      xhr.send(form);
    });
    return { done, abort: () => xhr.abort() };
  },
};
