import { defineConfig } from "vitest/config";

// The database tests share one database, so they run in one worker, one file after another.
export default defineConfig({
  test: {
    include: ["tests/**/*.db.test.ts"],
    globalSetup: ["tests/support/database-global-setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
