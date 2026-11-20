import type { InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  readonly id: string;
  readonly label: string;
  /** What is wrong with the field. It is announced, and it marks the field as not valid. */
  readonly error?: string | undefined;
}

/** A label, its input and the message of what is wrong with it. The message has the id `<id>-missing`. */
export function Field({ id, label, error, className = "", ...rest }: Props) {
  const errorId = `${id}-missing`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
        className={`rounded-lg border bg-surface px-3 py-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent ${
          error !== undefined ? "border-danger" : "border-line"
        } ${className}`}
        {...rest}
      />
      {error !== undefined && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
