/**
 * Composition Root: the one place where the parts of the application are chosen and connected.
 *
 * Everything else depends on ports (interfaces) and never creates its own collaborators,
 * so replacing an adapter, for example the in-memory catalogue by a database one, means
 * changing this file and nothing else.
 *
 * It is also the only place that knows both features. Price Alerts read the Current Price of
 * a Listing, and that price is not stored by them: it follows from the Price Observations
 * (BR-07 of feature 02). The two meet here, through two functions handed to the reader.
 * They meet a second time when a price is recorded: the Price Alerts of that Listing are
 * evaluated (feature 03). Recording itself knows nothing of it (BR-11 of feature 02).
 *
 * The same happens with who a User is. Accounts know the Sessions, and the other two features ask
 * only who a token belongs to, each through a port of its own. The use case of Accounts that answers
 * it is adapted to both here (feature 06), so no route of the other features knows about Accounts.
 */

import type { FastifyInstance } from "fastify";
import {
  CryptoSessionTokens,
  InMemoryAccountRepository,
  InMemoryLoginAttemptStore,
  InMemorySessionStore,
  PostgresAccountRepository,
  PostgresLoginAttemptStore,
  PostgresSessionStore,
  ScryptPasswordHasher,
} from "./accounts/adapters";
import {
  Authenticate,
  ReadMyAccount,
  RegisterAccount,
  SignIn,
  SignOut,
  type AccountRepository,
  type LoginAttemptStore,
  type PasswordHasher,
  type SessionStore,
} from "./accounts/application";
import { buildApp, type ApiDocsOptions, type SessionCookieOptions, type WebInterfaceOptions } from "./app";
import {
  ComposedListingReader,
  InMemoryNotificationRepository,
  InMemoryPriceAlertRepository,
  PostgresNotificationRepository,
  PostgresPriceAlertRepository,
} from "./price-alerts/adapters";
import {
  CancelPriceAlert,
  CreatePriceAlert,
  EvaluatePriceAlerts,
  GetPriceAlert,
  ListNotifications,
  ListPriceAlerts,
  ModifyTargetPrice,
  type CurrentPrice,
  type CurrentPriceSource,
  type NotificationRepository,
  type PriceAlertRepository,
} from "./price-alerts/application";
import { logEvaluation, withEvaluation, type EvaluationReport } from "./evaluation-trigger";
import type { Authenticator } from "./price-alerts/http";
import type { ListingId } from "./shared/domain";
import type { Pool } from "./database/connect";
import {
  InMemoryListingCatalogue,
  InMemoryPriceObservationRepository,
  PostgresListingCatalogue,
  PostgresPriceObservationRepository,
  SystemClock,
} from "./price-observations/adapters";
import {
  ListListings,
  ReadListing,
  ReadPriceHistory,
  RecordPriceObservation,
  type Clock,
  type ListingCatalogue,
  type PriceObservationRepository,
} from "./price-observations/application";
import { InMemoryProviderAuthenticator, type UserAuthenticator } from "./price-observations/http";

/** The Catalogue is filled by the system and not by the use cases, so the stores give a way to add a Listing. */
export interface ListingWriter {
  addListing(listingId: ListingId, currency: string, text?: { title: string; retailer: string }): void | Promise<void>;
}

/** Where the application keeps what it stores: one store for each port that holds state. */
export interface Stores {
  readonly catalogue: ListingCatalogue & ListingWriter;
  readonly observations: PriceObservationRepository;
  readonly accounts: AccountRepository;
  readonly sessions: SessionStore;
  readonly loginAttempts: LoginAttemptStore;
  readonly alerts: PriceAlertRepository;
  readonly notifications: NotificationRepository;
}

export interface InMemoryStores extends Stores {
  readonly catalogue: InMemoryListingCatalogue;
  readonly observations: InMemoryPriceObservationRepository;
  readonly accounts: InMemoryAccountRepository;
  readonly sessions: InMemorySessionStore;
  readonly loginAttempts: InMemoryLoginAttemptStore;
  readonly alerts: InMemoryPriceAlertRepository;
  readonly notifications: InMemoryNotificationRepository;
}

export interface Application<S extends Stores = Stores> {
  readonly app: FastifyInstance;
  /** The adapters, so that the caller can fill them with data (development and tests). */
  readonly catalogue: S["catalogue"];
  /**
   * The use cases that register an Account and sign in, so that the caller can make a User the
   * way a person would (the demo and the tests), and not by writing into the adapters.
   */
  readonly registerAccount: RegisterAccount;
  readonly signIn: SignIn;
  readonly providerAuthenticator: InMemoryProviderAuthenticator;
  /**
   * The use case that records prices, so that the caller can give a Listing its first price
   * the way a Provider would, and not by writing into the adapters.
   */
  readonly recordPriceObservation: RecordPriceObservation;
  /** The use case that creates alerts and the stores of alerts and Notifications, for the demo and the tests. */
  readonly createPriceAlert: CreatePriceAlert;
  readonly alerts: S["alerts"];
  readonly notifications: S["notifications"];
}

export type InMemoryApplication = Application<InMemoryStores>;

export interface ComposeOptions {
  logger?: boolean;
  apiDocs?: ApiDocsOptions;
  /** Serves the built web interface under /app/ (feature 09). */
  webInterface?: WebInterfaceOptions;
  clock?: Clock;
  /** How passwords are hashed. By default `scrypt` with its production cost, which is slow on purpose: tests give a fast one. */
  passwordHasher?: PasswordHasher;
  /**
   * Turns on the cookie of the Session for the browser (feature 08). Without it only the header identifies a User,
   * and nothing that exists changes. A origin that is not valid makes it throw when it is built.
   */
  sessionCookie?: SessionCookieOptions;
  /** Receives what each Evaluation came to. By default it writes to the log of the application. */
  onEvaluation?: (report: EvaluationReport) => void;
}

