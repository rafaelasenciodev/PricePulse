import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { relative, sep } from "node:path";
import type { Authenticate, ReadMyAccount, RegisterAccount, SignIn, SignOut } from "./accounts/application";
import { accountRoutes, accountsHttpError } from "./accounts/http";
import { normalizeOrigin, sharedHttpError, type SessionCookieSettings } from "./shared/http";
import type { CreatePriceAlert } from "./price-alerts/application";
import {
  priceAlertHttpError,
  priceAlertRoutes,
  type Authenticator,
  type PriceAlertManagement,
} from "./price-alerts/http";
import type {
  ListListings,
  PriceObservationRecorder,
  ReadListing,
  ReadPriceHistory,
} from "./price-observations/application";
import {
  catalogueRoutes,
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
  /** What is wrong, as a stable identifier, for an error that has several causes. It is in the body when there is one. */
  readonly reason?: string;
  /** Headers that the answer carries, such as how long to wait. */
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * A feature's translation of its own errors to HTTP: null when the error is not one of its own.
 * Each feature declares the same shape for what it returns: a feature does not import this file.
 */
type HttpErrorMapper = (error: unknown) => HttpError | null;

const featureMappers: readonly HttpErrorMapper[] = [accountsHttpError, priceAlertHttpError, priceObservationHttpError, sharedHttpError];

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

/**
 * Turns the cookie of the Session on (feature 08). Without it, nothing is set and nothing is read, and the
 * application behaves as it did before (BR-10).
 */
export interface SessionCookieOptions {
  /**
   * The only origin that the application accepts for a request that the cookie authenticates, such as
   * `http://127.0.0.1:3000`: the scheme, the host and the port, with no path. A value that is not one makes
   * `buildApp` throw, so that a wrong setting is found when the application starts.
   */
  readonly origin: string;
  /** Mark the cookie `Secure`: only when the application is served over HTTPS. `false` unless it is said. */
  readonly secure?: boolean;
}

/** The built interface: the folder that holds `index.html` and its `assets/` (feature 09). */
export interface WebInterfaceOptions {
  readonly root: string;
}

const WEB_BASE = "/app/";

/** What the answers under `/app/` carry. The interface has no inline script or style, and loads nothing from outside. */
const WEB_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "content-security-policy": "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
} as const;

const pathOf = (request: FastifyRequest) => request.url.split("?")[0] ?? "";

/**
 * Whether an unknown address is a page of the interface, which gets `index.html` and not a 404: a GET or a HEAD
 * under `/app/` whose last segment has no dot. A missing script or style sheet has a dot, and is a 404.
 */
function isPageOfInterface(request: FastifyRequest): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const path = pathOf(request);
  return path.startsWith(WEB_BASE) && !(path.split("/").pop() ?? "").includes(".");
}

export interface AppDependencies {
  /** The cookie of the Session, for the browser. Optional: without it only the header identifies a User. */
  readonly sessionCookie?: SessionCookieOptions;
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
  /**
   * The routes that read the Catalogue of Listings, for the Users. Optional: without them the Catalogue
   * is not served, and the documentation does not mention it.
   */
  readonly catalogue?: {
    readonly listListings: ListListings;
    readonly readListing: ReadListing;
    readonly authenticator: UserAuthenticator;
  };
  readonly logger?: boolean;
  /** Serve the interactive API documentation at /docs. Off by default. */
  readonly apiDocs?: ApiDocsOptions;
  /**
   * Serve the web interface under /app/, and lead / to it. Optional: without it /app/ is an unknown route and
   * the application is what it was before the interface.
   */
  readonly webInterface?: WebInterfaceOptions;
}

/** Build the HTTP application from its dependencies. It does not decide which ones to use. */
export function buildApp(dependencies: AppDependencies): FastifyInstance {
  const sessionCookie: SessionCookieSettings | undefined = dependencies.sessionCookie
    ? { origin: normalizeOrigin(dependencies.sessionCookie.origin), secure: dependencies.sessionCookie.secure ?? false }
    : undefined;

  const app = Fastify({
    logger: dependencies.logger ?? false,
    ajv: {
      // Strict validation: "80" is accepted as text, 80 as a number is not,
      // and fields that are not in the schema are rejected instead of removed.
      customOptions: { coerceTypes: false, removeAdditional: false },
    },
  });

  app.setErrorHandler((error, request, reply) => {
    const { status, code, message, reason, headers } = toHttpError(error);
    if (status >= 500) request.log.error(error);
    if (headers) reply.headers(headers);
    return reply.code(status).send({ code, message, ...(reason === undefined ? {} : { reason }) });
  });

  const webInterface = dependencies.webInterface;

  app.setNotFoundHandler((request, reply) => {
    if (webInterface && isPageOfInterface(request)) return reply.sendFile("index.html");
    return reply.code(404).send({ code: "NOT_FOUND", message: "Route not found" });
  });

  if (webInterface) {
    // Only what is under /app/ gets these headers: the documentation page has its own scripts and styles.
    app.addHook("onSend", async (request, reply) => {
      if (pathOf(request).startsWith(WEB_BASE)) reply.headers(WEB_HEADERS);
    });
    app.register(fastifyStatic, {
      root: webInterface.root,
      prefix: WEB_BASE,
      // `index.html` must be asked for again each time, so a new build is seen. What is under `assets/` has the hash of its content in its name, so it never changes.
      cacheControl: false,
      setHeaders: (reply, path) => {
        const inAssets = relative(webInterface.root, path).startsWith(`assets${sep}`);
        reply.header("cache-control", inAssets ? "public, max-age=31536000, immutable" : "no-cache");
      },
    });
    // Temporary, not permanent: a browser would keep a permanent redirect for ever.
    app.get("/", { schema: { hide: true } }, (_request, reply) => reply.redirect(WEB_BASE, 302));
  }

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
            dependencies.catalogue && "Read the Listings of the catalogue, with their Current Price, to choose one to watch.",
            dependencies.accounts && "Register an Account and sign in to get the token of a Session, which identifies the User in the other requests.",
            dependencies.sessionCookie && "A browser that signs in also gets the session cookie, which identifies the User in the requests that come from the pages of the application. A request that carries the token in the header does not need it.",
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
          ...(dependencies.catalogue
            ? [{ name: "Listings", description: "The Listings that the system knows, with their Current Price, read by a User" }]
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

  if (dependencies.accounts) app.register(accountRoutes, { ...dependencies.accounts, sessionCookie });

  app.register(priceAlertRoutes, {
    createPriceAlert: dependencies.createPriceAlert,
    authenticator: dependencies.authenticator,
    sessionCookie,
    ...(dependencies.priceAlertManagement ? { management: dependencies.priceAlertManagement } : {}),
  });

  if (dependencies.catalogue) app.register(catalogueRoutes, { ...dependencies.catalogue, sessionCookie });

  if (dependencies.priceHistory) {
    app.register(priceHistoryRoutes, {
      readPriceHistory: dependencies.priceHistory.readPriceHistory,
      authenticator: dependencies.priceHistory.authenticator,
      sessionCookie,
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
