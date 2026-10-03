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
        find: "@statewalker/content-store",
        replacement: path.resolve(import.meta.dirname, "../content-store/src/index.ts"),
      },
      {
        find: "@statewalker/storage",
        replacement: path.resolve(import.meta.dirname, "../storage/src/index.ts"),
      },
      {
        find: "@statewalker/files-sync",
        replacement: path.resolve(import.meta.dirname, "../files-sync/src/index.ts"),
      },
    ],
  },
});
