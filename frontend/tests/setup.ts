import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest has no globals here, so Testing Library does not clean the page between tests by itself.
afterEach(cleanup);

// A simulated page has no layout, and the chart measures its container with the size observer of the browser: this one measures nothing.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
