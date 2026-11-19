import type { FastifyPluginAsync } from "fastify";
import { bearerTokenOf } from "../../shared/http";
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
}

interface Credentials {
  email: string;
  password: string;
}

export const accountRoutes: FastifyPluginAsync<AccountRoutesOptions> = async (
  app,
  { registerAccount, signIn, signOut, readMyAccount, authenticate },
) => {
  // UC-01 Register. No token: the person has no Account yet.
  app.post<{ Body: Credentials }>("/accounts", { schema: registerAccountSchema }, async (request, reply) =>
    reply.code(201).send(await registerAccount.execute(request.body)),
  );

  // UC-02 Sign in. No token: it is how the person gets one. The answer carries a secret, so it is not kept.
  app.post<{ Body: Credentials }>("/sessions", { schema: signInSchema }, async (request, reply) =>
    reply.code(201).header("cache-control", "no-store").send(await signIn.execute(request.body)),
  );

  // The routes that need a Session. The hook belongs to this plugin: it does not apply to the two above.
  await app.register(async (signedInRoutes) => {
    signedInRoutes.decorateRequest("signedIn", null);

    // Authentication runs first, before anything else is read (BR-08).
    signedInRoutes.addHook("onRequest", async (request) => {
      const token = bearerTokenOf(request.headers.authorization);
      const userId = token === null ? null : await authenticate.execute(token);
      if (token === null || userId === null) throw new Unauthenticated();
      request.signedIn = { token, userId };
    });

    // UC-03 Sign out
    signedInRoutes.delete("/sessions/current", { schema: signOutSchema }, async (request, reply) => {
      await signOut.execute({ token: signedIn(request).token });
      return reply.code(204).send();
    });

    // UC-04 Read my Account
    signedInRoutes.get("/accounts/me", { schema: readMyAccountSchema }, async (request) =>
      readMyAccount.execute({ owner: signedIn(request).userId }),
    );
  });
};

/** The identified request. The hook guarantees it; this fails safe if a route is ever moved out of its reach. */
function signedIn(request: { readonly signedIn: { readonly token: string; readonly userId: UserId } | null }) {
  if (request.signedIn === null) throw new Unauthenticated();
  return request.signedIn;
}
