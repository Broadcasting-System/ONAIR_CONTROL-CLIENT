export type FileType = 'image' | 'video' | 'audio' | 'presentation';

export interface UploadedFile {
  id: string;
  type: FileType;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  /** 영상 HLS 플레이리스트. 변환 전이면 서버가 내려주지 않는다. */
  hlsUrl?: string | null;
  urls?: string[];
  duration?: number;
  fileSize: number;
  uploadedAt: string;
}

