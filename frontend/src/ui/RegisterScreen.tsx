import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../session";
import { messageFor, screens } from "../texts";
import { CredentialsForm } from "./CredentialsForm";

export function RegisterScreen() {
  const { register } = useSession();
  const navigate = useNavigate();

  return (
    <CredentialsForm
      title={screens.register.title}
      submit={screens.register.submit}
      submitting={screens.register.submitting}
      newPassword
      send={async (email, password) => {
        const outcome = await register(email, password);
        if (outcome.ok) return null;
        if (outcome.accountCreated) {
          // SC-10: the Account exists, so what is left to do is to sign in, with the email already written.
          navigate("/sign-in", { replace: true, state: { accountCreated: true, email } });
          return null;
        }
        return messageFor("register", outcome.failure);
      }}
    >
      <Link to="/sign-in">{screens.register.toSignIn}</Link>
    </CredentialsForm>
  );
}
