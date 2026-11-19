import type { FastifyPluginAsync } from "fastify";
import type {
  CancelPriceAlert,
  CreatePriceAlert,
  GetPriceAlert,
  ListNotifications,
  ListPriceAlerts,
  ModifyTargetPrice,
} from "../application";
import { ListingId } from "../../shared/domain";
import { AlertId, type AlertStatus, type UserId } from "../domain";
import type { Authenticator } from "./authenticator";
import { Unauthenticated } from "./errors";
import {
  DEFAULT_LIMIT,
  createPriceAlertSchema,
  getPriceAlertSchema,
  listNotificationsSchema,
  listPriceAlertsSchema,
  patchPriceAlertSchema,
} from "./schemas";

declare module "fastify" {
  interface FastifyRequest {
    /** The User who makes the request, set by the authentication hook. */
    owner: UserId | null;
  }
}

/** The use cases to read and manage Price Alerts. Optional: without them only creating is served. */
export interface PriceAlertManagement {
  readonly listPriceAlerts: ListPriceAlerts;
  readonly listNotifications: ListNotifications;
  readonly getPriceAlert: GetPriceAlert;
  readonly modifyTargetPrice: ModifyTargetPrice;
  readonly cancelPriceAlert: CancelPriceAlert;
}

export interface PriceAlertRoutesOptions {
  readonly createPriceAlert: CreatePriceAlert;
  readonly authenticator: Authenticator;
  readonly management?: PriceAlertManagement;
}

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * The numbers of a URL arrive as text, and the validation of the application is strict on purpose.
 * Only for the two numbers of a page, and only on the routes that have them, whole numbers written
 * in digits are read as numbers. Anything else stays as it is and the validation rejects it.
 */
async function readPageNumbers(request: { readonly query: unknown }): Promise<void> {
  const query = request.query as Record<string, unknown>;
  for (const key of ["limit", "offset"]) {
    const value = query[key];
    if (typeof value === "string" && /^\d+$/.test(value)) query[key] = Number(value);
  }
}

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
  { createPriceAlert, authenticator, management },
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
    { schema: createPriceAlertSchema },
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

  if (management === undefined) return;

  // UC-01 List my Price Alerts
  app.get<{ Querystring: { status?: AlertStatus; limit?: number; offset?: number } }>(
    "/price-alerts",
    { schema: listPriceAlertsSchema, preValidation: readPageNumbers },
    async (request) => {
      const { status, limit = DEFAULT_LIMIT, offset = 0 } = request.query;
      const command = { owner: ownerOf(request), limit, offset };
      return management.listPriceAlerts.execute(status === undefined ? command : { ...command, status });
    },
  );

  // UC-01 of feature 05 List my Notifications
  app.get<{ Querystring: { limit?: number; offset?: number } }>(
    "/notifications",
    { schema: listNotificationsSchema, preValidation: readPageNumbers },
    async (request) => {
      const { limit = DEFAULT_LIMIT, offset = 0 } = request.query;
      return management.listNotifications.execute({ owner: ownerOf(request), limit, offset });
    },
  );

  // UC-02 Read a Price Alert
  app.get<{ Params: { alertId: string } }>(
    "/price-alerts/:alertId",
    { schema: getPriceAlertSchema },
    async (request) => {
      const result = await management.getPriceAlert.execute({
        owner: ownerOf(request),
        alertId: AlertId(request.params.alertId),
      });
      return result.alert;
    },
  );

  // UC-03 Modify the Target Price, or UC-04 Cancel: the body says which
  app.patch<{ Params: { alertId: string }; Body: { targetAmount: string } | { status: "cancelled" } }>(
    "/price-alerts/:alertId",
    { schema: patchPriceAlertSchema },
    async (request) => {
      const owner = ownerOf(request);
      const alertId = AlertId(request.params.alertId);
      const { body } = request;
      const result =
        "status" in body
          ? await management.cancelPriceAlert.execute({ owner, alertId })
          : await management.modifyTargetPrice.execute({ owner, alertId, targetAmount: body.targetAmount });
      return result.alert;
    },
  );
};
