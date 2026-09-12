import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const isProduction = process.env.NODE_ENV === "production";
const isReplitDevelopment = !isProduction && process.env.REPL_ID !== undefined;

export default defineConfig({
  plugins: [
    react(),
    // Replit's runtime error overlay is development tooling. Shipping it in a
    // production build adds avoidable transforms/styles and can leak dev-only
    // chrome into the public bundle.
    ...(!isProduction ? [runtimeErrorOverlay()] : []),
    ...(isReplitDevelopment
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      // Compatibility bridge for live surfaces that still import the legacy
      // raster asset. The canonical artwork is the vector master in brand/.
      // Keep this exact alias before the broader @assets alias below.
      "@assets/DE-Logo-new_1762461524794.webp": path.resolve(
        import.meta.dirname,
        "brand",
        "digerati-logo-reverse.svg",
      ),
      "@brand": path.resolve(import.meta.dirname, "brand"),
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
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
