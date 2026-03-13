import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/*/src/**/*.test.ts", "apps/daemons/src/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".next", ".turbo"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "apps/daemons/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts", "**/*.d.ts"],
    },
  },
})
