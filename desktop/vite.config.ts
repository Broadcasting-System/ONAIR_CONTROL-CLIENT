import { defineConfig } from "vite";

// Tauri 개발 서버 규칙: 고정 포트 1420, 화면 지우지 않기
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: "localhost" },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    target: "es2021",
    outDir: "dist",
    emptyOutDir: true,
  },
});
