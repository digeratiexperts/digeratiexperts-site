import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["client/src/**/*.test.ts", "server/**/*.test.ts", "shared/**/*.test.ts", "scripts/**/*.test.ts"],
    // msp-advisor is written against the node:test runner and is executed by
    // `npm run test:advisor`. Collecting it here makes Vitest fail the suite
    // with "No test suite found".
    exclude: ["**/node_modules/**", "**/dist/**", "server/services/msp-advisor/**"],
  },
  resolve: {
    alias: {
      "@assets/DE-Logo-new_1762461524794.webp": path.resolve(
        __dirname,
        "brand",
        "digerati-logo-reverse.svg",
      ),
      "@brand": path.resolve(__dirname, "brand"),
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
});
