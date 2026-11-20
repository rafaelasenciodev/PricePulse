import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useSession } from "../session";
import { isSessionEnded, messageFor, screens } from "../texts";
import { Button } from "./Button";
import { ThemeSelector } from "./ThemeSelector";
import { useSubmit } from "./useSubmit";

const NAV = [
  { to: "/catalogue", text: screens.nav.catalogue },
  { to: "/alerts", text: screens.nav.alerts },
  { to: "/notifications", text: screens.nav.notifications },
] as const;

/** A link of the navigation: the one of the screen that is open is darker and underlined. */
const LINK = "py-1 text-muted no-underline hover:text-ink aria-[current=page]:border-b-2 aria-[current=page]:border-accent aria-[current=page]:font-medium aria-[current=page]:text-ink";

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
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="text-lg font-bold text-accent">{screens.appName}</span>
          <nav aria-label={screens.nav.label} className="order-last flex w-full gap-5 text-sm sm:order-none sm:w-auto">
            {NAV.map(({ to, text }) => (
              <NavLink key={to} to={to} className={LINK}>
                {text}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ThemeSelector />
            {state.status === "signedIn" && <span className="hidden text-sm text-muted sm:inline">{state.account.email}</span>}
            <Button variant="secondary" onClick={() => void handleSignOut()} disabled={pending}>
              {pending ? screens.signOut.submitting : screens.signOut.submit}
            </Button>
          </div>
        </div>
      </header>
      {error !== null && (
        <p role="alert" className="mx-auto max-w-5xl px-4 pt-4 text-sm text-danger">
          {error}
        </p>
      )}
      <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </>
  );
}
