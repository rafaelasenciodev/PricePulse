import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Account, ApiClient, Failure, Result } from "../api";
import { isSessionEnded } from "../texts";

/**
 * Who is signed in. It is found out with the Account at the start, and any answer that the Session is not valid,
 * from any request, makes it `signedOut` with the reason `ended` (BR-06).
 */
export type SessionState =
  | { readonly status: "checking" }
  | { readonly status: "signedOut"; readonly reason?: "ended" | "check-failed" }
  | { readonly status: "signedIn"; readonly account: Account };

/** What registering gives: `accountCreated` tells a failed registration from a failed sign-in that followed it (BR-04). */
export type RegisterOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly failure: Failure; readonly accountCreated: boolean };

export interface SessionValue {
  readonly state: SessionState;
  /**
   * The client that the screens use. It is the one given to the provider, and every answer that the Session is not
   * valid that goes through it ends the Session, so no screen has to look for it (BR-06).
   */
  readonly api: ApiClient;
  signIn(email: string, password: string): Promise<Result<Account>>;
  register(email: string, password: string): Promise<RegisterOutcome>;
  /** The person leaves the signed-in screens only when the server has answered (BR-05). */
  signOut(): Promise<Result<null>>;
}

export const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ client, children }: { readonly client: ApiClient; readonly children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "checking" });

  // Wraps each operation: an answer that the Session is not valid ends it, whoever asked.
  const api = useMemo<ApiClient>(() => {
    const watch = <A extends unknown[], T>(call: (...args: A) => Promise<Result<T>>) => {
      return async (...args: A): Promise<Result<T>> => {
        const result = await call(...args);
        if (!result.ok && isSessionEnded(result.failure)) setState({ status: "signedOut", reason: "ended" });
        return result;
      };
    };
    return {
      signIn: client.signIn.bind(client),
      register: client.register.bind(client),
      signOut: watch(client.signOut.bind(client)),
      account: client.account.bind(client),
      listings: watch(client.listings.bind(client)),
      listing: watch(client.listing.bind(client)),
      createAlert: watch(client.createAlert.bind(client)),
      alerts: watch(client.alerts.bind(client)),
      changeTarget: watch(client.changeTarget.bind(client)),
      cancelAlert: watch(client.cancelAlert.bind(client)),
      notifications: watch(client.notifications.bind(client)),
      priceHistory: watch(client.priceHistory.bind(client)),
      // It needs no Session, so no answer of it ends one.
      demo: client.demo.bind(client),
    };
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    void api.account().then((result) => {
      if (cancelled) return;
      if (result.ok) setState({ status: "signedIn", account: result.data });
      // Not signed in is the normal case here; any other failure is kept apart so a screen may say it.
      else setState({ status: "signedOut", ...(isSessionEnded(result.failure) ? {} : { reason: "check-failed" as const }) });
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api.signIn(email, password);
      if (result.ok) setState({ status: "signedIn", account: result.data });
      return result;
    },
    [api],
  );

  const register = useCallback(
    async (email: string, password: string): Promise<RegisterOutcome> => {
      const registered = await api.register(email, password);
      if (!registered.ok) return { ok: false, failure: registered.failure, accountCreated: false };
      const signedIn = await signIn(email, password);
      return signedIn.ok ? { ok: true } : { ok: false, failure: signedIn.failure, accountCreated: true };
    },
    [api, signIn],
  );

  const signOut = useCallback(async () => {
    const result = await api.signOut();
    if (result.ok) setState({ status: "signedOut" });
    return result;
  }, [api]);

  const value = useMemo<SessionValue>(() => ({ state, api, signIn, register, signOut }), [state, api, signIn, register, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
