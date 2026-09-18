import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const isVercelBuild = Boolean(process.env.VERCEL);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Local FastAPI serves the compiled SPA from backend/static. Vercel
    // deploys the frontend project itself and expects its output in dist.
    outDir: isVercelBuild ? "dist" : path.resolve(__dirname, "../backend/static"),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
    },
  },
});
