import { defineConfig } from "vite";

// 모바일 개발(tauri ios/android dev)은 기기가 이 맥의 개발 서버에 붙어야 해서 CLI 가 TAURI_DEV_HOST 를 준다
declare const process: { env: Record<string, string | undefined> };
const host: string | undefined = process.env.TAURI_DEV_HOST;

// Tauri 개발 서버 규칙: 고정 포트 1420, 화면 지우지 않기
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || "localhost",
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    target: "es2021",
    outDir: "dist",
    emptyOutDir: true,
  },
});
