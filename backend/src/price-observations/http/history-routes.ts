import type { FastifyPluginAsync } from "fastify";
import { ListingId } from "../../shared/domain";
import { bearerTokenOf, sessionCookieHook, type SessionCookieSettings } from "../../shared/http";
import type { ReadPriceHistory } from "../application";
import { Unauthenticated } from "./errors";
import { readPageNumbers } from "./page-numbers";
import { DEFAULT_LIMIT, readPriceHistorySchema } from "./schemas";
import type { UserAuthenticator } from "./user-authenticator";

export interface PriceHistoryRoutesOptions {
  readonly readPriceHistory: ReadPriceHistory;
  readonly authenticator: UserAuthenticator;
  /** The cookie of the Session (feature 08). Without it nothing is read from a cookie (BR-10). */
  readonly sessionCookie?: SessionCookieSettings | undefined;
}

/**
 * The route that reads the Price History. It is a plugin of its own because it is read by Users,
 * and the hook of the routes that record prices asks for a Provider: a hook belongs to the plugin
 * that adds it, so the two do not mix, although they share a path with different methods.
 */
export const priceHistoryRoutes: FastifyPluginAsync<PriceHistoryRoutesOptions> = async (
  app,
  { readPriceHistory, authenticator, sessionCookie },
) => {
  // With the cookie on, it is turned into the header before the hook that authenticates (decision 1 of feature 08).
  if (sessionCookie) app.addHook("onRequest", sessionCookieHook(sessionCookie));

  // Authentication runs first, before the query is validated: a request that is not
  // authenticated learns nothing about what a valid request looks like (BR-04).
  app.addHook("onRequest", async (request) => {
    const token = bearerTokenOf(request.headers.authorization);
    const signedIn = token ? await authenticator.isUser(token) : false;
    if (!signedIn) throw new Unauthenticated();
  });

  // UC-02 of feature 05 Read the Price History
  app.get<{
    Params: { listingId: string };
    Querystring: { from?: string; to?: string; limit?: number; offset?: number };
  }>(
    "/listings/:listingId/price-observations",
    { schema: readPriceHistorySchema, preValidation: readPageNumbers },
    async (request) => {
      const { from, to, limit = DEFAULT_LIMIT, offset = 0 } = request.query;
      return readPriceHistory.execute({
        listingId: ListingId(request.params.listingId),
        ...(from === undefined ? {} : { from }),
        ...(to === undefined ? {} : { to }),
        limit,
        offset,
      });
    },
  );
};
