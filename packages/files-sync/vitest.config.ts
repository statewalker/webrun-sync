import path from "node:path";
import { defineConfig } from "vitest/config";


export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    // More specific finds (`-mem`, `merge-core`) must precede the shorter
    // `@statewalker/webrun-files` prefix so aliasing does not shadow them.
    alias: [
      {
        find: "@statewalker/merge-core",
        replacement: path.resolve(import.meta.dirname, "../merge-core/src/index.ts"),
      },
    ],
  },
});
