import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  cacheDir: process.env.VITE_CACHE_DIR || path.resolve(import.meta.dirname, "node_modules/.vite"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules[\\/](react|react-dom|scheduler|wouter|@tanstack)[\\/]/.test(id)) {
            return "framework";
          }
          if (/node_modules[\\/](@radix-ui|cmdk|vaul|lucide-react|react-icons)[\\/]/.test(id)) {
            return "ui-vendor";
          }
          if (/node_modules[\\/](framer-motion|embla-carousel|embla-carousel-react)[\\/]/.test(id)) {
            return "motion";
          }
          if (/node_modules[\\/](recharts|d3-|victory-vendor)[\\/]/.test(id)) {
            return "charts";
          }
          if (/node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/.test(id)) {
            return "forms";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
