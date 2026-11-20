import type { ReactNode } from "react";

interface Props {
  /** `li` for a card that is an item of a list. */
  readonly as?: "div" | "li";
  readonly className?: string;
  readonly children: ReactNode;
}

/** A surface that holds one thing: a Listing, an alert or a Notification. */
export function Card({ as: Tag = "div", className = "", children }: Props) {
  return <Tag className={`rounded-xl border border-line bg-surface p-4 shadow-sm ${className}`}>{children}</Tag>;
}
