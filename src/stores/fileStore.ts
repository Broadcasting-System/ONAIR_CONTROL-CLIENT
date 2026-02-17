import { create } from "zustand";
import { FileItem } from "@/types/file";

interface FileStore {
  files: FileItem[];
  setFiles: (files: FileItem[]) => void;
}

export const useFileStore = create<FileStore>((set) => ({
  files: [],
  setFiles: (files) => set({ files }),
}));
