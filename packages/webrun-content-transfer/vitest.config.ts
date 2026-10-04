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
        find: "@statewalker/webrun-content-store",
        replacement: path.resolve(import.meta.dirname, "../webrun-content-store/src/index.ts"),
      },
      {
        find: "@statewalker/webrun-storage",
        replacement: path.resolve(import.meta.dirname, "../webrun-storage/src/index.ts"),
      },
      {
        find: "@statewalker/webrun-files-sync",
        replacement: path.resolve(import.meta.dirname, "../webrun-files-sync/src/index.ts"),
      },
    ],
  },
});
