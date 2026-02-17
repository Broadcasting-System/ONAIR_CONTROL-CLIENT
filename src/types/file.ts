export interface FileItem {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  url: string;
  type: "AUDIO" | "VIDEO" | "IMAGE" | "OTHER";
}
