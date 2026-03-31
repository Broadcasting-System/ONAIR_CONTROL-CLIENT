import { FileType } from "@/types/file";

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getAcceptedFormats = (type: FileType): string => {
  switch (type) {
    case "image":
      return "image/jpeg,image/png,image/gif";
    case "video":
      return "video/mp4,video/webm";
    case "audio":
      return "audio/mpeg,audio/wav";
    case "presentation":
      return "application/pdf";
    default:
      return "*/*";
  }
};

export const validateFile = (file: File, type: FileType): boolean => {
  const maxSize = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || "500000000", 10);
  if (file.size > maxSize) return false;

  const accepted = getAcceptedFormats(type).split(",");
  return accepted.some((format) => file.type === format || file.name.endsWith(format.split("/")[1]));
};

export const generateThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.src = URL.createObjectURL(file);
      video.onloadeddata = () => {
        video.currentTime = 1;
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg"));
        } else {
          resolve("");
        }
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => resolve("");
    } else if (file.type === "application/pdf") {
      resolve("");
    } else {
      resolve("");
    }
  });
};
