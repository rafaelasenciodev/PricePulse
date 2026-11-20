import { useState, type ReactNode } from "react";
import { useSession } from "../session";
import { isSessionEnded, messageFor, screens } from "../texts";
import { useSubmit } from "./useSubmit";

/** The frame of the screens of a person who is signed in: who it is, and the way to sign out. */
export function Layout({ children }: { readonly children: ReactNode }) {
  const { state, signOut } = useSession();
  const [error, setError] = useState<string | null>(null);
  const { submit, pending } = useSubmit(signOut);

  async function handleSignOut() {
    setError(null);
    const result = await submit();
    // An ended Session has already signed the person out, and has its own message on the sign-in screen (BR-06).
    if (result && !result.ok && !isSessionEnded(result.failure)) setError(messageFor("signOut", result.failure));
  }

  return (
    <>
      <header className="bar">
        <span className="brand">{screens.appName}</span>
        {state.status === "signedIn" && <span className="who">{state.account.email}</span>}
        <button type="button" onClick={() => void handleSignOut()} disabled={pending}>
          {pending ? screens.signOut.submitting : screens.signOut.submit}
        </button>
      </header>
      {error !== null && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <main>{children}</main>
    </>
  );
}
