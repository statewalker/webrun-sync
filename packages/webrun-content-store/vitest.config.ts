import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: [
      {
        find: "@statewalker/webrun-storage",
        replacement: path.resolve(import.meta.dirname, "../webrun-storage/src/index.ts"),
      },
    ],
  },
});
