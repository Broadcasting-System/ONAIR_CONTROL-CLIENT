export type FileType = 'image' | 'video' | 'audio' | 'presentation';

export interface UploadedFile {
  id: string;
  type: FileType;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  urls?: string[];
  duration?: number;
  fileSize: number;
  uploadedAt: string;
}

