/**
 * The Session cookie (feature 08): the name of the cookie, how it is read from a `Cookie` header and
 * written for a `Set-Cookie` header, and how an origin is compared. Pure functions: they know nothing of
 * the framework, so they can be tested alone and the plugins of every feature can use them.
 */

/** The name of the cookie (Q2 of feature 08). */
export const SESSION_COOKIE_NAME = "pricepulse_session";

/**
 * What the application is told when the cookie is on (BR-10). Without it, nothing is set and nothing is read.
 */
export interface SessionCookieSettings {
  /** The only origin that the application accepts for a request that the cookie authenticates, such as "http://127.0.0.1:3000". */
  readonly origin: string;
  /** Whether the cookie is marked `Secure`: only when the application is served over HTTPS (BR-02). */
  readonly secure: boolean;
}

// The characters of the token of a bearer header (`token68`, RFC 6750), and the longest value that is read.
// The cookie holds the token as the header does, so what could not travel in the header is not a token.
const TOKEN = /^[A-Za-z0-9\-._~+/]+=*$/;
const MAXIMUM_VALUE_LENGTH = 512;

/**
 * The token that the cookie holds, or null if the `Cookie` header is missing, has no cookie of that exact
 * name, or holds a value that cannot be a token. It never throws.
 *
 * A name is compared as it is: `pricepulse_session_old` and `Pricepulse_Session` are other cookies. When
 * the name is there twice, the first is the one that is read, and it is not replaced by the second if it is
 * not valid: a browser sends the most specific first.
 */
export function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (cookieHeader === undefined) return null;
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    const value = pair.slice(separator + 1).trim();
    return value.length <= MAXIMUM_VALUE_LENGTH && TOKEN.test(value) ? value : null;
  }
  return null;
}

const attributes = (secure: boolean): string => `Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;

/**
 * The `Set-Cookie` that gives the cookie a token (BR-01, BR-02): for every path of the application, not
 * readable by scripts, and not sent with a request that another site makes. It lasts `maxAgeSeconds`.
 */
export function serializeSessionCookie(token: string, options: { readonly maxAgeSeconds: number; readonly secure: boolean }): string {
  if (!TOKEN.test(token) || token.length > MAXIMUM_VALUE_LENGTH) throw new RangeError("The token cannot be written in a cookie");
  if (!Number.isInteger(options.maxAgeSeconds) || options.maxAgeSeconds < 0) {
    throw new RangeError("The life of the cookie must be a whole number of seconds, at least 0");
  }
  return `${SESSION_COOKIE_NAME}=${token}; Max-Age=${options.maxAgeSeconds}; ${attributes(options.secure)}`;
}

/** The `Set-Cookie` that removes the cookie (BR-09): the same name, path and attributes, and a life of zero. */
export function serializeClearedSessionCookie(options: { readonly secure: boolean }): string {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; ${attributes(options.secure)}`;
}

/**
 * The origin of a text, in its normal form: the scheme, the host and the port, with no path. Only `http`
 * and `https` are origins of the application. It throws a `RangeError` for anything else, so that a wrong
 * setting is found when the application starts and not when a request comes.
 */
export function normalizeOrigin(text: string): string {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new RangeError(`The origin ${JSON.stringify(text)} is not a URL`);
  }
  const bare = url.pathname === "/" && url.search === "" && url.hash === "" && url.username === "" && url.password === "";
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname === "" || !bare) {
    throw new RangeError(`The origin ${JSON.stringify(text)} must be an http or https address with a host and no path`);
  }
  return url.origin;
}

/**
 * Whether the `Origin` header of a request is exactly the origin of the application (BR-07, BR-08): the same
 * scheme, host and port. A missing header, `null` (which a browser sends in some cases) and another port or
 * scheme of the same host do not match. `expected` is in the normal form that `normalizeOrigin` gives.
 */
export function originMatches(originHeader: string | undefined, expected: string): boolean {
  return originHeader !== undefined && originHeader.toLowerCase() === expected.toLowerCase();
}

/** A read does not change anything: a GET or a HEAD (BR-07). Any other method is a change. */
export function isRead(method: string): boolean {
  const upper = method.toUpperCase();
  return upper === "GET" || upper === "HEAD";
}
