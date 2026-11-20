import { Price } from "../../shared/domain";
import { CurrencyMismatch, NonPositiveTargetPrice } from "./errors";

/** The Price at which a User wants to be notified. */
export class TargetPrice {
  private constructor(readonly price: Price) {}

  /** BR-03: the Target Price must be greater than zero. */
  static of(price: Price): TargetPrice {
    if (price.minorUnits <= 0) throw new NonPositiveTargetPrice(price.toDecimalString());
    return new TargetPrice(price);
  }

  static fromDecimalString(amount: string, currency: string): TargetPrice {
    return TargetPrice.of(Price.fromDecimalString(amount, currency));
  }

  get currency(): string {
    return this.price.currency;
  }

  toDecimalString(): string {
    return this.price.toDecimalString();
  }

  /** Target reached: the Current Price is less than or equal to the Target Price (BR-05). */
  isReachedBy(currentPrice: Price): boolean {
    if (currentPrice.currency !== this.currency) {
      throw new CurrencyMismatch(currentPrice.currency, this.currency);
    }
    return currentPrice.minorUnits <= this.price.minorUnits;
  }

  equals(other: TargetPrice): boolean {
    return this.price.equals(other.price);
  }
}
