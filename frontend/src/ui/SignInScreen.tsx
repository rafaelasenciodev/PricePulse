import { Link, useLocation } from "react-router-dom";
import { useSession } from "../session";
import { failures, messageFor, screens } from "../texts";
import { CredentialsForm } from "./CredentialsForm";

/** What the registration screen leaves when the Account was created and the sign-in that followed it failed (SC-10). */
interface Arrival {
  readonly email: string;
}

function arrivalFrom(state: unknown): Arrival | null {
  if (typeof state !== "object" || state === null) return null;
  const { accountCreated, email } = state as { accountCreated?: unknown; email?: unknown };
  return accountCreated === true && typeof email === "string" ? { email } : null;
}

export function SignInScreen() {
  const { state, signIn } = useSession();
  const arrival = arrivalFrom(useLocation().state);

  // Why the person is here when it is not because they chose to be (BR-06).
  const reason = state.status === "signedOut" ? state.reason : undefined;
  const notice = arrival
    ? screens.signIn.accountCreated
    : reason === "ended"
      ? failures.sessionEnded
      : reason === "check-failed"
        ? failures.session.other
        : undefined;

  return (
    <CredentialsForm
      title={screens.signIn.title}
      submit={screens.signIn.submit}
      submitting={screens.signIn.submitting}
      initialEmail={arrival?.email ?? ""}
      notice={notice}
      send={async (email, password) => {
        const result = await signIn(email, password);
        return result.ok ? null : messageFor("signIn", result.failure);
      }}
    >
      <Link to="/register">{screens.signIn.toRegister}</Link>
    </CredentialsForm>
  );
}
