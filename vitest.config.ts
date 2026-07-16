import { defineConfig } from "vitest/config";
import { resolve } from "path";

// Resolve the "@/..." path alias (declared in tsconfig) for tests, and run in
// a Node environment since the suites cover server/library code.
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
});
