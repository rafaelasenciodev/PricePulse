import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The tests of screens run in a simulated page.
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    // Instants are shown with the format of the browser, so the tests fix the time zone: what they expect does not depend on the machine.
    env: { TZ: "UTC" },
  },
});
