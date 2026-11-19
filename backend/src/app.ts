import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";
import type { CreatePriceAlert } from "./price-alerts/application";
import { priceAlertRoutes, toHttpError, type Authenticator } from "./price-alerts/http";

/** The version of the API shown in its documentation. Kept equal to `package.json` by a test. */
export const API_VERSION = "0.1.0";

export interface ApiDocsOptions {
  /** A note shown at the top of the documentation, for example which demo data exists. */
  readonly note?: string;
}

export interface AppDependencies {
  readonly createPriceAlert: CreatePriceAlert;
  readonly authenticator: Authenticator;
  readonly logger?: boolean;
  /** Serve the interactive API documentation at /docs. Off by default. */
  readonly apiDocs?: ApiDocsOptions;
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

  // The documentation is generated from the schemas of the routes, so it must be
  // registered before them.
  if (dependencies.apiDocs) {
    app.register(swagger, {
      openapi: {
        openapi: "3.0.3",
        info: {
          title: "PricePulse API",
          version: API_VERSION,
          description: ["Create price alerts for the Listings of a catalogue.", dependencies.apiDocs.note]
            .filter(Boolean)
            .join("\n\n"),
        },
        tags: [{ name: "Price alerts", description: "Requests to be notified when a Listing reaches a price" }],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              description: "The token that identifies the User. Press Authorize and paste it",
            },
          },
        },
      },
    });
    app.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: { docExpansion: "list", persistAuthorization: true },
    });
  }

  app.register(priceAlertRoutes, {
    createPriceAlert: dependencies.createPriceAlert,
    authenticator: dependencies.authenticator,
  });

  return app;
}
