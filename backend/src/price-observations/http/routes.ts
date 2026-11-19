import type { FastifyPluginAsync } from "fastify";
import { ListingId } from "../../shared/domain";
import type { RecordPriceObservation } from "../application";
import type { ProviderId } from "../domain";
import type { ProviderAuthenticator } from "./authenticator";
import { Unauthenticated } from "./errors";
import { recordPriceObservationSchema } from "./schemas";

declare module "fastify" {
  interface FastifyRequest {
    /** The Provider who makes the request, set by the authentication hook. */
    provider: ProviderId | null;
  }
}

export interface PriceObservationRoutesOptions {
  readonly recordPriceObservation: RecordPriceObservation;
  readonly authenticator: ProviderAuthenticator;
}

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * The authenticated Provider of a request.
 *
 * The authentication hook guarantees it. This fails safe if it ever does not, for example
 * if the route is moved to a place without the hook: the use case must never receive a
 * request without a Provider.
 */
export function providerOf(request: { readonly provider: ProviderId | null }): ProviderId {
  if (request.provider === null) throw new Unauthenticated();
  return request.provider;
}

export const priceObservationRoutes: FastifyPluginAsync<PriceObservationRoutesOptions> = async (
  app,
  { recordPriceObservation, authenticator },
) => {
  app.decorateRequest("provider", null);

  // Authentication runs first, before the body is validated: a request that is not
  // authenticated learns nothing about what a valid request looks like (BR-01, SC-16, SC-17).
  // The hook belongs to this plugin: it does not apply to the routes of other features.
  app.addHook("onRequest", async (request) => {
    const token = BEARER.exec(request.headers.authorization ?? "")?.[1]?.trim();
    const provider = token ? await authenticator.authenticate(token) : null;
    if (provider === null) throw new Unauthenticated();
    request.provider = provider;
  });

  // UC-01 Record Price Observation
  app.post<{
    Params: { listingId: string };
    Body: { observedAt: string; price: { amount: string; currency: string } | null };
  }>("/listings/:listingId/price-observations", { schema: recordPriceObservationSchema }, async (request, reply) => {
    const result = await recordPriceObservation.execute({
      provider: providerOf(request),
      listingId: ListingId(request.params.listingId),
      observedAt: request.body.observedAt,
      price: request.body.price,
    });
    // 201 for a new Price Observation, 200 when an existing one is returned (BR-09).
    return reply.code(result.recorded ? 201 : 200).send(result.observation);
  });
};
