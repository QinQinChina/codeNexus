import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["dist/**", "release/**", "node_modules/**", "src/generated/**"],
    globals: false,
  },
});
