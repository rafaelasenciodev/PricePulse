import type { FastifyPluginAsync } from "fastify";
import { ListingId } from "../../shared/domain";
import type { ReadPriceHistory } from "../application";
import { Unauthenticated } from "./errors";
import { DEFAULT_LIMIT, readPriceHistorySchema } from "./schemas";
import type { UserAuthenticator } from "./user-authenticator";

export interface PriceHistoryRoutesOptions {
  readonly readPriceHistory: ReadPriceHistory;
  readonly authenticator: UserAuthenticator;
}

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * The numbers of a URL arrive as text, and the validation of the application is strict on purpose.
 * Only for the two numbers of a page, whole numbers written in digits are read as numbers. Anything
 * else stays as it is and the validation rejects it.
 */
async function readPageNumbers(request: { readonly query: unknown }): Promise<void> {
  const query = request.query as Record<string, unknown>;
  for (const key of ["limit", "offset"]) {
    const value = query[key];
    if (typeof value === "string" && /^\d+$/.test(value)) query[key] = Number(value);
  }
}

/**
 * The route that reads the Price History. It is a plugin of its own because it is read by Users,
 * and the hook of the routes that record prices asks for a Provider: a hook belongs to the plugin
 * that adds it, so the two do not mix, although they share a path with different methods.
 */
export const priceHistoryRoutes: FastifyPluginAsync<PriceHistoryRoutesOptions> = async (
  app,
  { readPriceHistory, authenticator },
) => {
  // Authentication runs first, before the query is validated: a request that is not
  // authenticated learns nothing about what a valid request looks like (BR-04).
  app.addHook("onRequest", async (request) => {
    const token = BEARER.exec(request.headers.authorization ?? "")?.[1]?.trim();
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
