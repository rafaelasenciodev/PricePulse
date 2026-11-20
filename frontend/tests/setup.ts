import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest has no globals here, so Testing Library does not clean the page between tests by itself.
afterEach(cleanup);
