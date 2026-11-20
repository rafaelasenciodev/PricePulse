import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

const BASE =
  "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Readonly<Record<Variant, string>> = {
  primary: "border-accent bg-accent text-accent-ink hover:opacity-90",
  secondary: "border-line bg-surface text-ink hover:bg-page",
};

/** The classes of a button, for a link that has to look like one. */
export const buttonClasses = (variant: Variant = "primary") => `${BASE} ${VARIANTS[variant]}`;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
}

/** The button of the interface. It is a `button` that does not send a form unless it says `type="submit"`. */
export function Button({ variant = "primary", type = "button", className = "", ...rest }: Props) {
  return <button type={type} className={`${buttonClasses(variant)} ${className}`} {...rest} />;
}
