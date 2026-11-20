import { ForbiddenOrigin } from "./forbidden-origin";
import { isRead, originMatches, readSessionCookie, type SessionCookieSettings } from "./session-cookie";

/**
 * What the hooks need of a request. The request of the framework has all of it, and this module does not
 * import the framework.
 */
export interface CookieHookRequest {
  readonly method: string;
  readonly headers: {
    authorization?: string | undefined;
    cookie?: string | undefined;
    origin?: string | undefined;
  };
}

/**
 * The hook of the routes of Users, which goes before the one that authenticates (decision 1 of feature 08).
 *
 * It turns the cookie into the `Authorization` header of the request, in memory, so that everything after it
 * reads the header as it always did and does not know where the token came from.
 *
 * - A request that has an `Authorization` header, whatever it holds, is left as it is (BR-05).
 * - A request with no valid cookie is left as it is, and is not authenticated.
 * - A change that the cookie would authenticate must come from the application: its `Origin` must be the
 *   one of the settings, and one that is missing is refused (BR-07). This is checked before the token is.
 * - A read is not checked: it changes nothing (BR-07).
 *
 * The routes of Providers do not add it, so a cookie never identifies one (BR-06).
 */
export function sessionCookieHook(settings: SessionCookieSettings): (request: CookieHookRequest) => Promise<void> {
  return async (request) => {
    if (request.headers.authorization !== undefined) return;
    const token = readSessionCookie(request.headers.cookie);
    if (token === null) return;
    if (!isRead(request.method) && !originMatches(request.headers.origin, settings.origin)) throw new ForbiddenOrigin();
    request.headers.authorization = `Bearer ${token}`;
  };
}

/**
 * The hook of the routes to sign in and to register (BR-08). They have no credential to forge, but a page of
 * another site could make a person sign in to an Account that is not theirs. A request that carries an
 * `Origin` that is not the application's is refused, and one that carries none, which is what a program
 * sends, goes on.
 */
export function publicOriginHook(settings: SessionCookieSettings): (request: CookieHookRequest) => Promise<void> {
  return async (request) => {
    const origin = request.headers.origin;
    if (origin !== undefined && !originMatches(origin, settings.origin)) throw new ForbiddenOrigin();
  };
}
