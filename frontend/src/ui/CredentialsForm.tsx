import { useState, type FormEvent, type ReactNode } from "react";
import { screens } from "../texts";
import { Button } from "./Button";
import { Field } from "./Field";
import { useSubmit } from "./useSubmit";

interface Props {
  readonly title: string;
  readonly submit: string;
  readonly submitting: string;
  readonly initialEmail?: string;
  /** Whether the password is a new one, so the browser offers to make one instead of filling one in. */
  readonly newPassword?: boolean;
  /** A message above the form that is not the result of sending it. */
  readonly notice?: string | undefined;
  /** Sends the form. It gives the message to show if it failed, and null if it did not. */
  readonly send: (email: string, password: string) => Promise<string | null>;
  /** The way to the other screen. */
  readonly children: ReactNode;
}

/**
 * The form of the two screens of access: an email, a password and a button. A field that is empty is not sent and
 * says which one is missing (BR-14), and whether what is written is valid is for the API to say. While it is being
 * sent, it cannot be sent again (BR-11).
 */
export function CredentialsForm({ title, submit, submitting, initialEmail = "", newPassword = false, notice, send, children }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [missing, setMissing] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const { submit: sendOnce, pending } = useSubmit(send);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const absent = {
      ...(email === "" ? { email: screens.emailMissing } : {}),
      ...(password === "" ? { password: screens.passwordMissing } : {}),
    };
    setMissing(absent);
    if (Object.keys(absent).length > 0) return;
    const message = await sendOnce(email, password);
    if (typeof message === "string") setError(message);
  }

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-10">
      <p className="mb-4 text-center text-lg font-bold text-accent">{screens.appName}</p>
      <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold">{title}</h1>
        {notice !== undefined && (
          <p role="status" className="mb-4 rounded-lg border border-line bg-page p-3 text-sm">
            {notice}
          </p>
        )}
        <form onSubmit={(event) => void handleSubmit(event)} noValidate className="gap-4">
          <Field
            id="email"
            label={screens.email}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={missing.email}
          />
          <Field
            id="password"
            label={screens.password}
            type="password"
            autoComplete={newPassword ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={missing.password}
          />
          {error !== null && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? submitting : submit}
          </Button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm [&_a]:text-accent [&_a]:underline">{children}</p>
    </main>
  );
}