/** The application wired with in-memory adapters: no database, no external provider. */
export function composeInMemoryApp(options: ComposeOptions = {}): InMemoryApplication {
  return composeApp(
    {
      catalogue: new InMemoryListingCatalogue(),
      observations: new InMemoryPriceObservationRepository(),
      accounts: new InMemoryAccountRepository(),
      sessions: new InMemorySessionStore(),
      loginAttempts: new InMemoryLoginAttemptStore(),
      alerts: new InMemoryPriceAlertRepository(),
      notifications: new InMemoryNotificationRepository(),
    },
    options,
  );
}

/** The application wired with the adapters of PostgreSQL over a pool (feature 11). The schema must have been applied. */
export function composePostgresApp(pool: Pool, options: ComposeOptions = {}): Application {
  return composeApp(
    {
      catalogue: new PostgresListingCatalogue(pool),
      observations: new PostgresPriceObservationRepository(pool),
      accounts: new PostgresAccountRepository(pool),
      sessions: new PostgresSessionStore(pool),
      loginAttempts: new PostgresLoginAttemptStore(pool),
      alerts: new PostgresPriceAlertRepository(pool),
      notifications: new PostgresNotificationRepository(pool),
    },
    options,
  );
}

/** Joins the use cases and the HTTP layer over the stores it is given. The only difference between storages is the stores. */
export function composeApp<S extends Stores>(stores: S, options: ComposeOptions = {}): Application<S> {
  const { catalogue, observations, alerts, accounts, sessions, notifications } = stores;
  // Price Observations
  const providerAuthenticator = new InMemoryProviderAuthenticator();
  const clock = options.clock ?? new SystemClock();
  const recordPriceObservation = new RecordPriceObservation(catalogue, observations, clock);

  // The Current Price of a Listing, with the moment at which it was observed, comes from its latest
  // Price Observation (BR-07 of feature 02). One whose latest observation has no Price has none.
  // It is written once and every reader of the Current Price uses it.
  const currentPriceOf = async (listingId: Parameters<CurrentPriceSource["currentPriceOf"]>[0]): Promise<CurrentPrice | null> => {
    const latest = await observations.findLatest(listingId);
    return latest === null || latest.price === null ? null : { price: latest.price, observedAt: latest.observedAt };
  };

  // Price Alerts. The currency of a Listing comes from the catalogue and its Current Price from
  // the function above: a Listing with none has no Current Price.
  const listings = new ComposedListingReader(
    async (listingId) => (await catalogue.find(listingId))?.currency ?? null,
    async (listingId) => (await currentPriceOf(listingId))?.price ?? null,
  );

  // Accounts. One clock for everything, so a test that moves it moves the Sessions too.
  const hasher = options.passwordHasher ?? new ScryptPasswordHasher();
  const tokens = new CryptoSessionTokens();
  const registerAccount = new RegisterAccount(accounts, hasher);
  const signIn = new SignIn(accounts, sessions, stores.loginAttempts, hasher, tokens, clock);
  const authenticate = new Authenticate(sessions, tokens, clock);
  const authenticator: Authenticator = { authenticate: (token) => authenticate.execute(token) };
  const createPriceAlert = new CreatePriceAlert(listings, alerts, clock);

  // The Price History is read by Users: the module of Price Observations asks only whether a token is a User's.
  const usersOnly: UserAuthenticator = { isUser: async (token) => (await authenticate.execute(token)) !== null };
  const evaluatePriceAlerts = new EvaluatePriceAlerts(alerts, notifications, { currentPriceOf });

  const app: FastifyInstance = buildApp({
    accounts: {
      registerAccount,
      signIn,
      signOut: new SignOut(sessions, tokens, clock),
      readMyAccount: new ReadMyAccount(accounts),
      authenticate,
    },
    createPriceAlert,
    authenticator,
    priceAlertManagement: {
      listPriceAlerts: new ListPriceAlerts(alerts),
      listNotifications: new ListNotifications(notifications),
      getPriceAlert: new GetPriceAlert(alerts),
      modifyTargetPrice: new ModifyTargetPrice(alerts, listings),
      cancelPriceAlert: new CancelPriceAlert(alerts),
    },
    priceHistory: { readPriceHistory: new ReadPriceHistory(catalogue, observations), authenticator: usersOnly },
    // The Catalogue is read by Users, as the history is, and the Current Price of each Listing comes from its latest observation.
    catalogue: {
      listListings: new ListListings(catalogue, observations),
      readListing: new ReadListing(catalogue, observations),
      authenticator: usersOnly,
    },
    priceObservations: {
      recordPriceObservation: withEvaluation(
        recordPriceObservation,
        evaluatePriceAlerts,
        options.onEvaluation ?? ((report) => logEvaluation(app.log)(report)),
      ),
      authenticator: providerAuthenticator,
    },
    logger: options.logger,
    apiDocs: options.apiDocs,
    ...(options.webInterface ? { webInterface: options.webInterface } : {}),
    ...(options.sessionCookie ? { sessionCookie: options.sessionCookie } : {}),
  });

  return {
    app,
    catalogue,
    registerAccount,
    signIn,
    providerAuthenticator,
    recordPriceObservation,
    createPriceAlert,
    alerts,
    notifications,
  };
}
