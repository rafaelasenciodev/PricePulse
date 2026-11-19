import Fastify, { type FastifyInstance } from "fastify";
import type { CreatePriceAlert } from "./price-alerts/application";
import { priceAlertRoutes, toHttpError, type Authenticator } from "./price-alerts/http";

export interface AppDependencies {
  readonly createPriceAlert: CreatePriceAlert;
  readonly authenticator: Authenticator;
  readonly logger?: boolean;
}

/** Build the HTTP application from its dependencies. It does not decide which ones to use. */
export function buildApp(dependencies: AppDependencies): FastifyInstance {
  const app = Fastify({
    logger: dependencies.logger ?? false,
    ajv: {
      // Strict validation: "80" is accepted as text, 80 as a number is not,
      // and fields that are not in the schema are rejected instead of removed.
      customOptions: { coerceTypes: false, removeAdditional: false },
    },
  });

  app.setErrorHandler((error, request, reply) => {
    const { status, code, message } = toHttpError(error);
    if (status >= 500) request.log.error(error);
    return reply.code(status).send({ code, message });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ code: "NOT_FOUND", message: "Route not found" }),
  );

  app.register(priceAlertRoutes, {
    createPriceAlert: dependencies.createPriceAlert,
    authenticator: dependencies.authenticator,
  });

  return app;
}
