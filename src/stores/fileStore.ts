import { create } from "zustand";
import { UploadedFile } from "@/types/file";

interface FileState {
  files: UploadedFile[];
  setFiles: (files: UploadedFile[]) => void;
}

export const useFileStore = create<FileState>((set) => ({
  files: [],
  setFiles: (files) => set({ files }),
}));
