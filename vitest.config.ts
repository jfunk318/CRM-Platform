import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    // Database tests share one Postgres; run files one at a time.
    fileParallelism: false,
    env: {
      // Uploads made by tests go to a temp folder, never ./storage.
      STORAGE_DIR: path.join(tmpdir(), "nametbd-test-storage"),
    },
  },
});
