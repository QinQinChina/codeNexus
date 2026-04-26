// Vite 配置：仅用于渲染进程构建与本地开发端口设置。
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

export default defineConfig(({ command }) => {
  return {
    plugins: [vue()],
    root: resolve(__dirname, "src/renderer"),
    // Electron 生产态使用 file:// 加载 index.html，必须使用相对路径引用 assets，避免出现白屏。
    base: command === "build" ? "./" : "/",
    build: {
      outDir: resolve(__dirname, "dist/renderer"),
      emptyOutDir: true,
      // ECharts 产物体积天然较大（当前已独立分块），提升阈值避免噪音告警。
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ["vue", "pinia"],
            ui: ["lucide-vue-next"],
            markdown: ["markdown-it", "dompurify"],
            charts: ["echarts", "echarts-liquidfill"],
            editor: [
              "codemirror",
              "@codemirror/commands",
              "@codemirror/language",
              "@codemirror/language-data",
              "@codemirror/state",
              "@codemirror/view",
              "@lezer/highlight",
            ],
          },
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  };
});
