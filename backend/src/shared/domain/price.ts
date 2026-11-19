import { InvalidAmount, TooManyDecimals, UnsupportedCurrency } from "./errors";

// Decimal places allowed by each supported currency.
// Supporting another currency means adding a line here.
const DECIMALS_BY_CURRENCY: Readonly<Record<string, number>> = { EUR: 2, USD: 2 };

function decimalsOf(currency: string): number {
  const decimals = DECIMALS_BY_CURRENCY[currency];
  if (decimals === undefined) throw new UnsupportedCurrency(currency);
  return decimals;
}

/**
 * An amount of money in a currency.
 *
 * The amount is stored as an integer number of minor units (8000 for 80.00 EUR),
 * so there is no floating-point error. Use the factory methods to create one.
 */
export class Price {
  private constructor(
    readonly minorUnits: number,
    readonly currency: string,
  ) {}

  static fromMinorUnits(minorUnits: number, currency: string): Price {
    decimalsOf(currency);
    if (!Number.isSafeInteger(minorUnits)) throw new InvalidAmount(String(minorUnits));
    return new Price(minorUnits, currency);
  }

  /**
   * Parse a decimal written as text, such as "80", "80.5" or "80.00".
   *
   * Strict: only digits, an optional leading minus and an optional fraction.
   * "80.000" is accepted for EUR because it is numerically 80.00; "79.999" is not.
   */
  static fromDecimalString(amount: string, currency: string): Price {
    const decimals = decimalsOf(currency);
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount);
    if (match === null) throw new InvalidAmount(amount);

    const negative = match[1] === "-";
    const whole = match[2] ?? "0";
    const fraction = match[3] ?? "";

    if (/[^0]/.test(fraction.slice(decimals))) {
      throw new TooManyDecimals(amount, currency, decimals);
    }
    const digits = whole + fraction.slice(0, decimals).padEnd(decimals, "0");
    const magnitude = BigInt(digits);
    if (magnitude > BigInt(Number.MAX_SAFE_INTEGER)) throw new InvalidAmount(amount);

    return new Price(negative ? -Number(magnitude) : Number(magnitude), currency);
  }

  /** The amount as text with the decimals of the currency, such as "80.00". */
  toDecimalString(): string {
    const decimals = decimalsOf(this.currency);
    const digits = String(Math.abs(this.minorUnits)).padStart(decimals + 1, "0");
    const whole = digits.slice(0, digits.length - decimals);
    const fraction = digits.slice(digits.length - decimals);
    const sign = this.minorUnits < 0 ? "-" : "";
    return decimals === 0 ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
  }

  equals(other: Price): boolean {
    return this.minorUnits === other.minorUnits && this.currency === other.currency;
  }
}
