import type { FastifyInstance } from "fastify";
import { InMemoryAccountRepository, InMemoryLoginAttemptStore, InMemorySessionStore, ScryptPasswordHasher, FAST_SCRYPT_PARAMETERS, CryptoSessionTokens } from "../../../src/accounts/adapters";
import { Authenticate, ReadMyAccount, RegisterAccount, SignIn, SignOut } from "../../../src/accounts/application";
import { buildApp } from "../../../src/app";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { CreatePriceAlert } from "../../../src/price-alerts/application";
import { InMemoryAuthenticator } from "../../../src/price-alerts/http";
import { FIXED_CLOCK } from "../../support/created-at";
import { MutableClock } from "./fakes";
import { START } from "./world";

/** The HTTP application with only the routes of accounts that matter here, real stores and a fast hash. */
export function buildAccountsApp(options: { apiDocs?: boolean } = {}) {
  const accounts = new InMemoryAccountRepository();
  const sessions = new InMemorySessionStore();
  const attempts = new InMemoryLoginAttemptStore();
  const hasher = new ScryptPasswordHasher(FAST_SCRYPT_PARAMETERS);
  const tokens = new CryptoSessionTokens();
  const clock = new MutableClock(START);
  const app: FastifyInstance = buildApp({
    createPriceAlert: new CreatePriceAlert(new InMemoryListingReader(), new InMemoryPriceAlertRepository(), FIXED_CLOCK),
    authenticator: new InMemoryAuthenticator(),
    accounts: {
      registerAccount: new RegisterAccount(accounts, hasher),
      signIn: new SignIn(accounts, sessions, attempts, hasher, tokens, clock),
      signOut: new SignOut(sessions, tokens, clock),
      readMyAccount: new ReadMyAccount(accounts),
      authenticate: new Authenticate(sessions, tokens, clock),
    },
    ...(options.apiDocs ? { apiDocs: {} } : {}),
  });
  return { app, clock, accounts, sessions };
}
