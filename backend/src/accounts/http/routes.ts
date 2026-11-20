import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  bearerTokenOf,
  publicOriginHook,
  serializeClearedSessionCookie,
  serializeSessionCookie,
  sessionCookieHook,
  type SessionCookieSettings,
} from "../../shared/http";
import type { UserId } from "../../shared/domain";
import {
  Unauthenticated,
  type Authenticate,
  type ReadMyAccount,
  type RegisterAccount,
  type SignIn,
  type SignOut,
} from "../application";
import { readMyAccountSchema, registerAccountSchema, signInSchema, signOutSchema } from "./schemas";

declare module "fastify" {
  interface FastifyRequest {
    /** The token and the User of a request made with a valid token, set by the hook of the routes that need one. */
    signedIn: { readonly token: string; readonly userId: UserId } | null;
  }
}

export interface AccountRoutesOptions {
  readonly registerAccount: RegisterAccount;
  readonly signIn: SignIn;
  readonly signOut: SignOut;
  readonly readMyAccount: ReadMyAccount;
  readonly authenticate: Authenticate;
  /** The cookie of the Session (feature 08). Without it nothing is set and nothing is read (BR-10). */
  readonly sessionCookie?: SessionCookieSettings | undefined;
}

interface Credentials {
  email: string;
  password: string;
}

export const accountRoutes: FastifyPluginAsync<AccountRoutesOptions> = async (
  app,
  { registerAccount, signIn, signOut, readMyAccount, authenticate, sessionCookie },
) => {
  // The routes with no token: the person has no Account yet, or is getting a token. With the cookie on, they
  // refuse a request that comes from another origin (BR-08 of feature 08). The hook belongs to this plugin: it
  // does not apply to the routes of the Session below, which have their own rule for the origin.
  await app.register(async (publicRoutes) => {
    if (sessionCookie) publicRoutes.addHook("onRequest", publicOriginHook(sessionCookie));

    // UC-01 Register
    publicRoutes.post<{ Body: Credentials }>("/accounts", { schema: registerAccountSchema }, async (request, reply) =>
      reply.code(201).send(await registerAccount.execute(request.body)),
    );

    // UC-02 Sign in. The answer carries a secret, so it is not kept. With the cookie on it also sets the cookie,
    // after the Session exists: a sign-in that fails never gets here (BR-01, BR-03 of feature 08).
    publicRoutes.post<{ Body: Credentials }>("/sessions", { schema: signInSchema }, async (request, reply) => {
      const result = await signIn.execute(request.body);
      reply.code(201).header("cache-control", "no-store");
      if (sessionCookie) {
        reply.header(
          "set-cookie",
          serializeSessionCookie(result.token, { maxAgeSeconds: result.expiresInSeconds, secure: sessionCookie.secure }),
        );
      }
      return reply.send(result);
    });
  });

  // The routes that need a Session. The hook that turns the cookie into the header belongs to this plugin, and
  // runs before the hooks that authenticate (decision 1 of feature 08).
  await app.register(async (signedInRoutes) => {
    signedInRoutes.decorateRequest("signedIn", null);
    if (sessionCookie) signedInRoutes.addHook("onRequest", sessionCookieHook(sessionCookie));

    // Authentication runs first, before anything else is read (BR-08).
    const authenticateRequest = async (request: FastifyRequest): Promise<void> => {
      const token = bearerTokenOf(request.headers.authorization);
      const userId = token === null ? null : await authenticate.execute(token);
      if (token === null || userId === null) throw new Unauthenticated();
      request.signedIn = { token, userId };
    };

    // UC-03 Sign out. The cookie is cleared before the token is checked, and after the check of the origin that
    // the hook above makes: the answer clears it whether the token is valid or not, and a request that was
    // refused for its origin does not (BR-09 of feature 08, decision 6).
    await signedInRoutes.register(async (signOutRoutes) => {
      if (sessionCookie) {
        signOutRoutes.addHook("onRequest", async (_request, reply) => {
          reply.header("set-cookie", serializeClearedSessionCookie({ secure: sessionCookie.secure }));
        });
      }
      signOutRoutes.addHook("onRequest", authenticateRequest);
      signOutRoutes.delete("/sessions/current", { schema: signOutSchema }, async (request, reply) => {
        await signOut.execute({ token: signedIn(request).token });
        return reply.code(204).send();
      });
    });

    // UC-04 Read my Account
    await signedInRoutes.register(async (meRoutes) => {
      meRoutes.addHook("onRequest", authenticateRequest);
      meRoutes.get("/accounts/me", { schema: readMyAccountSchema }, async (request) =>
        readMyAccount.execute({ owner: signedIn(request).userId }),
      );
    });
  });
};

/** The identified request. The hook guarantees it; this fails safe if a route is ever moved out of its reach. */
function signedIn(request: { readonly signedIn: { readonly token: string; readonly userId: UserId } | null }) {
  if (request.signedIn === null) throw new Unauthenticated();
  return request.signedIn;
}
