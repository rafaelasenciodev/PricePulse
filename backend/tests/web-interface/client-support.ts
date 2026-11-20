/** What the tests of the client against the real application share: a free port, and a `fetch` that behaves as a browser. */

import { createServer } from "node:net";
import type { FetchLike } from "../../../frontend/src/api";

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

/**
 * A browser for one person on the page of the application at `base`: it keeps the cookie that an answer sets, sends
 * it back, and adds the `Origin` of the page to a request that is not a read.
 */
export function browserFor(base: string, options: { sendsOrigin?: boolean } = {}): FetchLike {
  let cookie: string | null = null;
  return async (input, init) => {
    const headers = new Headers(init.headers as HeadersInit);
    if (cookie !== null) headers.set("cookie", cookie);
    const method = (init.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD" && options.sendsOrigin !== false) headers.set("origin", base);
    const response = await fetch(base + input, { ...init, headers, redirect: "manual" });
    for (const setCookie of response.headers.getSetCookie()) {
      const [pair = ""] = setCookie.split(";");
      const [name, value = ""] = pair.split("=");
      if (name === "pricepulse_session") cookie = value === "" ? null : `${name}=${value}`;
    }
    return response;
  };
}
