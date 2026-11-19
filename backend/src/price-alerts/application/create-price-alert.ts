/** UC-01 Create Price Alert (see the use case contract). */

import { InvalidValue, type ListingId } from "../../shared/domain";
import {
  PriceAlert,
  TargetAlreadyReached as DomainTargetAlreadyReached,
  TargetPrice,
  newAlertId,
  type UserId,
} from "../domain";
import { DuplicateAlert, InvalidTargetPrice, ListingNotFound, TargetAlreadyReached } from "./errors";
import { ActiveAlertAlreadyExists, type ListingReader, type PriceAlertRepository } from "./ports";

export interface CreatePriceAlertCommand {
  /** Comes from the authentication of the request, never from the client. */
  readonly owner: UserId;
  readonly listingId: ListingId;
  /** Only the amount, as text such as "80.00". The currency is the one of the Listing. */
  readonly targetAmount: string;
}

export interface PriceAlertView {
  readonly id: string;
  readonly listingId: string;
  readonly targetAmount: string;
  readonly currency: string;
  readonly status: string;
}

export interface CreatePriceAlertResult {
  readonly alert: PriceAlertView;
  /** false when an existing Active Price Alert was returned (BR-08). */
  readonly created: boolean;
}

export class CreatePriceAlert {
  constructor(
    private readonly listings: ListingReader,
    private readonly alerts: PriceAlertRepository,
  ) {}

  async execute(command: CreatePriceAlertCommand): Promise<CreatePriceAlertResult> {
    // 1. The Listing exists (BR-02)
    const listing = await this.listings.get(command.listingId);
    if (listing === null) throw new ListingNotFound(command.listingId);

    // 2. The Target Price is valid, in the currency of the Listing (BR-03, BR-04)
    let target: TargetPrice;
    try {
      target = TargetPrice.fromDecimalString(command.targetAmount, listing.currency);
    } catch (error) {
      if (error instanceof InvalidValue) {
        throw new InvalidTargetPrice(error.message, { cause: error });
      }
      throw error; // e.g. an unsupported currency of the catalogue: an internal error
    }

    // Two attempts: if adding fails because of a concurrent request, repeat from step 3.
    for (let attempt = 0; attempt < 2; attempt++) {
      // 3. An Active Price Alert may already exist (BR-07, BR-08).
      //    This comes before step 4, so BR-08 takes precedence over BR-05.
      const existing = await this.alerts.findActive(command.owner, command.listingId);
      if (existing !== null) {
        if (existing.targetPrice.equals(target)) {
          return { alert: toView(existing), created: false };
        }
        throw new DuplicateAlert();
      }

      // 4. The Target Price is not already reached (BR-05, BR-06), and the alert is Active (BR-09)
      let alert: PriceAlert;
      try {
        alert = PriceAlert.create({
          id: newAlertId(),
          owner: command.owner,
          listingId: command.listingId,
          targetPrice: target,
          currentPrice: listing.currentPrice,
        });
      } catch (error) {
        if (error instanceof DomainTargetAlreadyReached) {
          throw new TargetAlreadyReached(error.message, { cause: error });
        }
        throw error;
      }

      // 5. Store it. Persistence guarantees uniqueness if two requests race.
      try {
        await this.alerts.add(alert);
      } catch (error) {
        if (error instanceof ActiveAlertAlreadyExists) continue;
        throw error;
      }
      return { alert: toView(alert), created: true };
    }

    throw new Error("Could not create the Price Alert: repeated concurrent conflicts");
  }
}

function toView(alert: PriceAlert): PriceAlertView {
  return {
    id: alert.id,
    listingId: alert.listingId,
    targetAmount: alert.targetPrice.toDecimalString(),
    currency: alert.targetPrice.currency,
    status: alert.status,
  };
}
