export type FileType = 'image' | 'video' | 'audio' | 'presentation';

export interface UploadedFile {
  id: string;
  type: FileType;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  uploadedAt: string;
}
