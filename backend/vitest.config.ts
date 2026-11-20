import { configDefaults, defineConfig } from "vitest/config";

// `npm test` stays in memory: the tests that need the database are `*.db.test.ts`, run by `npm run test:db`.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, "**/*.db.test.ts"] },
});
