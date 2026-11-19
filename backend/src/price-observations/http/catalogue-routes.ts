import type { FastifyPluginAsync } from "fastify";
import { ListingId } from "../../shared/domain";
import { bearerTokenOf } from "../../shared/http";
import type { ListListings, ReadListing } from "../application";
import { Unauthenticated } from "./errors";
import { readPageNumbers } from "./page-numbers";
import { DEFAULT_LIMIT, listListingsSchema, readListingSchema } from "./schemas";
import type { UserAuthenticator } from "./user-authenticator";

export interface CatalogueRoutesOptions {
  readonly listListings: ListListings;
  readonly readListing: ReadListing;
  readonly authenticator: UserAuthenticator;
}

/**
 * The routes that read the Catalogue. They are for Users, so they are a plugin of their own with a hook
 * that asks for one, as the one of the Price History does: a hook belongs to the plugin that adds it.
 *
 * Nothing here writes: no other method is registered on these paths, so a request that would add,
 * change or remove a Listing finds no route (BR-08).
 */
export const catalogueRoutes: FastifyPluginAsync<CatalogueRoutesOptions> = async (
  app,
  { listListings, readListing, authenticator },
) => {
  // Authentication runs first, before the query is validated and before the Listing is looked for: a
  // request that is not authenticated learns nothing about what a valid one looks like, or about what
  // the Catalogue holds (BR-06, SC-19).
  app.addHook("onRequest", async (request) => {
    const token = bearerTokenOf(request.headers.authorization);
    const signedIn = token ? await authenticator.isUser(token) : false;
    if (!signedIn) throw new Unauthenticated();
  });

  // UC-01 List Listings
  app.get<{ Querystring: { limit?: number; offset?: number } }>(
    "/listings",
    { schema: listListingsSchema, preValidation: readPageNumbers },
    async (request) => {
      const { limit = DEFAULT_LIMIT, offset = 0 } = request.query;
      return listListings.execute({ limit, offset });
    },
  );

  // UC-02 Read a Listing
  app.get<{ Params: { listingId: string } }>("/listings/:listingId", { schema: readListingSchema }, async (request) =>
    readListing.execute({ listingId: ListingId(request.params.listingId) }),
  );
};
