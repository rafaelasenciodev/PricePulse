import type { CurrentPrice } from "../api";

/** An amount as the API gives it, with its currency. It is never turned into a number. */
export function formatPrice(price: Pick<CurrentPrice, "amount" | "currency">): string {
  return `${price.amount} ${price.currency}`;
}

const instant = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** An instant with the format of the browser. What is not a date is shown as it came. */
export function formatInstant(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : instant.format(date);
}
