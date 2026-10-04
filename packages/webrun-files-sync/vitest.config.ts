import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    // More specific finds (`-mem`, `webrun-merge`) must precede the shorter
    // `@statewalker/webrun-files` prefix so aliasing does not shadow them.
    alias: [
      {
        find: "@statewalker/webrun-merge",
        replacement: path.resolve(import.meta.dirname, "../webrun-merge/src/index.ts"),
      },
    ],
  },
});
