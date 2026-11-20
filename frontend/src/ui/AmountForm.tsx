import { useState, type FormEvent } from "react";
import type { Failure, Result } from "../api";
import { messageFor, type Action } from "../texts";
import { useSubmit } from "./useSubmit";

interface Props<T> {
  /** The identifier of the field. Two forms on one screen must not share one. */
  readonly id: string;
  readonly label: string;
  readonly texts: { readonly submit: string; readonly submitting: string; readonly missing: string };
  /** What the form asks the API for, with the amount as the text that was written, trimmed. */
  readonly send: (amount: string) => Promise<Result<T>>;
  /** The action whose messages say what went wrong. */
  readonly failureAction: Action;
  readonly onDone: (data: T) => void;
  /** Called with a failure that is an answer or not. It gives true when it has told the person, and then the form does not. */
  readonly onFailure?: (failure: Failure) => boolean;
  /** A second button that does not send: to give up. */
  readonly secondary?: { readonly label: string; readonly onClick: () => void };
}

/**
 * A form with one field, for an amount of money. The amount goes to the API as the text that the person wrote,
 * trimmed, and the API decides whether it is valid (BR-09 of feature 09, BR-05 of feature 10). An empty field is not
 * sent and says so (BR-14). What was written stays in the field when the request fails, and the button cannot be
 * used while a request is in progress (BR-11).
 */
export function AmountForm<T>({ id, label, texts, send, failureAction, onDone, onFailure, secondary }: Props<T>) {
  const [amount, setAmount] = useState("");
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { submit, pending } = useSubmit(send);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const target = amount.trim();
    setMissing(target === "");
    if (target === "") return;
    const result = await submit(target);
    if (result === undefined) return;
    if (result.ok) onDone(result.data);
    else if (onFailure?.(result.failure) !== true) setError(messageFor(failureAction, result.failure));
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        aria-invalid={missing}
        aria-describedby={missing ? `${id}-missing` : undefined}
      />
      {missing && (
        <p id={`${id}-missing`} role="alert" className="error">
          {texts.missing}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? texts.submitting : texts.submit}
      </button>
      {secondary !== undefined && (
        <button type="button" onClick={secondary.onClick} disabled={pending}>
          {secondary.label}
        </button>
      )}
    </form>
  );
}
