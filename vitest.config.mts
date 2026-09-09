import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    // The `server-only` marker package throws on import outside a React Server
    // Component; alias it to an empty shim so server modules (cron route,
    // notifications) import cleanly under the node test env.
    alias: {
      "server-only": fileURLToPath(new URL("./tests/shims/server-only.ts", import.meta.url)),
    },
  },
});
