import type { FastifyPluginAsync } from "fastify";
import type { CreatePriceAlert } from "../application";
import { ListingId, type UserId } from "../domain";
import type { Authenticator } from "./authenticator";
import { Unauthenticated } from "./errors";

declare module "fastify" {
  interface FastifyRequest {
    /** The User who makes the request, set by the authentication hook. */
    owner: UserId | null;
  }
}

export interface PriceAlertRoutesOptions {
  readonly createPriceAlert: CreatePriceAlert;
  readonly authenticator: Authenticator;
}

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * The authenticated User of a request.
 *
 * The authentication hook guarantees it. This fails safe if it ever does not, for example
 * if the route is moved to a place without the hook: the use case must never receive a
 * request without an owner.
 */
export function ownerOf(request: { readonly owner: UserId | null }): UserId {
  if (request.owner === null) throw new Unauthenticated();
  return request.owner;
}

export const priceAlertRoutes: FastifyPluginAsync<PriceAlertRoutesOptions> = async (
  app,
  { createPriceAlert, authenticator },
) => {
  app.decorateRequest("owner", null);

  // Authentication runs first, before the body is validated: a request that is not
  // authenticated learns nothing about what a valid request looks like (BR-01, SC-14).
  app.addHook("onRequest", async (request) => {
    const token = BEARER.exec(request.headers.authorization ?? "")?.[1]?.trim();
    const owner = token ? await authenticator.authenticate(token) : null;
    if (owner === null) throw new Unauthenticated();
    request.owner = owner;
  });

  // UC-01 Create Price Alert
  app.post<{ Params: { listingId: string }; Body: { targetAmount: string } }>(
    "/listings/:listingId/price-alerts",
    {
      schema: {
        params: {
          type: "object",
          required: ["listingId"],
          properties: { listingId: { type: "string", minLength: 1 } },
        },
        body: {
          type: "object",
          required: ["targetAmount"],
          // The owner is never taken from the body: unknown fields are rejected.
          additionalProperties: false,
          properties: { targetAmount: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const result = await createPriceAlert.execute({
        owner: ownerOf(request),
        listingId: ListingId(request.params.listingId),
        targetAmount: request.body.targetAmount,
      });
      // 201 for a new Price Alert, 200 when an existing one is returned (BR-08).
      return reply.code(result.created ? 201 : 200).send(result.alert);
    },
  );
};
