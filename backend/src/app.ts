import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";
import type { Authenticate, ReadMyAccount, RegisterAccount, SignIn, SignOut } from "./accounts/application";
import { accountRoutes, accountsHttpError } from "./accounts/http";
import type { CreatePriceAlert } from "./price-alerts/application";
import {
  priceAlertHttpError,
  priceAlertRoutes,
  type Authenticator,
  type PriceAlertManagement,
} from "./price-alerts/http";
import type { PriceObservationRecorder, ReadPriceHistory } from "./price-observations/application";
import {
  priceHistoryRoutes,
  priceObservationHttpError,
  priceObservationRoutes,
  type ProviderAuthenticator,
  type UserAuthenticator,
} from "./price-observations/http";

/** The version of the API shown in its documentation. Kept equal to `package.json` by a test. */
export const API_VERSION = "0.1.0";

/** The HTTP response that reports an error. */
interface HttpError {
  readonly status: number;
  /** A stable identifier, so a client can tell apart errors that share a status. */
  readonly code: string;
  readonly message: string;
  /** Headers that the answer carries, such as how long to wait. */
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * A feature's translation of its own errors to HTTP: null when the error is not one of its own.
 * Each feature declares the same shape for what it returns: a feature does not import this file.
 */
type HttpErrorMapper = (error: unknown) => HttpError | null;

const featureMappers: readonly HttpErrorMapper[] = [accountsHttpError, priceAlertHttpError, priceObservationHttpError];

/** Map an error to the HTTP response that reports it. Unexpected errors reveal nothing. */
function toHttpError(error: unknown): HttpError {
  for (const mapper of featureMappers) {
    const mapped = mapper(error);
    if (mapped !== null) return mapped;
  }
  const status = clientErrorStatus(error);
  if (status !== null) {
    // The request itself is wrong: bad JSON, a body that does not match the schema, ...
    return {
      status,
      code: status === 400 ? "BAD_REQUEST" : "CLIENT_ERROR",
      message: error instanceof Error ? error.message : "Invalid request",
    };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "Internal server error" };
}

function clientErrorStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const status = (error as { statusCode: unknown }).statusCode;
    if (typeof status === "number" && status >= 400 && status < 500) return status;
  }
  return null;
}

export interface ApiDocsOptions {
  /** A note shown at the top of the documentation, for example which demo data exists. */
  readonly note?: string;
}

export interface AppDependencies {
  /**
   * The routes of accounts: registering, signing in and out, and reading one's own Account. Optional:
   * without them the application serves no way to get a token, and the documentation does not mention them.
   */
  readonly accounts?: {
    readonly registerAccount: RegisterAccount;
    readonly signIn: SignIn;
    readonly signOut: SignOut;
    readonly readMyAccount: ReadMyAccount;
    readonly authenticate: Authenticate;
  };
  readonly createPriceAlert: CreatePriceAlert;
  readonly authenticator: Authenticator;
  /**
   * The routes to read and manage Price Alerts. Optional: without them the application serves
   * only the creation of a Price Alert, and the documentation says so.
   */
  readonly priceAlertManagement?: PriceAlertManagement;
  /**
   * The routes of Price Observations, for the Providers. Optional: without them the
   * application serves only the routes of Price Alerts, and the documentation says so.
   */
  readonly priceObservations?: {
    readonly recordPriceObservation: PriceObservationRecorder;
    readonly authenticator: ProviderAuthenticator;
  };
  /**
   * The route that reads the Price History of a Listing, for the Users. Optional: without it the
   * history is not served, and the documentation does not mention it.
   */
  readonly priceHistory?: {
    readonly readPriceHistory: ReadPriceHistory;
    readonly authenticator: UserAuthenticator;
  };
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
    const { status, code, message, headers } = toHttpError(error);
    if (status >= 500) request.log.error(error);
    if (headers) reply.headers(headers);
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
          description: [
            dependencies.priceAlertManagement
              ? "Create price alerts for the Listings of a catalogue, read them and manage them. Read the Notifications that are produced when an alert is reached."
              : "Create price alerts for the Listings of a catalogue.",
            dependencies.accounts && "Register an Account and sign in to get the token of a Session, which identifies the User in the other requests.",
            dependencies.priceObservations && "Price providers report the price of a Listing with price observations.",
            dependencies.apiDocs.note,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
        tags: [
          ...(dependencies.accounts
            ? [
                { name: "Accounts", description: "Register an Account and read one's own" },
                { name: "Sessions", description: "Sign in to get a token, and sign out to end it" },
              ]
            : []),
          { name: "Price alerts", description: "Requests to be notified when a Listing reaches a price" },
          ...(dependencies.priceAlertManagement
            ? [{ name: "Notifications", description: "The records of the Price Alerts that were reached" }]
            : []),
          ...(dependencies.priceHistory
            ? [{ name: "Price history", description: "How the price of a Listing has moved, read by a User" }]
            : []),
          ...(dependencies.priceObservations
            ? [{ name: "Price observations", description: "Reports of the price of a Listing, made by a price provider" }]
            : []),
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              description: dependencies.accounts
                ? "The token that `POST /sessions` gives when a User signs in. Press Authorize and paste it"
                : "The token that identifies the User. Press Authorize and paste it",
            },
            ...(dependencies.priceObservations
              ? {
                  providerAuth: {
                    type: "http",
                    scheme: "bearer",
                    description: "The token that identifies the price provider. It is not the token of a User",
                  },
                }
              : {}),
          },
        },
      },
    });
    app.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: { docExpansion: "list", persistAuthorization: true },
    });
  }

  if (dependencies.accounts) app.register(accountRoutes, dependencies.accounts);

  app.register(priceAlertRoutes, {
    createPriceAlert: dependencies.createPriceAlert,
    authenticator: dependencies.authenticator,
    ...(dependencies.priceAlertManagement ? { management: dependencies.priceAlertManagement } : {}),
  });

  if (dependencies.priceHistory) {
    app.register(priceHistoryRoutes, {
      readPriceHistory: dependencies.priceHistory.readPriceHistory,
      authenticator: dependencies.priceHistory.authenticator,
    });
  }

  if (dependencies.priceObservations) {
    app.register(priceObservationRoutes, {
      recordPriceObservation: dependencies.priceObservations.recordPriceObservation,
      authenticator: dependencies.priceObservations.authenticator,
    });
  }

  return app;
}
