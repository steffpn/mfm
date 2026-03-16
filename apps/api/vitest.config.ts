import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000, // DB operations can be slow
    hookTimeout: 30000, // Server startup can be slow (pdfkit module loading)
    fileParallelism: false, // Tests share a DB -- run files sequentially
  },
});
